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
 */
export const RESUMEN_PROVEEDOR: Record<ProveedorVinculable, string> = {
  steam: 'Tus juegos, tus horas y tu actividad, actualizados solos.',
  discord: 'Tu estado en vivo y lo que escuchas en Spotify.',
  google: 'Una forma rápida de entrar, sin contraseña.',
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

/** Traduce los códigos que llegan como query al volver de un flujo. */
export function mensajeRetorno(params: URLSearchParams): {
  tipo: 'ok' | 'error';
  texto: string;
} | null {
  const vinculado = params.get('vinculado');
  if (vinculado) {
    const nombre = NOMBRES[vinculado as ProveedorVinculable] ?? vinculado;
    return { tipo: 'ok', texto: `${nombre} quedó vinculado a tu cuenta.` };
  }

  for (const proveedor of ['discord', 'google', 'steam'] as const) {
    if (params.get(proveedor) === 'cancelado') {
      return { tipo: 'error', texto: `Cancelaste la conexión con ${NOMBRES[proveedor]}.` };
    }
  }

  const error = params.get('error');
  if (!error) return null;

  const textos: Record<string, string> = {
    'ya-vinculada':
      'Esa cuenta ya está vinculada a otro usuario de Wander. Desvincúlala allí primero.',
    'no-configurado': 'Ese proveedor no está disponible ahora mismo.',
    state: 'La conexión caducó o no se pudo verificar. Inténtalo otra vez.',
    'sin-codigo': 'El proveedor no devolvió lo necesario para continuar.',
    proveedor: 'No se pudo hablar con el proveedor. Inténtalo en un momento.',
    sesion: 'Tu sesión cambió durante el proceso. Vuelve a intentarlo.',
  };

  return { tipo: 'error', texto: textos[error] ?? 'No se pudo completar la conexión.' };
}
