import { z } from 'zod';
import { IDS_PLANTILLA } from './plantillas';

/**
 * Validación del perfil, su tema y sus bloques.
 *
 * Regla general: TODO lo que acaba en `config` (JSON libre en la DB) pasa
 * por el schema de su tipo antes de guardarse. Un tipo desconocido o un
 * campo de más se rechaza — el mass assignment muere aquí, no en Prisma.
 */

// ── Tema ─────────────────────────────────────────────────────────────

/** Color hex de 6 dígitos. Validarlo con regex es lo que permite meterlo
 *  después en un atributo style sin abrir la puerta a inyecciones. */
const colorHex = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido: usa formato #rrggbb.');

export const FUENTES_PERFIL = ['inter', 'system', 'mono', 'serif'] as const;

/**
 * Tokens de diseño del perfil. Todos opcionales: lo que falte usa el valor
 * por defecto de la plantilla en el cliente. `.strict()` para que un campo
 * inventado no se cuele al JSON de la DB.
 */
export const temaSchema = z
  .object({
    colorFondo: colorHex.optional(),
    colorTexto: colorHex.optional(),
    colorAcento: colorHex.optional(),
    colorTarjeta: colorHex.optional(),
    colorBorde: colorHex.optional(),
    fuente: z.enum(FUENTES_PERFIL).optional(),
    radio: z.number().int().min(0).max(32).optional(),
  })
  .strict();

// ── Bloques ──────────────────────────────────────────────────────────

/** Solo http/https. `javascript:alert(1)` pasa el `.url()` de zod, así que
 *  el refine no es decorativo: es la barrera contra XSS por enlace. */
const urlHttp = z
  .string()
  .trim()
  .max(500, 'La URL es demasiado larga.')
  .url('Esa URL no parece válida.')
  .refine(
    (u) => u.startsWith('https://') || u.startsWith('http://'),
    'Solo se permiten enlaces http:// o https://.'
  );

const heroConfigSchema = z
  .object({
    // Frase corta bajo el nombre. La bio larga vive en User.bio.
    tagline: z.string().trim().max(120, 'Máximo 120 caracteres.').optional(),
    mostrarBio: z.boolean().optional(),
  })
  .strict();

const textoConfigSchema = z
  .object({
    titulo: z.string().trim().max(80, 'Máximo 80 caracteres.').optional(),
    // Texto plano. Se renderiza como texto (nunca HTML), así que el límite
    // es de cortesía, no de seguridad.
    contenido: z.string().max(5000, 'Máximo 5000 caracteres.').default(''),
  })
  .strict();

const enlaceSchema = z
  .object({
    etiqueta: z.string().trim().min(1, 'La etiqueta no puede estar vacía.').max(40),
    url: urlHttp,
  })
  .strict();

const enlacesConfigSchema = z
  .object({
    titulo: z.string().trim().max(80).optional(),
    enlaces: z.array(enlaceSchema).max(20, 'Máximo 20 enlaces por bloque.').default([]),
  })
  .strict();

// ── Bloques de Steam (Fase 5) ────────────────────────────────────────
//
// Estos tres bloques no guardan DATOS de Steam en su `config`, solo
// PREFERENCIAS de presentación. Los datos viven en `CacheExterno` y se
// piden aparte. Si el config guardara las horas jugadas, cada perfil
// tendría una copia congelada que envejece sin que nadie la refresque, y
// el usuario podría editarla a mano para inventarse sus estadísticas.

const steamActividadConfigSchema = z
  .object({
    titulo: z.string().trim().max(80).optional(),
    // Cuántos juegos recientes enseñar. El servicio trae 12 como mucho.
    limite: z.number().int().min(1).max(12).default(6),
    mostrarHorasTotales: z.boolean().optional(),
  })
  .strict();

const estadisticasConfigSchema = z
  .object({
    titulo: z.string().trim().max(80).optional(),
    mostrarNivel: z.boolean().optional(),
    mostrarTotalJuegos: z.boolean().optional(),
    mostrarHoras: z.boolean().optional(),
  })
  .strict();

/**
 * Favoritos: el usuario CURA la lista (§2, "destacados curados"), así que
 * lo que se guarda son appids. El nombre, la carátula y las horas se
 * resuelven contra la caché de Steam al pintar — nunca se confía en un
 * nombre que mande el cliente.
 */
