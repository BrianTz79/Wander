import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from './api';
import type { Adjunto } from './archivos';

/**
 * Capa social del cliente (Fase 7): tipos que espejan al backend y el hook
 * de paginación por cursor que usan las tres pantallas.
 */

// ── Tipos ────────────────────────────────────────────────────────────

export interface AutorResumen {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
}

export const TIPOS_REACCION = ['like', 'fuego', 'gg', 'corazon'] as const;
export type TipoReaccion = (typeof TIPOS_REACCION)[number];

export interface Publicacion {
  id: string;
  texto: string;
  /** Idioma detectado al escribir. Se recibe pero no se usa todavía: la
   *  traducción de contenido está aplazada (PROYECTO.md §8). */
  idioma: string | null;
  juegoAppid: number | null;
  juegoNombre: string | null;
  createdAt: string;
  editadoEn: string | null;
  autor: AutorResumen;
  /** Imágenes, GIFs y archivos de la publicación (Fase 8). */
  adjuntos: Adjunto[];
  comentarios: number;
  reacciones: number;
  misReacciones: TipoReaccion[];
}

export interface Comentario {
  id: string;
  texto: string;
  idioma: string | null;
  createdAt: string;
  respondeAId: string | null;
  autor: AutorResumen;
}

export interface Relacion {
  handle: string;
  seguidores: number;
  siguiendo: number;
  losigo: boolean;
  meSigue: boolean;
  bloqueado: boolean;
  esPropio: boolean;
}

export interface UsuarioExplorar {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  vistas: number;
  seguidores: number;
}

export type TipoNotificacion =
  | 'seguimiento'
  | 'comentario'
  | 'reaccion'
  | 'mensaje'
  | 'mencion'
  | 'sistema';

/**
 * Contexto que el servidor guarda con cada notificación para poder pintarla
 * y enlazarla sin más consultas.
 *
 * Todo es opcional porque cada tipo rellena lo suyo: una de seguimiento no
 * tiene `publicacionId`, y una de mensaje no tiene `reaccion`. Se lee con
 * `destinoDeNotificacion`, que es quien decide a dónde lleva cada una.
 */
export interface DatosNotificacion {
  publicacionId?: string;
  comentarioId?: string;
  conversacionId?: string;
  /** Handle del perfil donde ocurrió (para los comentarios en muro). */
  handle?: string;
  enPerfil?: boolean;
  reaccion?: TipoReaccion;
  extracto?: string;
  grupo?: string;
  evento?: string;
}

export interface Notificacion {
  id: string;
  tipo: TipoNotificacion;
  datos: DatosNotificacion;
  leidaEn: string | null;
  createdAt: string;
  emisor: AutorResumen | null;
}

/**
 * A dónde lleva pulsar una notificación.
 *
 * **Es la pieza que hace que la campana sirva de algo.** Una notificación
 * que solo dice "alguien comentó" y no lleva a ninguna parte obliga a
 * buscar la interacción a mano; el objetivo es aterrizar exactamente en lo
 * que pasó.
 *
 * Devuelve `null` cuando no hay destino sensato (una notificación de
 * sistema), y entonces se pinta como texto y no como enlace: un enlace que
 * no va a ningún sitio es peor que la ausencia de enlace.
 */
export function destinoDeNotificacion(n: Notificacion): string | null {
  const { publicacionId, comentarioId, conversacionId, handle, enPerfil } = n.datos;

  switch (n.tipo) {
    case 'seguimiento':
      // Al perfil de quien te siguió: lo que se quiere al verlo es saber
      // quién es.
      return n.emisor ? `/u/${n.emisor.handle}` : null;

    case 'comentario':
      /*
       * El ancla `#c-<id>` es lo que lleva AL comentario dentro del hilo, y
       * no solo a la publicación. Con veinte comentarios, aterrizar arriba
       * obliga a buscar cuál era.
       */
      if (enPerfil && handle) {
        return comentarioId ? `/u/${handle}#c-${comentarioId}` : `/u/${handle}`;
      }
      if (publicacionId) {
        return comentarioId
          ? `/publicacion/${publicacionId}#c-${comentarioId}`
          : `/publicacion/${publicacionId}`;
      }
      return null;

    case 'reaccion':
      return publicacionId ? `/publicacion/${publicacionId}` : null;

    case 'mensaje':
      return conversacionId ? `/mensajes/${conversacionId}` : '/mensajes';

    case 'mencion':
      return publicacionId ? `/publicacion/${publicacionId}` : null;

    default:
      return null;
  }
}

/** Respuesta paginada por cursor. `cursor: null` = no hay más. */
export interface Pagina<T> {
  items: T[];
  cursor: string | null;
}

// ── Llamadas ─────────────────────────────────────────────────────────

