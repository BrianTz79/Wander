import type { Server as HttpServer } from 'node:http';

import cookie from 'cookie';
import { Server, type Socket } from 'socket.io';

import { env } from '../config/env';
import { logger } from '../config/logger';
import { prisma } from '../config/prisma';
import { COOKIE_ACCESS, verificarAccessToken } from '../services/sesion.service';

/**
 * Tiempo real del chat (Fase 8): socket.io en el namespace `/chat`.
 *
 * **El socket NO es la fuente de verdad, solo la acelera.** Todo mensaje se
 * escribe en Postgres primero y se emite después; el historial se pide
 * siempre por REST. Esto es lo que hace que el chat siga funcionando
 * entero detrás de un proxy que bloquee websockets: sin socket se pierde la
 * inmediatez, no los mensajes.
 *
 * Por la misma razón, **aquí no se escribe nada en la base**. Los eventos
 * que entran (`escribiendo`) son efímeros por naturaleza; los que
 * persisten van por REST, donde ya viven la validación de zod, el rate
 * limit y las comprobaciones de permisos. Tener dos caminos de escritura
 * con dos copias de las reglas es la forma segura de que un día una de las
 * dos se quede corta.
 */

/** Rooms: cada usuario tiene la suya y cada conversación la suya. */
const roomUsuario = (userId: string) => `user:${userId}`;
const roomConversacion = (id: string) => `conv:${id}`;

let io: Server | null = null;

// ─────────────────────────────────────────────────────────────────────
//  Autenticación del handshake
// ─────────────────────────────────────────────────────────────────────

interface DatosSocket {
  userId: string;
  handle: string;
}

/**
 * Resuelve quién es quien abre el socket, leyendo la MISMA cookie httpOnly
 * que usa el REST.
 *
 * No se acepta un token por query ni por `auth`: una cookie httpOnly no la
 * puede leer el JavaScript de la página, que es justo la propiedad que la
 * hace resistente a XSS (§5). Si se admitiera además un token por
 * parámetro, habría que ponerlo al alcance del JS del cliente y se
 * perdería esa garantía — además de que los parámetros de query acaban en
 * los logs de los proxies.
 */
async function autenticar(socket: Socket): Promise<DatosSocket | null> {
  const cabecera = socket.handshake.headers.cookie;
  if (!cabecera) return null;

  const cookies = cookie.parse(cabecera);
  const token = cookies[COOKIE_ACCESS];
  if (!token) return null;

  const payload = verificarAccessToken(token);
  if (!payload) return null;

  // Las mismas comprobaciones que `auth.middleware`: `tokenVersion` para
  // que un "cerrar sesión en todas partes" corte también los sockets, y la
  // suspensión para que un suspendido no siga escuchando en vivo.
  const usuario = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, handle: true, tokenVersion: true, suspendido: true, suspendidoHasta: true },
  });

  if (!usuario || usuario.tokenVersion !== payload.tv) return null;
  if (usuario.suspendido && (!usuario.suspendidoHasta || usuario.suspendidoHasta > new Date())) {
    return null;
  }

  return { userId: usuario.id, handle: usuario.handle };
}

// ─────────────────────────────────────────────────────────────────────
//  Arranque
// ─────────────────────────────────────────────────────────────────────

