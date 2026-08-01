import { z } from 'zod';

/**
 * Validación de reportes y de las acciones de moderación (Fase 10).
 *
 * El modelo `Reporte` existe en el schema de Prisma desde la migración
 * inicial, pero hasta la Fase 10 **ninguna ruta lo tocaba**: no había
 * forma de reportar nada ni de revisar lo reportado. Es el mismo patrón
 * que dejó la Fase 8 con la mensajería —la pieza construida sin puerta de
 * entrada—, así que aquí se cierran las dos mitades a la vez.
 */

// ── Reportar (cualquier usuario) ─────────────────────────────────────

/**
 * Qué se puede reportar.
 *
 * `mensaje` está en la lista aunque los mensajes sean privados: quien
 * recibe acoso por DM tiene que poder reportarlo, y es el único caso en
 * que un moderador puede llegar a ver un mensaje que no es suyo. Ver la
 * nota en `moderacion.controller.ts` sobre qué se le enseña exactamente.
 */
export const TIPOS_OBJETO = [
  'usuario',
  'perfil',
  'publicacion',
  'comentario',
  'mensaje',
] as const;

/**
 * Motivos. Enum cerrado y no texto libre: son las categorías por las que
 * se prioriza la cola. `contenido-ilegal` va primero en la revisión, y eso
 * solo se puede ordenar si el motivo es un valor conocido.
 */
export const MOTIVOS_REPORTE = [
  'spam',
  'acoso',
  'contenido-ilegal',
  'suplantacion',
  'otro',
] as const;

export const crearReporteSchema = z
  .object({
    tipoObjeto: z.enum(TIPOS_OBJETO, { error: 'No se puede reportar eso.' }),
    // Un cuid; no se valida el formato exacto porque el controlador
    // comprueba que el objeto EXISTA, que es la garantía que importa.
    objetoId: z.string().trim().min(1).max(40),
    motivo: z.enum(MOTIVOS_REPORTE, { error: 'Elige un motivo válido.' }),
    detalle: z.string().trim().max(1000, 'Máximo 1000 caracteres.').optional(),
  })
  .strict();

// ── Revisar (moderadores) ────────────────────────────────────────────

export const ESTADOS_REPORTE = ['PENDIENTE', 'REVISADO', 'DESCARTADO'] as const;

export const listarReportesSchema = z
  .object({
    estado: z.enum(ESTADOS_REPORTE).default('PENDIENTE'),
    cursor: z.string().trim().max(40).optional(),
    limite: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

/**
 * Resolver un reporte.
 *
 * `accion` es lo que el moderador hace ADEMÁS de cerrar el reporte, y va
 * en la misma petición a propósito: cerrar el reporte y ocultar el
 * contenido son un solo gesto, y separarlos deja la puerta abierta a
 * cerrar sin actuar por un fallo de red a la mitad.
 */
export const resolverReporteSchema = z
  .object({
    estado: z.enum(['REVISADO', 'DESCARTADO'], {
      error: 'Un reporte solo se puede marcar como revisado o descartado.',
    }),
    /** `ninguna` = el reporte no procedía, o ya se actuó por otra vía. */
    accion: z.enum(['ninguna', 'ocultar', 'suspender']).default('ninguna'),
    resolucion: z.string().trim().max(500).optional(),
    /** Días de suspensión. Ausente con `accion: suspender` = permanente. */
    dias: z.coerce.number().int().min(1).max(3650).optional(),
  })
  .strict();

// ── Acciones directas sobre una cuenta ───────────────────────────────

export const suspenderSchema = z
  .object({
    handle: z.string().trim().toLowerCase().min(3).max(24),
    /** Ausente = permanente. */
    dias: z.coerce.number().int().min(1).max(3650).optional(),
    motivo: z.string().trim().min(1, 'Escribe el motivo.').max(500),
  })
  .strict();

export const levantarSuspensionSchema = z
  .object({
    handle: z.string().trim().toLowerCase().min(3).max(24),
  })
  .strict();

/**
 * Ocultar contenido sin borrarlo.
 *
 * Usa el mismo `borradoEn` que el borrado del autor en vez de una columna
 * nueva `ocultadoPorMod`. Es deliberado: el efecto visible tiene que ser
 * idéntico —si fueran dos caminos distintos, cada consulta del feed
 * tendría que acordarse de filtrar por los dos, y la que se olvidara
 * dejaría el contenido moderado a la vista—. Quién lo ocultó y por qué
 * queda en `AuditLog`, que es donde se investiga un incidente.
 */
export const ocultarSchema = z
  .object({
    tipo: z.enum(['publicacion', 'comentario']),
    id: z.string().trim().min(1).max(40),
    motivo: z.string().trim().max(500).optional(),
  })
  .strict();

export const cambiarRolSchema = z
  .object({
    handle: z.string().trim().toLowerCase().min(3).max(24),
    rol: z.enum(['USER', 'MOD', 'ADMIN'], { error: 'Rol desconocido.' }),
  })
  .strict();

export type CrearReporteInput = z.infer<typeof crearReporteSchema>;
export type ListarReportesInput = z.infer<typeof listarReportesSchema>;
export type ResolverReporteInput = z.infer<typeof resolverReporteSchema>;
export type SuspenderInput = z.infer<typeof suspenderSchema>;
export type LevantarSuspensionInput = z.infer<typeof levantarSuspensionSchema>;
export type OcultarInput = z.infer<typeof ocultarSchema>;
export type CambiarRolInput = z.infer<typeof cambiarRolSchema>;
