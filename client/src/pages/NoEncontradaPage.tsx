import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/** 404. */
export function NoEncontradaPage() {
  const { t } = useTranslation();

  return (
    <div className="contenedor-app flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-mono text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {t('noEncontrada.codigo')}
      </p>

      <h1 className="mt-4 text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
        {t('noEncontrada.titulo')}
      </h1>

      <p className="mt-3 max-w-md text-zinc-600 dark:text-zinc-400">{t('noEncontrada.texto')}</p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn-primario">
          {t('comun.volverInicio')}
        </Link>
        <Link to="/explorar" className="btn-secundario">
          {t('noEncontrada.explorar')}
        </Link>
      </div>
    </div>
  );
}