export function montarChat(servidor: HttpServer): Server {
  io = new Server(servidor, {
    path: '/socket.io/',
    // Misma lista blanca que el CORS del REST. Con `credentials: true` el
    // origen no puede ser '*', igual que allí.
    cors: {
      origin: env.esProduccion
        ? [env.PUBLIC_URL]
        : [env.PUBLIC_URL, 'http://localhost:5173', 'http://localhost:3045'],
      credentials: true,
    },
    // Un mensaje son unos pocos KB; los archivos van por HTTP multipart y
    // nunca por el socket. Este tope evita que alguien mande un payload
    // gigante por el canal persistente.
    maxHttpBufferSize: 256 * 1024,
    // Si el cliente no responde al ping en 20 s se considera caído y se
    // libera su sesión de socket.
    pingTimeout: 20_000,
    pingInterval: 25_000,
  });

  const chat = io.of('/chat');

  /*
   * La autenticación va en un middleware del namespace, no dentro de
   * `connection`. La diferencia importa: aquí se rechaza ANTES de que el
   * socket quede establecido, así que un cliente sin sesión nunca llega a
   * tener una conexión abierta con la que gastar recursos ni con la que
   * suscribirse a nada.
   */
  chat.use((socket, next) => {
    autenticar(socket)
      .then((datos) => {
        if (!datos) return next(new Error('no autenticado'));
        socket.data = datos;
        next();
      })
      .catch((error) => {
        logger.warn({ error }, 'Fallo al autenticar un socket');
        next(new Error('no autenticado'));
      });
  });

  chat.on('connection', (socket) => {
    const { userId } = socket.data as DatosSocket;

    /*
     * Cada quien entra a su propia room al conectar. Es lo que permite
     * avisar a una persona ("tienes un mensaje nuevo en otro hilo") sin
     * saber qué conversación tiene abierta ni si tiene varias pestañas.
     */
    void socket.join(roomUsuario(userId));

    /*
     * Suscribirse a una conversación. **Se verifica la pertenencia contra
     * la base cada vez**: sin esto, cualquiera con una sesión válida podría
     * mandar `conv:entrar` con un id ajeno y quedarse escuchando en vivo
     * una conversación que no es suya. Es el equivalente en el socket de
     * `exigirParticipante`, y es la comprobación que sostiene toda la
     * privacidad del chat en tiempo real.
     */
    socket.on('conv:entrar', (conversacionId: unknown) => {
      if (typeof conversacionId !== 'string' || conversacionId.length > 40) return;

      prisma.participante
        .findUnique({
          where: { conversacionId_userId: { conversacionId, userId } },
          select: { salioEn: true },
        })
        .then((participante) => {
          if (!participante || participante.salioEn) return;
          void socket.join(roomConversacion(conversacionId));
        })
        .catch((error) => logger.warn({ error }, 'Fallo al entrar a una conversación'));
    });

    socket.on('conv:salir', (conversacionId: unknown) => {
      if (typeof conversacionId !== 'string') return;
      void socket.leave(roomConversacion(conversacionId));
    });

    /*
     * "Está escribiendo…". Es el único evento que no pasa por REST, y
     * puede permitírselo porque **no persiste nada**: es un aviso efímero
     * que se pierde si no llega, y cuyo peor abuso posible es que aparezca
     * un indicador de más.
     *
     * Aun así se comprueba que quien lo manda esté en la room: si no,
     * bastaría con conocer un id de conversación para hacer aparecer un
     * "escribiendo…" fantasma en el chat de otros.
     */
    socket.on('escribiendo', (conversacionId: unknown) => {
      if (typeof conversacionId !== 'string') return;
      if (!socket.rooms.has(roomConversacion(conversacionId))) return;

      socket.to(roomConversacion(conversacionId)).emit('escribiendo', {
        conversacionId,
        userId,
        handle: (socket.data as DatosSocket).handle,
      });
    });

    socket.on('error', (error) => {
      logger.warn({ error, userId }, 'Error en un socket de chat');
    });
  });

  logger.info('socket.io montado en /chat');
  return io;
}

// ─────────────────────────────────────────────────────────────────────
//  Emisión desde el REST
// ─────────────────────────────────────────────────────────────────────

/**
 * Las dos funciones que usa el controlador para avisar en vivo.
 *
 * **Nunca lanzan.** Emitir es un efecto secundario del que ya se guardó en
 * la base: que falle no puede tumbar la petición que lo originó, igual que
 * pasa con `notificar` en la Fase 7. Si `io` es nulo (el servidor arrancó
 * sin sockets, o esto se llama desde un test), simplemente no se emite y
 * el cliente se entera al recargar.
 */
export function emitirAConversacion(conversacionId: string, evento: string, datos: unknown): void {
  try {
    io?.of('/chat').to(roomConversacion(conversacionId)).emit(evento, datos);
  } catch (error) {
    logger.warn({ error, evento, conversacionId }, 'No se pudo emitir a la conversación');
  }
}

export function emitirAUsuario(userId: string, evento: string, datos: unknown): void {
  try {
    io?.of('/chat').to(roomUsuario(userId)).emit(evento, datos);
  } catch (error) {
    logger.warn({ error, evento, userId }, 'No se pudo emitir al usuario');
  }
}

/**
 * Aviso de notificación nueva, para que la campana se actualice sin que el
 * cliente tenga que preguntar cada pocos segundos.
 *
 * Se manda solo la señal, **no el contenido**: el cliente pide la lista por
 * REST si tiene el panel abierto. Mandar la notificación entera por el
 * socket obligaría a duplicar aquí el filtrado de bloqueos y la forma de la
 * respuesta, que ya viven en el controlador.
 */
export function avisarNotificacion(userId: string): void {
  emitirAUsuario(userId, 'notificacion:nueva', {});
}
