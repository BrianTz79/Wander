import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Flag, Loader2, X } from 'lucide-react';

import { mensajeError } from '../../lib/api';
import { useAuth } from '../../store/authStore';
import { moderacion, MOTIVOS, type MotivoReporte, type TipoObjeto } from '../../lib/moderacion';

/**
 * Botón de reportar con su diálogo (Fase 10).
 *
 * El modelo `Reporte` existía desde la migración inicial pero **nadie
 * podía crear uno**: no había ni endpoint ni botón. Sin esto, la cola de
 * moderación está siempre vacía por construcción y el panel de `/admin`
 * no tendría nada que revisar.
 *
 * No se pinta para quien no tiene sesión (un reporte anónimo no se puede
 * limitar ni contrastar) ni sobre el contenido propio.
 */
export function BotonReportar({
  tipoObjeto,
  objetoId,
  /** Compacto: solo el icono. Para las tarjetas del feed. */
  compacto = false,
}: {
  tipoObjeto: TipoObjeto;
  objetoId: string;
  compacto?: boolean;
}) {
  const { t } = useTranslation();
  const usuario = useAuth((e) => e.usuario);
  const [abierto, setAbierto] = useState(false);

  if (!usuario) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={
          compacto
            ? 'btn-fantasma h-8 w-8 px-0 text-zinc-400 hover:text-red-500'
            : 'btn-fantasma h-9 px-3 text-sm text-zinc-500 hover:text-red-500'
        }
        aria-label={t('reportar.abrir')}
        title={t('reportar.abrir')}
      >
        <Flag className="h-4 w-4" aria-hidden="true" />
        {!compacto && t('reportar.accion')}
      </button>

      {abierto && (
        <DialogoReportar
          tipoObjeto={tipoObjeto}
          objetoId={objetoId}
          alCerrar={() => setAbierto(false)}
        />
      )}
    </>
  );
}

function DialogoReportar({
  tipoObjeto,
  objetoId,
  alCerrar,
}: {
  tipoObjeto: TipoObjeto;
  objetoId: string;
  alCerrar: () => void;
}) {
  const { t } = useTranslation();
  const [motivo, setMotivo] = useState<MotivoReporte>('spam');
  const [detalle, setDetalle] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);

  // Escape cierra, como el resto de capas de la interfaz.
  useEffect(() => {
    const alPulsarTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar();
    };
    document.addEventListener('keydown', alPulsarTecla);
    return () => document.removeEventListener('keydown', alPulsarTecla);
  }, [alCerrar]);

  async function alEnviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await moderacion.reportar({
        tipoObjeto,
        objetoId,
        motivo,
        ...(detalle.trim() ? { detalle: detalle.trim() } : {}),
      });
      setEnviado(true);
    } catch (err) {
      setError(mensajeError(err));
      setEnviando(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={alCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reportar-titulo"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2
            id="reportar-titulo"
            className="text-lg font-semibold text-zinc-900 dark:text-white"
          >
            {t('reportar.titulo')}
          </h2>
          <button
            type="button"
            onClick={alCerrar}
            className="btn-fantasma h-8 w-8 shrink-0 px-0"
            aria-label={t('comun.cerrar')}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {enviado ? (
          <>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{t('reportar.gracias')}</p>
            <button type="button" onClick={alCerrar} className="btn-primario mt-4 h-9 w-full text-sm">
              {t('comun.cerrar')}
            </button>
          </>
        ) : (
          <form onSubmit={(e) => void alEnviar(e)} className="space-y-4">
            {error && <p className="texto-error">{error}</p>}

            <fieldset>
              <legend className="etiqueta mb-2">{t('reportar.motivo')}</legend>
              <div className="space-y-1.5">
                {MOTIVOS.map((m) => (
                  <label
                    key={m}
                    className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    <input
                      type="radio"
                      name="motivo"
                      value={m}
                      checked={motivo === m}
                      onChange={() => setMotivo(m)}
                      className="h-4 w-4 accent-zinc-900 dark:accent-white"
                    />
                    {t(`admin.motivo_${m.replace('-', '_')}`)}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="reportar-detalle" className="etiqueta">
                {t('reportar.detalle')}
              </label>
              <textarea
                id="reportar-detalle"
                value={detalle}
                onChange={(e) => setDetalle(e.target.value)}
                maxLength={1000}
                rows={3}
                className="campo h-auto resize-y py-2"
                placeholder={t('reportar.detallePlaceholder')}
              />
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('reportar.aviso')}</p>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={enviando}
                className="btn-primario h-9 flex-1 text-sm disabled:opacity-50"
              >
                {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {t('reportar.enviar')}
              </button>
              <button type="button" onClick={alCerrar} className="btn-fantasma h-9 px-4 text-sm">
                {t('comun.cancelar')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
