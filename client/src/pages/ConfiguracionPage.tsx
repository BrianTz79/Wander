import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Link2,
  Loader2,
  Music,
  Search,
  ShieldCheck,
  Unlink,
  X,
} from 'lucide-react';
import { api, mensajeError } from '../lib/api';
import { useAuth } from '../store/authStore';
import { SelectorIdioma } from '../components/SelectorIdioma';
import {
  CLAVE_RESUMEN,
  NOMBRES,
  mensajeRetorno,
  urlVincular,
  type CuentaVinculada,
  type RespuestaCuentas,
} from '../lib/cuentas';

/**
 * Configuración de cuentas vinculadas (Fase 6).
 *
 * Esta pantalla es donde se cumple —o no— la promesa de §1: "cada
 * vinculación dice exactamente qué se lee y qué se guarda, con permisos
 * granulares y desvinculación que borra de verdad".
 *
 * Tres decisiones de diseño que salen de ahí:
 *
 *  1. **El consentimiento se enseña ANTES de salir al proveedor**, no
 *     después. Una pantalla que explique lo que ya pasó no es
 *     consentimiento, es un informe.
 *  2. **Se listan también los proveedores NO vinculados**, con lo que
 *     leerían. Poder leer eso sin comprometerse a nada es la diferencia
 *     entre informar y presionar.
 *  3. **Se dice lo que NO se pide.** Es lo que la gente teme de verdad al
 *     conectar Discord, y casi ningún sitio lo responde.
 */
