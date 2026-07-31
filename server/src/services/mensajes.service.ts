import { prisma } from '../config/prisma';
import { errores } from '../middlewares/errores.middleware';
import { hayBloqueo, SELECT_AUTOR } from './social.service';
import { SELECT_ADJUNTO } from './archivos.service';

/**
 * Reglas de la mensajería (Fase 8).
 *
 * Aquí vive lo que deciden quién puede hablar con quién y quién puede leer
 * qué. Está separado del controlador porque las mismas comprobaciones las
 * necesitan **dos** puntos de entrada: el REST y el socket. Duplicarlas
 * sería garantizar que un día una de las dos copias se quede corta, y esa
 * sería justo la que dejara leer la conversación de otro.
 */

// ─────────────────────────────────────────────────────────────────────
//  Pertenencia
// ─────────────────────────────────────────────────────────────────────

export interface Pertenencia {
  conversacionId: string;
  esGrupo: boolean;
  rol: string;
  silenciado: boolean;
  participanteId: string;
}

/**
 * Comprueba que alguien es participante activo de una conversación.
 *
 * **Es la única puerta a todo el contenido de un chat.** Cada endpoint que
 * lee o escribe en una conversación pasa por aquí primero, sin excepción.
 *
 * Devuelve 404 y no 403 cuando no se es participante, y la diferencia
 * importa: un 403 confirmaría que esa conversación existe, y con ids
 * secuenciales o filtrados eso permite mapear qué conversaciones hay en la
 * plataforma. Un 404 no distingue "no existe" de "no es tuya".
 *
 * `salioEn` cuenta como no-participante: quien se fue de un grupo deja de
 * ver lo que se dice después, que es lo que significa irse.
 */
export async function exigirParticipante(
  userId: string,
  conversacionId: string
): Promise<Pertenencia> {
  const participante = await prisma.participante.findUnique({
    where: { conversacionId_userId: { conversacionId, userId } },
    select: {
      id: true,
      rol: true,
      silenciado: true,
      salioEn: true,
      conversacion: { select: { id: true, esGrupo: true } },
    },
  });

  if (!participante || participante.salioEn) {
    throw errores.noEncontrado('Esa conversación no existe.');
  }

  return {
    conversacionId: participante.conversacion.id,
    esGrupo: participante.conversacion.esGrupo,
    rol: participante.rol,
    silenciado: participante.silenciado,
    participanteId: participante.id,
  };
}

/** Como `exigirParticipante`, pero además exige ser ADMIN del grupo. */
export async function exigirAdmin(userId: string, conversacionId: string): Promise<Pertenencia> {
  const pertenencia = await exigirParticipante(userId, conversacionId);

  if (!pertenencia.esGrupo) {
    throw errores.invalido('Eso solo aplica a los grupos.');
  }
  if (pertenencia.rol !== 'ADMIN') {
    throw errores.sinPermiso('Solo un administrador del grupo puede hacer eso.');
  }

  return pertenencia;
}

// ─────────────────────────────────────────────────────────────────────
//  Quién puede escribirte
// ─────────────────────────────────────────────────────────────────────

export type ResultadoDm = 'directo' | 'solicitud';

/**
 * Decide si `emisorId` puede abrir un DM con `destinoId`, y si ese DM entra
 * en la bandeja principal o en la de solicitudes.
 *
 * Las tres reglas de `privacidadDm` (§8):
 *
 *  - `todos` — cualquiera puede escribir, pero si no hay relación previa el
 *    hilo nace como **solicitud**. No es lo mismo "acepto que me escriban"
 *    que "quiero que los desconocidos aparezcan mezclados con mis amigos".
 *  - `seguidos` (por defecto) — solo quien tiene relación de seguimiento en
 *    alguna dirección. El resto se rechaza.
 *  - `nadie` — nadie inicia un DM contigo.
 *
 * **El bloqueo se comprueba primero y por encima de todo.** Va antes que
 * `privacidadDm` porque un bloqueo es más fuerte que cualquier preferencia:
 * aunque tengas los DMs abiertos a todos, quien bloqueaste no entra.
 */
