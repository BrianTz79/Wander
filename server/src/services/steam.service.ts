import { env } from '../config/env';
import { logger } from '../config/logger';
import { obtenerConCache, type ResultadoCache } from './cache.service';

/**
 * Datos de Steam para los bloques del perfil (Fase 5).
 *
 * Tres ideas que gobiernan este archivo:
 *
 *  1. **Nada de lo que devuelve Steam se pasa tal cual al cliente.** Cada
 *     respuesta se recorta a una forma nuestra (`JuegoSteam`, etc.). Así un
 *     campo nuevo del proveedor no acaba publicado por accidente, y el
 *     contrato con el frontend no depende de que Valve no cambie nada.
 *
 *  2. **`vacBanned` no se publica** (decisión de §2 de PROYECTO.md). No es
 *     que se omita al pintar: no entra en la estructura, así que no está en
 *     la respuesta HTTP ni en la fila de `CacheExterno`. Un dato que no se
 *     guarda no se puede filtrar por descuido más tarde.
 *
 *  3. **Un fallo de Steam nunca es un error de Wander.** Estas funciones
 *     lanzan; quien las llama lo hace a través de `cache.service`, que
 *     responde con lo último bueno que tenga.
 */

const API = 'https://api.steampowered.com';

/** Steam puede tardar; sin timeout, una petición colgada bloquea un
 *  worker de Node hasta que el cliente se rinda. */
const TIMEOUT_MS = 8_000;

// ── TTLs ─────────────────────────────────────────────────────────────
// Cada dato caduca según lo rápido que cambie de verdad. Las horas
// jugadas se mueven a diario; el nivel y el total de juegos, casi nunca.
export const TTL = {
  resumen: 15 * 60_000, // estado en línea y avatar
  recientes: 30 * 60_000, // jugado en 2 semanas
  juegos: 6 * 60 * 60_000, // biblioteca y horas totales
  nivel: 24 * 60 * 60_000,
} as const;

// ─────────────────────────────────────────────────────────────────────
//  Utilidades
// ─────────────────────────────────────────────────────────────────────

class ErrorSteam extends Error {}

/** GET a la Web API con timeout y errores explícitos. */
async function pedir(ruta: string, parametros: Record<string, string>): Promise<unknown> {
  if (!env.STEAM_API_KEY) throw new ErrorSteam('Sin STEAM_API_KEY configurada.');

  const url = new URL(ruta, API);
  url.searchParams.set('key', env.STEAM_API_KEY);
  for (const [clave, valor] of Object.entries(parametros)) url.searchParams.set(clave, valor);

  const respuesta = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: 'application/json' },
  });

  if (!respuesta.ok) {
    // El cuerpo del error puede traer la API key en un eco de la URL: no
    // se registra, solo el código.
    throw new ErrorSteam(`Steam respondió ${respuesta.status}`);
  }
  return respuesta.json();
}

/**
 * Hosts de imagen permitidos. La lista debe coincidir con `img-src` de la
 * CSP en nginx.conf: si aceptamos aquí un host que la CSP no lista, la
 * imagen se bloquea en el navegador y el fallo solo se ve en la consola.
 */
const RE_HOST_IMAGEN =
  /^https:\/\/(?:[a-z0-9-]+\.)*(?:steamstatic\.com|akamaihd\.net|steampowered\.com)\//;

/** Solo se deja pasar una URL de imagen si viene de un host de Valve:
 *  acaba en un `<img>` que cargan todos los visitantes del perfil. */
function imagenSegura(url: unknown): string | null {
  return typeof url === 'string' && RE_HOST_IMAGEN.test(url) ? url : null;
}

/** Un SteamID64 válido: 17 dígitos empezando por 7656119. Se valida antes
 *  de meterlo en una URL saliente aunque venga de nuestra propia DB. */
export function esSteamIdValido(valor: string): boolean {
  return /^7656119\d{10}$/.test(valor);
}

const texto = (valor: unknown, max: number): string | null =>
  typeof valor === 'string' && valor.trim() !== '' ? valor.trim().slice(0, max) : null;

const entero = (valor: unknown): number =>
  typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 ? Math.floor(valor) : 0;

// ─────────────────────────────────────────────────────────────────────
//  Formas públicas (lo que ve el cliente)
// ─────────────────────────────────────────────────────────────────────

