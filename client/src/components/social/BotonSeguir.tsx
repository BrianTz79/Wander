import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, UserMinus, UserPlus } from 'lucide-react';

import { social, type Relacion } from '../../lib/social';
import { mensajeError } from '../../lib/api';
import { useAuth } from '../../store/authStore';

interface Props {
  relacion: Relacion;
  alCambiar: (relacion: Relacion) => void;
  /** Estilo del perfil público (variables `--p-*`) en vez del de Wander. */
  temaDePerfil?: boolean;
}

/**
 * Botón de seguir / dejar de seguir.
 *
 * Al pasar el ratón sobre "Siguiendo" cambia a "Dejar de seguir": es la
 * convención de todas las redes y evita el error de pulsar por costumbre
 * creyendo que sigue siendo el botón de seguir.
 *
 * **Actualización optimista.** El estado cambia en pantalla antes de que
 * responda el servidor, y se revierte si falla. Seguir a alguien es una
 * acción trivial y reversible: hacer esperar medio segundo con un spinner
 * la hace sentir pesada sin ganar nada.
 */
export function BotonSeguir({ relacion, alCambiar, temaDePerfil = false }: Props) {
  const { t } = useTranslation();
  const usuario = useAuth((e) => e.usuario);
  const [enviando, setEnviando] = useState(false);
  const [sobre, setSobre] = useState(false);
  const [error, setError] = useState('');

  // No se ofrece el botón a quien no tiene sesión ni en el perfil propio.
  if (!usuario || relacion.esPropio) return null;

  async function alternar() {
    if (enviando) return;

    const seguiaAntes = relacion.losigo;
    const previo = relacion;

    // Optimista: contador incluido, para que el número no se quede quieto
    // mientras el botón ya cambió.
    alCambiar({
      ...relacion,
      losigo: !seguiaAntes,
      seguidores: relacion.seguidores + (seguiaAntes ? -1 : 1),
    });

    setEnviando(true);
    setError('');
    try {
      if (seguiaAntes) {
        await social.dejarDeSeguir(relacion.handle);
      } else {
        await social.seguir(relacion.handle);
      }
    } catch (e) {
      // Revierte al estado exacto de antes, no a "lo contrario de ahora":
      // si algo más lo cambió mientras tanto, esto es lo correcto.
      alCambiar(previo);
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  }

  const siguiendo = relacion.losigo;
  const etiqueta = siguiendo
    ? sobre
      ? t('social.dejarDeSeguir')
      : t('social.siguiendo')
    : t('social.seguir');

  const estiloPerfil = temaDePerfil
    ? {
        backgroundColor: siguiendo ? 'var(--p-tarjeta)' : 'var(--p-acento)',
        color: siguiendo ? 'var(--p-texto)' : 'var(--p-fondo)',
        border: '1px solid var(--p-borde)',
        borderRadius: 'var(--p-radio)',
      }
    : undefined;

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={alternar}
        onMouseEnter={() => setSobre(true)}
        onMouseLeave={() => setSobre(false)}
        onFocus={() => setSobre(true)}
        onBlur={() => setSobre(false)}
        disabled={enviando}
        aria-pressed={siguiendo}
        style={estiloPerfil}
        className={
          temaDePerfil
            ? 'inline-flex h-10 items-center gap-2 px-4 text-sm font-semibold transition-transform hover:scale-105 disabled:opacity-60'
            : `inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors disabled:opacity-60 ${
                siguiendo
                  ? 'border border-zinc-300 text-zinc-700 hover:border-red-300 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-red-800 dark:hover:text-red-400'
                  : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200'
              }`
        }
      >
        {enviando ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : siguiendo ? (
          sobre ? (
            <UserMinus className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )
        ) : (
          <UserPlus className="h-4 w-4" aria-hidden="true" />
        )}
        {etiqueta}
      </button>

      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
