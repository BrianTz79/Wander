import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { Check, Compass, Eye, EyeOff, Loader2, X } from 'lucide-react';

import { useAuth } from '../store/authStore';
import { api, erroresPorCampo, mensajeError } from '../lib/api';
import { BotonDiscord, BotonGoogle, BotonSteam, SeparadorO } from '../components/BotonSteam';

/** Estado de la comprobación de handle contra el backend. */
type EstadoHandle =
  | { tipo: 'vacio' }
  | { tipo: 'comprobando' }
  | { tipo: 'libre' }
  | { tipo: 'ocupado'; motivo: string };

/** Debe coincidir con `passwordSchema` del backend (§ schemas/auth.schema.ts). */
const LARGO_MINIMO_PASSWORD = 12;

export function RegistroPage() {
  const { t } = useTranslation();
  const registro = useAuth((e) => e.registro);
  const navegar = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [acepta, setAcepta] = useState(false);

  const [verPassword, setVerPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [estadoHandle, setEstadoHandle] = useState<EstadoHandle>({ tipo: 'vacio' });

  // ── Comprobación de handle con rebote ──────────────────────────────
  // 400 ms tras dejar de teclear. Sin el rebote sería una petición por
  // pulsación y el rate limit de búsqueda del backend cortaría.
  useEffect(() => {
    const valor = handle.trim().toLowerCase();

    if (valor.length < 3) {
      setEstadoHandle({ tipo: 'vacio' });
      return;
    }

    setEstadoHandle({ tipo: 'comprobando' });

    // `cancelado` evita que una respuesta lenta de un handle viejo pise
    // el resultado de uno más nuevo.
    let cancelado = false;
    const temporizador = setTimeout(async () => {
      try {
        const { data } = await api.get<{ disponible: boolean; motivo?: string }>(
          '/auth/handle-disponible',
          { params: { handle: valor } }
        );
        if (cancelado) return;
        setEstadoHandle(
          data.disponible
            ? { tipo: 'libre' }
            : { tipo: 'ocupado', motivo: data.motivo ?? t('registro.handleNoDisponible') }
        );
      } catch {
        // Si la comprobación falla no se bloquea el registro: el backend
        // valida igual al enviar. Se vuelve al estado neutro.
        if (!cancelado) setEstadoHandle({ tipo: 'vacio' });
      }
    }, 400);

    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [handle, t]);

  async function alEnviar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando) return;

    setEnviando(true);
    setError('');
    setErrores({});

    try {
      await registro({
        email,
        password,
        handle: handle.trim().toLowerCase(),
        displayName: displayName.trim(),
        aceptaTerminos: true,
      });
      // Recién registrado: directo a su perfil vacío para que lo arme.
      navegar(`/u/${handle.trim().toLowerCase()}`, { replace: true });
    } catch (e) {
      setError(mensajeError(e));
      setErrores(erroresPorCampo(e));
    } finally {
      setEnviando(false);
    }
  }

  const passwordCorta = password.length > 0 && password.length < LARGO_MINIMO_PASSWORD;
  const puedeEnviar =
    acepta && !enviando && estadoHandle.tipo !== 'ocupado' && estadoHandle.tipo !== 'comprobando';

  return (
    <div className="contenedor-app flex min-h-[80vh] items-center justify-center py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="mb-6 inline-flex items-center gap-2 font-bold">
            <Compass className="h-7 w-7 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span className="text-xl text-zinc-900 dark:text-white">Wander</span>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {t('registro.titulo')}
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">{t('registro.subtitulo')}</p>
        </div>

        <form onSubmit={alEnviar} className="tarjeta" noValidate>
          {error && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm
                         text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </div>
          )}

          {/* ── Handle ── */}
          <div className="mb-5">
            <label htmlFor="handle" className="etiqueta">
              {t('registro.handle')}
            </label>
            <div className="relative">
              {/* `aria-hidden` porque el lector ya lee la etiqueta del
                  campo, pero SÍ tiene que cumplir contraste: sigue siendo
                  texto que se ve, y quien tiene baja visión lo lee. */}
              <span
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base
                           text-zinc-500 dark:text-zinc-400"
                aria-hidden="true"
              >
                /u/
              </span>
              <input
                id="handle"
                name="handle"
                type="text"
                autoComplete="username"
                required
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className={`campo pl-11 pr-11 ${
                  errores['handle'] || estadoHandle.tipo === 'ocupado' ? 'campo-error' : ''
                }`}
                placeholder="mizllet"
                maxLength={24}
                aria-invalid={Boolean(errores['handle']) || estadoHandle.tipo === 'ocupado'}
                aria-describedby="ayuda-handle"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2" aria-hidden="true">
                {estadoHandle.tipo === 'comprobando' && (
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                )}
                {estadoHandle.tipo === 'libre' && (
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                )}
                {estadoHandle.tipo === 'ocupado' && (
                  <X className="h-5 w-5 text-red-600 dark:text-red-400" />
                )}
              </span>
            </div>

            {/* aria-live: el resultado de la comprobación se anuncia sin
                mover el foco del campo. */}
            <p
              id="ayuda-handle"
              aria-live="polite"
              className={
                estadoHandle.tipo === 'ocupado' || errores['handle']
                  ? 'texto-error'
                  : 'mt-1.5 text-sm text-zinc-500 dark:text-zinc-400'
              }
            >
              {errores['handle'] ??
                (estadoHandle.tipo === 'ocupado'
                  ? estadoHandle.motivo
                  : estadoHandle.tipo === 'libre'
                    ? t('registro.handleDisponible')
                    : t('registro.handleAyuda'))}
            </p>
          </div>

          {/* ── Nombre para mostrar ── */}
          <div className="mb-5">
            <label htmlFor="displayName" className="etiqueta">
              {t('registro.displayName')}
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              autoComplete="nickname"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={`campo ${errores['displayName'] ? 'campo-error' : ''}`}
              placeholder="Mizllet"
              maxLength={40}
              aria-invalid={Boolean(errores['displayName'])}
            />
            {errores['displayName'] && <p className="texto-error">{errores['displayName']}</p>}
          </div>

          {/* ── Correo ── */}
          <div className="mb-5">
            <label htmlFor="email" className="etiqueta">
              {t('registro.correo')}
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
              placeholder={t('registro.correoPlaceholder')}
              aria-invalid={Boolean(errores['email'])}
            />
            {errores['email'] && <p className="texto-error">{errores['email']}</p>}
          </div>

          {/* ── Contraseña ── */}
          <div className="mb-5">
            <label htmlFor="password" className="etiqueta">
              {t('registro.password')}
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={verPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`campo pr-12 ${
                  errores['password'] || passwordCorta ? 'campo-error' : ''
                }`}
                placeholder={t('registro.passwordPlaceholder')}
                aria-invalid={Boolean(errores['password'])}
                aria-describedby="ayuda-password"
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
            <p
              id="ayuda-password"
              className={
                errores['password'] || passwordCorta
                  ? 'texto-error'
                  : 'mt-1.5 text-sm text-zinc-500 dark:text-zinc-400'
              }
            >
              {errores['password'] ??
                t('registro.passwordAyuda', { minimo: LARGO_MINIMO_PASSWORD })}
            </p>
          </div>

          {/* ── Consentimiento ──
              El backend exige `aceptaTerminos: true`, así que el envío se
              bloquea hasta que se marque. */}
          <div className="mb-6 flex items-start gap-3">
            <input
              id="acepta"
              name="acepta"
              type="checkbox"
              checked={acepta}
              onChange={(e) => setAcepta(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 accent-zinc-900
                         dark:border-zinc-700 dark:accent-white"
              aria-describedby={errores['aceptaTerminos'] ? 'error-acepta' : undefined}
            />
            {/* <Trans> y no una concatenación: los enlaces van DENTRO de la
                frase, y cada idioma los coloca en un orden distinto.

                Los marcadores van por NOMBRE (`<terminos>`) y no por índice
                (`<1>`): con índices hay que contar los hijos del JSX, y ahí
                cuentan también los `{' '}` sueltos, así que basta reacomodar
                el formato para que los enlaces desaparezcan del render sin
                que nada falle. Con nombres no hay nada que contar. */}
            <label htmlFor="acepta" className="text-sm text-zinc-600 dark:text-zinc-400">
              <Trans
                i18nKey="registro.acepto"
                components={{
                  terminos: <Link to="/terminos" className="enlace-acento" />,
                  privacidad: <Link to="/privacidad" className="enlace-acento" />,
                }}
              />
            </label>
          </div>
          {errores['aceptaTerminos'] && (
            <p id="error-acepta" className="-mt-4 mb-5 text-sm text-red-600 dark:text-red-400">
              {errores['aceptaTerminos']}
            </p>
          )}

          <button type="submit" disabled={!puedeEnviar} className="btn-primario w-full">
            {enviando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t('registro.creando')}
              </>
            ) : (
              t('registro.crear')
            )}
          </button>

          <SeparadorO />
          {/* Con cualquiera de estos no hace falta ni correo ni contraseña:
              la identidad del proveedor basta para crear la cuenta y el
              handle se genera automáticamente. */}
          <div className="space-y-2">
            <BotonSteam registro />
            <BotonDiscord registro />
            <BotonGoogle registro />
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          {t('registro.yaTienesCuenta')}{' '}
          <Link to="/login" className="enlace-acento">
            {t('registro.iniciarSesion')}
          </Link>
        </p>
      </div>
    </div>
  );
}
