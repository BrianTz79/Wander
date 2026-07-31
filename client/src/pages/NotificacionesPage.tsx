import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, Heart, MessageCircle, MessageSquare, UserPlus } from 'lucide-react';

import {
  destinoDeNotificacion,
  social,
  tiempoRelativo,
  useListaPaginada,
  type Notificacion,
} from '../lib/social';
import { Avatar } from '../components/social/Avatar';

/**
 * Historial completo de notificaciones (Fase 8).
 *
 * El panel de la campana muestra las últimas veinte; esta pantalla las
 * pagina todas. Es donde acaba quien vuelve tras unos días y tiene más de
 * las que caben en un desplegable.
 */

const ICONOS = {
  seguimiento: UserPlus,
  comentario: MessageSquare,
  reaccion: Heart,
  mensaje: MessageCircle,
  mencion: MessageSquare,
  sistema: Bell,
} as const;

export function NotificacionesPage() {
  const { t, i18n } = useTranslation();
  const navegar = useNavigate();

  const traer = useCallback((cursor?: string) => social.notificaciones(cursor), []);
  const lista = useListaPaginada<Notificacion>(traer);

  // Al abrir esta pantalla se dan por vistas: entrar aquí ES verlas.
  useEffect(() => {
    social.marcarLeidas().catch(() => undefined);
  }, []);

  useEffect(() => {
    document.title = `${t('notificaciones.titulo')} · Wander`;
  }, [t]);

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

  return (
    <div className="contenedor-app max-w-2xl py-6">
      <h1 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-white">
        {t('notificaciones.titulo')}
      </h1>

      {lista.cargando && (
        <p className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {t('comun.cargando')}
        </p>
      )}

      {lista.error && !lista.cargando && (
        <div className="py-12 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('errores.inesperado')}</p>
          <button type="button" onClick={lista.recargar} className="btn-fantasma mt-2">
            {t('comun.reintentar')}
          </button>
        </div>
      )}

      {!lista.cargando && !lista.error && lista.items.length === 0 && (
        <p className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {t('notificaciones.vacio')}
        </p>
      )}

      <ul className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        {lista.items.map((n) => {
          const Icono = ICONOS[n.tipo] ?? Bell;
          const destino = destinoDeNotificacion(n);

          const contenido = (
            <>
              {n.emisor ? (
                <Avatar usuario={n.emisor} tamano={40} enlazar={false} />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <Icono className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                </span>
              )}

              <span className="min-w-0 flex-1">
                <span className="block text-sm text-zinc-900 dark:text-zinc-100">{textoDe(n)}</span>
                {n.datos.extracto && (
                  <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {n.datos.extracto}
                  </span>
                )}
                <span className="mt-0.5 block text-xs text-zinc-400 dark:text-zinc-500">
                  {tiempoRelativo(n.createdAt, i18n.language)}
                </span>
              </span>

              <Icono className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
            </>
          );

          const clases =
            'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900';

          return (
            <li
              key={n.id}
              className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
            >
              {destino ? (
                <button type="button" onClick={() => navegar(destino)} className={clases}>
                  {contenido}
                </button>
              ) : (
                <div className={clases}>{contenido}</div>
              )}
            </li>
          );
        })}
      </ul>

      {lista.hayMas && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={lista.cargarMas}
            disabled={lista.cargandoMas}
            className="btn-fantasma"
          >
            {lista.cargandoMas ? t('comun.cargando') : t('comun.cargarMas')}
          </button>
        </div>
      )}
    </div>
  );
}
