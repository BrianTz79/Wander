import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Configuración central. Valida TODO al arrancar y falla rápido si algo
 * falta o es débil, en vez de arrancar con un fallback inseguro.
 *
 * La regla: es mejor que el contenedor no arranque y salga un error claro
 * en los logs, que un servidor en producción firmando tokens con
 * "secreto_dev" porque alguien olvidó una variable.
 */

// Un secreto de 32 bytes en hex son 64 caracteres. Aceptamos cualquier
// cadena de 32+ caracteres, pero avisamos si no parece aleatoria.
const secreto = (nombre: string) =>
  z
    .string({ error: `Falta ${nombre}. Géneralo con: openssl rand -hex 32` })
    .min(32, `${nombre} debe tener al menos 32 caracteres. Géneralo con: openssl rand -hex 32`);

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z
    .string({ error: 'Falta DATABASE_URL.' })
    .startsWith('postgresql://', 'DATABASE_URL debe ser una URL de PostgreSQL.'),

  JWT_SECRET: secreto('JWT_SECRET'),
  REFRESH_SECRET: secreto('REFRESH_SECRET'),
  // AES-256-GCM necesita exactamente 32 bytes = 64 caracteres hex.
  ENCRYPTION_KEY: z
    .string({ error: 'Falta ENCRYPTION_KEY. Génerala con: openssl rand -hex 32' })
    .regex(
      /^[0-9a-fA-F]{64}$/,
      'ENCRYPTION_KEY debe ser exactamente 64 caracteres hex (32 bytes). Génerala con: openssl rand -hex 32'
    ),

  PUBLIC_URL: z
    .string({ error: 'Falta PUBLIC_URL.' })
    .url('PUBLIC_URL debe ser una URL completa, ej. https://wander.ourocore.net'),

  // Integraciones: todas opcionales. La app arranca sin ellas y desactiva
  // la funcionalidad correspondiente en vez de romperse.
  STEAM_API_KEY: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),
  TWITCH_CLIENT_ID: z.string().optional(),
  TWITCH_CLIENT_SECRET: z.string().optional(),
  GIPHY_API_KEY: z.string().optional(),

  UPLOAD_DIR: z.string().default('/app/uploads'),
});

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  const problemas = resultado.error.issues
    .map((i) => `  · ${i.path.join('.') || '(raíz)'}: ${i.message}`)
    .join('\n');

  // Se escribe a stderr y se sale con código 1: en Docker esto deja el
  // error visible en `docker compose logs` y evita el arranque.
  console.error(
    `\n╭─ Configuración inválida ────────────────────────────────────\n` +
      `│ El servidor no puede arrancar. Revisa tu .env:\n│\n` +
      problemas.replace(/^/gm, '│ ') +
      `\n│\n│ Plantilla completa en .env.example\n` +
      `╰─────────────────────────────────────────────────────────────\n`
  );
  process.exit(1);
}

const bruto = resultado.data;

// Comprobaciones extra que zod no cubre bien y que importan de verdad.
const avisos: string[] = [];

if (bruto.JWT_SECRET === bruto.REFRESH_SECRET) {
  console.error(
    'JWT_SECRET y REFRESH_SECRET no pueden ser iguales: un access token robado ' +
      'serviría como refresh token. Genera dos distintos.'
  );
  process.exit(1);
}

if (bruto.NODE_ENV === 'production') {
  if (!bruto.PUBLIC_URL.startsWith('https://')) {
    console.error(
      'En producción PUBLIC_URL debe usar https:// — las cookies de sesión ' +
        'se marcan Secure y el navegador no las mandaría por http.'
    );
    process.exit(1);
  }
  // Patrones de secreto de ejemplo que alguien podría dejar copiados.
  const sospechosos = [/cambiame/i, /^(test|dev|secreto|password|changeme)/i, /^(.)\1+$/];
  for (const [nombre, valor] of [
    ['JWT_SECRET', bruto.JWT_SECRET],
    ['REFRESH_SECRET', bruto.REFRESH_SECRET],
  ] as const) {
    if (sospechosos.some((p) => p.test(valor))) {
      console.error(`${nombre} parece un valor de ejemplo. Genera uno real: openssl rand -hex 32`);
      process.exit(1);
    }
  }
  if (!bruto.STEAM_API_KEY) {
    avisos.push('Sin STEAM_API_KEY: solo se usará el feed público de Steam (menos datos).');
  }
}

for (const aviso of avisos) console.warn(`⚠ ${aviso}`);

export const env = {
  ...bruto,
  esProduccion: bruto.NODE_ENV === 'production',
  esDesarrollo: bruto.NODE_ENV === 'development',

  /** Qué integraciones están realmente configuradas y usables. */
  integraciones: {
    steam: Boolean(bruto.STEAM_API_KEY),
    discord: Boolean(bruto.DISCORD_CLIENT_ID && bruto.DISCORD_CLIENT_SECRET),
    google: Boolean(bruto.GOOGLE_CLIENT_ID && bruto.GOOGLE_CLIENT_SECRET),
    spotify: Boolean(bruto.SPOTIFY_CLIENT_ID && bruto.SPOTIFY_CLIENT_SECRET),
    twitch: Boolean(bruto.TWITCH_CLIENT_ID && bruto.TWITCH_CLIENT_SECRET),
    giphy: Boolean(bruto.GIPHY_API_KEY),
  },
} as const;

export type Env = typeof env;