export async function puedeIniciarDm(
  emisorId: string,
  destinoId: string
): Promise<ResultadoDm> {
  if (emisorId === destinoId) {
    throw errores.invalido('No puedes abrir una conversación contigo.');
  }

  if (await hayBloqueo(emisorId, destinoId)) {
    // Mismo mensaje que un 404 de cuenta: confirmar el bloqueo le diría a
    // quien fue bloqueado que lo está, y eso convierte el bloqueo en una
    // notificación.
    throw errores.noEncontrado('Esa cuenta no existe.');
  }

  const destino = await prisma.user.findUnique({
    where: { id: destinoId },
    select: { privacidadDm: true },
  });
  if (!destino) throw errores.noEncontrado('Esa cuenta no existe.');

  if (destino.privacidadDm === 'nadie') {
    throw errores.sinPermiso('Esa persona no acepta mensajes directos.');
  }

  /*
   * ¿Hay relación de seguimiento en alguna dirección? Cuenta en ambas: si
   * te sigo, es razonable que pueda escribirte; y si tú me sigues, ya
   * mostraste interés en mí. Exigir seguimiento mutuo sería más estricto de
   * lo que la gente espera de "seguidos".
   */
  const relacion = await prisma.seguimiento.findFirst({
    where: {
      OR: [
        { seguidorId: emisorId, seguidoId: destinoId },
        { seguidorId: destinoId, seguidoId: emisorId },
      ],
    },
    select: { seguidorId: true },
  });

  if (destino.privacidadDm === 'seguidos' && !relacion) {
    throw errores.sinPermiso('Esa persona solo acepta mensajes de gente a la que sigue.');
  }

  return relacion ? 'directo' : 'solicitud';
}

/**
 * Comprueba que se puede escribir en una conversación que ya existe.
 *
 * No basta con haber pasado `exigirParticipante`: en un DM, la otra persona
 * puede haberte bloqueado **después** de que el hilo existiera. Es el mismo
 * principio que rige toda la Fase 7 — el bloqueo se comprueba en cada
 * interacción, no solo al crear la relación.
 *
 * En un grupo no se aplica: bloquear a alguien no debería expulsarte de un
 * grupo compartido ni silenciar el grupo entero. Lo que se hace en su lugar
 * es ocultar los mensajes de quien bloqueaste al pintarlos.
 */
export async function exigirPuedeEscribir(
  userId: string,
  conversacionId: string,
  esGrupo: boolean
): Promise<void> {
  if (esGrupo) return;

  const otro = await prisma.participante.findFirst({
    where: { conversacionId, userId: { not: userId }, salioEn: null },
    select: { userId: true },
  });

  // Un DM cuyo otro participante borró su cuenta: se deja leer el
  // historial, pero no escribir a nadie.
  if (!otro) throw errores.sinPermiso('Esta conversación ya no está activa.');

  if (await hayBloqueo(userId, otro.userId)) {
    throw errores.sinPermiso('No puedes escribir en esta conversación.');
  }
}

// ─────────────────────────────────────────────────────────────────────
//  Búsqueda de un DM existente
// ─────────────────────────────────────────────────────────────────────

/**
 * Encuentra el DM entre dos personas, si ya lo hay.
 *
 * La consulta es "una conversación no-grupo donde ambos son participantes".
 * Se comprueba además que tenga exactamente 2 participantes: sin eso, un
 * grupo del que se fueron todos menos dos podría confundirse con su DM.
 */
export async function buscarDm(unoId: string, otroId: string): Promise<string | null> {
  const conversacion = await prisma.conversacion.findFirst({
    where: {
      esGrupo: false,
      AND: [
        { participantes: { some: { userId: unoId } } },
        { participantes: { some: { userId: otroId } } },
      ],
    },
    select: { id: true, _count: { select: { participantes: true } } },
  });

  if (!conversacion || conversacion._count.participantes !== 2) return null;
  return conversacion.id;
}

