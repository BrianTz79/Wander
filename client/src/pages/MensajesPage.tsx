import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Bell, BellOff, Loader2, LogOut, Send, SquarePen, Users } from 'lucide-react';

import {
  leerEventoSistema,
  mensajes as api,
  type Conversacion,
  type Mensaje,
} from '../lib/mensajes';
import type { Adjunto } from '../lib/archivos';
import { mensajeError } from '../lib/api';
import { tiempoRelativo } from '../lib/social';
import {
  useEventoChat,
  useSalaConversacion,
  socketActual,
  conectarChat,
  type EventoConversacion,
  type EventoEscribiendo,
  type EventoMensajeBorrado,
  type EventoMensajeNuevo,
} from '../lib/socket';
import { useAuth } from '../store/authStore';
import { Avatar } from '../components/social/Avatar';
import { Adjuntos } from '../components/social/Adjuntos';
import { BarraCompositor } from '../components/social/Compositor';
import { NuevaConversacion } from '../components/social/NuevaConversacion';

/**
 * Mensajería (Fase 8).
 *
 * Dos paneles: la bandeja a la izquierda y el hilo a la derecha. En móvil
 * solo se ve uno de los dos —el hilo si hay conversación abierta, la
 * bandeja si no—, que es lo que hace que quepa sin que ninguno de los dos
 * quede inutilizable.
 *
 * La conversación abierta vive en la URL (`/mensajes/:id`) y no en el
 * estado: así se puede compartir el enlace, el botón de atrás funciona, y
 * una notificación puede llevar directamente a un hilo concreto.
 */

const MAX_TEXTO = 4000;

