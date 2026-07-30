import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Link2,
  Loader2,
  ShieldCheck,
  Unlink,
  X,
} from 'lucide-react';
import { api, mensajeError } from '../lib/api';
import {
  NOMBRES,
  RESUMEN_PROVEEDOR,
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
  const [datos, setDatos] = useState<RespuestaCuentas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [params, setParams] = useSearchParams();

  // Mensaje de vuelta de un flujo OAuth (?vinculado=discord, ?error=…).
  const [aviso, setAviso] = useState(() => mensajeRetorno(params));

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
          Cuentas vinculadas
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Conecta tus plataformas para que tu perfil se mantenga solo. Tú decides qué se muestra, y
          puedes desconectar cuando quieras.{' '}
          <Link to="/privacidad" className="enlace-acento">
            Cómo tratamos tus datos
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
            aria-label="Cerrar aviso"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {cargando && (
        <div className="flex justify-center py-16" role="status">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" aria-hidden="true" />
          <span className="sr-only">Cargando tus cuentas…</span>
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
              Entras a Wander solo con las cuentas de arriba. Si algún día pierdes el acceso a
              ellas, perderías también esta cuenta: por eso no te dejamos desvincular la última.
            </p>
          )}
        </>
      )}
    </div>
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
                Conectado
              </span>
            )}
            {cuenta.esMetodoLogin && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[0.7rem] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                Sirve para entrar
              </span>
            )}
          </div>

          <p className="mt-0.5 truncate text-sm text-zinc-600 dark:text-zinc-400">
            {cuenta.vinculada
              ? (cuenta.usuarioRemoto ?? 'Cuenta conectada')
              : RESUMEN_PROVEEDOR[cuenta.proveedor]}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!cuenta.disponible ? (
            <span className="text-xs text-zinc-500">No disponible</span>
          ) : cuenta.vinculada ? (
            <button
              type="button"
              onClick={() => void desvincular()}
              disabled={ocupado || esUltimaEntrada}
              title={
                esUltimaEntrada
                  ? `${nombre} es tu única forma de entrar. Ponle una contraseña a tu cuenta o vincula otro proveedor antes de quitarlo.`
                  : undefined
              }
              className="btn-secundario h-9 text-xs"
            >
              <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
              Desconectar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMostrarDetalle(true)}
              className="btn-primario h-9 text-xs"
            >
              Conectar
            </button>
          )}
        </div>
      </div>

      {cuenta.requiereReconexion && (
        <p className="mx-4 mb-4 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          El permiso caducó o lo revocaste desde {nombre}. Vuelve a conectarlo para que tus datos
          sigan actualizándose.
        </p>
      )}

      {/* El `title` del botón no lo ve un lector de pantalla ni existe en
          móvil, así que el motivo también va como texto visible. */}
      {esUltimaEntrada && (
        <p className="mx-4 mb-4 rounded-lg bg-zinc-100 p-2.5 text-xs text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400">
          {nombre} es tu única forma de entrar a Wander. Ponle una contraseña a tu cuenta o vincula
          otro proveedor antes de desconectarlo.
        </p>
      )}

      {error && <p className="mx-4 mb-4 texto-error">{error}</p>}

      {/* ── Permisos, solo si está vinculada y tiene alguno ── */}
      {cuenta.vinculada && clavesPermisos.length > 0 && (
        <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Qué se muestra en tu perfil
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
              Para leer tu estado en vivo hace falta que estés en el servidor de Lanyard:{' '}
              <a
                href="https://discord.gg/UrXF2cfJ7F"
                target="_blank"
                rel="noreferrer noopener"
                className="enlace-acento inline-flex items-center gap-1"
              >
                discord.gg/UrXF2cfJ7F
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
              . Es un servicio externo que lee la presencia de Discord; sin él, Discord no la
              comparte con nadie.
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
            Ver qué datos se leerían
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
  const nombre = NOMBRES[cuenta.proveedor];
  const { lee, guarda, noPide } = cuenta.descripcion;

  return (
    <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
      <div className="grid gap-4 sm:grid-cols-2">
        <Lista titulo={`Qué leemos de ${nombre}`} elementos={lee} />
        <Lista titulo="Qué guardamos" elementos={guarda} />
      </div>

      {noPide.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Qué NO pedimos
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
        Podrás elegir qué se muestra después de conectar, y desconectar cuando quieras: al hacerlo
        se borran tanto la conexión como los datos que hubiéramos guardado de {nombre}.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {cuenta.disponible ? (
          // <a> con navegación real, no fetch: OAuth es una cadena de
          // redirecciones que termina con las cookies puestas.
          <a href={urlVincular(cuenta.proveedor)} rel="noopener" className="btn-primario h-10">
            Continuar a {nombre}
          </a>
        ) : (
          <span className="text-sm text-zinc-500">
            Este proveedor no está configurado en el servidor ahora mismo.
          </span>
        )}
        <button type="button" onClick={alCancelar} className="btn-secundario h-10">
          Cancelar
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
