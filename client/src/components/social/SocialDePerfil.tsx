import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Ban, MessageSquare, Users } from 'lucide-react';

import {
  social,
  tiempoRelativo,
  useListaPaginada,
  type Comentario,
  type Publicacion,
  type Relacion,
} from '../../lib/social';
import { mensajeError } from '../../lib/api';
import { mensajes } from '../../lib/mensajes';
import { useAuth } from '../../store/authStore';
import { TEXTO_SUAVE } from '../../lib/perfil';
import { Avatar } from './Avatar';
import { BotonSeguir } from './BotonSeguir';
import { BotonReportar } from './BotonReportar';

interface Props {
  handle: string;
}

/**
 * Bloque social del perfil público: seguidores, seguir, muro de
 * comentarios y publicaciones de esa persona.
 *
 * **Se pinta con el tema del perfil (`--p-*`), no con el de Wander.** Es la
 * misma regla que los bloques: dentro de `/u/:handle` manda la
 * personalización de quien lo tiene. Por eso los estilos van en `style` con
 * variables y no en clases de Tailwind con `zinc`.
 */
export function SocialDePerfil({ handle }: Props) {
  const [relacion, setRelacion] = useState<Relacion | null>(null);

  useEffect(() => {
    let cancelado = false;
    social
      .relacion(handle)
      .then((r) => {
        if (!cancelado) setRelacion(r);
      })
      .catch(() => {
        // Que falle la relación no puede tumbar el perfil entero: el resto
        // de la página ya se pintó y esto es un añadido.
        if (!cancelado) setRelacion(null);
      });
    return () => {
      cancelado = true;
    };
  }, [handle]);

  if (!relacion) return null;

  return (
    <div className="mt-8 space-y-8">
      <CabeceraSocial relacion={relacion} alCambiar={setRelacion} />
      <PublicacionesDelPerfil handle={handle} />
      <MuroDeComentarios handle={handle} bloqueado={relacion.bloqueado} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Contadores + seguir + bloquear
// ─────────────────────────────────────────────────────────────────────

function CabeceraSocial({
  relacion,
  alCambiar,
}: {
  relacion: Relacion;
  alCambiar: (r: Relacion) => void;
}) {
  const { t } = useTranslation();
  const usuario = useAuth((e) => e.usuario);
  const [error, setError] = useState('');

  async function alternarBloqueo() {
    setError('');
    try {
      if (relacion.bloqueado) {
        await social.desbloquear(relacion.handle);
        alCambiar({ ...relacion, bloqueado: false });
      } else {
        if (!window.confirm(t('social.confirmarBloqueo', { handle: relacion.handle }))) return;
        await social.bloquear(relacion.handle);
        // Bloquear rompe el seguimiento en ambos sentidos (lo hace el
        // servidor en la misma transacción); se refleja aquí para no
        // quedar mostrando "siguiendo" a quien acabas de bloquear.
        alCambiar({
          ...relacion,
          bloqueado: true,
          losigo: false,
          meSigue: false,
          seguidores: relacion.losigo ? relacion.seguidores - 1 : relacion.seguidores,
        });
      }
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  return (
    <div
      className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t pt-6"
      style={{ borderColor: 'var(--p-borde)' }}
    >
      <div className="flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5">
          <Users className="h-4 w-4" style={{ color: 'var(--p-acento)' }} aria-hidden="true" />
          <strong>{relacion.seguidores}</strong>
          <span style={TEXTO_SUAVE}>{t('social.seguidores')}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <strong>{relacion.siguiendo}</strong>
          <span style={TEXTO_SUAVE}>{t('social.siguiendoA')}</span>
        </span>
      </div>

      {relacion.meSigue && !relacion.esPropio && (
        <span className="text-xs" style={TEXTO_SUAVE}>
          {t('social.teSigue')}
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        {!relacion.bloqueado && (
          <BotonSeguir relacion={relacion} alCambiar={alCambiar} temaDePerfil />
        )}

        {/* Empezar un DM desde el perfil (Fase 10).
            La API existía desde la Fase 8, pero no había ningún botón en
            toda la interfaz que la llamara: se podía leer una conversación
            y contestarla, pero no iniciarla. */}
        {usuario && !relacion.esPropio && !relacion.bloqueado && (
          <BotonMensaje handle={relacion.handle} />
        )}

        {usuario && !relacion.esPropio && (
          <button
            type="button"
            onClick={alternarBloqueo}
            className="inline-flex h-10 items-center gap-2 px-3 text-sm font-medium transition-transform hover:scale-105"
            style={{
              border: '1px solid var(--p-borde)',
              borderRadius: 'var(--p-radio)',
              opacity: 0.75,
            }}
          >
            <Ban className="h-4 w-4" aria-hidden="true" />
            {relacion.bloqueado ? t('social.desbloquear') : t('social.bloquear')}
          </button>
        )}

        {/* Reportar el perfil (Fase 10). Va por handle: el perfil público
            no expone el id del usuario, y el backend lo resuelve. */}
        {usuario && !relacion.esPropio && (
          <BotonReportar tipoObjeto="perfil" objetoId={relacion.handle} compacto />
        )}
      </div>

      {error && (
        <p className="w-full text-sm" style={{ color: 'var(--p-acento)' }}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Botón de «Mensaje» del perfil: abre el DM y lleva a él.
 *
 * `abrirDm` es idempotente en el servidor, así que pulsarlo dos veces
 * lleva al MISMO hilo en vez de partir la conversación en dos.
 *
 * Va con el tema del perfil (`--p-*`) como el resto de la cabecera: dentro
 * de `/u/:handle` manda la personalización de quien lo tiene.
 */
function BotonMensaje({ handle }: { handle: string }) {
  const { t } = useTranslation();
  const navegar = useNavigate();
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState('');

  async function abrir() {
    if (abriendo) return;
    setAbriendo(true);
    setError('');
    try {
      const { conversacionId } = await mensajes.abrirDm(handle);
      navegar(`/mensajes/${conversacionId}`);
    } catch (e) {
      // Puede fallar legítimamente: quien tenga los DMs cerrados no acepta
      // que se le escriba, y el servidor lo dice con su propio mensaje.
      setError(mensajeError(e));
      setAbriendo(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        disabled={abriendo}
        className="inline-flex h-10 items-center gap-2 px-3 text-sm font-medium transition-transform hover:scale-105 disabled:opacity-60"
        style={{
          border: '1px solid var(--p-borde)',
          borderRadius: 'var(--p-radio)',
        }}
      >
        <MessageSquare className="h-4 w-4" aria-hidden="true" />
        {t('mensajes.mensaje')}
      </button>

      {error && (
        <p className="w-full text-sm" style={{ color: 'var(--p-acento)' }}>
          {error}
        </p>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Publicaciones de esta persona
// ─────────────────────────────────────────────────────────────────────

function PublicacionesDelPerfil({ handle }: { handle: string }) {
  const { t, i18n } = useTranslation();

  const traer = useCallback((cursor?: string) => social.publicacionesDe(handle, cursor), [handle]);
  const lista = useListaPaginada<Publicacion>(traer);

  if (lista.cargando || lista.error || lista.items.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={TEXTO_SUAVE}>
        {t('social.publicaciones')}
      </h2>

      <ul className="space-y-4">
        {lista.items.map((p) => (
          <li
            key={p.id}
            className="p-4"
            style={{
              backgroundColor: 'var(--p-tarjeta)',
              border: '1px solid var(--p-borde)',
              borderRadius: 'var(--p-radio)',
            }}
          >
            <p className="whitespace-pre-wrap break-words text-sm">{p.texto}</p>
            <div className="mt-2 flex items-center gap-3 text-xs" style={TEXTO_SUAVE}>
              <time dateTime={p.createdAt}>{tiempoRelativo(p.createdAt, i18n.language)}</time>
              {p.reacciones > 0 && <span>{t('social.nMeGusta', { count: p.reacciones })}</span>}
              {p.comentarios > 0 && (
                <span>{t('social.nComentarios', { count: p.comentarios })}</span>
              )}
              {p.juegoNombre && (
                <span style={{ color: 'var(--p-acento)' }}>{p.juegoNombre}</span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {lista.hayMas && (
        <button
          type="button"
          onClick={lista.cargarMas}
          disabled={lista.cargandoMas}
          className="mt-4 text-sm font-semibold underline"
          style={{ color: 'var(--p-acento)' }}
        >
          {lista.cargandoMas ? t('comun.cargando') : t('social.cargarMas')}
        </button>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Muro de comentarios del perfil
// ─────────────────────────────────────────────────────────────────────

function MuroDeComentarios({ handle, bloqueado }: { handle: string; bloqueado: boolean }) {
  const { t, i18n } = useTranslation();
  const usuario = useAuth((e) => e.usuario);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const traer = useCallback(
    (cursor?: string) => social.comentariosDePerfil(handle, cursor),
    [handle]
  );
  const lista = useListaPaginada<Comentario>(traer);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio || enviando) return;

    setEnviando(true);
    setError('');
    try {
      const comentario = await social.comentarPerfil(handle, limpio);
      // Al principio: el muro va del más nuevo al más viejo.
      lista.reemplazar([comentario, ...lista.items]);
      setTexto('');
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
    <section>
      <h2
        className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide"
        style={TEXTO_SUAVE}
      >
        <MessageSquare className="h-4 w-4" aria-hidden="true" />
        {t('social.muro')}
      </h2>

      {usuario && !bloqueado && (
        <form onSubmit={enviar} className="mb-5 flex gap-2">
          <label htmlFor="muro" className="sr-only">
            {t('social.dejaUnComentario')}
          </label>
          <input
            id="muro"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={500}
            placeholder={t('social.dejaUnComentario')}
            className="h-10 flex-1 px-3 text-sm outline-none"
            style={{
              backgroundColor: 'var(--p-tarjeta)',
              border: '1px solid var(--p-borde)',
              borderRadius: 'var(--p-radio)',
              color: 'var(--p-texto)',
            }}
          />
          <button
            type="submit"
            disabled={!texto.trim() || enviando}
            className="h-10 px-4 text-sm font-semibold transition-transform hover:scale-105 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--p-acento)',
              color: 'var(--p-fondo)',
              borderRadius: 'var(--p-radio)',
            }}
          >
            {t('social.enviar')}
          </button>
        </form>
      )}

      {!usuario && (
        /*
         * Este enlace lo colorea `--p-acento`, que elige el DUEÑO del
         * perfil, así que Wander no puede garantizarle un contraste
         * concreto —un acento claro sobre un fondo claro es una
         * combinación que el editor permite y que aquí no se puede
         * corregir sin pisarle el tema—. Lo que sí está en nuestra mano
         * es que no dependa solo del color: hereda el color del texto del
         * perfil y usa el acento en el subrayado, de modo que el enlace se
         * lee siempre y se distingue igual. Salió de la auditoría con axe
         * de la Fase 10.
         */
        <p className="mb-5 text-sm">
          <Link
            to="/login"
            className="underline underline-offset-2"
            style={{ color: 'var(--p-texto)', textDecorationColor: 'var(--p-acento)' }}
          >
            {t('social.inicioParaComentar')}
          </Link>
        </p>
      )}

      {lista.items.length === 0 ? (
        <p className="text-sm" style={TEXTO_SUAVE}>
          {t('social.muroVacio')}
        </p>
      ) : (
        <ul className="space-y-4">
          {lista.items.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar usuario={c.autor} tamano={32} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
                  <Link to={`/u/${c.autor.handle}`} className="font-semibold hover:underline">
                    {c.autor.displayName}
                  </Link>
                  <time dateTime={c.createdAt} style={TEXTO_SUAVE}>
                    {tiempoRelativo(c.createdAt, i18n.language)}
                  </time>
                  {usuario?.id === c.autor.id && (
                    <button
                      type="button"
                      onClick={() => void borrar(c.id)}
                      className="underline"
                      style={TEXTO_SUAVE}
                    >
                      {t('social.borrar')}
                    </button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{c.texto}</p>
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
          className="mt-4 text-sm font-semibold underline"
          style={{ color: 'var(--p-acento)' }}
        >
          {lista.cargandoMas ? t('comun.cargando') : t('social.cargarMas')}
        </button>
      )}

      {error && (
        <p className="mt-3 text-sm" style={{ color: 'var(--p-acento)' }}>
          {error}
        </p>
      )}
    </section>
  );
}
