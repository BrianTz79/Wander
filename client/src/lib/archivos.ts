import { api } from './api';

/**
 * Subida de archivos y buscador de GIFs en el cliente (Fase 8).
 *
 * La subida va **separada** de enviar el mensaje o la publicación: se sube
 * al elegir el archivo y se manda solo el id al enviar. Así se puede ver la
 * miniatura mientras se escribe, y una foto de 6 MB no bloquea el envío.
 */

// ── Tipos ────────────────────────────────────────────────────────────

export interface Adjunto {
  id: string;
  url: string;
  miniaturaUrl: string | null;
  mime: string;
  bytes: number;
  ancho: number | null;
  alto: number | null;
  externo: boolean;
}

export interface Gif {
  id: string;
  titulo: string;
  url: string;
  vistaPrevia: string;
  ancho: number;
  alto: number;
}

export interface LimitesSubida {
  maxBytes: number;
  maxAdjuntos: number;
  /** Si el servidor tiene GIPHY_API_KEY. Con `false`, el botón de GIF no se
   *  pinta: un botón que siempre falla es peor que no tenerlo. */
  gifs: boolean;
}

/** Uso del archivo. Espeja el enum cerrado del backend. */
export type UsoArchivo = 'adjunto' | 'publicacion' | 'icono-grupo' | 'avatar' | 'banner';

// ── Llamadas ─────────────────────────────────────────────────────────

export const archivos = {
  /**
   * Sube archivos y devuelve sus adjuntos ya registrados.
   *
   * `Content-Type` se pone a `undefined` a propósito: axios tiene puesto
   * `application/json` por defecto, y con un `FormData` hay que dejar que
   * el navegador escriba la cabecera él mismo. Solo él conoce el `boundary`
   * que separa las partes, y sin ese valor el servidor no puede parsear
   * nada.
   */
  subir: (ficheros: File[], uso: UsoArchivo = 'adjunto') => {
    const cuerpo = new FormData();
    for (const f of ficheros) cuerpo.append('archivos', f);
    cuerpo.append('uso', uso);

    return api
      .post<{ archivos: Adjunto[] }>('/archivos', cuerpo, {
        headers: { 'Content-Type': undefined },
        // Subir por datos móviles es lento; el timeout general de 20 s
        // cortaría subidas legítimas a mitad.
        timeout: 120_000,
      })
      .then((r) => r.data.archivos);
  },

  /** Descarta un adjunto que todavía no se envió. */
  descartar: (id: string) => api.delete(`/archivos/${id}`).then(() => undefined),

  buscarGifs: (q: string) =>
    api.get<{ gifs: Gif[] }>('/archivos/gifs', { params: q ? { q } : {} }).then((r) => r.data.gifs),

  /** Registra un GIF elegido como adjunto (solo se guarda su URL). */
  elegirGif: (gif: Gif) =>
    api
      .post<{ archivo: Adjunto }>('/archivos/gif', {
        url: gif.url,
        miniaturaUrl: gif.vistaPrevia,
        ancho: gif.ancho,
        alto: gif.alto,
      })
      .then((r) => r.data.archivo),

  limites: () => api.get<LimitesSubida>('/archivos/limites').then((r) => r.data),
};

// ── Ayudantes ────────────────────────────────────────────────────────

export const esImagen = (mime: string): boolean => mime.startsWith('image/');
export const esVideo = (mime: string): boolean => mime.startsWith('video/');
export const esAudio = (mime: string): boolean => mime.startsWith('audio/');

/**
 * Tamaño legible. Usa `Intl.NumberFormat` para el decimal, que cambia entre
 * idiomas (1.5 MB en inglés, 1,5 MB en español).
 */
export function tamanoLegible(bytes: number, idioma: string): string {
  if (bytes < 1024) return `${bytes} B`;

  const unidades = ['KB', 'MB', 'GB'];
  let valor = bytes / 1024;
  let i = 0;
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024;
    i++;
  }

  const formato = new Intl.NumberFormat(idioma, { maximumFractionDigits: 1 });
  return `${formato.format(valor)} ${unidades[i]}`;
}