export const social = {
  feed: (cursor?: string) =>
    api
      .get<Pagina<Publicacion> & { sigueAAlguien: boolean }>('/social/feed', {
        params: cursor ? { cursor } : {},
      })
      .then((r) => r.data),

  explorar: (params: { q?: string; juegoAppid?: number; cursor?: string }) =>
    api
      .get<{
        usuarios: UsuarioExplorar[];
        cursor: string | null;
        publicaciones: Publicacion[];
      }>('/social/explorar', { params })
      .then((r) => r.data),

  publicar: (datos: { texto: string; juegoAppid?: number; adjuntos?: string[] }) =>
    api
      .post<{ publicacion: Publicacion }>('/social/publicaciones', {
        ...datos,
        adjuntos: datos.adjuntos ?? [],
      })
      .then((r) => r.data.publicacion),

  editarPublicacion: (id: string, texto: string) =>
    api
      .patch<{ publicacion: Publicacion }>(`/social/publicaciones/${id}`, { texto })
      .then((r) => r.data.publicacion),

  borrarPublicacion: (id: string) => api.delete(`/social/publicaciones/${id}`).then(() => undefined),

  publicacionesDe: (handle: string, cursor?: string) =>
    api
      .get<Pagina<Publicacion>>(`/social/usuarios/${encodeURIComponent(handle)}/publicaciones`, {
        params: cursor ? { cursor } : {},
      })
      .then((r) => r.data),

  reaccionar: (id: string, tipo: TipoReaccion) =>
    api
      .put<{ reaccionado: boolean; reacciones: number; misReacciones: TipoReaccion[] }>(
        `/social/publicaciones/${id}/reaccion`,
        { tipo }
      )
      .then((r) => r.data),

  comentariosDe: (publicacionId: string, cursor?: string) =>
    api
      .get<Pagina<Comentario>>(`/social/publicaciones/${publicacionId}/comentarios`, {
        params: cursor ? { cursor } : {},
      })
      .then((r) => r.data),

  comentar: (publicacionId: string, texto: string, respondeAId?: string) =>
    api
      .post<{ comentario: Comentario }>(`/social/publicaciones/${publicacionId}/comentarios`, {
        texto,
        ...(respondeAId ? { respondeAId } : {}),
      })
      .then((r) => r.data.comentario),

  comentariosDePerfil: (handle: string, cursor?: string) =>
    api
      .get<Pagina<Comentario>>(`/social/usuarios/${encodeURIComponent(handle)}/comentarios`, {
        params: cursor ? { cursor } : {},
      })
      .then((r) => r.data),

  comentarPerfil: (handle: string, texto: string) =>
    api
      .post<{ comentario: Comentario }>(`/social/usuarios/${encodeURIComponent(handle)}/comentarios`, {
        texto,
      })
      .then((r) => r.data.comentario),

  borrarComentario: (id: string) => api.delete(`/social/comentarios/${id}`).then(() => undefined),

  relacion: (handle: string) =>
    api.get<Relacion>(`/social/usuarios/${encodeURIComponent(handle)}/relacion`).then((r) => r.data),

  seguir: (handle: string) =>
    api
      .post<{ siguiendo: boolean }>(`/social/usuarios/${encodeURIComponent(handle)}/seguir`)
      .then((r) => r.data.siguiendo),

  dejarDeSeguir: (handle: string) =>
    api
      .delete<{ siguiendo: boolean }>(`/social/usuarios/${encodeURIComponent(handle)}/seguir`)
      .then((r) => r.data.siguiendo),

  bloquear: (handle: string) =>
    api
      .post<{ bloqueado: boolean }>(`/social/usuarios/${encodeURIComponent(handle)}/bloquear`)
      .then((r) => r.data.bloqueado),

  desbloquear: (handle: string) =>
    api
      .delete<{ bloqueado: boolean }>(`/social/usuarios/${encodeURIComponent(handle)}/bloquear`)
      .then((r) => r.data.bloqueado),

  seguidoresDe: (handle: string, cursor?: string) =>
    api
      .get<Pagina<AutorResumen>>(`/social/usuarios/${encodeURIComponent(handle)}/seguidores`, {
        params: cursor ? { cursor } : {},
      })
      .then((r) => r.data),

  siguiendoDe: (handle: string, cursor?: string) =>
    api
      .get<Pagina<AutorResumen>>(`/social/usuarios/${encodeURIComponent(handle)}/siguiendo`, {
        params: cursor ? { cursor } : {},
      })
      .then((r) => r.data),

  notificaciones: (cursor?: string) =>
    api
      .get<Pagina<Notificacion> & { sinLeer: number }>('/social/notificaciones', {
        params: cursor ? { cursor } : {},
      })
      .then((r) => r.data),

  marcarLeidas: () =>
    api.post<{ marcadas: number }>('/social/notificaciones/leidas').then((r) => r.data.marcadas),

  /** Solo el número, para el punto de la campana. Barato de pedir en cada
   *  carga de página; la lista entera no lo sería. */
  contadorNotificaciones: () =>
    api.get<{ sinLeer: number }>('/social/notificaciones/contador').then((r) => r.data.sinLeer),
};

