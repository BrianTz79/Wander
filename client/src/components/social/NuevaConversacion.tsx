import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Search, Users, X } from 'lucide-react';

import { social, type UsuarioExplorar } from '../../lib/social';
import { mensajes } from '../../lib/mensajes';
import { mensajeError } from '../../lib/api';
import { Avatar } from './Avatar';

/**
 * Diálogo para empezar una conversación (Fase 10).
 *
 * La Fase 8 dejó la mensajería entera —DMs, grupos, adjuntos, tiempo
 * real— pero **sin ninguna puerta de entrada**: `abrirDm` y `crearGrupo`
 * existían en la API y en `lib/mensajes.ts`, y no había un solo botón en
 * toda la interfaz que los llamara. Se podía leer y contestar una
 * conversación, pero no iniciarla, así que la bandeja solo se llenaba si
 * alguien te escribía primero. Esto es esa puerta.
 *
 * Un solo diálogo para las dos cosas, con un interruptor entre DM y grupo:
 * la diferencia real entre ambos es «una persona o varias», y separarlos en
 * dos pantallas obligaría a decidir antes de empezar a buscar.
 */

interface Props {
  /** Se llama con el id de la conversación ya creada o recuperada. */
  alAbrir: (conversacionId: string) => void;
  alCerrar: () => void;
}

