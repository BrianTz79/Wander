import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Gamepad2, Heart, MessageCircle, Trash2 } from 'lucide-react';

import {
  social,
  tiempoRelativo,
  useListaPaginada,
  type Comentario,
  type Publicacion,
} from '../../lib/social';
import { mensajeError } from '../../lib/api';
import { useAuth } from '../../store/authStore';
import { Avatar } from './Avatar';
import { Adjuntos } from './Adjuntos';
import { BotonReportar } from './BotonReportar';

interface Props {
  publicacion: Publicacion;
  /** Notifica al padre el estado nuevo tras reaccionar o comentar. */
  alCambiar?: (publicacion: Publicacion) => void;
  /** Notifica que se borró, para quitarla de la lista sin recargar. */
  alBorrar?: (id: string) => void;
  /** Abre los comentarios de entrada (vista de publicación suelta). */
  comentariosAbiertos?: boolean;
}

/**
 * Una publicación en el feed, en el perfil o en explorar.
 *
 * El texto se pinta con `{publicacion.texto}`, es decir, como TEXTO. Nunca
 * `dangerouslySetInnerHTML`: es lo que hace que un `<script>` escrito por
 * un usuario se lea como los caracteres que son. Por eso el backend puede
 * guardar el texto tal cual, sin destriparlo.
 */
