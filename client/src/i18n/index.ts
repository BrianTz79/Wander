import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { es } from './locales/es';
import { en } from './locales/en';

/**
 * i18n de la interfaz de Wander (Fase 6.5).
 *
 * Dos idiomas: español neutro/mexicano (de «tú», nunca voseo) e inglés
 * estadounidense. El español es la fuente: los textos se escribieron en
 * español y el inglés es la traducción, así que `es` es también el idioma
 * de respaldo cuando falte una clave.
 *
 * **Los catálogos se importan, no se cargan por HTTP.** Con dos idiomas y
 * unos pocos kilobytes, un backend de carga asíncrona solo añadiría un
 * parpadeo de texto sin traducir en el primer render y una petición más
 * que puede fallar. Cuando haya seis idiomas, entonces sí conviene
 * partirlos por ruta.
 *
 * No se usa `i18next-browser-languagedetector`: la detección de aquí abajo
 * son quince líneas, y necesitamos control exacto sobre el orden de
 * prioridades y sobre cómo se normaliza `es-MX` → `es`.
 */

export const IDIOMAS = ['es', 'en'] as const;
export type Idioma = (typeof IDIOMAS)[number];

/** Cómo se llama cada idioma **en ese idioma**. Un selector que dice
 *  «Spanish» a quien busca su idioma no le sirve de nada: quien no lee
 *  inglés no reconoce la palabra. */
export const NOMBRES_IDIOMA: Record<Idioma, string> = {
  es: 'Español',
  en: 'English',
};

export const CLAVE_IDIOMA = 'wander-idioma';

function esIdiomaValido(valor: string | null | undefined): valor is Idioma {
  return valor === 'es' || valor === 'en';
}

/**
 * Qué idioma usar en el primer render.
 *
 * 1. Lo que el usuario eligió a mano (localStorage) — siempre gana.
 * 2. El idioma del navegador/sistema, que es lo que pide la Fase 6.5:
 *    quien entra por primera vez ya lo ve en su idioma sin tocar nada.
 * 3. Español.
 *
 * `navigator.languages` llega como `['es-MX', 'es', 'en-US']`: se corta
 * por el guion para que `es-MX`, `es-419` y `es-ES` caigan todos en `es`.
 * Se recorre la lista entera en vez de mirar solo `navigator.language`
 * porque alguien con el sistema en inglés y el español como segunda
 * preferencia debe caer en español antes que en el respaldo.
 *
 * La preferencia de la cuenta (servidor) no se consulta aquí: llega
 * después de `/auth/yo` y la aplica `SincronizadorIdioma`.
 */
export function detectarIdioma(): Idioma {
  try {
    const guardado = localStorage.getItem(CLAVE_IDIOMA);
    if (esIdiomaValido(guardado)) return guardado;
  } catch {
    // Safari en modo privado lanza al tocar localStorage. Que no se pueda
    // recordar el idioma no es motivo para no pintar la página.
  }

  for (const etiqueta of navigator.languages ?? [navigator.language]) {
    const base = etiqueta.toLowerCase().split('-')[0];
    if (esIdiomaValido(base)) return base;
  }

  return 'es';
}

/** Refleja el idioma en `<html lang>`. Importa de verdad: es lo que usan
 *  los lectores de pantalla para elegir voz y pronunciación, y lo que lee
 *  el buscador para saber en qué idioma está la página. */
function aplicarLangDelDocumento(idioma: string) {
  document.documentElement.lang = idioma;
}

void i18n.use(initReactI18next).init({
  resources: {
    es: { traduccion: es },
    en: { traduccion: en },
  },
  lng: detectarIdioma(),
  fallbackLng: 'es',
  defaultNS: 'traduccion',
  ns: ['traduccion'],
  // React ya escapa todo lo que interpola en JSX; volver a escapar aquí
  // convertiría los acentos y las comillas en entidades HTML visibles.
  interpolation: { escapeValue: false },
  returnNull: false,
});

aplicarLangDelDocumento(i18n.language);
i18n.on('languageChanged', aplicarLangDelDocumento);

export default i18n;