export function NuevaConversacion({ alAbrir, alCerrar }: Props) {
  const { t } = useTranslation();

  const [esGrupo, setEsGrupo] = useState(false);
  const [termino, setTermino] = useState('');
  const [resultados, setResultados] = useState<UsuarioExplorar[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [elegidas, setElegidas] = useState<UsuarioExplorar[]>([]);
  const [nombre, setNombre] = useState('');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');

  const dialogo = useRef<HTMLDivElement>(null);
  const peticion = useRef(0);

  /*
   * Búsqueda con rebote, igual que la de GIFs y por la misma razón: una
   * petición por tecla gasta base de datos para nada y hace parpadear la
   * lista. El contador descarta las respuestas que llegan fuera de orden.
   */
  useEffect(() => {
    const mia = ++peticion.current;
    const limpio = termino.trim();

    if (!limpio) {
      setResultados([]);
      setBuscando(false);
      return;
    }

    setBuscando(true);
    const temporizador = setTimeout(() => {
      social
        .explorar({ q: limpio })
        .then((pagina) => {
          if (peticion.current !== mia) return;
          setResultados(pagina.usuarios);
        })
        .catch(() => {
          if (peticion.current !== mia) return;
          setResultados([]);
        })
        .finally(() => {
          if (peticion.current === mia) setBuscando(false);
        });
    }, 300);

    return () => clearTimeout(temporizador);
  }, [termino]);

  // Cerrar con Escape, como el resto de capas de la interfaz.
  useEffect(() => {
    const alPulsarTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar();
    };
    document.addEventListener('keydown', alPulsarTecla);
    return () => document.removeEventListener('keydown', alPulsarTecla);
  }, [alCerrar]);

  function alternar(usuario: UsuarioExplorar) {
    setError('');

    // En un DM no hay nada que elegir: se abre y ya.
    if (!esGrupo) {
      void abrirDm(usuario.handle);
      return;
    }

    setElegidas((actual) =>
      actual.some((u) => u.id === usuario.id)
        ? actual.filter((u) => u.id !== usuario.id)
        : [...actual, usuario]
    );
  }

  async function abrirDm(handle: string) {
    if (creando) return;
    setCreando(true);
    setError('');
    try {
      const { conversacionId } = await mensajes.abrirDm(handle);
      alAbrir(conversacionId);
    } catch (e) {
      // Falla de verdad cuando esa persona no acepta DMs de cualquiera.
      setError(mensajeError(e));
      setCreando(false);
    }
  }

  async function crearGrupo() {
    if (creando) return;

    if (!nombre.trim()) {
      setError(t('mensajes.faltaNombre'));
      return;
    }
    if (elegidas.length === 0) {
      setError(t('mensajes.faltaGente'));
      return;
    }

    setCreando(true);
    setError('');
    try {
      const id = await mensajes.crearGrupo({
        nombre: nombre.trim(),
        handles: elegidas.map((u) => u.handle),
      });
      alAbrir(id);
    } catch (e) {
      setError(mensajeError(e));
      setCreando(false);
    }
  }

  return (
    // El fondo cierra al pulsarlo; el diálogo para la propagación para que
    // pulsar DENTRO no lo cierre.
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[10vh]"
      onMouseDown={alCerrar}
      role="presentation"
    >
      <div
        ref={dialogo}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={esGrupo ? t('mensajes.nuevoGrupo') : t('mensajes.nuevaConversacion')}
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl border border-zinc-200
                   bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        {/* ── Cabecera ── */}
        <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 p-3 dark:border-zinc-800">
          <div className="flex flex-1 gap-1" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={!esGrupo}
              onClick={() => {
                setEsGrupo(false);
                setError('');
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                !esGrupo
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              {t('mensajes.nuevaConversacion')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={esGrupo}
              onClick={() => {
                setEsGrupo(true);
                setError('');
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                esGrupo
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              {t('mensajes.nuevoGrupo')}
            </button>
          </div>

          <button
            type="button"
            onClick={alCerrar}
            className="btn-fantasma h-9 w-9 shrink-0 px-0"
            aria-label={t('mensajes.cancelar')}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* ── Nombre del grupo ── */}
        {esGrupo && (
          <div className="shrink-0 border-b border-zinc-200 p-3 dark:border-zinc-800">
            <label htmlFor="nombre-grupo" className="sr-only">
              {t('mensajes.nombreDelGrupo')}
            </label>
            <input
              id="nombre-grupo"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={60}
              placeholder={t('mensajes.nombreDelGrupo')}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm
                         text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500
                         focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
            />

            {elegidas.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {elegidas.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => alternar(u)}
                      className="flex items-center gap-1 rounded-full bg-zinc-100 py-1 pl-2 pr-1
                                 text-xs text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800
                                 dark:text-zinc-200 dark:hover:bg-zinc-700"
                      aria-label={`${t('mensajes.quitar')} ${u.displayName}`}
                    >
                      {u.displayName}
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Buscador ── */}
        <div className="relative shrink-0 p-3">
          <Search
            className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            aria-hidden="true"
          />
          <label htmlFor="buscar-personas" className="sr-only">
            {t('mensajes.buscarPersonas')}
          </label>
          <input
            id="buscar-personas"
            type="search"
            value={termino}
            onChange={(e) => setTermino(e.target.value)}
            placeholder={t('mensajes.buscarPersonas')}
            autoFocus
            maxLength={40}
            className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm
                       text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500
                       focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
          />
        </div>

        {/* ── Resultados ── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3">
          {buscando && (
            <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {t('comun.cargando')}
            </p>
          )}

          {!buscando && termino.trim() && resultados.length === 0 && (
            <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {t('mensajes.sinResultados')}
            </p>
          )}

          <ul>
            {resultados.map((u) => {
              const elegida = elegidas.some((e) => e.id === u.id);
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => alternar(u)}
                    disabled={creando}
                    aria-pressed={esGrupo ? elegida : undefined}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left
                                transition-colors disabled:opacity-60 ${
                                  elegida
                                    ? 'bg-zinc-100 dark:bg-zinc-800'
                                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                                }`}
                  >
                    <Avatar usuario={u} enlazar={false} tamano={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-900 dark:text-white">
                        {u.displayName}
                      </span>
                      <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                        @{u.handle}
                      </span>
                    </span>
                    {esGrupo && elegida && (
                      <span className="shrink-0 text-xs font-semibold text-blue-600 dark:text-blue-400">
                        ✓
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── Pie ── */}
        {(error || esGrupo) && (
          <div className="shrink-0 border-t border-zinc-200 p-3 dark:border-zinc-800">
            {error && (
              <p role="alert" className="mb-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            {esGrupo && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t('mensajes.elegidas', { count: elegidas.length })}
                </span>
                <button
                  type="button"
                  onClick={crearGrupo}
                  disabled={creando || elegidas.length === 0 || !nombre.trim()}
                  className="btn-primario inline-flex h-10 items-center gap-2 px-4 disabled:opacity-50"
                >
                  {creando ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Users className="h-4 w-4" aria-hidden="true" />
                  )}
                  {t('mensajes.crearGrupo')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
