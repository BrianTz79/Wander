import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from './api';
import { useAuth } from '../store/authStore';
import { CLAVE_IDIOMA, IDIOMAS, NOMBRES_IDIOMA, type Idioma } from '../i18n';

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
 *  1. Lo que el usuario eligió **en este navegador** (`localStorage`).
 *  2. Lo que tiene guardado **en su cuenta**.
 *  3. El idioma del navegador o del sistema (lo resuelve `detectarIdioma`).
 *
 * El 1 va por delante del 2 a propósito: si alguien acaba de pulsar
 * «English» en esta máquina, que `/auth/yo` responda `es` medio segundo
 * después no puede devolverle la página al español delante de sus ojos.
 */
export function useSincronizarIdiomaDeCuenta() {
  const { i18n } = useTranslation();
  const usuario = useAuth((e) => e.usuario);

  useEffect(() => {
    if (!usuario?.idioma) return;

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
