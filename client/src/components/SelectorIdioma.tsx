import { useTranslation } from 'react-i18next';
import { Check, Languages } from 'lucide-react';

import { IDIOMAS, NOMBRES_IDIOMA, useIdioma } from '../lib/idioma';

/**
 * Selector de idioma (Fase 6.5).
 *
 * Dos formas del mismo control, porque los dos sitios donde vive son muy
 * distintos:
 *
 *  - `variante="menu"` — filas dentro del menú de cuenta de la navbar,
 *    donde ya hay un desplegable abierto y meter otro sería un menú dentro
 *    de un menú.
 *  - `variante="bloque"` — la sección de `/configuracion`, con espacio
 *    para explicar qué hace.
 *
 * Cada idioma se nombra **en su propio idioma** ("English", no "Inglés"):
 * quien necesita cambiarlo es, por definición, quien no entiende el que
 * está viendo.
 */
export function SelectorIdioma({
  variante = 'bloque',
}: {
  variante?: 'menu' | 'bloque' | 'compacto';
}) {
  const { t } = useTranslation();
  const { idioma, cambiar } = useIdioma();

  /*
   * `compacto` — un solo botón en la navbar de escritorio, para quien no
   * tiene sesión y por tanto no tiene menú de cuenta donde buscarlo.
   *
   * Alterna directamente en vez de abrir un desplegable porque con DOS
   * idiomas un menú es un clic de más para llegar al único otro sitio
   * posible. Enseña el código del idioma al que se va a cambiar, no el
   * actual: la etiqueta dice qué va a pasar si lo pulsas.
   */
  if (variante === 'compacto') {
    const siguiente = IDIOMAS.find((c) => c !== idioma) ?? idioma;
    return (
      <button
        type="button"
        onClick={() => cambiar(siguiente)}
        className="btn-fantasma h-10 gap-1.5 px-2.5 text-xs font-semibold uppercase"
        aria-label={`${t('idioma.cambiar')}: ${NOMBRES_IDIOMA[siguiente]}`}
      >
        <Languages className="h-4 w-4" aria-hidden="true" />
        {siguiente}
      </button>
    );
  }

  if (variante === 'menu') {
    return (
      <div role="group" aria-label={t('idioma.cambiar')}>
        {IDIOMAS.map((codigo) => (
          <button
            key={codigo}
            type="button"
            role="menuitemradio"
            aria-checked={idioma === codigo}
            onClick={() => cambiar(codigo)}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm
                       text-zinc-700 transition-colors hover:bg-zinc-100
                       dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Languages className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{NOMBRES_IDIOMA[codigo]}</span>
            {idioma === codigo && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
          </button>
        ))}
      </div>
    );
  }

  return (
    <section className="tarjeta">
      <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-white">
        {t('configuracion.seccionIdioma')}
      </h2>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        {t('configuracion.idiomaAyuda')}
      </p>

      {/* Botones y no un <select>: con dos opciones, un desplegable esconde
          la mitad de la información tras un clic sin ahorrar nada. */}
      <div role="group" aria-label={t('idioma.cambiar')} className="flex flex-wrap gap-2">
        {IDIOMAS.map((codigo) => {
          const activo = idioma === codigo;
          return (
            <button
              key={codigo}
              type="button"
              aria-pressed={activo}
              onClick={() => cambiar(codigo)}
              className={
                activo
                  ? 'inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-900 px-4 text-sm font-semibold text-zinc-900 dark:border-white dark:text-white'
                  : 'inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 px-4 text-sm font-medium text-zinc-600 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600'
              }
            >
              {activo && <Check className="h-4 w-4" aria-hidden="true" />}
              {NOMBRES_IDIOMA[codigo]}
            </button>
          );
        })}
      </div>
    </section>
  );
}