const favoritosConfigSchema = z
  .object({
    titulo: z.string().trim().max(80).optional(),
    // Un appid es un entero positivo. Máximo 12 para que el bloque siga
    // siendo "destacados" y no una biblioteca entera.
    appids: z.array(z.number().int().positive().max(20_000_000)).max(12).default([]),
  })
  .strict();

// ── Bloques de Discord (Fase 6) ──────────────────────────────────────
//
// Misma regla que los de Steam: solo PREFERENCIAS, ningún dato. La
// presencia se pide a `/api/externo/discord/:handle` y cambia cada minuto;
// congelarla en el config sería mostrar "jugando a algo" para siempre.

const discordEstadoConfigSchema = z
  .object({
    titulo: z.string().trim().max(80).optional(),
    mostrarActividad: z.boolean().optional(),
    /** Avatar y nombre de Discord junto al estado. */
    mostrarAvatar: z.boolean().optional(),
  })
  .strict();

const spotifyConfigSchema = z
  .object({
    titulo: z.string().trim().max(80).optional(),
    /** Barra de progreso de la canción. Es puramente visual. */
    mostrarProgreso: z.boolean().optional(),
  })
  .strict();

/**
 * Registro de tipos de bloque de la v1. Añadir un tipo = añadir su schema
 * aquí; cualquier otro string se rechaza con la lista de válidos.
 */
export const SCHEMAS_BLOQUE = {
  hero: heroConfigSchema,
  texto: textoConfigSchema,
  enlaces: enlacesConfigSchema,
  'steam-actividad': steamActividadConfigSchema,
  estadisticas: estadisticasConfigSchema,
  favoritos: favoritosConfigSchema,
  'discord-estado': discordEstadoConfigSchema,
  spotify: spotifyConfigSchema,
} as const;

export type TipoBloque = keyof typeof SCHEMAS_BLOQUE;
export const TIPOS_BLOQUE = Object.keys(SCHEMAS_BLOQUE) as TipoBloque[];

/** Tope de bloques por perfil: evita que un perfil de 500 bloques se
 *  convierta en un DoS de render para quien lo visite. */
export const MAX_BLOQUES = 30;

export const crearBloqueSchema = z
  .object({
    tipo: z.enum(TIPOS_BLOQUE as [TipoBloque, ...TipoBloque[]], {
      error: `Tipo de bloque desconocido. Válidos: ${TIPOS_BLOQUE.join(', ')}.`,
    }),
    config: z.unknown().optional(),
  })
  .strict();

export const actualizarBloqueSchema = z
  .object({
    config: z.unknown().optional(),
    visible: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.config !== undefined || v.visible !== undefined, {
    message: 'No hay nada que actualizar.',
  });

export const reordenarBloquesSchema = z
  .object({
    // La lista COMPLETA de ids en su nuevo orden. Pedirla entera (y no
    // "mueve X a la posición 3") hace la operación idempotente y elimina
    // las carreras entre dos reordenamientos simultáneos.
    orden: z.array(z.string().min(1)).min(1).max(MAX_BLOQUES),
  })
  .strict();

// ── Perfil ───────────────────────────────────────────────────────────

export const actualizarPerfilSchema = z
  .object({
    tema: temaSchema.optional(),
    // Aplicar una plantilla: el servidor resuelve el id contra el catálogo
    // y escribe SU tema. Nunca se guarda un id que no exista.
    plantilla: z.enum(IDS_PLANTILLA, { error: 'Esa plantilla no existe.' }).optional(),
    publicado: z.boolean().optional(),
    // Campos de User que se editan desde el editor. Viven aquí porque
    // para el usuario "mi perfil" es una sola cosa.
    displayName: z.string().trim().min(1, 'El nombre no puede estar vacío.').max(40).optional(),
    bio: z.string().trim().max(500, 'Máximo 500 caracteres.').optional(),
  })
  .strict();

export const handleParamSchema = z.object({
  handle: z.string().trim().toLowerCase().min(3).max(24),
});

export type ActualizarPerfilInput = z.infer<typeof actualizarPerfilSchema>;
export type CrearBloqueInput = z.infer<typeof crearBloqueSchema>;
export type ActualizarBloqueInput = z.infer<typeof actualizarBloqueSchema>;
export type ReordenarBloquesInput = z.infer<typeof reordenarBloquesSchema>;
