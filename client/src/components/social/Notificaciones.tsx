import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, Heart, MessageCircle, MessageSquare, UserPlus } from 'lucide-react';

import {
  destinoDeNotificacion,
  social,
  tiempoRelativo,
  type Notificacion,
} from '../../lib/social';
import { useEventoChat } from '../../lib/socket';
import { Avatar } from './Avatar';

/**
 * Campana de notificaciones (Fase 8).
 *
 * Dos piezas separadas a propósito:
 *
 *  - **El contador** se pide en cada carga con un endpoint que solo hace un
 *    `count`. Es lo que decide si se pinta el punto rojo.
 *  - **La lista** solo se pide al ABRIR el panel. Traer veinte
 *    notificaciones con sus emisores en cada visita, para que la mayoría de
 *    las veces nadie las mire, sería pagar una consulta con JOIN por página
 *    vista.
 *
 * El contador se actualiza además por socket (`notificacion:nueva`), así
 * que la campana se enciende sola sin sondear cada pocos segundos.
 */

/** Icono por tipo. Es lo que hace escaneable la lista: se distingue un
 *  seguidor nuevo de un comentario sin leer el texto. */
const ICONOS = {
  seguimiento: UserPlus,
  comentario: MessageSquare,
  reaccion: Heart,
  mensaje: MessageCircle,
  mencion: MessageSquare,
  sistema: Bell,
} as const;

