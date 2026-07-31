import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

/**
 * Reglas compartidas de la capa social (Fase 7).
 *
 * Aquí vive lo que se repite en casi todos los endpoints sociales: el
 * bloqueo entre usuarios y la creación de notificaciones.
 */

// ─────────────────────────────────────────────────────────────────────
//  Bloqueo
// ─────────────────────────────────────────────────────────────────────

/**
 * ¿Hay un bloqueo entre estas dos personas, en cualquier dirección?
 *
 * **La simetría es deliberada y es el punto entero.** Si A bloquea a B, no
 * basta con que B no pueda escribirle a A: A tampoco debe poder seguir a B
 * ni comentar en su perfil. Un bloqueo unidireccional deja a quien bloquea
 * apareciendo en las notificaciones de quien fue bloqueado, que es lo
 * contrario de lo que pidió.
 *
 * Se comprueba en cada acción y no solo al establecerse la relación,
 * porque el bloqueo puede llegar DESPUÉS de que ya se siguieran.
 */
export async function hayBloqueo(unoId: string, otroId: string): Promise<boolean> {
  if (unoId === otroId) return false;

  const bloqueo = await prisma.bloqueo.findFirst({
    where: {
      OR: [
        { bloqueadorId: unoId, bloqueadoId: otroId },
        { bloqueadorId: otroId, bloqueadoId: unoId },
      ],
    },
    select: { bloqueadorId: true },
  });

  return bloqueo !== null;
}

/**
 * Ids de todo el que tiene un bloqueo con este usuario, en cualquier
 * dirección. Sirve para excluirlos de un golpe en el feed y en las
 * búsquedas, donde comprobarlo fila por fila serían N consultas.
 */
export async function idsBloqueados(userId: string): Promise<string[]> {
  const filas = await prisma.bloqueo.findMany({
    where: { OR: [{ bloqueadorId: userId }, { bloqueadoId: userId }] },
    select: { bloqueadorId: true, bloqueadoId: true },
  });

  const ids = new Set<string>();
  for (const fila of filas) {
    ids.add(fila.bloqueadorId === userId ? fila.bloqueadoId : fila.bloqueadorId);
  }
  return [...ids];
}

// ─────────────────────────────────────────────────────────────────────
//  Notificaciones
// ─────────────────────────────────────────────────────────────────────

export type TipoNotificacion = 'seguimiento' | 'comentario' | 'reaccion' | 'mencion';

/**
 * Crea una notificación, si tiene sentido crearla.
 *
 * Nunca lanza: una notificación es un efecto secundario. Que falle no
 * puede tumbar la acción que la originó — sería absurdo devolver un 500 al
 * comentar porque no se pudo avisar al dueño del perfil.
 *
 * Filtra dos casos por su cuenta:
 *  - **Uno mismo.** Darle "me gusta" a tu propia publicación no genera
 *    aviso; sabes perfectamente lo que acabas de hacer.
 *  - **Bloqueo.** Una notificación de alguien bloqueado es exactamente el
 *    contacto que el bloqueo debía impedir.
 */
export async function notificar(datos: {
  destinatarioId: string;
  emisorId: string;
  tipo: TipoNotificacion;
  /** Contexto para pintar el aviso sin más consultas: handle, id del
   *  objeto, un extracto del texto. */
  datos?: Record<string, unknown>;
}): Promise<void> {
  const { destinatarioId, emisorId, tipo } = datos;

  if (destinatarioId === emisorId) return;

  try {
    if (await hayBloqueo(destinatarioId, emisorId)) return;

    await prisma.notificacion.create({
      data: {
        destinatarioId,
        emisorId,
        tipo,
        datos: (datos.datos ?? {}) as object,
      },
    });
  } catch (error) {
    logger.warn({ error, tipo, destinatarioId }, 'No se pudo crear la notificación');
  }
}

// ─────────────────────────────────────────────────────────────────────
//  Actividad del feed
// ─────────────────────────────────────────────────────────────────────

export type TipoActividad =
  | 'perfil-publicado'
  | 'publicacion'
  | 'siguio-a'
  | 'juego-nuevo'
  | 'horas-hito';

/**
 * Registra un evento en el historial de actividad. Igual que `notificar`:
 * es un efecto secundario y nunca hace fallar la acción principal.
 */
export async function registrarActividad(
  userId: string,
  tipo: TipoActividad,
  datos: Record<string, unknown> = {}
): Promise<void> {
  try {
    await prisma.actividadFeed.create({ data: { userId, tipo, datos: datos as object } });
  } catch (error) {
    logger.warn({ error, tipo, userId }, 'No se pudo registrar la actividad');
  }
}

// ─────────────────────────────────────────────────────────────────────
//  Selects compartidos
// ─────────────────────────────────────────────────────────────────────

/**
 * Los campos de un usuario que acompañan a cualquier contenido suyo.
 *
 * Está aquí y no repetido en cada consulta por un motivo de seguridad, no
 * de comodidad: un `select` explícito y compartido es lo que garantiza que
 * el correo, el hash de la contraseña o la IP no se cuelen nunca en la
 * respuesta de un endpoint público por un descuido al escribir la consulta.
 */
export const SELECT_AUTOR = {
  id: true,
  handle: true,
  displayName: true,
  avatarUrl: true,
} as const;
