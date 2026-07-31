import { z } from 'zod';

import { MAX_ADJUNTOS } from '../services/archivos.service';

/**
 * Validación de la mensajería (Fase 8).
 *
 * Misma regla que el resto: `.strict()` en todo, para que un campo
 * inventado se descarte en el middleware y no llegue nunca a Prisma.
 */

// ── Mensajes ─────────────────────────────────────────────────────────

/**
 * Tope de un mensaje. Más largo que una publicación (1000) porque en un
 * chat sí se pegan cosas —una lista de items, un trozo de log— y cortar
 * eso a mitad es más molesto que en un feed de notas cortas.
 */
export const MAX_TEXTO_MENSAJE = 4000;

export const MAX_PARTICIPANTES = 50;

const adjuntosIds = z
  .array(z.string().min(1).max(40))
  .max(MAX_ADJUNTOS, `Máximo ${MAX_ADJUNTOS} archivos.`)
  .default([]);

/**
 * Un mensaje necesita texto **o** adjuntos, pero no puede no tener nada.
 *
 * El `.refine` es la pieza que lo garantiza: sin él, un `{}` crearía un
 * mensaje vacío que aparece en la conversación como una burbuja en blanco
 * y que además pisa la vista previa de la bandeja.
 */
export const enviarMensajeSchema = z
  .object({
    texto: z.string().max(MAX_TEXTO_MENSAJE, `Máximo ${MAX_TEXTO_MENSAJE} caracteres.`).optional(),
    adjuntos: adjuntosIds,
    /** Responder a otro mensaje del mismo hilo. */
    respondeAId: z.string().min(1).max(40).optional(),
  })
  .strict()
  .refine((d) => (d.texto?.trim().length ?? 0) > 0 || d.adjuntos.length > 0, {
    message: 'El mensaje no puede estar vacío.',
    path: ['texto'],
  });

/**
 * Editar solo cambia el texto.
 *
 * Los adjuntos quedan fuera a propósito: dejar cambiarlos permitiría enviar
 * una imagen, esperar a que la vean y sustituirla por otra, con la
 * conversación alrededor comentando algo que ya no está.
 */
export const editarMensajeSchema = z
  .object({
    texto: z
      .string()
      .trim()
      .min(1, 'El mensaje no puede estar vacío.')
      .max(MAX_TEXTO_MENSAJE, `Máximo ${MAX_TEXTO_MENSAJE} caracteres.`),
  })
  .strict();

// ── Conversaciones ───────────────────────────────────────────────────

/**
 * Abrir un DM. Se identifica por handle y no por id de usuario: es lo que
 * el cliente tiene a mano desde un perfil, y evita exponer ids internos.
 */
export const abrirDmSchema = z
  .object({
    handle: z.string().trim().toLowerCase().min(3).max(24),
  })
  .strict();

export const crearGrupoSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(1, 'El grupo necesita un nombre.')
      .max(60, 'Máximo 60 caracteres.'),
    /*
     * A quién se invita al crearlo. El creador NO va en esta lista: se
     * añade solo, en el servidor, desde la sesión. Si viniera del cliente
     * se podría crear un grupo "de" otra persona.
     */
    handles: z
      .array(z.string().trim().toLowerCase().min(3).max(24))
      .min(1, 'Invita al menos a una persona.')
      .max(MAX_PARTICIPANTES - 1, `Máximo ${MAX_PARTICIPANTES} participantes.`),
    /** Id de un archivo ya subido con `uso: 'icono-grupo'`. */
    iconoId: z.string().min(1).max(40).optional(),
  })
  .strict();

export const editarGrupoSchema = z
  .object({
    nombre: z.string().trim().min(1).max(60).optional(),
    iconoId: z.string().min(1).max(40).optional(),
  })
  .strict();

export const anadirParticipantesSchema = z
  .object({
    handles: z
      .array(z.string().trim().toLowerCase().min(3).max(24))
      .min(1)
      .max(MAX_PARTICIPANTES - 1),
  })
  .strict();

/**
 * Marcar leído hasta un mensaje concreto, y no "todo".
 *
 * Con un id, el cliente dice exactamente hasta dónde llegó la vista de
 * quien mira. Un "marcar todo como leído" sin id daría por leídos los
 * mensajes que llegaron entre que se pintó la pantalla y se envió la
 * petición, y esos nunca los vio nadie.
 */
export const marcarLeidoSchema = z
  .object({
    mensajeId: z.string().min(1).max(40),
  })
  .strict();

export const silenciarSchema = z
  .object({
    silenciado: z.boolean(),
  })
  .strict();

// ── Paginación ───────────────────────────────────────────────────────

/**
 * Los mensajes se paginan hacia ATRÁS: `antes` es el id del mensaje más
 * viejo que ya se tiene, y se piden los anteriores. Es el sentido natural
 * de un chat, donde lo nuevo está abajo y el scroll sube hacia el pasado.
 */
export const paginaMensajesSchema = z
  .object({
    antes: z.string().min(1).max(40).optional(),
    limite: z.coerce.number().int().min(1).max(60).default(30),
  })
  .strict();

export const bandejaSchema = z
  .object({
    cursor: z.string().min(1).max(40).optional(),
    limite: z.coerce.number().int().min(1).max(50).default(20),
    /** `true` para la bandeja de solicitudes de desconocidos. */
    solicitudes: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
  })
  .strict();

export const idParamSchema = z.object({
  id: z.string().min(1).max(40),
});

export const participanteParamSchema = z.object({
  id: z.string().min(1).max(40),
  handle: z.string().trim().toLowerCase().min(3).max(24),
});

export type EnviarMensajeInput = z.infer<typeof enviarMensajeSchema>;
export type EditarMensajeInput = z.infer<typeof editarMensajeSchema>;
export type AbrirDmInput = z.infer<typeof abrirDmSchema>;
export type CrearGrupoInput = z.infer<typeof crearGrupoSchema>;
export type EditarGrupoInput = z.infer<typeof editarGrupoSchema>;
export type AnadirParticipantesInput = z.infer<typeof anadirParticipantesSchema>;
export type MarcarLeidoInput = z.infer<typeof marcarLeidoSchema>;
export type SilenciarInput = z.infer<typeof silenciarSchema>;
export type PaginaMensajesInput = z.infer<typeof paginaMensajesSchema>;
export type BandejaInput = z.infer<typeof bandejaSchema>;
