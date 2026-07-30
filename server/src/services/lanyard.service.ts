import { logger } from '../config/logger';
import { obtenerConCache } from './cache.service';

/**
 * Presencia de Discord en vivo, vía Lanyard (Fase 6).
 *
 * Lanyard (https://github.com/Phineas/lanyard) es un servicio público que
 * expone la presencia de Discord de cualquiera que esté en su servidor.
 * Se eligió frente a un bot propio por una razón práctica: leer presencia
 * exige el intent privilegiado GUILD_PRESENCES y un bot que comparta
 * servidor con el usuario. Para una plataforma donde cada usuario está en
 * servidores distintos, eso no escala; Lanyard ya resolvió ese problema.
 *
 * El precio, y hay que ser honestos en la UI: **solo funciona si el
 * usuario se une a `discord.gg/UrXF2cfJ7F`**. Quien no esté, no tiene
 * presencia, y eso se muestra como una instrucción, no como un error.
 *
 * Se usa la API REST y no el WebSocket: el perfil no es una app en vivo
 * abierta durante horas, y un socket por visitante sería mucho más caro
 * que una lectura cacheada. La regla de la Fase 5 sigue en pie — **el
 * render nunca sale a la red**: esto pasa por `obtenerConCache`, con su
 * TTL y su circuit breaker.
 */

const API = 'https://api.lanyard.rest/v1';
const TIMEOUT_MS = 6_000;

/** TTL corto: la gracia de esto es que sea "en vivo". Un minuto mantiene
 *  la sensación de inmediatez sin martillear un servicio gratuito ajeno. */
export const TTL_PRESENCIA = 60_000;

class ErrorLanyard extends Error {}

// ─────────────────────────────────────────────────────────────────────
//  Formas públicas
// ─────────────────────────────────────────────────────────────────────

export interface ActividadDiscord {
  nombre: string;
  /** 0 jugando · 1 streaming · 2 escuchando · 3 viendo · 4 custom · 5 compitiendo */
  tipo: number;
  detalles: string | null;
  estado: string | null;
  imagenGrande: string | null;
  /** Epoch ms de inicio, para pintar "llevas 2 h 15 min". */
  desde: number | null;
}

export interface CancionSpotify {
  cancion: string;
  artista: string;
  album: string | null;
  portada: string | null;
  inicio: number | null;
  fin: number | null;
}

export interface PresenciaDiscord {
  /** online | idle | dnd | offline */
  estado: string;
  nombre: string | null;
  avatar: string | null;
  actividades: ActividadDiscord[];
  spotify: CancionSpotify | null;
  /** `false` cuando Lanyard no conoce a este usuario: casi siempre porque
   *  no se ha unido al servidor. Es la diferencia entre "está desconectado"
   *  y "no podemos verlo", y la UI dice cosas distintas en cada caso. */
  monitorizado: boolean;
}

const texto = (valor: unknown, max: number): string | null =>
  typeof valor === 'string' && valor.trim() !== '' ? valor.trim().slice(0, max) : null;

/**
 * Los assets de actividad vienen como `mp:external/…` o como un id del CDN
 * de Discord. Solo se aceptan las formas conocidas y siempre se construye
 * la URL nosotros: nunca se pinta una URL arbitraria que venga del
 * proveedor, porque acaba en un `<img>` de todos los visitantes.
 */
function imagenActividad(appId: unknown, imagen: unknown): string | null {
  if (typeof imagen !== 'string') return null;

  // Imagen re-hospedada por Discord desde un host externo.
  const externa = /^mp:external\/([\w-]+)\/(https?)\/(.+)$/.exec(imagen);
  if (externa) {
    return `https://media.discordapp.net/external/${externa[1]}/${externa[2]}/${externa[3]}`;
  }

  // Asset propio de la aplicación: id hexadecimal + app id numérico.
  if (typeof appId === 'string' && /^\d{5,25}$/.test(appId) && /^[a-f0-9_]{5,64}$/i.test(imagen)) {
    return `https://cdn.discordapp.com/app-assets/${appId}/${imagen}.png`;
  }

  return null;
}

function mapearActividad(bruta: Record<string, unknown>): ActividadDiscord | null {
  const nombre = texto(bruta['name'], 80);
  if (!nombre) return null;

  const tipo = typeof bruta['type'] === 'number' ? bruta['type'] : 0;
  const assets = (bruta['assets'] ?? {}) as Record<string, unknown>;
  const timestamps = (bruta['timestamps'] ?? {}) as Record<string, unknown>;

  return {
    nombre,
    tipo,
    detalles: texto(bruta['details'], 120),
    estado: texto(bruta['state'], 120),
    imagenGrande: imagenActividad(bruta['application_id'], assets['large_image']),
    desde: typeof timestamps['start'] === 'number' ? timestamps['start'] : null,
  };
}

