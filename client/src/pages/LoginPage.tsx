import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass, Eye, EyeOff, Loader2 } from 'lucide-react';

import { useAuth } from '../store/authStore';
import { erroresPorCampo, mensajeError } from '../lib/api';
import { BotonDiscord, BotonGoogle, BotonSteam, SeparadorO } from '../components/BotonSteam';
import { textoErrorExterno } from '../lib/erroresExternos';

export function LoginPage() {
  const { t } = useTranslation();
  const login = useAuth((e) => e.login);
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [parametros] = useSearchParams();

  const errorSteam = textoErrorExterno(parametros.get('error'), t);
  const canceloSteam =
    parametros.get('steam') === 'cancelado' ||
    parametros.get('discord') === 'cancelado' ||
    parametros.get('google') === 'cancelado';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});

  // A dónde volver tras entrar: la ruta de la que fue expulsado, si la hay.
  const destino = (ubicacion.state as { desde?: string } | null)?.desde;

  async function alEnviar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando) return;

    setEnviando(true);
    setError('');
    setErrores({});

    try {
      await login(email, password);
      navegar(destino ?? '/', { replace: true });
    } catch (e) {
      setError(mensajeError(e));
      setErrores(erroresPorCampo(e));
      // No se limpia el correo: reescribirlo tras un fallo molesta.
      setPassword('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="contenedor-app flex min-h-[80vh] items-center justify-center py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="mb-6 inline-flex items-center gap-2 font-bold">
            <Compass className="h-7 w-7 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span className="text-xl text-zinc-900 dark:text-white">Wander</span>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {t('login.titulo')}
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">{t('login.subtitulo')}</p>
        </div>

        <form onSubmit={alEnviar} className="tarjeta" noValidate>
          {/* Vuelta desde Steam: error real o cancelación del usuario. */}
          {errorSteam && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm
                         text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {errorSteam}
            </div>
          )}
          {canceloSteam && (
            <div
              role="status"
              className="mb-5 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm
                         text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
            >
              {t('login.canceloSteam')}
            </div>
          )}

          {/* El error general se anuncia a lectores de pantalla. */}
          {error && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm
                         text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </div>
          )}

          <div className="mb-5">
            <label htmlFor="email" className="etiqueta">
              {t('login.correo')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`campo ${errores['email'] ? 'campo-error' : ''}`}
              placeholder={t('login.correoPlaceholder')}
              aria-invalid={Boolean(errores['email'])}
              aria-describedby={errores['email'] ? 'error-email' : undefined}
            />
            {errores['email'] && (
              <p id="error-email" className="texto-error">
                {errores['email']}
              </p>
            )}
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="etiqueta">
              {t('login.password')}
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={verPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`campo pr-12 ${errores['password'] ? 'campo-error' : ''}`}
                placeholder="••••••••••••"
                aria-invalid={Boolean(errores['password'])}
                aria-describedby={errores['password'] ? 'error-password' : undefined}
              />
              <button
                type="button"
                onClick={() => setVerPassword((v) => !v)}
                className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center
                           justify-center rounded-md text-zinc-500 transition-colors
                           hover:text-zinc-900 dark:hover:text-white"
                aria-label={verPassword ? t('login.ocultarPassword') : t('login.mostrarPassword')}
              >
                {verPassword ? (
                  <EyeOff className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Eye className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
            {errores['password'] && (
              <p id="error-password" className="texto-error">
                {errores['password']}
              </p>
            )}
          </div>

          <button type="submit" disabled={enviando} className="btn-primario w-full">
            {enviando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t('login.entrando')}
              </>
            ) : (
              t('login.entrar')
            )}
          </button>

          <SeparadorO />
          <div className="space-y-2">
            <BotonSteam />
            <BotonDiscord />
            <BotonGoogle />
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          {t('login.sinCuenta')}{' '}
          <Link to="/registro" className="enlace-acento">
            {t('login.crearPerfil')}
          </Link>
        </p>
      </div>
    </div>
  );
}