export function ConfiguracionPage() {
  const { t } = useTranslation();
  const [datos, setDatos] = useState<RespuestaCuentas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [params, setParams] = useSearchParams();

  // Mensaje de vuelta de un flujo OAuth (?vinculado=discord, ?error=…).
  // Se calcula una sola vez porque los parámetros se limpian de la URL en
  // cuanto se leen: si cambias de idioma después, este aviso concreto se
  // queda en el idioma en el que llegaste, y es un texto efímero.
  const [aviso, setAviso] = useState(() => mensajeRetorno(params, t));

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get<RespuestaCuentas>('/cuentas');
      setDatos(data);
      setError('');
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Limpia los parámetros de la URL tras leerlos: si el usuario recarga,
  // no debe volver a ver "Discord quedó vinculado".
  useEffect(() => {
    if (params.toString() !== '') setParams({}, { replace: true });
    // Solo al montar: `params` cambia al limpiarlo y volvería a entrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="contenedor-app max-w-3xl py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          {t('configuracion.titulo')}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {t('configuracion.subtitulo')}{' '}
          <Link to="/privacidad" className="enlace-acento">
            {t('configuracion.comoTratamosDatos')}
          </Link>
        </p>
      </header>

      {aviso && (
        <div
          role="status"
          className={`mb-6 flex items-start gap-3 rounded-xl p-3 text-sm ${
            aviso.tipo === 'ok'
              ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
          }`}
        >
          {aviso.tipo === 'ok' ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <p className="flex-1">{aviso.texto}</p>
          <button
            type="button"
            onClick={() => setAviso(null)}
            className="shrink-0 opacity-60 hover:opacity-100"
            aria-label={t('configuracion.cerrarAviso')}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {cargando && (
        <div className="flex justify-center py-16" role="status">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" aria-hidden="true" />
          <span className="sr-only">{t('configuracion.cargando')}</span>
        </div>
      )}

      {error && !cargando && <p className="texto-error">{error}</p>}

      {datos && (
        <>
          <ul className="space-y-4">
            {datos.cuentas.map((cuenta) => (
              <li key={cuenta.proveedor}>
                <TarjetaCuenta
                  cuenta={cuenta}
                  tienePassword={datos.tienePassword}
                  // ¿Queda OTRA cuenta con la que entrar si se quita esta?
                  hayOtroLogin={datos.cuentas.some(
                    (c) => c.esMetodoLogin && c.proveedor !== cuenta.proveedor
                  )}
                  alCambiar={cargar}
                />
              </li>
            ))}
          </ul>

          {/* Aviso de seguridad: solo si el usuario depende por completo de
              los proveedores para entrar. Es información accionable, no un
              regaño: si mañana pierde su Discord, pierde la cuenta. */}
          {!datos.tienePassword && (
            <p className="mt-6 rounded-xl bg-zinc-100 p-4 text-sm text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400">
              <ShieldCheck className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
              {t('configuracion.soloProveedores')}
            </p>
          )}
        </>
      )}

      {/* Idioma. Va debajo de las cuentas porque estas son el motivo por el
          que se entra a esta pantalla, pero es la otra preferencia real que
          hay hoy — y el sitio donde la gente la buscará. */}
      <div className="mt-8">
        <SelectorIdioma />
      </div>

      <div className="mt-8">
        <AjusteMusica />
      </div>

      <div className="mt-8">
        <AjusteIndexado />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Aparecer en buscadores (§13)
// ─────────────────────────────────────────────────────────────────────

/**
 * `permitirIndexado` existía en el schema desde la migración inicial y
 * **nadie lo aplicaba ni había forma de cambiarlo**. Desde la Fase 10 se
 * respeta de verdad: apagarlo saca el perfil del `sitemap.xml` y le añade
 * `noindex` a su tarjeta.
 *
 * La tarjeta al compartir se sigue generando a propósito: pegar tu propio
 * enlace en un chat y que se vea bien no es lo mismo que salir en Google,
 * y la gente quiere esas dos cosas por separado.
 */
function AjusteIndexado() {
  const { t } = useTranslation();
  const usuario = useAuth((e) => e.usuario);
  const setUsuario = useAuth((e) => e.setUsuario);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  if (!usuario) return null;
  const activo = usuario.permitirIndexado !== false;

  async function alternar() {
    if (!usuario) return;
    const nuevo = !activo;
    setGuardando(true);
    setError('');
    setUsuario({ ...usuario, permitirIndexado: nuevo });
    try {
      await api.patch('/auth/preferencias', { permitirIndexado: nuevo });
    } catch (e) {
      setUsuario({ ...usuario, permitirIndexado: activo });
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="tarjeta">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-white">
        <Search className="h-4 w-4" aria-hidden="true" />
        {t('configuracion.indexado')}
      </h2>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        {t('configuracion.indexadoAyuda')}
      </p>

      {error && <p className="texto-error mb-3">{error}</p>}

      <label className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={activo}
          disabled={guardando}
          onChange={() => void alternar()}
          className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:border-zinc-700 dark:accent-white"
        />
        {t('configuracion.indexadoActivar')}
      </label>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Música de los perfiles (Fase 11)
// ─────────────────────────────────────────────────────────────────────

/**
 * "No reproducir música en los perfiles".
 *
 * Es un ajuste de CUENTA y no del navegador porque gana sobre lo que
 * decida cada perfil visitado: quien lo apaga lo hace una vez y le sigue a
 * todos sus dispositivos. El volumen concreto sí vive en el navegador —esa
 * es una preferencia del momento, no una decisión sobre la propia
 * experiencia—, y lo lleva el propio reproductor.
 *
 * `prefers-reduced-motion` no cubre audio (§7), así que este interruptor
 * es lo único que tiene quien no quiere que una web le suene sin avisar.
 */
function AjusteMusica() {
  const { t } = useTranslation();
  const usuario = useAuth((e) => e.usuario);
  const setUsuario = useAuth((e) => e.setUsuario);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  if (!usuario) return null;
  const activo = usuario.reproducirMusica !== false;

  async function alternar() {
    if (!usuario) return;
    const nuevo = !activo;
    setGuardando(true);
    setError('');
    // Optimista: el interruptor responde al instante y se revierte si el
    // servidor lo rechaza. Es un ajuste de comodidad, no una operación
    // que convenga hacer esperar.
    setUsuario({ ...usuario, reproducirMusica: nuevo });
    try {
      await api.patch('/auth/preferencias', { reproducirMusica: nuevo });
    } catch (e) {
      setUsuario({ ...usuario, reproducirMusica: activo });
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="tarjeta">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-white">
        <Music className="h-4 w-4" aria-hidden="true" />
        {t('configuracion.musica')}
      </h2>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        {t('configuracion.musicaAyuda')}
      </p>

      {error && <p className="texto-error mb-3">{error}</p>}

      <label className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={activo}
          disabled={guardando}
          onChange={() => void alternar()}
          className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:border-zinc-700 dark:accent-white"
        />
        {t('configuracion.musicaActivar')}
      </label>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Tarjeta de un proveedor
// ─────────────────────────────────────────────────────────────────────

function TarjetaCuenta({
  cuenta,
  tienePassword,
  hayOtroLogin,
  alCambiar,
}: {
  cuenta: CuentaVinculada;
  tienePassword: boolean;
  hayOtroLogin: boolean;
  alCambiar: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [mostrarDetalle, setMostrarDetalle] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  const nombre = NOMBRES[cuenta.proveedor];
  const permisos = cuenta.permisos ?? {};
  const clavesPermisos = Object.keys(cuenta.permisosDisponibles);

  /*
   * ¿Desvincular esto dejaría al usuario sin forma de entrar? El backend lo
   * rechaza igualmente —es ahí donde tiene que estar la regla—, pero
   * desactivar el botón evita el clic que acaba en un error inevitable, y
   * el `title` explica el porqué antes de intentarlo.
   */
  const esUltimaEntrada = cuenta.esMetodoLogin && !tienePassword && !hayOtroLogin;

  async function alternarPermiso(clave: string, valor: boolean) {
    setError('');
    setOcupado(true);
    try {
      await api.patch(`/cuentas/${cuenta.proveedor}/permisos`, {
        permisos: { [clave]: valor },
      });
      await alCambiar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setOcupado(false);
    }
  }

  async function desvincular() {
    setError('');
    setOcupado(true);
    try {
      await api.delete(`/cuentas/${cuenta.proveedor}`);
      await alCambiar();
    } catch (err) {
      // El backend rechaza quitar el único método de acceso; el mensaje ya
      // explica qué hacer, así que se muestra tal cual.
      setError(mensajeError(err));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-4 p-4">
        {cuenta.vinculada && cuenta.avatarRemoto ? (
          <img
            src={cuenta.avatarRemoto}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800"
            aria-hidden="true"
          >
            <Link2 className="h-5 w-5 text-zinc-400" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-zinc-900 dark:text-white">{nombre}</h2>
            {cuenta.vinculada && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.7rem] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {t('configuracion.conectado')}
              </span>
            )}
            {cuenta.esMetodoLogin && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[0.7rem] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {t('configuracion.sirveParaEntrar')}
              </span>
            )}
          </div>

          <p className="mt-0.5 truncate text-sm text-zinc-600 dark:text-zinc-400">
            {cuenta.vinculada
              ? (cuenta.usuarioRemoto ?? t('configuracion.cuentaConectada'))
              : t(CLAVE_RESUMEN[cuenta.proveedor])}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!cuenta.disponible ? (
            <span className="text-xs text-zinc-500">{t('configuracion.noDisponible')}</span>
          ) : cuenta.vinculada ? (
            <button
              type="button"
              onClick={() => void desvincular()}
              disabled={ocupado || esUltimaEntrada}
              title={
                esUltimaEntrada
                  ? t('configuracion.ultimaEntrada', { proveedor: nombre })
                  : undefined
              }
              className="btn-secundario h-9 text-xs"
            >
              <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
              {t('configuracion.desconectar')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMostrarDetalle(true)}
              className="btn-primario h-9 text-xs"
            >
              {t('configuracion.conectar')}
            </button>
          )}
        </div>
      </div>

      {cuenta.requiereReconexion && (
        <p className="mx-4 mb-4 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {t('configuracion.requiereReconexion', { proveedor: nombre })}
        </p>
      )}

      {/* El `title` del botón no lo ve un lector de pantalla ni existe en
          móvil, así que el motivo también va como texto visible. */}
      {esUltimaEntrada && (
        <p className="mx-4 mb-4 rounded-lg bg-zinc-100 p-2.5 text-xs text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400">
          {t('configuracion.ultimaEntrada', { proveedor: nombre })}
        </p>
      )}

      {error && <p className="mx-4 mb-4 texto-error">{error}</p>}

      {/* ── Permisos, solo si está vinculada y tiene alguno ── */}
      {cuenta.vinculada && clavesPermisos.length > 0 && (
        <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
            {t('configuracion.queSeMuestra')}
          </h3>
          <ul className="space-y-3">
            {clavesPermisos.map((clave) => {
              const def = cuenta.permisosDisponibles[clave]!;
              return (
                <li key={clave}>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={permisos[clave] === true}
                      disabled={ocupado}
                      onChange={(e) => void alternarPermiso(clave, e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 accent-zinc-900 dark:border-zinc-700 dark:accent-white"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm text-zinc-800 dark:text-zinc-200">
                        {def.etiqueta}
                      </span>
                      <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                        {def.detalle}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          {cuenta.proveedor === 'discord' && permisos['mostrarPresencia'] && (
            <p className="mt-3 rounded-lg bg-zinc-100 p-2.5 text-xs text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400">
              <Trans
                i18nKey="configuracion.avisoLanyard"
                components={{
                  /* El icono va DENTRO del componente y no en la cadena: el
                     catálogo es texto, no puede llevar JSX. Se pinta detrás
                     del texto del enlace, que es lo que traduce el
                     marcador. */
                  lanyard: (
                    <a
                      href="https://discord.gg/UrXF2cfJ7F"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="enlace-acento inline-flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  ),
                }}
              />
            </p>
          )}
        </div>
      )}

      {/* ── Pantalla de consentimiento, ANTES de salir al proveedor ── */}
      {mostrarDetalle && !cuenta.vinculada && (
        <PantallaConsentimiento cuenta={cuenta} alCancelar={() => setMostrarDetalle(false)} />
      )}

      {/* Quien no la tiene vinculada puede leer qué se leería, sin
          comprometerse: informar no debería costar un clic en "conectar". */}
      {!cuenta.vinculada && !mostrarDetalle && (
        <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setMostrarDetalle(true)}
            className="text-xs text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            {t('configuracion.verQueDatos')}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Consentimiento
// ─────────────────────────────────────────────────────────────────────

function PantallaConsentimiento({
  cuenta,
  alCancelar,
}: {
  cuenta: CuentaVinculada;
  alCancelar: () => void;
}) {
  const { t } = useTranslation();
  const nombre = NOMBRES[cuenta.proveedor];
  const { lee, guarda, noPide } = cuenta.descripcion;

  return (
    <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
      {/* Ojo: los elementos de estas listas los redacta el BACKEND y
          siguen llegando en español. Traducirlos exige mover
          `cuentas.controller.ts` a claves — anotado en PROYECTO.md. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Lista titulo={t('configuracion.queLeemos', { proveedor: nombre })} elementos={lee} />
        <Lista titulo={t('configuracion.queGuardamos')} elementos={guarda} />
      </div>

      {noPide.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            {t('configuracion.queNoPedimos')}
          </h3>
          <ul className="space-y-1">
            {noPide.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400"
              >
                <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
        {t('configuracion.podrasElegir', { proveedor: nombre })}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {cuenta.disponible ? (
          // <a> con navegación real, no fetch: OAuth es una cadena de
          // redirecciones que termina con las cookies puestas.
          <a href={urlVincular(cuenta.proveedor)} rel="noopener" className="btn-primario h-10">
            {t('configuracion.continuarA', { proveedor: nombre })}
          </a>
        ) : (
          <span className="text-sm text-zinc-500">{t('configuracion.noConfigurado')}</span>
        )}
        <button type="button" onClick={alCancelar} className="btn-secundario h-10">
          {t('comun.cancelar')}
        </button>
      </div>
    </div>
  );
}

function Lista({ titulo, elementos }: { titulo: string; elementos: string[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{titulo}</h3>
      <ul className="space-y-1">
        {elementos.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <Check
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-hidden="true"
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
