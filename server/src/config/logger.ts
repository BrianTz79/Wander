import pino from 'pino';
import { env } from './env';

/**
 * Logger estructurado.
 *
 * `redact` es la parte importante: hay campos que NUNCA deben aparecer en
 * los logs, ni por accidente al loguear un objeto entero. Los logs se
 * rotan, se copian y se leen en pantallas compartidas — un token ahí es
 * un token filtrado.
 */
export const logger = pino({
  level: env.esProduccion ? 'info' : 'debug',

  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      'passwordHash',
      'contrasena',
      'token',
      'accessToken',
      'refreshToken',
      'accessTokenCif',
      'refreshTokenCif',
      'ENCRYPTION_KEY',
      'JWT_SECRET',
      'REFRESH_SECRET',
      'STEAM_API_KEY',
      '*.password',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
    ],
    censor: '[oculto]',
  },

  // En desarrollo, salida legible; en producción, JSON de una línea para
  // que lo pueda ingerir cualquier colector.
  transport: env.esProduccion
    ? undefined
    : {
        target: 'pino/file',
        options: { destination: 1 },
      },

  base: { servicio: 'wander-api' },
});

export type Logger = typeof logger;
