import { api } from './api';
import type { Adjunto } from './archivos';
import type { AutorResumen } from './social';

/**
 * Mensajería en el cliente (Fase 8): tipos que espejan al backend y las
 * llamadas REST.
 *
 * **El REST es la fuente de verdad**, igual que en el servidor. El socket
 * (`lib/socket.ts`) solo adelanta lo que aquí se puede pedir de todos
 * modos, así que el chat funciona entero aunque los websockets estén
 * bloqueados.
 */

// ── Tipos ────────────────────────────────────────────────────────────

export interface Conversacion {
  id: string;
  esGrupo: boolean;
  /** En un DM es el nombre del otro; en un grupo, el del grupo. */
  nombre: string | null;
  iconoUrl: string | null;
  /** Solo en DMs: el handle del otro, para enlazar a su perfil. */
  handle: string | null;
  ultimoMsgEn: string;
  ultimoMsgTexto: string | null;
  esSolicitud: boolean;
  silenciado: boolean;
  rol: 'ADMIN' | 'MIEMBRO';
  sinLeer: number;
  participantes: AutorResumen[];
}

export type TipoMensaje = 'texto' | 'imagen' | 'gif' | 'archivo' | 'audio' | 'sistema';

export interface Mensaje {
  id: string;
  conversacionId: string;
  texto: string | null;
  idioma: string | null;
  tipo: TipoMensaje;
  createdAt: string;
  editadoEn: string | null;
  borradoEn: string | null;
  respondeAId: string | null;
  autor: AutorResumen;
  adjuntos: Adjunto[];
}

/**
 * Contenido de un mensaje de sistema ("X se unió").
 *
 * El servidor guarda una CLAVE y no una frase, porque el mismo mensaje lo
 * leen personas con la interfaz en distintos idiomas. Aquí se parsea para
 * que `t()` lo traduzca al idioma de quien mira.
 */
export interface EventoSistema {
  evento: 'participante-anadido' | 'participante-quitado' | 'participante-salio';
  porHandle: string;
  handle: string;
}

export function leerEventoSistema(texto: string | null): EventoSistema | null {
  if (!texto) return null;
  try {
    const datos = JSON.parse(texto) as EventoSistema;
    return datos.evento ? datos : null;
  } catch {
    // Un mensaje de sistema que no parsea no debe romper el hilo entero.
    return null;
  }
}

export interface PaginaMensajes {
  items: Mensaje[];
  cursor: string | null;
}

export interface PaginaBandeja {
  items: Conversacion[];
  cursor: string | null;
}

// ── Llamadas ─────────────────────────────────────────────────────────

export const mensajes = {
  bandeja: (params: { cursor?: string; solicitudes?: boolean } = {}) =>
    api
      .get<PaginaBandeja>('/mensajes/conversaciones', {
        params: {
          ...(params.cursor ? { cursor: params.cursor } : {}),
          solicitudes: params.solicitudes ? 'true' : 'false',
        },
      })
      .then((r) => r.data),

  noLeidos: () =>
    api
      .get<{ conversaciones: number; solicitudes: number }>('/mensajes/no-leidos')
      .then((r) => r.data),

  verConversacion: (id: string) =>
    api
      .get<{ conversacion: Conversacion }>(`/mensajes/conversaciones/${id}`)
      .then((r) => r.data.conversacion),

  /** Historial, paginado hacia atrás: `antes` es el mensaje más viejo que
   *  ya se tiene. */
  mensajesDe: (id: string, antes?: string) =>
    api
      .get<PaginaMensajes>(`/mensajes/conversaciones/${id}/mensajes`, {
        params: antes ? { antes } : {},
      })
      .then((r) => r.data),

  enviar: (id: string, datos: { texto?: string; adjuntos?: string[]; respondeAId?: string }) =>
    api
      .post<{ mensaje: Mensaje }>(`/mensajes/conversaciones/${id}/mensajes`, {
        ...(datos.texto ? { texto: datos.texto } : {}),
        adjuntos: datos.adjuntos ?? [],
        ...(datos.respondeAId ? { respondeAId: datos.respondeAId } : {}),
      })
      .then((r) => r.data.mensaje),

  editar: (mensajeId: string, texto: string) =>
    api.patch<{ mensaje: Mensaje }>(`/mensajes/${mensajeId}`, { texto }).then((r) => r.data.mensaje),

  borrar: (mensajeId: string) => api.delete(`/mensajes/${mensajeId}`).then(() => undefined),

  /** Abre (o recupera) el DM con alguien. Es idempotente. */
  abrirDm: (handle: string) =>
    api
      .post<{ conversacionId: string; creada: boolean; esSolicitud?: boolean }>('/mensajes/dm', {
        handle,
      })
      .then((r) => r.data),

  crearGrupo: (datos: { nombre: string; handles: string[]; iconoId?: string }) =>
    api
      .post<{ conversacionId: string }>('/mensajes/grupos', datos)
      .then((r) => r.data.conversacionId),

  editarGrupo: (id: string, datos: { nombre?: string; iconoId?: string }) =>
    api.patch(`/mensajes/grupos/${id}`, datos).then(() => undefined),

  anadirParticipantes: (id: string, handles: string[]) =>
    api
      .post<{ anadidos: number }>(`/mensajes/grupos/${id}/participantes`, { handles })
      .then((r) => r.data.anadidos),

  quitarParticipante: (id: string, handle: string) =>
    api
      .delete(`/mensajes/grupos/${id}/participantes/${encodeURIComponent(handle)}`)
      .then(() => undefined),

  marcarLeido: (id: string, mensajeId: string) =>
    api.post(`/mensajes/conversaciones/${id}/leido`, { mensajeId }).then(() => undefined),

  silenciar: (id: string, silenciado: boolean) =>
    api
      .post<{ silenciado: boolean }>(`/mensajes/conversaciones/${id}/silenciar`, { silenciado })
      .then((r) => r.data.silenciado),

  aceptarSolicitud: (id: string) =>
    api.post(`/mensajes/conversaciones/${id}/aceptar`).then(() => undefined),

  salir: (id: string) => api.post(`/mensajes/conversaciones/${id}/salir`).then(() => undefined),
};
