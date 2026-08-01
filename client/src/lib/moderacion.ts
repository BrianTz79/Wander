import { api } from './api';

/**
 * Moderación en el cliente (Fase 10).
 *
 * Dos públicos distintos en el mismo archivo: `reportar` la usa cualquier
 * usuario desde un perfil o una publicación, y el resto solo se llama
 * desde `/admin`. Están juntas porque son la misma conversación con el
 * servidor; la separación de permisos la hace el backend por ruta, no el
 * cliente por archivo.
 */

// ── Tipos ────────────────────────────────────────────────────────────

export type TipoObjeto = 'usuario' | 'perfil' | 'publicacion' | 'comentario' | 'mensaje';

export type MotivoReporte = 'spam' | 'acoso' | 'contenido-ilegal' | 'suplantacion' | 'otro';

export const MOTIVOS: MotivoReporte[] = [
  'spam',
  'acoso',
  'contenido-ilegal',
  'suplantacion',
  'otro',
];

export type EstadoReporte = 'PENDIENTE' | 'REVISADO' | 'DESCARTADO';

/** Lo reportado, resuelto por el servidor. `null` si ya no existe. */
export interface ContextoReporte {
  tipo: string;
  handle: string;
  autor: string;
  texto: string;
  oculto?: boolean;
  suspendido?: boolean;
}

export interface Reporte {
  id: string;
  tipoObjeto: TipoObjeto;
  objetoId: string;
  motivo: MotivoReporte;
  detalle: string | null;
  estado: EstadoReporte;
  createdAt: string;
  resolucion: string | null;
  contexto: ContextoReporte | null;
}

export interface ResumenModeracion {
  pendientes: number;
  revisados: number;
  descartados: number;
  suspendidos: number;
  usuarios: number;
}

/** Qué hace el moderador además de cerrar el reporte. */
export type AccionReporte = 'ninguna' | 'ocultar' | 'suspender';

// ── Llamadas ─────────────────────────────────────────────────────────

export const moderacion = {
  /** Reportar. Disponible para cualquier usuario con sesión. */
  reportar: (datos: {
    tipoObjeto: TipoObjeto;
    objetoId: string;
    motivo: MotivoReporte;
    detalle?: string;
  }) => api.post('/moderacion/reportes', datos).then(() => undefined),

  resumen: () => api.get<ResumenModeracion>('/moderacion/resumen').then((r) => r.data),

  reportes: (params: { estado?: EstadoReporte; cursor?: string; limite?: number } = {}) =>
    api
      .get<{ reportes: Reporte[]; siguiente: string | null }>('/moderacion/reportes', { params })
      .then((r) => r.data),

  resolver: (
    id: string,
    datos: { estado: 'REVISADO' | 'DESCARTADO'; accion?: AccionReporte; resolucion?: string; dias?: number }
  ) => api.patch(`/moderacion/reportes/${id}`, datos).then(() => undefined),

  suspender: (datos: { handle: string; motivo: string; dias?: number }) =>
    api.post('/moderacion/suspender', datos).then(() => undefined),

  levantar: (handle: string) =>
    api.post('/moderacion/levantar', { handle }).then(() => undefined),

  ocultar: (datos: { tipo: 'publicacion' | 'comentario'; id: string; motivo?: string }) =>
    api.post('/moderacion/ocultar', datos).then(() => undefined),

  cambiarRol: (handle: string, rol: 'USER' | 'MOD' | 'ADMIN') =>
    api.post('/moderacion/rol', { handle, rol }).then(() => undefined),
};

/** ¿Esta persona puede entrar al panel? Se usa para no pintar el enlace en
 *  la navbar a quien no modera. */
export function puedeModerar(rol: string | undefined): boolean {
  return rol === 'MOD' || rol === 'ADMIN';
}
