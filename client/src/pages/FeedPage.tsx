import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass, Loader2 } from 'lucide-react';

import { social, useListaPaginada, type Publicacion } from '../lib/social';
import { Redactor } from '../components/social/Redactor';
import { TarjetaPublicacion } from '../components/social/TarjetaPublicacion';

/**
 * `/feed` — lo que publica la gente a la que sigues, y tú.
 *
 * El vacío tiene dos versiones distintas y es importante que lo sean: "no
 * sigues a nadie" se arregla yendo a explorar, y "no han publicado nada"
 * no se arregla con nada. Un solo mensaje genérico dejaría al recién
 * llegado sin saber qué hacer.
 */
export function FeedPage() {
  const { t } = useTranslation();
  const [sigueAAlguien, setSigueAAlguien] = useState(true);

  const traer = useCallback(
    async (cursor?: string) => {
      const datos = await social.feed(cursor);
      setSigueAAlguien(datos.sigueAAlguien);
      return datos;
    },
    []
  );

  const lista = useListaPaginada<Publicacion>(traer);

  /** Sustituye una publicación en la lista tras reaccionar o comentar. */
  const actualizar = (publicacion: Publicacion) =>
    lista.reemplazar(lista.items.map((p) => (p.id === publicacion.id ? publicacion : p)));

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
        {t('social.tituloFeed')}
      </h1>

      <div className="space-y-4">
        <Redactor alPublicar={(p) => lista.reemplazar([p, ...lista.items])} />

        {lista.cargando && (
          <div className="flex justify-center py-12" role="status">
            <span className="sr-only">{t('comun.cargando')}</span>
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" aria-hidden="true" />
          </div>
        )}

        {lista.error && (
          <p className="py-12 text-center text-zinc-500 dark:text-zinc-400">
            {t('comun.algoSalioMal')}
          </p>
        )}

        {!lista.cargando && !lista.error && lista.items.length === 0 && (
          <div className="tarjeta text-center">
            <p className="text-zinc-600 dark:text-zinc-400">
              {sigueAAlguien ? t('social.feedVacioSilencio') : t('social.feedVacioSinSeguidos')}
            </p>
            {!sigueAAlguien && (
              <Link to="/explorar" className="btn-secundario mt-4">
                <Compass className="h-4 w-4" aria-hidden="true" />
                {t('social.buscarGente')}
              </Link>
            )}
          </div>
        )}

        {lista.items.map((p) => (
          <TarjetaPublicacion
            key={p.id}
            publicacion={p}
            alCambiar={actualizar}
            alBorrar={(id) => lista.reemplazar(lista.items.filter((x) => x.id !== id))}
          />
        ))}

        {lista.hayMas && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={lista.cargarMas}
              disabled={lista.cargandoMas}
              className="btn-secundario"
            >
              {lista.cargandoMas ? t('comun.cargando') : t('social.cargarMas')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
