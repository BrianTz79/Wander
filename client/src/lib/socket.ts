import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';

import type { Mensaje } from './mensajes';

/**
 * Conexión en vivo con el chat (Fase 8).
 *
 * **Un solo socket para toda la aplicación.** Se comparte entre la campana
 * de notificaciones, la bandeja y el hilo abierto: con uno por componente,
 * abrir una conversación abriría una conexión nueva cada vez y el servidor
 * acabaría con varias por pestaña.
 *
 * No hay token que pasar: la sesión viaja en la cookie httpOnly, que el
 * navegador manda sola en el handshake gracias a `withCredentials`. Es la
 * misma cookie del REST, así que no hay un segundo mecanismo de
 * autenticación que mantener en sincronía.
 */

let socket: Socket | null = null;

export function conectarChat(): Socket {
  if (socket) return socket;

  socket = io('/chat', {
    path: '/socket.io/',
    withCredentials: true,
    /*
     * Se empieza por polling y se sube a websocket si se puede. Al revés
     * (`transports: ['websocket']`) es más rápido cuando funciona, pero
     * deja sin chat en vivo a quien esté detrás de un proxy que bloquee
     * websockets — y esa gente existe. Con el orden por defecto, esos
     * usuarios siguen recibiendo eventos por long-polling.
     */
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
  });

  return socket;
}

export function desconectarChat(): void {
  socket?.disconnect();
  socket = null;
}

export function socketActual(): Socket | null {
  return socket;
}

// ─────────────────────────────────────────────────────────────────────
//  Hooks
// ─────────────────────────────────────────────────────────────────────

/**
 * Suscribe a un evento del socket mientras el componente esté montado.
 *
 * El `off` en la limpieza no es opcional: sin él, cada vez que el
 * componente se vuelve a montar queda otro manejador escuchando, y un
 * mensaje acabaría añadiéndose a la lista tantas veces como montajes haya
 * habido. Es el bug clásico de "el mensaje aparece duplicado".
 */
export function useEventoChat<T>(
  evento: string,
  manejador: (datos: T) => void,
  activo = true
): void {
  useEffect(() => {
    if (!activo) return;

    const s = conectarChat();
    const fn = (datos: T) => manejador(datos);
    s.on(evento, fn);

    return () => {
      s.off(evento, fn);
    };
    // `manejador` entra en las dependencias: quien lo pase debe envolverlo
    // en `useCallback`, o la suscripción se rehará en cada render.
  }, [evento, manejador, activo]);
}

/**
 * Entra a la room de una conversación y sale al cambiar de hilo.
 *
 * La salida importa: sin ella, quien abra diez conversaciones seguidas
 * seguiría recibiendo los mensajes en vivo de las diez, y el navegador
 * gastaría trabajo pintando actualizaciones de hilos que ya nadie mira.
 */
export function useSalaConversacion(conversacionId: string | null): void {
  useEffect(() => {
    if (!conversacionId) return;

    const s = conectarChat();
    s.emit('conv:entrar', conversacionId);

    /*
     * Al reconectar hay que volver a entrar: el servidor no recuerda las
     * rooms de un socket caído, así que sin esto una reconexión deja la
     * conversación abierta pero muda.
     */
    const alReconectar = () => s.emit('conv:entrar', conversacionId);
    s.on('connect', alReconectar);

    return () => {
      s.emit('conv:salir', conversacionId);
      s.off('connect', alReconectar);
    };
  }, [conversacionId]);
}

// ─────────────────────────────────────────────────────────────────────
//  Formas de los eventos
// ─────────────────────────────────────────────────────────────────────

export interface EventoMensajeNuevo {
  mensaje: Mensaje;
}

export interface EventoMensajeBorrado {
  mensajeId: string;
  conversacionId: string;
}

export interface EventoEscribiendo {
  conversacionId: string;
  userId: string;
  handle: string;
}

export interface EventoLeido {
  conversacionId: string;
  userId: string;
  mensajeId: string;
}

export interface EventoConversacion {
  conversacionId: string;
}
