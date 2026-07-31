import { z } from 'zod';

import { MAX_ADJUNTOS } from '../services/archivos.service';

/**
 * Validación de la capa social (Fase 7): seguir, publicar, comentar,
 * reaccionar, feed y explorar. La Fase 8 le añade los adjuntos.
 *
 * Misma regla que el resto de schemas: `.strict()` en todo, para que un
 * campo inventado se descarte en el middleware y no llegue nunca a Prisma.
 */

// ── Publicaciones ────────────────────────────────────────────────────

/** Tope de una publicación. Corto a propósito: el feed es de notas, no de
 *  ensayos, y un límite bajo hace el render predecible. */
export const MAX_TEXTO_PUBLICACION = 1000;
export const MAX_TEXTO_COMENTARIO = 500;

/** Mismo tope que en el chat: el límite lo pone el servicio de archivos,
 *  que es donde vive la cuota. */
const MAX_ADJUNTOS_PUBLICACION = MAX_ADJUNTOS;

const textoPublicacion = z
  .string()
  .trim()
  .min(1, 'La publicación no puede estar vacía.')
  .max(MAX_TEXTO_PUBLICACION, `Máximo ${MAX_TEXTO_PUBLICACION} caracteres.`);

/**
 * Texto de una publicación que además lleva imágenes. Puede ir vacío:
 * publicar una captura sin comentario es normal. El `.refine` de abajo es
 * el que impide que se queden vacíos texto y adjuntos a la vez.
 */
const textoOpcional = z
  .string()
  .trim()
  .max(MAX_TEXTO_PUBLICACION, `Máximo ${MAX_TEXTO_PUBLICACION} caracteres.`)
  .default('');

export const crearPublicacionSchema = z
  .object({
    texto: textoOpcional,
    /**
     * Ids de archivos ya subidos por `POST /api/archivos`. Se mandan ids y
     * no los archivos en sí: la subida va aparte para que una foto de 6 MB
     * no bloquee el envío y para poder enseñar la miniatura mientras se
     * escribe. La propiedad de cada id se comprueba en el servidor.
     */
    adjuntos: z.array(z.string().min(1).max(40)).max(MAX_ADJUNTOS_PUBLICACION).default([]),
    /*
     * Juego al que se refiere la publicación. Se manda solo el appid: el
     * NOMBRE lo resuelve el servidor contra la caché de Steam, nunca se
     * confía en el que mande el cliente. Si se aceptara, cualquiera podría
     * publicar bajo un juego que no existe o suplantar el nombre de otro
     * ("Elden Ring " con espacio) y ensuciar el filtro del feed.
     */
    juegoAppid: z.number().int().positive().max(20_000_000).optional(),
  })
  .strict()
  .refine((d) => d.texto.length > 0 || d.adjuntos.length > 0, {
    message: 'La publicación no puede estar vacía.',
    path: ['texto'],
  });

export const editarPublicacionSchema = z
  .object({
    texto: textoPublicacion,
  })
  .strict();

// ── Comentarios ──────────────────────────────────────────────────────

export const crearComentarioSchema = z
  .object({
    texto: z
      .string()
      .trim()
      .min(1, 'El comentario no puede estar vacío.')
      .max(MAX_TEXTO_COMENTARIO, `Máximo ${MAX_TEXTO_COMENTARIO} caracteres.`),
    /** Respuesta a otro comentario. Un solo nivel de anidación (§4). */
    respondeAId: z.string().min(1).max(40).optional(),
  })
  .strict();

// ── Reacciones ───────────────────────────────────────────────────────

/**
 * Los cuatro tipos del esquema. Es un enum cerrado y no texto libre: si el
 * cliente pudiera mandar cualquier string, el campo `tipo` acabaría siendo
 * un almacén de texto arbitrario del usuario indexado en la base.
 */
export const TIPOS_REACCION = ['like', 'fuego', 'gg', 'corazon'] as const;
export type TipoReaccion = (typeof TIPOS_REACCION)[number];

export const reaccionSchema = z
  .object({
    tipo: z.enum(TIPOS_REACCION).default('like'),
  })
  .strict();

// ── Paginación ───────────────────────────────────────────────────────

/**
 * Paginación por cursor, no por `?pagina=3`.
 *
 * El offset es incorrecto en un feed: entre que alguien pide la página 1 y
 * la 2, si se publica algo nuevo todo se desplaza una posición y la
 * página 2 repite la última entrada de la 1. Con cursor se pide "lo
 * anterior a ESTE elemento", que es estable pase lo que pase.
 */
export const LIMITE_PAGINA = 20;

export const paginacionSchema = z
  .object({
    /** `id` del último elemento recibido. */
    cursor: z.string().min(1).max(40).optional(),
    limite: z.coerce.number().int().min(1).max(50).default(LIMITE_PAGINA),
  })
  .strict();

// ── Explorar ─────────────────────────────────────────────────────────

export const buscarSchema = z
  .object({
    /*
     * La búsqueda va a un ILIKE con comodines. Se limita a 40 caracteres y
     * se recorta, pero lo que de verdad la hace segura es que Prisma
     * parametriza la consulta: `q` viaja como parámetro, no concatenado
     * en el SQL.
     */
    q: z.string().trim().max(40).optional(),
    /** Filtro por juego, para "quién más juega esto". */
    juegoAppid: z.coerce.number().int().positive().max(20_000_000).optional(),
    cursor: z.string().min(1).max(40).optional(),
    limite: z.coerce.number().int().min(1).max(50).default(LIMITE_PAGINA),
  })
  .strict();

// ── Params ───────────────────────────────────────────────────────────

export const handleParamSchema = z.object({
  handle: z.string().trim().toLowerCase().min(3).max(24),
});

export const idParamSchema = z.object({
  id: z.string().min(1).max(40),
});

export type CrearPublicacionInput = z.infer<typeof crearPublicacionSchema>;
export type EditarPublicacionInput = z.infer<typeof editarPublicacionSchema>;
export type CrearComentarioInput = z.infer<typeof crearComentarioSchema>;
export type ReaccionInput = z.infer<typeof reaccionSchema>;
export type PaginacionInput = z.infer<typeof paginacionSchema>;
export type BuscarInput = z.infer<typeof buscarSchema>;
