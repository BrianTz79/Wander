import type { TFunction } from 'i18next';

import { textoErrorExterno } from './erroresExternos';

/**
 * Cuentas vinculadas en el cliente (Fase 6).
 *
 * Espeja lo que devuelve `server/src/controllers/cuentas.controller.ts`.
 * Nótese lo que NO está: ningún campo de token. El backend no los
 * serializa, así que aquí no hay dónde guardarlos ni por descuido.
 */

export type ProveedorVinculable = 'steam' | 'discord' | 'google';

export interface DefinicionPermiso {
  etiqueta: string;
  detalle: string;
  pordefecto: boolean;
}

export interface DescripcionVinculacion {
  lee: string[];
  guarda: string[];
  noPide: string[];
}

export interface CuentaVinculada {
  proveedor: ProveedorVinculable;
  /** `false` si al servidor le faltan las credenciales del proveedor. */
  disponible: boolean;
  vinculada: boolean;
  usuarioRemoto: string | null;
  avatarRemoto: string | null;
  esMetodoLogin: boolean;
  requiereReconexion: boolean;
  sincronizadoEn: string | null;
  vinculadaEn: string | null;
  permisos: Record<string, boolean> | null;
  permisosDisponibles: Record<string, DefinicionPermiso>;
  descripcion: DescripcionVinculacion;
}

export interface RespuestaCuentas {
  cuentas: CuentaVinculada[];
  tienePassword: boolean;
  tieneEmail: boolean;
}

/** Nombre presentable de cada proveedor. */
export const NOMBRES: Record<ProveedorVinculable, string> = {
  steam: 'Steam',
  discord: 'Discord',
  google: 'Google',
};

/**
 * Qué aporta cada proveedor, en una línea. Es lo que se lee ANTES de
 * pulsar "vincular", así que dice el beneficio concreto, no el mecanismo.
 *
 * Se guarda la CLAVE del catálogo, no el texto: es un objeto de módulo, se
 * evalúa una sola vez al importarlo, y un texto resuelto ahí se quedaría
 * congelado en el idioma que hubiera al arrancar.
 */
export const CLAVE_RESUMEN: Record<ProveedorVinculable, string> = {
  steam: 'configuracion.resumenSteam',
  discord: 'configuracion.resumenDiscord',
  google: 'configuracion.resumenGoogle',
};

/**
 * A dónde manda el navegador para iniciar el flujo. Es una navegación
 * real, no un fetch: OAuth es una cadena de redirecciones que termina con
 * las cookies puestas, y `fetch` la rompería.
 */
export function urlVincular(proveedor: ProveedorVinculable): string {
  // Steam sigue con OpenID 2.0 y vive bajo /api/auth (Fase 2).
  return proveedor === 'steam' ? '/api/auth/steam' : `/api/oauth/${proveedor}`;
}

/**
 * Traduce los códigos que llegan como query al volver de un flujo.
 *
 * Recibe `t` en vez de importarlo: así el componente que lo llama se
 * vuelve a ejecutar —y este mensaje se recalcula— al cambiar de idioma.
 *
 * El nombre del proveedor se resuelve contra `NOMBRES`, nunca se pinta el
 * valor crudo de la query: `?vinculado=<lo que sea>` acabaría si no en
 * pantalla tal cual.
 */
export function mensajeRetorno(
  params: URLSearchParams,
  t: TFunction
): { tipo: 'ok' | 'error'; texto: string } | null {
  const vinculado = params.get('vinculado');
  if (vinculado && vinculado in NOMBRES) {
    const nombre = NOMBRES[vinculado as ProveedorVinculable];
    return { tipo: 'ok', texto: t('configuracion.vinculado', { proveedor: nombre }) };
  }

  for (const proveedor of ['discord', 'google', 'steam'] as const) {
    if (params.get(proveedor) === 'cancelado') {
      return {
        tipo: 'error',
        texto: t('configuracion.canceloConexion', { proveedor: NOMBRES[proveedor] }),
      };
    }
  }

  const error = params.get('error');
  if (!error) return null;

  return { tipo: 'error', texto: textoErrorExterno(error, t) };
}