// ── Hook de listas paginadas ─────────────────────────────────────────

interface EstadoLista<T> {
  items: T[];
  cargando: boolean;
  cargandoMas: boolean;
  error: boolean;
  hayMas: boolean;
}

/**
 * Lista con "cargar más" por cursor.
 *
 * `traer` recibe el cursor (o `undefined` en la primera página) y devuelve
 * una `Pagina`. La función se recibe ya memorizada por quien llama: es su
 * identidad la que decide cuándo se reinicia la lista, así que envolverla
 * aquí en un `useCallback` no serviría de nada.
 *
 * El `useRef` de la petición evita el problema clásico de las listas
 * asíncronas: si alguien busca "ma", "mad", "madr" rápido, las tres
 * respuestas pueden volver en cualquier orden y la lenta pisar a la
 * última. Cada carga guarda su identidad y descarta el resultado si para
 * cuando llega ya no es la vigente.
 */
export function useListaPaginada<T>(
  traer: (cursor?: string) => Promise<Pagina<T>>
): EstadoLista<T> & { cargarMas: () => void; recargar: () => void; reemplazar: (items: T[]) => void } {
  const [estado, setEstado] = useState<EstadoLista<T>>({
    items: [],
    cargando: true,
    cargandoMas: false,
    error: false,
    hayMas: false,
  });
  const cursorRef = useRef<string | null>(null);
  const peticionRef = useRef(0);

  const cargarPrimera = useCallback(() => {
    const miPeticion = ++peticionRef.current;
    setEstado((e) => ({ ...e, cargando: true, error: false }));

    traer(undefined)
      .then((pagina) => {
        if (peticionRef.current !== miPeticion) return;
        cursorRef.current = pagina.cursor;
        setEstado({
          items: pagina.items,
          cargando: false,
          cargandoMas: false,
          error: false,
          hayMas: pagina.cursor !== null,
        });
      })
      .catch(() => {
        if (peticionRef.current !== miPeticion) return;
        setEstado({ items: [], cargando: false, cargandoMas: false, error: true, hayMas: false });
      });
  }, [traer]);

  useEffect(cargarPrimera, [cargarPrimera]);

  const cargarMas = useCallback(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;

    const miPeticion = peticionRef.current;
    setEstado((e) => ({ ...e, cargandoMas: true }));

    traer(cursor)
      .then((pagina) => {
        // Si mientras tanto la lista se recargó desde cero, esta página
        // pertenece a una búsqueda que ya no está en pantalla.
        if (peticionRef.current !== miPeticion) return;
        cursorRef.current = pagina.cursor;
        setEstado((e) => ({
          ...e,
          items: [...e.items, ...pagina.items],
          cargandoMas: false,
          hayMas: pagina.cursor !== null,
        }));
      })
      .catch(() => {
        if (peticionRef.current !== miPeticion) return;
        setEstado((e) => ({ ...e, cargandoMas: false }));
      });
  }, [traer]);

  /** Sustituye los items en memoria (tras publicar, borrar o reaccionar)
   *  sin volver a pedir la lista entera al servidor. */
  const reemplazar = useCallback((items: T[]) => {
    setEstado((e) => ({ ...e, items }));
  }, []);

  return { ...estado, cargarMas, recargar: cargarPrimera, reemplazar };
}

// ── Formato ──────────────────────────────────────────────────────────

/**
 * "hace 5 min", "hace 3 h", "12 mar".
 *
 * Usa `Intl.RelativeTimeFormat`, que ya viene en el navegador y conoce las
 * reglas de plural de cada idioma — escribirlo a mano significaría
 * reimplementar «1 hora» / «2 horas» / «1 hour» / «2 hours» por idioma.
 *
 * A partir de una semana pasa a fecha absoluta: "hace 43 días" no le dice
 * nada a nadie, y una fecha sí.
 */
export function tiempoRelativo(iso: string, idioma: string): string {
  const fecha = new Date(iso);
  const segundos = Math.round((fecha.getTime() - Date.now()) / 1000);
  const abs = Math.abs(segundos);

  const rtf = new Intl.RelativeTimeFormat(idioma, { numeric: 'auto' });

  if (abs < 60) return rtf.format(Math.round(segundos), 'second');
  if (abs < 3600) return rtf.format(Math.round(segundos / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(segundos / 3600), 'hour');
  if (abs < 604_800) return rtf.format(Math.round(segundos / 86_400), 'day');

  return fecha.toLocaleDateString(idioma, {
    day: 'numeric',
    month: 'short',
    // El año solo si no es el actual: "12 mar" basta para algo de este año.
    ...(fecha.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  });
}