export interface ResumenPerfilSteam {
  steamId: string;
  nombre: string | null;
  avatar: string | null;
  urlPerfil: string | null;
  /** 0 desconectado · 1 conectado · 2 ocupado · 3 ausente · 4-6 otros */
  estado: number;
  /** `false` si el perfil de Steam es privado: entonces no habrá juegos ni
   *  horas, y conviene decírselo al usuario en vez de mostrar ceros. */
  publico: boolean;
  paisCodigo: string | null;
  miembroDesde: number | null;
}

export interface JuegoSteam {
  appid: number;
  nombre: string;
  /** Minutos, como los da Steam. La conversión a horas es del cliente. */
  minutosTotales: number;
  minutosDosSemanas: number;
  /** Carátula del CDN. `null` si Steam no da icono para ese appid. */
  portada: string | null;
  icono: string | null;
  ultimaVez: number | null;
}

export interface EstadisticasSteam {
  totalJuegos: number;
  minutosTotales: number;
  nivel: number | null;
}

// ─────────────────────────────────────────────────────────────────────
//  Llamadas concretas
// ─────────────────────────────────────────────────────────────────────

async function traerResumen(steamId: string): Promise<ResumenPerfilSteam> {
  const datos = (await pedir('/ISteamUser/GetPlayerSummaries/v2/', { steamids: steamId })) as {
    response?: { players?: Array<Record<string, unknown>> };
  };

  const jugador = datos.response?.players?.[0];
  if (!jugador) throw new ErrorSteam('Steam no devolvió el jugador.');

  /*
   * Aquí está la decisión de §2 en código: `GetPlayerBans` NO se llama y
   * `VACBanned` no se copia. La cuenta de pruebas tiene un ban de 2016, así
   * que esto no es teórico — si el campo se colara, saldría publicado en un
   * perfil real.
   */
  return {
    steamId,
    nombre: texto(jugador['personaname'], 60),
    avatar: imagenSegura(jugador['avatarfull']),
    urlPerfil: texto(jugador['profileurl'], 200),
    estado: entero(jugador['personastate']),
    // 3 = público. Con 1 (privado) la biblioteca viene vacía.
    publico: entero(jugador['communityvisibilitystate']) === 3,
    paisCodigo: texto(jugador['loccountrycode'], 2),
    miembroDesde: entero(jugador['timecreated']) || null,
  };
}

/** Carátula ancha del juego. Se construye a partir del appid, que es un
 *  número validado, no una URL que venga del proveedor. */
function portadaDe(appid: number): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

function iconoDe(appid: number, hash: unknown): string | null {
  // El hash es hexadecimal; comprobarlo evita construir una URL con
  // cualquier cosa que venga en ese campo.
  if (typeof hash !== 'string' || !/^[a-f0-9]{20,64}$/i.test(hash)) return null;
  return `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${appid}/${hash}.jpg`;
}

function mapearJuego(bruto: Record<string, unknown>): JuegoSteam | null {
  const appid = entero(bruto['appid']);
  const nombre = texto(bruto['name'], 120);
  // Sin appid o sin nombre no hay nada que pintar.
  if (!appid || !nombre) return null;

  return {
    appid,
    nombre,
    minutosTotales: entero(bruto['playtime_forever']),
    minutosDosSemanas: entero(bruto['playtime_2weeks']),
    portada: portadaDe(appid),
    icono: iconoDe(appid, bruto['img_icon_url']),
    ultimaVez: entero(bruto['rtime_last_played']) || null,
  };
}

/** Jugados en las últimas 2 semanas. Es lo que alimenta "Actividad". */
async function traerRecientes(steamId: string): Promise<JuegoSteam[]> {
  const datos = (await pedir('/IPlayerService/GetRecentlyPlayedGames/v1/', {
    steamid: steamId,
    count: '12',
  })) as { response?: { games?: Array<Record<string, unknown>> } };

  // Un perfil privado (o sin actividad) devuelve `{}`: es una respuesta
  // válida, no un fallo. Devolver [] evita marcar la caché como rota.
  const juegos = datos.response?.games ?? [];
  return juegos
    .map(mapearJuego)
    .filter((j): j is JuegoSteam => j !== null)
    .sort((a, b) => b.minutosDosSemanas - a.minutosDosSemanas)
    .slice(0, 12);
}

/**
 * Biblioteca completa. Se pide entera (900+ juegos en la cuenta de prueba)
 * pero **no se guarda entera**: §2 decidió "destacados curados + total, sin
 * biblioteca navegable". Guardar 900 objetos por usuario en `CacheExterno`
 * engordaría la DB para pintar, como mucho, doce.
 */
