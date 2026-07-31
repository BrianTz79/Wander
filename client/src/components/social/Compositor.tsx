import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Loader2, Smile, X } from 'lucide-react';

import {
  archivos as apiArchivos,
  esImagen,
  esVideo,
  type Adjunto,
  type Gif,
  type LimitesSubida,
  type UsoArchivo,
} from '../../lib/archivos';
import { mensajeError } from '../../lib/api';
import { SelectorEmoji } from './SelectorEmoji';
import { SelectorGif } from './SelectorGif';

/**
 * Barra de herramientas del compositor: emojis, GIFs y archivos (Fase 8).
 *
 * Es un componente compartido entre el redactor del feed y el del chat.
 * Tenerlo en un solo sitio no es solo comodidad: los adjuntos tienen reglas
 * (cuántos caben, cuánto pesan, cómo se descartan) y con dos copias una de
 * las dos acabaría comportándose distinto.
 *
 * **El estado de los adjuntos vive en el padre**, que es quien envía. Este
 * componente solo los añade y los quita.
 */

interface Props {
  adjuntos: Adjunto[];
  alCambiarAdjuntos: (adjuntos: Adjunto[]) => void;
  /** Inserta texto (un emoji) en la posición del cursor del padre. */
  alInsertarTexto: (texto: string) => void;
  uso?: UsoArchivo;
  deshabilitado?: boolean;
}

