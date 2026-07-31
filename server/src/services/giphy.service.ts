import { env } from '../config/env';
import { logger } from '../config/logger';
import { errores } from '../middlewares/errores.middleware';

/**
 * Buscador de GIFs vía Giphy (Fase 8).
 *
 * **Por qué esto pasa por el servidor y no lo llama el navegador.** La
 * clave de Giphy es nuestra: si el cliente hiciera la petición, la clave
 * viajaría en el bundle de JavaScript, o sea que sería pública, y
 * cualquiera podría gastarnos la cuota. Además, con el proxy la CSP puede
 * seguir teniendo `connect-src 'self'`: el navegador no habla con ningún
 * host de terceros.
 *
 * De la respuesta de Giphy **no se pasa nada tal cual**. Cada resultado se
 * recorta a la forma mínima que el selector necesita, igual que se hace con
 * Steam en la Fase 5: si mañana Giphy añade un campo nuevo, no acaba
 * publicado por accidente.
 */

const API = 'https://api.giphy.com/v1/gifs';
const TIMEOUT_MS = 6_000;

/**
 * Clasificación de contenido. `g` es "apto para todos los públicos" y es lo
 * correcto por defecto: un buscador de GIFs dentro de un chat, sin
 * verificación de edad y con perfiles públicos, no es sitio para material
 * adulto. Giphy lo aplica en su lado, que es donde tiene que aplicarse.
 */
const CLASIFICACION = 'g';

/** Cuántos GIFs devuelve una búsqueda. Suficiente para llenar el panel sin
 *  descargar decenas de imágenes que nadie va a mirar. */
const LIMITE = 24;

// ─────────────────────────────────────────────────────────────────────
//  Forma pública
// ─────────────────────────────────────────────────────────────────────

export interface GifResultado {
  id: string;
  /** Título, para el texto alternativo. Un GIF sin `alt` es invisible para
   *  quien usa lector de pantalla. */
  titulo: string;
  /** La versión que se envía al enviarlo. */
  url: string;
  /** Versión ligera para la cuadrícula del selector. */
  vistaPrevia: string;
  ancho: number;
  alto: number;
}

// ─────────────────────────────────────────────────────────────────────
//  Caché en memoria
// ─────────────────────────────────────────────────────────────────────

/**
 * Caché por término de búsqueda, en memoria y no en Postgres.
 *
 * A diferencia de las cachés de la Fase 5, esto no cuelga de ningún
 * usuario: "gg" devuelve lo mismo para todo el mundo, así que la clave
 * natural es el propio término. Y no vale la pena una tabla — es un dato
 * enteramente prescindible que se puede volver a pedir, y perderlo al
 * reiniciar no tiene ninguna consecuencia.
 *
 * El tope de entradas es lo que evita que esto crezca sin límite: sin él,
 * buscar cadenas aleatorias en bucle sería una fuga de memoria a petición.
 */
const TTL_MS = 10 * 60_000;
const MAX_ENTRADAS = 200;

const cache = new Map<string, { expira: number; datos: GifResultado[] }>();

function leerCache(clave: string): GifResultado[] | null {
  const entrada = cache.get(clave);
  if (!entrada) return null;
  if (entrada.expira < Date.now()) {
    cache.delete(clave);
    return null;
  }
  return entrada.datos;
}

function guardarCache(clave: string, datos: GifResultado[]): void {
  // Se desaloja la entrada más vieja (Map itera en orden de inserción).
  if (cache.size >= MAX_ENTRADAS) {
    const primera = cache.keys().next().value;
    if (primera !== undefined) cache.delete(primera);
  }
  cache.set(clave, { expira: Date.now() + TTL_MS, datos });
}

// ─────────────────────────────────────────────────────────────────────
//  Recorte
// ─────────────────────────────────────────────────────────────────────

/** Forma cruda de Giphy, solo con lo que se lee. */
interface GifCrudo {
  id?: unknown;
  title?: unknown;
  images?: {
    downsized_medium?: { url?: unknown; width?: unknown; height?: unknown };
    fixed_height?: { url?: unknown; width?: unknown; height?: unknown };
    fixed_width_small?: { url?: unknown };
    preview_gif?: { url?: unknown };
  };
}

const texto = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
const entero = (v: unknown): number => {
  const n = typeof v === 'string' ? Number.parseInt(v, 10) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : 0;
};

/**
 * Convierte un resultado de Giphy en nuestra forma, o `null` si le falta lo
 * indispensable.
 *
 * Devolver `null` en vez de rellenar con valores por defecto es
 * deliberado: un GIF sin URL no es un GIF con URL vacía, es un resultado
 * que no sirve y que es mejor no pintar.
 */
function recortar(crudo: GifCrudo): GifResultado | null {
  const id = texto(crudo.id);
  const imagenes = crudo.images;
  if (!id || !imagenes) return null;

  const completa = imagenes.downsized_medium ?? imagenes.fixed_height;
  const url = texto(completa?.url);
  if (!url) return null;

  const vistaPrevia =
    texto(imagenes.fixed_width_small?.url) ?? texto(imagenes.preview_gif?.url) ?? url;

  return {
    id,
    titulo: texto(crudo.title) ?? 'GIF',
    url,
    vistaPrevia,
    ancho: entero(completa?.width),
    alto: entero(completa?.height),
  };
}

// ─────────────────────────────────────────────────────────────────────
//  Llamada
// ─────────────────────────────────────────────────────────────────────

async function pedir(ruta: string, params: Record<string, string>): Promise<GifResultado[]> {
  const url = new URL(`${API}/${ruta}`);
  url.searchParams.set('api_key', env.GIPHY_API_KEY!);
  url.searchParams.set('limit', String(LIMITE));
  url.searchParams.set('rating', CLASIFICACION);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  // `AbortSignal.timeout` en vez de dejar la petición colgada: sin él, si
  // Giphy tarda, la petición del usuario se queda esperando indefinidamente
  // y ocupa una conexión.
  const respuesta = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: 'application/json' },
  });

  if (!respuesta.ok) {
    throw new Error(`Giphy respondió ${respuesta.status}`);
  }

  const cuerpo = (await respuesta.json()) as { data?: unknown };
  if (!Array.isArray(cuerpo.data)) return [];

  return cuerpo.data
    .map((g) => recortar(g as GifCrudo))
    .filter((g): g is GifResultado => g !== null);
}

/**
 * Busca GIFs, o devuelve los populares si no hay término.
 *
 * Si Giphy falla no se propaga el error: se devuelve una lista vacía. Un
 * selector de GIFs caído es una molestia, no un motivo para que el mensaje
 * que alguien estaba escribiendo se pierda tras un 500.
 */
export async function buscarGifs(termino: string): Promise<GifResultado[]> {
  if (!env.integraciones.giphy) {
    throw errores.invalido('El buscador de GIFs no está configurado en este servidor.');
  }

  const clave = termino.trim().toLowerCase();
  const enCache = leerCache(clave);
  if (enCache) return enCache;

  try {
    const datos = clave
      ? await pedir('search', { q: clave, lang: 'es' })
      : await pedir('trending', {});
    guardarCache(clave, datos);
    return datos;
  } catch (error) {
    logger.warn({ error, termino: clave }, 'Fallo al consultar Giphy');
    return [];
  }
}
