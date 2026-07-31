import { z } from 'zod';

import { USOS } from '../services/archivos.service';

/**
 * Validación de subidas y del buscador de GIFs (Fase 8).
 *
 * Ojo con una diferencia respecto al resto de schemas: el cuerpo de una
 * subida llega como `multipart/form-data`, así que **todos los campos de
 * texto llegan como string**, incluidos los números. Por eso los enteros
 * usan `z.coerce`.
 */

// ── Subida ───────────────────────────────────────────────────────────

export const subirSchema = z
  .object({
    /*
     * Para qué es el archivo. Enum cerrado: decide dónde se puede usar y
     * qué validaciones extra se le aplican (un icono de grupo tiene que
     * ser imagen, el audio de perfil tiene que ser audio). Texto libre
     * aquí dejaría que alguien inventara un uso y se saltara esas reglas.
     */
    uso: z.enum(USOS).default('adjunto'),
  })
  .strict();

// ── GIFs ─────────────────────────────────────────────────────────────

export const buscarGifsSchema = z
  .object({
    q: z.string().trim().max(60).optional(),
  })
  .strict();

/**
 * Un GIF elegido en el buscador.
 *
 * Las URLs se aceptan aquí como strings y **el filtro de verdad está en el
 * servicio**, que comprueba que el host sea de Giphy. Esa comprobación no
 * se puede hacer bien con un `.url()` de zod: lo que importa no es que la
 * cadena tenga forma de URL, sino a qué host apunta.
 */
export const gifExternoSchema = z
  .object({
    url: z.string().min(1).max(600),
    miniaturaUrl: z.string().min(1).max(600).optional(),
    ancho: z.coerce.number().int().min(0).max(10_000).optional(),
    alto: z.coerce.number().int().min(0).max(10_000).optional(),
  })
  .strict();

export const idParamSchema = z.object({
  id: z.string().min(1).max(40),
});

export type SubirInput = z.infer<typeof subirSchema>;
export type BuscarGifsInput = z.infer<typeof buscarGifsSchema>;
export type GifExternoInput = z.infer<typeof gifExternoSchema>;
