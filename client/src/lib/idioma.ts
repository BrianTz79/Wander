import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from './api';
import { useAuth } from '../store/authStore';
import { CLAVE_IDIOMA, IDIOMAS, NOMBRES_IDIOMA, PARAM_IDIOMA, type Idioma } from '../i18n';

export { IDIOMAS, NOMBRES_IDIOMA, type Idioma };

/**
 * Idioma de la interfaz (Fase 6.5).
 *
 * Sigue el mismo patrón que `useTema`: un hook que lee el estado actual y
 * lo cambia, con la preferencia guardada en `localStorage`.
 *
 * La diferencia con el tema es que el idioma **también se guarda en la
 * cuenta**. No es simetría por gusto: en la Fase 8 el servidor tendrá que
 * escribir notificaciones y correos, y para eso necesita saber en qué
 * idioma hablarle a cada quien — algo que un `localStorage` del navegador
 * no le puede contar.
 */
export function useIdioma() {
  const { i18n } = useTranslation();
  const usuario = useAuth((e) => e.usuario);
  const setUsuario = useAuth((e) => e.setUsuario);

  const idioma = (i18n.language.split('-')[0] ?? 'es') as Idioma;

  const cambiar = useCallback(
    (nuevo: Idioma) => {
      void i18n.changeLanguage(nuevo);

      try {
        localStorage.setItem(CLAVE_IDIOMA, nuevo);
      } catch {
        // Modo privado de Safari. La interfaz ya cambió; solo se pierde el
        // recuerdo entre sesiones.
      }

      /*
       * Quitar el `?lang=` de la barra al elegir a mano.
       *
       * Quien llega por un `hreflang` (`?lang=en`) y luego pulsa
       * «Español» dejaría el parámetro puesto: la elección vale para esta
       * pantalla, pero al recargar o al compartir la URL volvería a ganar
       * el `?lang=en`, que es más fuerte que el `localStorage` recién
       * escrito. Se limpia con `replaceState` —no `pushState`— para no
       * meter una entrada en el historial que devolvería al idioma
       * anterior con el botón «atrás».
       */
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has(PARAM_IDIOMA)) {
          url.searchParams.delete(PARAM_IDIOMA);
          window.history.replaceState(null, '', url.toString());
        }
      } catch {
        // Si el historial no se deja tocar, la elección sigue aplicada.
      }

      /*
       * Con sesión abierta se persiste en la cuenta, pero **sin esperar a
       * la respuesta ni deshacer si falla**: el idioma ya cambió en
       * pantalla, y revertirlo porque una petición de fondo no llegó sería
       * mucho más desconcertante que quedarse sin guardar la preferencia.
       */
      if (usuario) {
        // `nuevo`, NO `idioma`: este último es el del render actual, o sea
        // el que se está abandonando. Mandarlo guardaba el idioma viejo y
        // dejaba la cuenta sin enterarse del cambio.
        void api.patch('/auth/preferencias', { idioma: nuevo }).catch(() => undefined);
        setUsuario({ ...usuario, idioma: nuevo });
      }
    },
    [i18n, usuario, setUsuario]
  );

  return { idioma, cambiar };
}

/**
 * Aplica el idioma guardado en la cuenta cuando llega la sesión.
 *
 * Orden de prioridades, de más a menos fuerte:
 *  1. El `?lang=` de la URL (Fase 12) — un enlace explícito a esta página
 *     en un idioma concreto.
 *  2. Lo que el usuario eligió **en este navegador** (`localStorage`).
 *  3. Lo que tiene guardado **en su cuenta**.
 *  4. El idioma del navegador o del sistema (lo resuelve `detectarIdioma`).
 *
 * El 2 va por delante del 3 a propósito: si alguien acaba de pulsar
 * «English» en esta máquina, que `/auth/yo` responda `es` medio segundo
 * después no puede devolverle la página al español delante de sus ojos.
 *
 * Y el 1 va por delante de los dos por el mismo motivo, un paso más
 * arriba: `detectarIdioma` ya respetó el `?lang=` en el primer render, y
 * sin esta comprobación la cuenta lo desharía en cuanto respondiera
 * `/auth/yo` — el `hreflang` llevaría a una página que parpadea al idioma
 * equivocado justo delante de quien siguió el enlace.
 */
export function useSincronizarIdiomaDeCuenta() {
  const { i18n } = useTranslation();
  const usuario = useAuth((e) => e.usuario);

  useEffect(() => {
    if (!usuario?.idioma) return;

    try {
      if (new URLSearchParams(window.location.search).get(PARAM_IDIOMA)) return;
    } catch {
      // URL rara: se sigue con las demás prioridades.
    }

    try {
      if (localStorage.getItem(CLAVE_IDIOMA)) return;
    } catch {
      // Sin localStorage no hay elección local que respetar: manda la cuenta.
    }

    if (usuario.idioma !== i18n.language) {
      void i18n.changeLanguage(usuario.idioma);
    }
  }, [usuario?.idioma, i18n]);
}