function mapearSpotify(bruto: unknown): CancionSpotify | null {
  if (typeof bruto !== 'object' || bruto === null) return null;
  const s = bruto as Record<string, unknown>;

  const cancion = texto(s['song'], 120);
  const artista = texto(s['artist'], 120);
  if (!cancion || !artista) return null;

  // La portada viene del CDN de Spotify. Se comprueba el host porque va a
  // un <img>, y `i.scdn.co` es justo lo que la CSP permite.
  const portadaBruta = s['album_art_url'];
  const portada =
    typeof portadaBruta === 'string' && /^https:\/\/i\.scdn\.co\//.test(portadaBruta)
      ? portadaBruta
      : null;

  const timestamps = (s['timestamps'] ?? {}) as Record<string, unknown>;

  return {
    cancion,
    artista,
    album: texto(s['album'], 120),
    portada,
    inicio: typeof timestamps['start'] === 'number' ? timestamps['start'] : null,
    fin: typeof timestamps['end'] === 'number' ? timestamps['end'] : null,
  };
}

/** Un snowflake de Discord: entero decimal. Se valida antes de meterlo en
 *  una URL saliente aunque venga de nuestra propia DB. */
export function esDiscordIdValido(valor: string): boolean {
  return /^\d{5,25}$/.test(valor);
}

// ─────────────────────────────────────────────────────────────────────
//  Llamada
// ─────────────────────────────────────────────────────────────────────

async function traerPresencia(discordId: string): Promise<PresenciaDiscord> {
  const respuesta = await fetch(`${API}/users/${discordId}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  /*
   * Un 404 significa "este usuario no está en el servidor de Lanyard". No
   * es un fallo del servicio: es una respuesta legítima y estable. Se
   * devuelve como `monitorizado: false` en vez de lanzar, porque lanzar
   * marcaría la caché como rota y dispararía el circuit breaker por algo
   * que no se va a arreglar reintentando.
   */
  if (respuesta.status === 404) {
    return {
      estado: 'offline',
      nombre: null,
      avatar: null,
      actividades: [],
      spotify: null,
      monitorizado: false,
    };
  }

  if (!respuesta.ok) throw new ErrorLanyard(`Lanyard respondió ${respuesta.status}`);

  const cuerpo = (await respuesta.json()) as { success?: boolean; data?: Record<string, unknown> };
  if (!cuerpo.success || !cuerpo.data) throw new ErrorLanyard('Lanyard devolvió una respuesta vacía.');

  const d = cuerpo.data;
  const usuario = (d['discord_user'] ?? {}) as Record<string, unknown>;

  const id = texto(usuario['id'], 25);
  const hashAvatar = usuario['avatar'];
  const avatar =
    id &&
    esDiscordIdValido(id) &&
    typeof hashAvatar === 'string' &&
    /^[a-f0-9_]{1,64}$/i.test(hashAvatar)
      ? `https://cdn.discordapp.com/avatars/${id}/${hashAvatar}.png?size=256`
      : null;

  const actividadesBrutas = Array.isArray(d['activities']) ? (d['activities'] as unknown[]) : [];

  return {
    estado: texto(d['discord_status'], 16) ?? 'offline',
    nombre: texto(usuario['global_name'], 60) ?? texto(usuario['username'], 60),
    avatar,
    actividades: actividadesBrutas
      .filter((a): a is Record<string, unknown> => typeof a === 'object' && a !== null)
      // El tipo 4 es el "estado personalizado", que no es una actividad y
      // se pintaría como si el usuario estuviera jugando a su propia frase.
      .filter((a) => a['type'] !== 4)
      .map(mapearActividad)
      .filter((a): a is ActividadDiscord => a !== null)
      .slice(0, 4),
    spotify: mapearSpotify(d['spotify']),
    monitorizado: true,
  };
}

// ─────────────────────────────────────────────────────────────────────
//  API del servicio (cacheada)
// ─────────────────────────────────────────────────────────────────────

export interface DatosDiscordPerfil {
  presencia: PresenciaDiscord | null;
  actualizadoEn: string | null;
  hayDatosViejos: boolean;
}

export async function datosDiscordDe(
  userId: string,
  discordId: string,
  opciones: { forzar?: boolean } = {}
): Promise<DatosDiscordPerfil> {
  if (!esDiscordIdValido(discordId)) {
    logger.warn({ userId }, 'ID de Discord inválido en la DB; se omite la consulta');
    return { presencia: null, actualizadoEn: null, hayDatosViejos: false };
  }

  const resultado = await obtenerConCache<PresenciaDiscord>({
    userId,
    proveedor: 'discord',
    clave: 'presencia',
    ttlMs: TTL_PRESENCIA,
    forzar: opciones.forzar ?? false,
    traer: () => traerPresencia(discordId),
  });

  return {
    presencia: resultado?.datos ?? null,
    actualizadoEn: resultado?.obtenidoEn.toISOString() ?? null,
    hayDatosViejos: resultado?.estado === 'viejo',
  };
}
