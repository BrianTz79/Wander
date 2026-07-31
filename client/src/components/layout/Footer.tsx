import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react';
import { useAuth } from '../../store/authStore';

/** Footer (§5.10 del sistema de diseño). */
export function Footer() {
  const { t } = useTranslation();
  const anio = new Date().getFullYear();
  // Con sesión, el footer ofrece también las páginas de cuenta: es el otro
  // sitio donde la gente busca "configuración" cuando no la encuentra arriba.
  const usuario = useAuth((e) => e.usuario);

  return (
    <footer className="mt-auto w-full border-t border-zinc-200 bg-white py-8 md:py-12 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="contenedor-app">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <Link to="/" className="mb-3 flex items-center gap-2 font-bold">
              <Compass className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span className="text-zinc-900 dark:text-white">Wander</span>
            </Link>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('footer.lema')}</p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">
                {t('footer.plataforma')}
              </h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    to="/explorar"
                    className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                  >
                    {t('footer.explorarPerfiles')}
                  </Link>
                </li>
                {!usuario && (
                  <li>
                    <Link
                      to="/registro"
                      className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                    >
                      {t('footer.crearPerfil')}
                    </Link>
                  </li>
                )}
              </ul>
            </div>

            {/* Columna de cuenta: solo tiene sentido con sesión iniciada. */}
            {usuario && (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">
                  {t('footer.tuCuenta')}
                </h3>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link
                      to={`/u/${usuario.handle}`}
                      className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                    >
                      {t('footer.miPerfil')}
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/editor"
                      className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                    >
                      {t('footer.editarPerfil')}
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/configuracion"
                      className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                    >
                      {t('footer.configuracion')}
                    </Link>
                  </li>
                </ul>
              </div>
            )}

            <div>
              <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">
                {t('footer.legal')}
              </h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    to="/privacidad"
                    className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                  >
                    {t('footer.privacidad')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/terminos"
                    className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                  >
                    {t('footer.terminos')}
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t('footer.derechos', { anio })}
          </p>
        </div>
      </div>
    </footer>
  );
}
