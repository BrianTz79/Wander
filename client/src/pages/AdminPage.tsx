import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, EyeOff, Loader2, ShieldBan, ShieldCheck } from 'lucide-react';

import { mensajeError } from '../lib/api';
import { useAuth } from '../store/authStore';
import {
  moderacion,
  type AccionReporte,
  type EstadoReporte,
  type Reporte,
  type ResumenModeracion,
} from '../lib/moderacion';

/**
 * Panel de moderación (Fase 10).
 *
 * Solo lo ve quien tiene rol MOD o ADMIN — la ruta lo comprueba y el
 * backend lo vuelve a comprobar en cada endpoint, que es donde cuenta.
 *
 * La pantalla está armada alrededor de la cola: lo primero es qué hay
 * pendiente, y cada reporte trae su contenido resuelto para poder decidir
 * sin salir de aquí. Las acciones sueltas (suspender a alguien que nadie
 * ha reportado, levantar una suspensión) viven abajo, porque son la
 * excepción y no el trabajo del día.
 */

const ESTADOS: EstadoReporte[] = ['PENDIENTE', 'REVISADO', 'DESCARTADO'];

export function AdminPage() {
  const { t } = useTranslation();
  const usuario = useAuth((e) => e.usuario);

  const [estado, setEstado] = useState<EstadoReporte>('PENDIENTE');
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [resumen, setResumen] = useState<ResumenModeracion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = `${t('admin.titulo')} · Wander`;
  }, [t]);

  const cargar = useCallback(
    async (cual: EstadoReporte) => {
      setCargando(true);
      setError('');
      try {
        const [pagina, cifras] = await Promise.all([
          moderacion.reportes({ estado: cual }),
          moderacion.resumen(),
        ]);
        setReportes(pagina.reportes);
        setResumen(cifras);
      } catch (e) {
        setError(mensajeError(e));
      } finally {
        setCargando(false);
      }
    },
    []
  );

  useEffect(() => {
    void cargar(estado);
  }, [cargar, estado]);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('admin.titulo')}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t('admin.subtitulo')}</p>
      </header>

      {resumen && (
        <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Cifra etiqueta={t('admin.pendientes')} valor={resumen.pendientes} destacada />
          <Cifra etiqueta={t('admin.revisados')} valor={resumen.revisados} />
          <Cifra etiqueta={t('admin.suspendidos')} valor={resumen.suspendidos} />
          <Cifra etiqueta={t('admin.usuarios')} valor={resumen.usuarios} />
        </dl>
      )}

      {/* Filtro por estado. Son pestañas de verdad (`role="tablist"`) para
          que un lector de pantalla anuncie cuál está activa. */}
      <div role="tablist" aria-label={t('admin.filtrar')} className="mb-4 flex flex-wrap gap-2">
        {ESTADOS.map((e) => (
          <button
            key={e}
            role="tab"
            type="button"
            aria-selected={estado === e}
            onClick={() => setEstado(e)}
            className={
              estado === e
                ? 'btn-primario h-9 px-4 text-xs'
                : 'btn-fantasma h-9 px-4 text-xs border border-zinc-200 dark:border-zinc-800'
            }
          >
            {t(`admin.estado${e}`)}
          </button>
        ))}
      </div>

      {error && <p className="texto-error mb-4">{error}</p>}

      {cargando ? (
        <p className="flex items-center gap-2 py-8 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t('comun.cargando')}
        </p>
      ) : reportes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {estado === 'PENDIENTE' ? t('admin.colaVacia') : t('admin.sinReportes')}
        </p>
      ) : (
        <ul className="space-y-3">
          {reportes.map((r) => (
            <TarjetaReporte key={r.id} reporte={r} alResolver={() => void cargar(estado)} />
          ))}
        </ul>
      )}

      <AccionesDirectas alActuar={() => void cargar(estado)} />

      {usuario?.rol === 'ADMIN' && <PanelRoles />}
    </main>
  );
}