export function TarjetaPublicacion({
  publicacion,
  alCambiar,
  alBorrar,
  comentariosAbiertos = false,
}: Props) {
  const { t, i18n } = useTranslation();
  const usuario = useAuth((e) => e.usuario);
  const [abierto, setAbierto] = useState(comentariosAbiertos);
  const [error, setError] = useState('');

  const esMio = usuario?.id === publicacion.autor.id;
  const meGusta = publicacion.misReacciones.includes('like');

  async function alternarMeGusta() {
    if (!usuario) return;
    setError('');
    try {
      const r = await social.reaccionar(publicacion.id, 'like');
      alCambiar?.({
        ...publicacion,
        reacciones: r.reacciones,
        misReacciones: r.misReacciones,
      });
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  async function borrar() {
    // `confirm` nativo: borrar es irreversible para el usuario y un modal
    // propio no aportaría nada aquí más que código.
    if (!window.confirm(t('social.confirmarBorrarPublicacion'))) return;
    setError('');
    try {
      await social.borrarPublicacion(publicacion.id);
      alBorrar?.(publicacion.id);
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  return (
    <article className="tarjeta">
      <div className="flex gap-3">
        <Avatar usuario={publicacion.autor} />

        <div className="min-w-0 flex-1">
          {/* Cabecera: quién y cuándo */}
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
            <Link
              to={`/u/${publicacion.autor.handle}`}
              className="font-semibold text-zinc-900 hover:underline dark:text-white"
            >
              {publicacion.autor.displayName}
            </Link>
            <span className="text-zinc-500 dark:text-zinc-400">@{publicacion.autor.handle}</span>
            <span className="text-zinc-400 dark:text-zinc-500" aria-hidden="true">
              ·
            </span>
            <time
              dateTime={publicacion.createdAt}
              className="text-zinc-500 dark:text-zinc-400"
              // El título da la fecha exacta al pasar el ratón: el relativo
              // es cómodo de leer pero pierde precisión.
              title={new Date(publicacion.createdAt).toLocaleString(i18n.language)}
            >
              {tiempoRelativo(publicacion.createdAt, i18n.language)}
            </time>
            {publicacion.editadoEn && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {t('social.editado')}
              </span>
            )}
          </div>

          {/* Texto. `whitespace-pre-wrap` respeta los saltos de línea que
              escribió el autor; el backend ya limitó cuántos seguidos. */}
          {publicacion.texto && (
            <p className="mt-2 whitespace-pre-wrap break-words text-zinc-800 dark:text-zinc-200">
              {publicacion.texto}
            </p>
          )}

          {/* Imágenes, GIFs y archivos (Fase 8). Una publicación puede ser
              solo esto, sin texto: una captura sin comentario. */}
          <Adjuntos adjuntos={publicacion.adjuntos ?? []} />

          {/* Juego etiquetado */}
          {publicacion.juegoAppid !== null && (
            <Link
              to={`/explorar?juego=${publicacion.juegoAppid}`}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-zinc-200
                         px-3 py-1 text-xs font-medium text-zinc-600 transition-colors
                         hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800
                         dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-white"
            >
              <Gamepad2 className="h-3.5 w-3.5" aria-hidden="true" />
              {publicacion.juegoNombre ?? t('social.juegoNumero', { appid: publicacion.juegoAppid })}
            </Link>
          )}

          {/* Acciones */}
          <div className="mt-3 flex items-center gap-1 text-sm">
            <button
              type="button"
              onClick={alternarMeGusta}
              disabled={!usuario}
              aria-pressed={meGusta}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-zinc-500
                         transition-colors hover:bg-zinc-100 hover:text-red-600
                         disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent
                         disabled:hover:text-zinc-500 dark:text-zinc-400 dark:hover:bg-zinc-800
                         dark:hover:text-red-400"
              title={usuario ? t('social.meGusta') : t('social.inicioParaInteractuar')}
            >
              <Heart
                className={`h-4 w-4 ${meGusta ? 'fill-red-600 text-red-600 dark:fill-red-400 dark:text-red-400' : ''}`}
                aria-hidden="true"
              />
              <span className="sr-only">{t('social.meGusta')}</span>
              {publicacion.reacciones > 0 && publicacion.reacciones}
            </button>

            <button
              type="button"
              onClick={() => setAbierto((a) => !a)}
              aria-expanded={abierto}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-zinc-500
                         transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400
                         dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">{t('social.comentarios')}</span>
              {publicacion.comentarios > 0 && publicacion.comentarios}
            </button>

            {esMio && (
              <button
                type="button"
                onClick={borrar}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-zinc-500
                           transition-colors hover:bg-zinc-100 hover:text-red-600 dark:text-zinc-400
                           dark:hover:bg-zinc-800 dark:hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">{t('social.borrar')}</span>
              </button>
            )}

            {/* Reportar (Fase 10). Solo sobre lo ajeno: la publicación
                propia se borra, no se reporta. */}
            {!esMio && usuario && (
              <span className="ml-auto">
                <BotonReportar tipoObjeto="publicacion" objetoId={publicacion.id} compacto />
              </span>
            )}
          </div>

          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

          {abierto && (
            <HiloComentarios
              publicacionId={publicacion.id}
              alComentar={() =>
                alCambiar?.({ ...publicacion, comentarios: publicacion.comentarios + 1 })
              }
            />
          )}
        </div>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Comentarios de una publicación
// ─────────────────────────────────────────────────────────────────────

function HiloComentarios({
  publicacionId,
  alComentar,
}: {
  publicacionId: string;
  alComentar: () => void;
}) {
  const { t, i18n } = useTranslation();
  const usuario = useAuth((e) => e.usuario);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  // Memorizado: `useListaPaginada` reinicia la lista cuando cambia la
  // identidad de esta función, así que sin `useCallback` se recargaría en
  // cada render.
  const traer = useCallback(
    (cursor?: string) => social.comentariosDe(publicacionId, cursor),
    [publicacionId]
  );
  const lista = useListaPaginada<Comentario>(traer);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio || enviando) return;

    setEnviando(true);
    setError('');
    try {
      const comentario = await social.comentar(publicacionId, limpio);
      // Se añade al final: los comentarios van en orden cronológico.
      lista.reemplazar([...lista.items, comentario]);
      setTexto('');
      alComentar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  async function borrar(id: string) {
    try {
      await social.borrarComentario(id);
      lista.reemplazar(lista.items.filter((c) => c.id !== id));
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
      {lista.cargando ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('comun.cargando')}</p>
      ) : (
        <ul className="space-y-3">
          {/* El `id` de cada <li> es el ancla a la que apunta una
              notificación de comentario (`#c-<id>`): sin él se aterrizaría
              arriba de la publicación y habría que buscar a mano de qué se
              trataba. `scroll-mt-20` deja hueco para la navbar sticky, que
              si no taparía justo el comentario al que se saltó. */}
          {lista.items.map((c) => (
            <li key={c.id} id={`c-${c.id}`} className="flex scroll-mt-20 gap-2.5">
              <Avatar usuario={c.autor} tamano={28} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
                  <Link
                    to={`/u/${c.autor.handle}`}
                    className="font-semibold text-zinc-900 hover:underline dark:text-white"
                  >
                    {c.autor.displayName}
                  </Link>
                  <time dateTime={c.createdAt} className="text-zinc-500 dark:text-zinc-400">
                    {tiempoRelativo(c.createdAt, i18n.language)}
                  </time>
                  {usuario?.id === c.autor.id && (
                    <button
                      type="button"
                      onClick={() => void borrar(c.id)}
                      className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      {t('social.borrar')}
                    </button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-zinc-700 dark:text-zinc-300">
                  {c.texto}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {lista.hayMas && (
        <button
          type="button"
          onClick={lista.cargarMas}
          disabled={lista.cargandoMas}
          className="mt-3 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {lista.cargandoMas ? t('comun.cargando') : t('social.verMasComentarios')}
        </button>
      )}

      {usuario ? (
        <form onSubmit={enviar} className="mt-3 flex gap-2">
          <label htmlFor={`comentario-${publicacionId}`} className="sr-only">
            {t('social.escribeComentario')}
          </label>
          <input
            id={`comentario-${publicacionId}`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={500}
            placeholder={t('social.escribeComentario')}
            className="campo h-10 flex-1 text-sm"
          />
          <button
            type="submit"
            disabled={!texto.trim() || enviando}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-zinc-900
                       px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800
                       disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {t('social.enviar')}
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          {t('social.inicioParaComentar')}
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
