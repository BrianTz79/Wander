import axios, { AxiosError } from 'axios';

import i18n from '../i18n';

/**
 * Cliente HTTP.
 *
 * `withCredentials: true` es esencial: la sesión vive en cookies httpOnly,
 * así que el navegador tiene que mandarlas en cada petición. No hay ningún
 * token en localStorage ni en memoria — es lo que hace que un XSS no
 * pueda robar la sesión.
 */
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

/*
 * El idioma viaja en `Accept-Language` en cada petición. Hoy el backend
 * apenas lo necesita —sus mensajes siguen viniendo en español—, pero es la
 * cabecera estándar para esto y estará puesta el día que el servidor
 * escriba algo destinado a leerse (Fase 8).
 */
api.interceptors.request.use((config) => {
  config.headers.set('Accept-Language', i18n.language);
  return config;
});

/**
 * Extrae el mensaje de error legible que manda el backend.
 *
 * **Los mensajes del servidor siguen llegando en español.** Traducirlos
 * exigiría que el backend mandara un código por cada error de validación
 * de zod —hay decenas, repartidos por todos los schemas— y ese cambio es
 * bastante más grande que esta fase. Lo que sí está traducido es todo lo
 * que se origina aquí: red, tiempo de espera y los códigos de los flujos
 * externos, que son los errores que la gente ve de verdad a menudo.
 * Queda anotado como pendiente en PROYECTO.md.
 */
export function mensajeError(error: unknown): string {
  if (error instanceof AxiosError) {
    const datos = error.response?.data as
      | { error?: string; detalles?: Array<{ campo: string; mensaje: string }> }
      | undefined;

    if (datos?.detalles?.length) {
      return datos.detalles.map((d) => d.mensaje).join(' ');
    }
    if (datos?.error) return datos.error;
    if (error.code === 'ECONNABORTED') return i18n.t('errores.timeout');
    if (!error.response) return i18n.t('errores.sinConexion');
  }
  return i18n.t('errores.inesperado');
}

/** Errores de validación por campo, para pintarlos junto a cada input. */
export function erroresPorCampo(error: unknown): Record<string, string> {
  if (!(error instanceof AxiosError)) return {};
  const detalles = (error.response?.data as { detalles?: Array<{ campo: string; mensaje: string }> })
    ?.detalles;
  if (!detalles) return {};
  return Object.fromEntries(detalles.map((d) => [d.campo, d.mensaje]));
}

// ── Renovación automática de sesión ──────────────────────────────────
// El access token dura 15 min. Cuando expira, la siguiente petición
// devuelve 401; aquí se intenta renovar una sola vez y se reintenta la
// original. Así la sesión se siente continua durante 30 días sin exponer
// un token de larga vida al JavaScript.

let renovando: Promise<boolean> | null = null;

async function renovarSesion(): Promise<boolean> {
  // Si ya hay una renovación en curso, todas las peticiones esperan la
  // misma en vez de disparar N refresh simultáneos (que además rotarían
  // el token entre ellas y se invalidarían unas a otras).
  renovando ??= api
    .post('/auth/refresh')
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      renovando = null;
    });
  return renovando;
}

api.interceptors.response.use(
  (respuesta) => respuesta,
  async (error: AxiosError) => {
    const config = error.config as (typeof error.config & { _reintentado?: boolean }) | undefined;

    const esRutaDeAuth =
      config?.url?.includes('/auth/refresh') ||
      config?.url?.includes('/auth/login') ||
      config?.url?.includes('/auth/registro');

    if (error.response?.status === 401 && config && !config._reintentado && !esRutaDeAuth) {
      config._reintentado = true;
      const ok = await renovarSesion();
      if (ok) return api.request(config);
    }

    return Promise.reject(error);
  }
);