function Cifra({
  etiqueta,
  valor,
  destacada = false,
}: {
  etiqueta: string;
  valor: number;
  destacada?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <dt className="text-xs text-zinc-500 dark:text-zinc-400">{etiqueta}</dt>
      <dd
        className={
          destacada && valor > 0
            ? 'text-2xl font-bold text-amber-600 dark:text-amber-500'
            : 'text-2xl font-bold text-zinc-900 dark:text-white'
        }
      >
        {valor}
      </dd>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Un reporte de la cola
// ─────────────────────────────────────────────────────────────────────

function TarjetaReporte({ reporte, alResolver }: { reporte: Reporte; alResolver: () => void }) {
  const { t, i18n } = useTranslation();
  const [accion, setAccion] = useState<AccionReporte>('ninguna');
  const [dias, setDias] = useState('');
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const pendiente = reporte.estado === 'PENDIENTE';
  const ctx = reporte.contexto;

  /** El contenido puede ocultarse; a un usuario se le suspende. */
  const sePuedeOcultar =
    reporte.tipoObjeto === 'publicacion' || reporte.tipoObjeto === 'comentario';

  async function resolver(estadoFinal: 'REVISADO' | 'DESCARTADO') {
    setEnviando(true);
    setError('');
    try {
      await moderacion.resolver(reporte.id, {
        estado: estadoFinal,
        // Descartar es decir "esto no procedía": llevar una acción
        // adjunta sería contradictorio, así que se manda siempre
        // `ninguna` y el selector de arriba se ignora.
        accion: estadoFinal === 'DESCARTADO' ? 'ninguna' : accion,
        ...(nota.trim() ? { resolucion: nota.trim() } : {}),
        ...(accion === 'suspender' && dias.trim() ? { dias: Number(dias) } : {}),
      });
      alResolver();
    } catch (e) {
      setError(mensajeError(e));
      setEnviando(false);
    }
  }

  return (
    <li className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
            <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
            {t(`admin.motivo_${reporte.motivo.replace('-', '_')}`)}
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-normal text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {t(`admin.tipo_${reporte.tipoObjeto}`)}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {new Date(reporte.createdAt).toLocaleString(i18n.language)}
          </p>
        </div>
      </div>

      {reporte.detalle && (
        <p className="mt-3 rounded-md bg-zinc-50 p-2 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {reporte.detalle}
        </p>
      )}

      {/* El contenido reportado. Se pinta como texto plano a propósito:
          nada de lo que hay aquí se interpreta como HTML. */}
      <div className="mt-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        {ctx ? (
          <>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              <Link to={`/u/${ctx.handle}`} className="font-medium hover:underline">
                @{ctx.handle}
              </Link>
              {ctx.oculto && ` · ${t('admin.yaOculto')}`}
              {ctx.suspendido && ` · ${t('admin.yaSuspendido')}`}
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
              {ctx.texto || <em className="text-zinc-400">{t('admin.sinTexto')}</em>}
            </p>
          </>
        ) : (
          <p className="text-sm text-zinc-400">{t('admin.objetoBorrado')}</p>
        )}
      </div>

      {reporte.resolucion && !pendiente && (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          {t('admin.resolucion')}: {reporte.resolucion}
        </p>
      )}

      {pendiente && (
        <div className="mt-4 space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          {error && <p className="texto-error">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor={`acc-${reporte.id}`}>
              {t('admin.accion')}
            </label>
            <select
              id={`acc-${reporte.id}`}
              value={accion}
              onChange={(e) => setAccion(e.target.value as AccionReporte)}
              className="campo h-9 w-auto text-sm"
            >
              <option value="ninguna">{t('admin.accionNinguna')}</option>
              {sePuedeOcultar && <option value="ocultar">{t('admin.accionOcultar')}</option>}
              <option value="suspender">{t('admin.accionSuspender')}</option>
            </select>

            {accion === 'suspender' && (
              <>
                <label className="sr-only" htmlFor={`dias-${reporte.id}`}>
                  {t('admin.dias')}
                </label>
                <input
                  id={`dias-${reporte.id}`}
                  type="number"
                  min={1}
                  max={3650}
                  value={dias}
                  onChange={(e) => setDias(e.target.value)}
                  placeholder={t('admin.diasPlaceholder')}
                  className="campo h-9 w-32 text-sm"
                />
              </>
            )}
          </div>

          <div>
            <label className="sr-only" htmlFor={`nota-${reporte.id}`}>
              {t('admin.nota')}
            </label>
            <input
              id={`nota-${reporte.id}`}
              type="text"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={500}
              placeholder={t('admin.notaPlaceholder')}
              className="campo h-9 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void resolver('REVISADO')}
              disabled={enviando}
              className="btn-primario h-9 px-4 text-xs"
            >
              {enviando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {t('admin.marcarRevisado')}
            </button>
            <button
              type="button"
              onClick={() => void resolver('DESCARTADO')}
              disabled={enviando}
              className="btn-fantasma h-9 px-4 text-xs border border-zinc-200 dark:border-zinc-800"
            >
              {t('admin.descartar')}
            </button>
          </div>

          <p className="text-xs text-zinc-400">{t('admin.avisoAccion')}</p>
        </div>
      )}
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Acciones sobre una cuenta concreta
// ─────────────────────────────────────────────────────────────────────

function AccionesDirectas({ alActuar }: { alActuar: () => void }) {
  const { t } = useTranslation();
  const [handle, setHandle] = useState('');
  const [motivo, setMotivo] = useState('');
  const [dias, setDias] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState('');

  async function ejecutar(que: 'suspender' | 'levantar') {
    setEnviando(true);
    setError('');
    setHecho('');
    try {
      if (que === 'suspender') {
        await moderacion.suspender({
          handle: handle.trim().toLowerCase(),
          motivo: motivo.trim(),
          ...(dias.trim() ? { dias: Number(dias) } : {}),
        });
        setHecho(t('admin.hechoSuspender', { handle: handle.trim() }));
      } else {
        await moderacion.levantar(handle.trim().toLowerCase());
        setHecho(t('admin.hechoLevantar', { handle: handle.trim() }));
      }
      setHandle('');
      setMotivo('');
      setDias('');
      alActuar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  }

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    void ejecutar('suspender');
  }

  return (
    <section className="mt-10 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
        {t('admin.accionesDirectas')}
      </h2>
      <p className="mt-1 mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        {t('admin.accionesDirectasAyuda')}
      </p>

      <form onSubmit={alEnviar} className="space-y-3">
        {error && <p className="texto-error">{error}</p>}
        {hecho && <p className="text-sm text-emerald-600 dark:text-emerald-400">{hecho}</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="mod-handle" className="etiqueta">
              {t('admin.handle')}
            </label>
            <input
              id="mod-handle"
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              maxLength={24}
              required
              className="campo h-10"
              placeholder="alguien"
            />
          </div>
          <div>
            <label htmlFor="mod-dias" className="etiqueta">
              {t('admin.dias')}
            </label>
            <input
              id="mod-dias"
              type="number"
              min={1}
              max={3650}
              value={dias}
              onChange={(e) => setDias(e.target.value)}
              className="campo h-10"
              placeholder={t('admin.diasPlaceholder')}
            />
          </div>
        </div>

        <div>
          <label htmlFor="mod-motivo" className="etiqueta">
            {t('admin.motivo')}
          </label>
          <input
            id="mod-motivo"
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={500}
            className="campo h-10"
            placeholder={t('admin.motivoPlaceholder')}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={enviando || !handle.trim() || !motivo.trim()}
            className="btn-primario h-9 px-4 text-xs disabled:opacity-50"
          >
            <ShieldBan className="h-3.5 w-3.5" aria-hidden="true" />
            {t('admin.suspender')}
          </button>
          <button
            type="button"
            onClick={() => void ejecutar('levantar')}
            disabled={enviando || !handle.trim()}
            className="btn-fantasma h-9 px-4 text-xs border border-zinc-200 disabled:opacity-50 dark:border-zinc-800"
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t('admin.levantar')}
          </button>
        </div>
      </form>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Roles (solo ADMIN)
// ─────────────────────────────────────────────────────────────────────

function PanelRoles() {
  const { t } = useTranslation();
  const [handle, setHandle] = useState('');
  const [rol, setRol] = useState<'USER' | 'MOD' | 'ADMIN'>('MOD');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState('');

  async function alEnviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    setHecho('');
    try {
      await moderacion.cambiarRol(handle.trim().toLowerCase(), rol);
      setHecho(t('admin.hechoRol', { handle: handle.trim(), rol }));
      setHandle('');
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t('admin.roles')}</h2>
      <p className="mt-1 mb-4 text-sm text-zinc-500 dark:text-zinc-400">{t('admin.rolesAyuda')}</p>

      <form onSubmit={(e) => void alEnviar(e)} className="space-y-3">
        {error && <p className="texto-error">{error}</p>}
        {hecho && <p className="text-sm text-emerald-600 dark:text-emerald-400">{hecho}</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="rol-handle" className="etiqueta">
              {t('admin.handle')}
            </label>
            <input
              id="rol-handle"
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              maxLength={24}
              required
              className="campo h-10"
            />
          </div>
          <div>
            <label htmlFor="rol-valor" className="etiqueta">
              {t('admin.rol')}
            </label>
            <select
              id="rol-valor"
              value={rol}
              onChange={(e) => setRol(e.target.value as 'USER' | 'MOD' | 'ADMIN')}
              className="campo h-10"
            >
              <option value="USER">USER</option>
              <option value="MOD">MOD</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={enviando || !handle.trim()}
          className="btn-primario h-9 px-4 text-xs disabled:opacity-50"
        >
          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
          {t('admin.cambiarRol')}
        </button>
      </form>
    </section>
  );
}