async function traerJuegos(steamId: string): Promise<{
  totalJuegos: number;
  minutosTotales: number;
  masJugados: JuegoSteam[];
}> {
  const datos = (await pedir('/IPlayerService/GetOwnedGames/v1/', {
    steamid: steamId,
    include_appinfo: '1',
    include_played_free_games: '1',
  })) as { response?: { game_count?: number; games?: Array<Record<string, unknown>> } };

  const brutos = datos.response?.games ?? [];
  const mapeados = brutos.map(mapearJuego).filter((j): j is JuegoSteam => j !== null);

  return {
    totalJuegos: entero(datos.response?.game_count) || mapeados.length,
    minutosTotales: mapeados.reduce((suma, j) => suma + j.minutosTotales, 0),
    masJugados: [...mapeados].sort((a, b) => b.minutosTotales - a.minutosTotales).slice(0, 24),
  };
}

async function traerNivel(steamId: string): Promise<number | null> {
  const datos = (await pedir('/IPlayerService/GetSteamLevel/v1/', { steamid: steamId })) as {
    response?: { player_level?: number };
  };
  const nivel = entero(datos.response?.player_level);
  return nivel || null;
}

// ─────────────────────────────────────────────────────────────────────
//  API del servicio (cacheada)
// ─────────────────────────────────────────────────────────────────────

/**
 * Todo lo que necesitan los tres bloques de Steam, en una sola llamada.
 *
 * Las cuatro consultas van en paralelo y **cada una con su propia caché y
 * su propio TTL**: que el nivel esté fresco no obliga a repedir la
 * biblioteca. `Promise.all` es seguro porque `obtenerConCache` no lanza —
 * devuelve `null` cuando no hay nada.
 */
export interface DatosSteamPerfil {
  resumen: ResumenPerfilSteam | null;
  recientes: JuegoSteam[];
  estadisticas: EstadisticasSteam | null;
  masJugados: JuegoSteam[];
  /** Cuándo se trajo el dato más viejo de los cuatro, para que la UI pueda
   *  decir "actualizado hace X". `null` si no hay ningún dato. */
  actualizadoEn: string | null;
  /** `true` si algo se está sirviendo de caché vencida porque Steam falló. */
  hayDatosViejos: boolean;
}

export async function datosSteamDe(
  userId: string,
  steamId: string,
  opciones: { forzar?: boolean } = {}
): Promise<DatosSteamPerfil> {
  if (!esSteamIdValido(steamId)) {
    logger.warn({ userId }, 'SteamID inválido en la DB; se omite la consulta');
    return { resumen: null, recientes: [], estadisticas: null, masJugados: [], actualizadoEn: null, hayDatosViejos: false };
  }

  const { forzar = false } = opciones;
  const base = { userId, proveedor: 'steam', forzar } as const;

  const [resumen, recientes, juegos, nivel] = await Promise.all([
    obtenerConCache<ResumenPerfilSteam>({
      ...base,
      clave: 'resumen',
      ttlMs: TTL.resumen,
      traer: () => traerResumen(steamId),
    }),
    obtenerConCache<JuegoSteam[]>({
      ...base,
      clave: 'recientes',
      ttlMs: TTL.recientes,
      traer: () => traerRecientes(steamId),
    }),
    obtenerConCache<{ totalJuegos: number; minutosTotales: number; masJugados: JuegoSteam[] }>({
      ...base,
      clave: 'juegos',
      ttlMs: TTL.juegos,
      traer: () => traerJuegos(steamId),
    }),
    obtenerConCache<number | null>({
      ...base,
      clave: 'nivel',
      ttlMs: TTL.nivel,
      traer: () => traerNivel(steamId),
    }),
  ]);

  const partes: Array<ResultadoCache<unknown> | null> = [resumen, recientes, juegos, nivel];
  const presentes = partes.filter((p): p is ResultadoCache<unknown> => p !== null);

  return {
    resumen: resumen?.datos ?? null,
    recientes: recientes?.datos ?? [],
    estadisticas: juegos
      ? {
          totalJuegos: juegos.datos.totalJuegos,
          minutosTotales: juegos.datos.minutosTotales,
          nivel: nivel?.datos ?? null,
        }
      : null,
    masJugados: juegos?.datos.masJugados ?? [],
    actualizadoEn:
      presentes.length > 0
        ? new Date(Math.min(...presentes.map((p) => p.obtenidoEn.getTime()))).toISOString()
        : null,
    hayDatosViejos: presentes.some((p) => p.estado === 'viejo'),
  };
}