// ─────────────────────────────────────────────────────────────────────
//  Vista previa de la bandeja
// ─────────────────────────────────────────────────────────────────────

/**
 * Texto que se guarda en `Conversacion.ultimoMsgTexto` para la bandeja.
 *
 * Está desnormalizado a propósito: pintar la bandeja necesita el último
 * mensaje de cada conversación, y sacarlo con un JOIN + MAX() por fila es
 * de las consultas que peor escalan. Guardarlo al enviar cuesta una
 * escritura que ya estábamos haciendo de todos modos.
 *
 * Un mensaje solo con adjuntos no tiene texto, así que se describe: una
 * vista previa vacía en la bandeja parece un fallo.
 */
export function vistaPrevia(texto: string | null, adjuntos: number): string {
  const limpio = texto?.trim();
  if (limpio) return limpio.slice(0, 140);
  if (adjuntos > 1) return `📎 ${adjuntos}`;
  return '📎';
}

// ─────────────────────────────────────────────────────────────────────
//  Selects compartidos
// ─────────────────────────────────────────────────────────────────────

/**
 * La forma de un mensaje tal y como sale a la red.
 *
 * Compartido entre el REST y el socket **a propósito**: los dos caminos
 * tienen que entregar exactamente la misma estructura, o el cliente
 * pintaría distinto un mensaje que llegó en vivo y el mismo mensaje tras
 * recargar la página.
 */
export const SELECT_MENSAJE = {
  id: true,
  conversacionId: true,
  texto: true,
  idioma: true,
  tipo: true,
  createdAt: true,
  editadoEn: true,
  borradoEn: true,
  respondeAId: true,
  autor: { select: SELECT_AUTOR },
  adjuntos: { select: SELECT_ADJUNTO },
} as const;

/**
 * Un mensaje borrado no se sirve con su texto.
 *
 * El borrado es suave (`borradoEn`) para no romper los hilos que responden
 * a él, pero eso es un detalle de almacenamiento: hacia fuera, borrado
 * significa que el contenido ya no está. Si se mandara el texto con una
 * marca de "borrado" y fuera el cliente quien lo ocultara, el mensaje
 * seguiría viajando en el JSON y se vería con las herramientas de
 * desarrollo — el mismo error que se evitó con el filtro de consentimiento
 * de la Fase 6.
 */
export function limpiarBorrado<
  T extends { borradoEn: Date | null; texto: string | null; adjuntos?: unknown[] },
>(mensaje: T): T {
  if (!mensaje.borradoEn) return mensaje;
  return { ...mensaje, texto: null, adjuntos: [] };
}

// ─────────────────────────────────────────────────────────────────────
//  Limpieza
// ─────────────────────────────────────────────────────────────────────

/**
 * Borra las conversaciones que se quedaron sin ningún participante.
 *
 * **Por qué hace falta un barrido y no basta con el `onDelete: Cascade`.**
 * `Participante` y `Mensaje` sí cuelgan de `Conversacion` y de `User`, así
 * que al borrarse una cuenta desaparecen solos. Pero `Conversacion` no
 * tiene relación con `User` —su `creadorId` es un campo suelto, sin FK—,
 * de modo que la fila de la conversación sobrevive a la desaparición de
 * todos sus miembros. Queda una conversación que nadie puede ver, nadie
 * puede borrar y que ya no significa nada: una fuga lenta de filas.
 *
 * Se detectó al limpiar las cuentas del E2E de la Fase 8: quedaron cuatro
 * conversaciones con cero participantes y cero mensajes.
 *
 * Se exige además que no queden mensajes, para no borrar por accidente el
 * historial de un grupo del que todos se fueron pero cuyos mensajes aún
 * podrían hacer falta para una investigación de moderación.
 */
export async function limpiarConversacionesVacias(): Promise<number> {
  const { count } = await prisma.conversacion.deleteMany({
    where: {
      participantes: { none: {} },
      mensajes: { none: {} },
    },
  });

  return count;
}