export function MensajesPage() {
  const { t, i18n } = useTranslation();
  const { id: conversacionId } = useParams<{ id: string }>();
  const navegar = useNavigate();

  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [verSolicitudes, setVerSolicitudes] = useState(false);
  const [cargandoBandeja, setCargandoBandeja] = useState(true);
  const [nueva, setNueva] = useState(false);

  // ── Bandeja ────────────────────────────────────────────────────────

  const cargarBandeja = useCallback(() => {
    setCargandoBandeja(true);
    api
      .bandeja({ solicitudes: verSolicitudes })
      .then((pagina) => setConversaciones(pagina.items))
      .catch(() => setConversaciones([]))
      .finally(() => setCargandoBandeja(false));
  }, [verSolicitudes]);

  useEffect(cargarBandeja, [cargarBandeja]);

  // El socket avisa de cualquier movimiento; la bandeja se vuelve a pedir
  // por REST, que es la fuente de verdad.
  const alMoverse = useCallback(() => cargarBandeja(), [cargarBandeja]);
  useEventoChat<EventoConversacion>('conv:actualizada', alMoverse);
  useEventoChat<EventoConversacion>('conv:nueva', alMoverse);

  // El socket se abre al entrar a mensajes y se cierra al salir de la app,
  // no de esta página: la campana de notificaciones lo usa también.
  useEffect(() => {
    conectarChat();
  }, []);

  return (
    <div className="contenedor-app py-6">
      <h1 className="sr-only">{t('mensajes.titulo')}</h1>

      <div className="flex h-[calc(100vh-10rem)] gap-4 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        {/* ── Bandeja ── */}
        <aside
          className={`w-full shrink-0 overflow-y-auto border-r border-zinc-200 md:block md:w-80
                      dark:border-zinc-800 ${conversacionId ? 'hidden' : 'block'}`}
        >
          <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-2 flex justify-end">
              {/* La puerta de entrada que faltaba: sin esto la bandeja solo
                  se llenaba si alguien te escribía primero. */}
              <button
                type="button"
                onClick={() => setNueva(true)}
                className="btn-primario inline-flex h-9 items-center gap-2 px-3 text-sm"
              >
                <SquarePen className="h-4 w-4" aria-hidden="true" />
                {t('mensajes.nuevaConversacion')}
              </button>
            </div>

            <div className="flex gap-1" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={!verSolicitudes}
                onClick={() => setVerSolicitudes(false)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  !verSolicitudes
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                }`}
              >
                {t('mensajes.bandeja')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={verSolicitudes}
                onClick={() => setVerSolicitudes(true)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  verSolicitudes
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                }`}
              >
                {t('mensajes.solicitudes')}
              </button>
            </div>
          </div>

          {cargandoBandeja && (
            <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {t('comun.cargando')}
            </p>
          )}

          {!cargandoBandeja && conversaciones.length === 0 && (
            <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {verSolicitudes ? t('mensajes.sinSolicitudes') : t('mensajes.bandejaVacia')}
            </p>
          )}

          <ul>
            {conversaciones.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => navegar(`/mensajes/${c.id}`)}
                  className={`flex w-full items-center gap-3 border-b border-zinc-100 px-3 py-3
                              text-left transition-colors hover:bg-zinc-50
                              dark:border-zinc-800/60 dark:hover:bg-zinc-900 ${
                                c.id === conversacionId ? 'bg-zinc-100 dark:bg-zinc-900' : ''
                              }`}
                >
                  {c.esGrupo ? (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800">
                      {c.iconoUrl ? (
                        <img src={c.iconoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <Users className="h-5 w-5 text-zinc-500" aria-hidden="true" />
                      )}
                    </span>
                  ) : c.participantes[0] ? (
                    <Avatar usuario={c.participantes[0]} enlazar={false} />
                  ) : (
                    <span className="h-10 w-10 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                  )}

                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                        {c.nombre ?? t('mensajes.sinNombre')}
                      </span>
                      <span className="shrink-0 text-xs text-zinc-400">
                        {tiempoRelativo(c.ultimoMsgEn, i18n.language)}
                      </span>
                    </span>

                    <span className="mt-0.5 flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {c.ultimoMsgTexto ?? t('mensajes.sinMensajes')}
                      </span>
                      {c.sinLeer > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                          {c.sinLeer > 99 ? '99+' : c.sinLeer}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* ── Hilo ── */}
        <main className={`min-w-0 flex-1 ${conversacionId ? 'block' : 'hidden md:block'}`}>
          {conversacionId ? (
            <Hilo
              key={conversacionId}
              conversacionId={conversacionId}
              alVolver={() => navegar('/mensajes')}
              alCambiar={cargarBandeja}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                {t('mensajes.eligeConversacion')}
              </p>
            </div>
          )}
        </main>
      </div>

      {nueva && (
        <NuevaConversacion
          alAbrir={(id) => {
            setNueva(false);
            // Se recarga la bandeja: el hilo recién creado tiene que
            // aparecer en la lista, no solo abrirse a la derecha.
            cargarBandeja();
            navegar(`/mensajes/${id}`);
          }}
          alCerrar={() => setNueva(false)}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
//  HILO
// ═════════════════════════════════════════════════════════════════════

interface PropsHilo {
  conversacionId: string;
  alVolver: () => void;
  alCambiar: () => void;
}

function Hilo({ conversacionId, alVolver, alCambiar }: PropsHilo) {
  const { t, i18n } = useTranslation();
  const yo = useAuth((e) => e.usuario);

  const [conversacion, setConversacion] = useState<Conversacion | null>(null);
  const [lista, setLista] = useState<Mensaje[]>([]);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState('');
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [escribiendo, setEscribiendo] = useState<string | null>(null);

  const finLista = useRef<HTMLDivElement>(null);
  const areaTexto = useRef<HTMLTextAreaElement>(null);
  const ultimoEscribiendo = useRef(0);

  // Suscripción en vivo a esta conversación.
  useSalaConversacion(conversacionId);

  // ── Carga inicial ──────────────────────────────────────────────────

  useEffect(() => {
    setCargando(true);
    Promise.all([api.verConversacion(conversacionId), api.mensajesDe(conversacionId)])
      .then(([conv, pagina]) => {
        setConversacion(conv);
        setLista(pagina.items);
      })
      .catch(() => setError(t('mensajes.noSePudoCargar')))
      .finally(() => setCargando(false));
  }, [conversacionId, t]);

  /**
   * Bajar del todo al llegar un mensaje.
   *
   * `behavior: 'auto'` (salto instantáneo) en la carga inicial y suave
   * después: al abrir un chat se quiere estar abajo YA, no ver el scroll
   * recorrer todo el historial.
   */
  useEffect(() => {
    finLista.current?.scrollIntoView({ behavior: cargando ? 'auto' : 'smooth' });
  }, [lista, cargando]);

  // ── Marcar leído ───────────────────────────────────────────────────

  /*
   * Se marca hasta el último mensaje que hay en pantalla, cada vez que la
   * lista cambia y el hilo está abierto. Es lo que apaga el contador de la
   * bandeja y el punto de la navbar.
   */
  useEffect(() => {
    const ultimo = lista[lista.length - 1];
    if (!ultimo || cargando) return;

    api
      .marcarLeido(conversacionId, ultimo.id)
      .then(alCambiar)
      .catch(() => undefined);
  }, [lista, conversacionId, cargando, alCambiar]);

  // ── Eventos en vivo ────────────────────────────────────────────────

  const alMensajeNuevo = useCallback(
    (datos: EventoMensajeNuevo) => {
      if (datos.mensaje.conversacionId !== conversacionId) return;

      setLista((actual) => {
        // Si ya está (llegó por la respuesta del POST antes que por el
        // socket), no se duplica.
        if (actual.some((m) => m.id === datos.mensaje.id)) return actual;
        return [...actual, datos.mensaje];
      });
      setEscribiendo(null);
    },
    [conversacionId]
  );

  const alMensajeEditado = useCallback(
    (datos: EventoMensajeNuevo) => {
      if (datos.mensaje.conversacionId !== conversacionId) return;
      setLista((actual) => actual.map((m) => (m.id === datos.mensaje.id ? datos.mensaje : m)));
    },
    [conversacionId]
  );

  const alMensajeBorrado = useCallback(
    (datos: EventoMensajeBorrado) => {
      if (datos.conversacionId !== conversacionId) return;
      setLista((actual) =>
        actual.map((m) =>
          m.id === datos.mensajeId
            ? { ...m, borradoEn: new Date().toISOString(), texto: null, adjuntos: [] }
            : m
        )
      );
    },
    [conversacionId]
  );

  const alEscribiendo = useCallback(
    (datos: EventoEscribiendo) => {
      if (datos.conversacionId !== conversacionId || datos.userId === yo?.id) return;
      setEscribiendo(datos.handle);
      // El indicador se apaga solo: el evento no tiene un "dejó de
      // escribir", así que sin caducidad se quedaría puesto para siempre si
      // la otra persona cierra la pestaña.
      setTimeout(() => setEscribiendo(null), 4000);
    },
    [conversacionId, yo?.id]
  );

  useEventoChat<EventoMensajeNuevo>('mensaje:nuevo', alMensajeNuevo);
  useEventoChat<EventoMensajeNuevo>('mensaje:editado', alMensajeEditado);
  useEventoChat<EventoMensajeBorrado>('mensaje:borrado', alMensajeBorrado);
  useEventoChat<EventoEscribiendo>('escribiendo', alEscribiendo);

  // ── Escribir ───────────────────────────────────────────────────────

  function avisarEscribiendo() {
    // Como mucho un aviso cada 2 s: emitir en cada tecla convertiría
    // escribir una frase en treinta mensajes por el socket.
    const ahora = Date.now();
    if (ahora - ultimoEscribiendo.current < 2000) return;
    ultimoEscribiendo.current = ahora;
    socketActual()?.emit('escribiendo', conversacionId);
  }

  const insertarTexto = useCallback((fragmento: string) => {
    const area = areaTexto.current;
    setTexto((actual) => {
      if (!area) return actual + fragmento;
      const inicio = area.selectionStart ?? actual.length;
      const fin = area.selectionEnd ?? actual.length;
      const nuevo = actual.slice(0, inicio) + fragmento + actual.slice(fin);
      requestAnimationFrame(() => {
        area.focus();
        const pos = inicio + fragmento.length;
        area.setSelectionRange(pos, pos);
      });
      return nuevo;
    });
  }, []);

  const puedeEnviar = Boolean(texto.trim()) || adjuntos.length > 0;

  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    if (!puedeEnviar || enviando) return;

    setEnviando(true);
    setError('');
    try {
      const mensaje = await api.enviar(conversacionId, {
        texto: texto.trim() || undefined,
        adjuntos: adjuntos.map((a) => a.id),
      });
      setTexto('');
      setAdjuntos([]);
      // Se añade en local sin esperar al socket: el propio mensaje tiene
      // que aparecer al instante, no cuando dé la vuelta por el servidor.
      setLista((actual) => (actual.some((m) => m.id === mensaje.id) ? actual : [...actual, mensaje]));
      alCambiar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  function alTeclear(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envía, Shift+Enter hace salto de línea: es la convención de
    // todos los chats, y la contraria sorprendería a todo el mundo.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void enviar();
    }
  }

  async function alternarSilencio() {
    if (!conversacion) return;
    try {
      const nuevo = await api.silenciar(conversacionId, !conversacion.silenciado);
      setConversacion({ ...conversacion, silenciado: nuevo });
    } catch {
      // Silenciar es secundario; si falla no se interrumpe la conversación.
    }
  }

  async function salirDelGrupo() {
    if (!confirm(t('mensajes.confirmarSalir'))) return;
    try {
      await api.salir(conversacionId);
      alCambiar();
      alVolver();
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  async function aceptar() {
    try {
      await api.aceptarSolicitud(conversacionId);
      setConversacion((c) => (c ? { ...c, esSolicitud: false } : c));
      alCambiar();
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  if (cargando) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" aria-hidden="true" />
        <span className="sr-only">{t('comun.cargando')}</span>
      </div>
    );
  }

  if (!conversacion) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{error || t('mensajes.noExiste')}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* ── Cabecera ── */}
      <header className="flex items-center gap-3 border-b border-zinc-200 p-3 dark:border-zinc-800">
        <button
          type="button"
          onClick={alVolver}
          className="btn-fantasma h-9 w-9 px-0 md:hidden"
          aria-label={t('comun.volver')}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        {conversacion.esGrupo ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800">
            <Users className="h-4 w-4 text-zinc-500" aria-hidden="true" />
          </span>
        ) : conversacion.participantes[0] ? (
          <Avatar usuario={conversacion.participantes[0]} tamano={36} />
        ) : null}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
            {conversacion.nombre ?? t('mensajes.sinNombre')}
          </p>
          {conversacion.esGrupo && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t('mensajes.participantes', { count: conversacion.participantes.length + 1 })}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={alternarSilencio}
          className="btn-fantasma h-9 w-9 px-0"
          aria-label={
            conversacion.silenciado ? t('mensajes.activarAvisos') : t('mensajes.silenciar')
          }
        >
          {conversacion.silenciado ? (
            <BellOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Bell className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {conversacion.esGrupo && (
          <button
            type="button"
            onClick={salirDelGrupo}
            className="btn-fantasma h-9 w-9 px-0"
            aria-label={t('mensajes.salirGrupo')}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </header>

      {/* ── Mensajes ── */}
      <div className="flex-1 overflow-y-auto p-4">
        {lista.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {t('mensajes.hiloVacio')}
          </p>
        )}

        <ul className="flex flex-col gap-3">
          {lista.map((m) => (
            <Burbuja key={m.id} mensaje={m} propio={m.autor.id === yo?.id} idioma={i18n.language} />
          ))}
        </ul>

        <div ref={finLista} />
      </div>

      {escribiendo && (
        <p className="px-4 pb-1 text-xs italic text-zinc-500 dark:text-zinc-400" aria-live="polite">
          {t('mensajes.estaEscribiendo', { quien: escribiendo })}
        </p>
      )}

      {/* ── Solicitud pendiente ── */}
      {conversacion.esSolicitud ? (
        <div className="border-t border-zinc-200 p-4 text-center dark:border-zinc-800">
          <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
            {t('mensajes.esSolicitud')}
          </p>
          <button type="button" onClick={aceptar} className="btn-primario">
            {t('mensajes.aceptar')}
          </button>
        </div>
      ) : (
        /* ── Compositor ── */
        <form onSubmit={enviar} className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          {error && (
            <p role="alert" className="mb-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor="mensaje" className="sr-only">
                {t('mensajes.escribeUnMensaje')}
              </label>
              <textarea
                id="mensaje"
                ref={areaTexto}
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value);
                  avisarEscribiendo();
                }}
                onKeyDown={alTeclear}
                maxLength={MAX_TEXTO}
                rows={1}
                placeholder={t('mensajes.escribeUnMensaje')}
                className="max-h-32 w-full resize-none rounded-lg border border-zinc-300 bg-white
                           px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400
                           focus:border-blue-500 focus:outline-none dark:border-zinc-700
                           dark:bg-zinc-950 dark:text-white"
              />

              <div className="mt-2">
                <BarraCompositor
                  adjuntos={adjuntos}
                  alCambiarAdjuntos={setAdjuntos}
                  alInsertarTexto={insertarTexto}
                  deshabilitado={enviando}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!puedeEnviar || enviando}
              className="btn-primario h-10 w-10 shrink-0 px-0"
              aria-label={t('mensajes.enviar')}
            >
              {enviando ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
//  BURBUJA
// ═════════════════════════════════════════════════════════════════════

function Burbuja({
  mensaje,
  propio,
  idioma,
}: {
  mensaje: Mensaje;
  propio: boolean;
  idioma: string;
}) {
  const { t } = useTranslation();

  /*
   * Los mensajes de sistema van centrados y sin burbuja: no son de nadie,
   * son sobre el grupo. El texto llega como una clave y se traduce aquí,
   * porque el mismo evento lo leen personas con la interfaz en distintos
   * idiomas.
   */
  if (mensaje.tipo === 'sistema') {
    const evento = leerEventoSistema(mensaje.texto);
    if (!evento) return null;

    return (
      <li className="my-1 text-center">
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {t(`mensajes.evento.${evento.evento}`, {
            quien: evento.porHandle,
            objetivo: evento.handle,
          })}
        </span>
      </li>
    );
  }

  if (mensaje.borradoEn) {
    return (
      <li className={`flex ${propio ? 'justify-end' : 'justify-start'}`}>
        <span className="rounded-2xl bg-zinc-100 px-3 py-2 text-sm italic text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
          {t('mensajes.borrado')}
        </span>
      </li>
    );
  }

  return (
    <li className={`flex gap-2 ${propio ? 'justify-end' : 'justify-start'}`}>
      {!propio && <Avatar usuario={mensaje.autor} tamano={32} />}

      <div className={`min-w-0 max-w-[75%] ${propio ? 'items-end' : 'items-start'}`}>
        {!propio && (
          <p className="mb-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {mensaje.autor.displayName}
          </p>
        )}

        <div
          className={`rounded-2xl px-3 py-2 ${
            propio
              ? 'bg-blue-600 text-white'
              : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
          }`}
        >
          {/* `{texto}` en JSX: React lo escapa, así que un `<script>` se ve
              literalmente. NUNCA `dangerouslySetInnerHTML` — es la misma
              regla de la Fase 7. */}
          {mensaje.texto && <p className="whitespace-pre-wrap break-words text-sm">{mensaje.texto}</p>}

          <Adjuntos adjuntos={mensaje.adjuntos} compacto />
        </div>

        <p className={`mt-0.5 text-[11px] text-zinc-400 ${propio ? 'text-right' : ''}`}>
          {tiempoRelativo(mensaje.createdAt, idioma)}
          {mensaje.editadoEn && ` · ${t('mensajes.editado')}`}
        </p>
      </div>
    </li>
  );
}