export function Notificaciones() {
  const { t, i18n } = useTranslation();
  const navegar = useNavigate();

  const [abierto, setAbierto] = useState(false);
  const [sinLeer, setSinLeer] = useState(0);
  const [items, setItems] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);

  const refPanel = useRef<HTMLDivElement>(null);

  // ── Contador ───────────────────────────────────────────────────────

  const refrescarContador = useCallback(() => {
    social
      .contadorNotificaciones()
      .then(setSinLeer)
      // Un fallo aquí no se le enseña a nadie: la campana simplemente no
      // muestra punto. Es un adorno, no una función crítica.
      .catch(() => undefined);
  }, []);

  useEffect(refrescarContador, [refrescarContador]);

  // El servidor avisa al crear una notificación; el cliente solo vuelve a
  // pedir el número. Mandar la notificación entera por el socket obligaría
  // a duplicar el filtrado de bloqueos que ya vive en el REST.
  useEventoChat('notificacion:nueva', refrescarContador);

  // ── Lista ──────────────────────────────────────────────────────────

  const cargar = useCallback(() => {
    setCargando(true);
    setError(false);

    social
      .notificaciones()
      .then((pagina) => {
        setItems(pagina.items);
        setSinLeer(pagina.sinLeer);
      })
      .catch(() => setError(true))
      .finally(() => setCargando(false));
  }, []);

  function alternar() {
    const siguiente = !abierto;
    setAbierto(siguiente);
    if (siguiente) cargar();
  }

  /**
   * Marcar como leídas al abrir, no al cerrar.
   *
   * Es lo que la gente espera: abrir el panel ES haberlas visto. Hacerlo al
   * cerrar deja el punto rojo puesto mientras se leen, y si se navega desde
   * una notificación (que es lo normal) el panel nunca llega a "cerrarse" y
   * el punto se queda para siempre.
   *
   * El contador se pone a cero en local sin esperar la respuesta: el efecto
   * visible es inmediato y, si la petición falla, el siguiente refresco lo
   * corrige solo.
   */
  useEffect(() => {
    if (!abierto || sinLeer === 0) return;

    setSinLeer(0);
    social.marcarLeidas().catch(refrescarContador);
  }, [abierto, sinLeer, refrescarContador]);

  // ── Cerrar al pulsar fuera o con Escape ────────────────────────────

  useEffect(() => {
    if (!abierto) return;

    const alPulsarFuera = (e: MouseEvent) => {
      if (refPanel.current && !refPanel.current.contains(e.target as Node)) setAbierto(false);
    };
    const alPulsarTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };

    document.addEventListener('mousedown', alPulsarFuera);
    document.addEventListener('keydown', alPulsarTecla);
    return () => {
      document.removeEventListener('mousedown', alPulsarFuera);
      document.removeEventListener('keydown', alPulsarTecla);
    };
  }, [abierto]);

  /** Texto de una notificación, ya traducido y con el nombre dentro. */
  function textoDe(n: Notificacion): string {
    const quien = n.emisor?.displayName ?? t('notificaciones.alguien');

    switch (n.tipo) {
      case 'seguimiento':
        return t('notificaciones.teSiguio', { quien });
      case 'comentario':
        return n.datos.enPerfil
          ? t('notificaciones.comentoTuPerfil', { quien })
          : t('notificaciones.comentoTuPublicacion', { quien });
      case 'reaccion':
        return t('notificaciones.reacciono', { quien });
      case 'mensaje':
        return n.datos.evento === 'invitacion'
          ? t('notificaciones.teInvito', { quien })
          : t('notificaciones.teEscribio', { quien });
      case 'mencion':
        return t('notificaciones.teMenciono', { quien });
      default:
        return t('notificaciones.sistema');
    }
  }

  function alPulsar(n: Notificacion) {
    const destino = destinoDeNotificacion(n);
    setAbierto(false);
    if (destino) navegar(destino);
  }

  return (
    <div className="relative" ref={refPanel}>
      <button
        type="button"
        onClick={alternar}
        className="btn-fantasma relative h-10 w-10 px-0"
        aria-expanded={abierto}
        aria-haspopup="menu"
        /* El número va en el nombre accesible, no solo en el punto de
           color: quien usa lector de pantalla no ve el punto. */
        aria-label={
          sinLeer > 0
            ? t('notificaciones.abrirConPendientes', { count: sinLeer })
            : t('notificaciones.abrir')
        }
      >
        <Bell className="h-5 w-5" aria-hidden="true" />

        {sinLeer > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center
                       rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
            aria-hidden="true"
          >
            {/* Más de 99 se corta: el ancho del punto tiene que ser
                predecible, y "137" no dice nada que no diga "99+". */}
            {sinLeer > 99 ? '99+' : sinLeer}
          </span>
        )}
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-80 overflow-y-auto
                     overscroll-contain rounded-xl border border-zinc-200 bg-white shadow-lg
                     sm:w-96 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="sticky top-0 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">
              {t('notificaciones.titulo')}
            </p>
          </div>

          {cargando && (
            <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {t('comun.cargando')}
            </p>
          )}

          {error && !cargando && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('errores.inesperado')}</p>
              <button type="button" onClick={cargar} className="btn-fantasma mt-2 text-sm">
                {t('comun.reintentar')}
              </button>
            </div>
          )}

          {!cargando && !error && items.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {t('notificaciones.vacio')}
            </p>
          )}

          <ul>
            {items.map((n) => {
              const Icono = ICONOS[n.tipo] ?? Bell;
              const destino = destinoDeNotificacion(n);
              const sinLeerEsta = n.leidaEn === null;

              const contenido = (
                <>
                  {n.emisor ? (
                    <Avatar usuario={n.emisor} tamano={36} enlazar={false} />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <Icono className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                    </span>
                  )}

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-zinc-900 dark:text-zinc-100">
                      {textoDe(n)}
                    </span>

                    {n.datos.extracto && (
                      <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {n.datos.extracto}
                      </span>
                    )}

                    <span className="mt-0.5 block text-xs text-zinc-400 dark:text-zinc-500">
                      {tiempoRelativo(n.createdAt, i18n.language)}
                    </span>
                  </span>

                  <Icono
                    className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500"
                    aria-hidden="true"
                  />
                </>
              );

              const clases = `flex w-full items-start gap-3 px-4 py-3 text-left transition-colors
                              hover:bg-zinc-100 dark:hover:bg-zinc-800
                              ${sinLeerEsta ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}`;

              return (
                <li key={n.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  {/* Sin destino se pinta como texto, no como enlace: un
                      enlace que no lleva a ninguna parte es peor que
                      ninguno. */}
                  {destino ? (
                    <button type="button" role="menuitem" onClick={() => alPulsar(n)} className={clases}>
                      {contenido}
                    </button>
                  ) : (
                    <div className={clases}>{contenido}</div>
                  )}
                </li>
              );
            })}
          </ul>

          {items.length > 0 && (
            <div className="border-t border-zinc-200 px-4 py-2 dark:border-zinc-800">
              <Link
                to="/notificaciones"
                onClick={() => setAbierto(false)}
                className="block py-1 text-center text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                {t('notificaciones.verTodas')}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
