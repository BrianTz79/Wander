import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';

/**
 * Aviso de que el documento legal solo existe en español (Fase 6.5).
 *
 * Los términos y la privacidad **no se traducen**. No es que falte tiempo:
 * traducir un texto legal genera una segunda versión que puede decir algo
 * ligeramente distinto, y entonces hay que decidir cuál manda cuando no
 * coinciden. Con una sola versión no hay ambigüedad que resolver.
 *
 * Por eso el aviso solo aparece cuando la interfaz NO está en español: a
 * quien ya lee el documento en su idioma no le aporta nada, y quien llega
 * con la interfaz en inglés merece saber por qué esta página no cambió.
 */
export function AvisoIdiomaLegal() {
  const { i18n } = useTranslation();
  if (i18n.language.startsWith('es')) return null;

  return (
    <p
      // `lang` explícito: el resto de la página está en español y este
      // párrafo en inglés, y sin marcarlo un lector de pantalla lo leería
      // con las reglas de pronunciación equivocadas.
      lang="en"
      className="mb-8 flex items-start gap-2.5 rounded-xl bg-zinc-100 p-3 text-sm
                 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400"
    >
      <Languages className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        This document is only available in Spanish, and the Spanish version is the one that
        applies. If anything is unclear, write to us and we will explain it.
      </span>
    </p>
  );
}