export function BarraCompositor({
  adjuntos,
  alCambiarAdjuntos,
  alInsertarTexto,
  uso = 'adjunto',
  deshabilitado = false,
}: Props) {
  const { t } = useTranslation();

  const [limites, setLimites] = useState<LimitesSubida | null>(null);
  const [panelEmoji, setPanelEmoji] = useState(false);
  const [panelGif, setPanelGif] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputArchivo = useRef<HTMLInputElement>(null);

  /*
   * Los límites los manda el servidor: son suyos, y dos copias acabarían
   * diciendo cosas distintas. Además dicen si hay buscador de GIFs, que
   * depende de si el servidor tiene GIPHY_API_KEY.
   */
  useEffect(() => {
    apiArchivos.limites().then(setLimites).catch(() => undefined);
  }, []);

  const maxAdjuntos = limites?.maxAdjuntos ?? 4;
  const lleno = adjuntos.length >= maxAdjuntos;

  async function subirArchivos(ficheros: FileList | null) {
    if (!ficheros || ficheros.length === 0) return;

    setError(null);

    const hueco = maxAdjuntos - adjuntos.length;
    const elegidos = [...ficheros].slice(0, hueco);
    if (elegidos.length === 0) return;

    /*
     * El tamaño se comprueba aquí ADEMÁS de en el servidor. No es una
     * defensa —el servidor es quien decide— sino cortesía: subir 20 MB por
     * datos móviles para que el servidor lo rechace al final es tirar el
     * tiempo y los datos de quien lo intenta.
     */
    if (limites) {
      const grande = elegidos.find((f) => f.size > limites.maxBytes);
      if (grande) {
        setError(t('compositor.demasiadoGrande', {
          max: Math.floor(limites.maxBytes / 1024 / 1024),
        }));
        return;
      }
    }

    setSubiendo(true);
    try {
      const subidos = await apiArchivos.subir(elegidos, uso);
      alCambiarAdjuntos([...adjuntos, ...subidos]);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setSubiendo(false);
      // Se limpia el input para que elegir DOS VECES el mismo archivo
      // vuelva a disparar el `change` (si no, el navegador lo considera
      // "sin cambios" y no pasa nada).
      if (inputArchivo.current) inputArchivo.current.value = '';
    }
  }

  async function quitar(adjunto: Adjunto) {
    // Se quita de la lista primero: la respuesta visible es inmediata, y si
    // el borrado en el servidor falla el archivo queda huérfano y lo barre
    // el job de limpieza.
    alCambiarAdjuntos(adjuntos.filter((a) => a.id !== adjunto.id));
    apiArchivos.descartar(adjunto.id).catch(() => undefined);
  }

  async function elegirGif(gif: Gif) {
    setPanelGif(false);
    setError(null);
    try {
      const adjunto = await apiArchivos.elegirGif(gif);
      alCambiarAdjuntos([...adjuntos, adjunto]);
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  // `useCallback` porque `SelectorEmoji` lo tiene en las dependencias de su
  // efecto: sin memorizar, el picker se recrearía en cada render.
  const insertarEmoji = useCallback(
    (emoji: string) => {
      alInsertarTexto(emoji);
      // El panel NO se cierra: al poner un emoji se suele poner más de uno.
    },
    [alInsertarTexto]
  );

  const cerrarEmoji = useCallback(() => setPanelEmoji(false), []);
  const cerrarGif = useCallback(() => setPanelGif(false), []);

  return (
    <div>
      {/* ── Vista previa de los adjuntos ── */}
      {adjuntos.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {adjuntos.map((a) => (
            <li key={a.id} className="relative">
              {esImagen(a.mime) ? (
                <img
                  src={a.miniaturaUrl ?? a.url}
                  alt=""
                  className="h-20 w-20 rounded-lg border border-zinc-200 object-cover dark:border-zinc-700"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-center text-[10px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  {esVideo(a.mime) ? t('compositor.video') : t('compositor.archivo')}
                </div>
              )}

              <button
                type="button"
                onClick={() => quitar(a)}
                aria-label={t('compositor.quitarAdjunto')}
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center
                           rounded-full bg-zinc-900 text-white shadow-md transition-transform
                           hover:scale-110 dark:bg-zinc-100 dark:text-zinc-900"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mb-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {/* ── Botones ── */}
      <div className="flex items-center gap-1">
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setPanelEmoji((v) => !v);
              setPanelGif(false);
            }}
            disabled={deshabilitado}
            className="btn-fantasma h-9 w-9 px-0"
            aria-label={t('compositor.emojis')}
            aria-expanded={panelEmoji}
          >
            <Smile className="h-5 w-5" aria-hidden="true" />
          </button>

          {panelEmoji && <SelectorEmoji alElegir={insertarEmoji} alCerrar={cerrarEmoji} />}
        </div>

        {/* El botón de GIF solo existe si el servidor tiene clave de Giphy:
            uno que siempre falla es peor que no tenerlo. */}
        {limites?.gifs && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setPanelGif((v) => !v);
                setPanelEmoji(false);
              }}
              disabled={deshabilitado || lleno}
              className="btn-fantasma h-9 px-2 text-xs font-bold"
              aria-label={t('compositor.gifs')}
              aria-expanded={panelGif}
            >
              GIF
            </button>

            {panelGif && <SelectorGif alElegir={elegirGif} alCerrar={cerrarGif} />}
          </div>
        )}

        <button
          type="button"
          onClick={() => inputArchivo.current?.click()}
          disabled={deshabilitado || lleno || subiendo}
          className="btn-fantasma h-9 w-9 px-0"
          aria-label={t('compositor.adjuntar')}
        >
          {subiendo ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <ImagePlus className="h-5 w-5" aria-hidden="true" />
          )}
        </button>

        <input
          ref={inputArchivo}
          type="file"
          multiple
          /* `accept` es una comodidad del selector de archivos, NO una
             validación: se puede rodear eligiendo "todos los archivos". El
             filtro de verdad son los magic bytes en el servidor. */
          accept="image/*,video/mp4,video/webm,audio/*"
          onChange={(e) => void subirArchivos(e.target.files)}
          className="hidden"
          tabIndex={-1}
        />

        {lleno && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {t('compositor.maximoAlcanzado', { count: maxAdjuntos })}
          </span>
        )}
      </div>
    </div>
  );
}
