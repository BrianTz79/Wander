import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import hpp from 'hpp';
import pinoHttp from 'pino-http';
import { createServer } from 'node:http';

import { env } from './config/env';
import { logger } from './config/logger';
import { esperarDb, prisma } from './config/prisma';
import { manejadorErrores, noEncontrado } from './middlewares/errores.middleware';
import { limiteGeneral } from './middlewares/rateLimit.middleware';
import { limpiarSesionesViejas } from './services/sesion.service';
import { INTERVALO_REFRESCO_MS, refrescarCachesSteam } from './jobs/refrescarCaches';

import authRoutes from './routes/auth.routes';
import oauthRoutes from './routes/oauth.routes';
import cuentasRoutes from './routes/cuentas.routes';
import seoRoutes from './routes/seo.routes';
import perfilesRoutes from './routes/perfiles.routes';
import socialRoutes from './routes/social.routes';
import externoRoutes from './routes/externo.routes';

const app = express();

// ─────────────────────────────────────────────────────────────────────
//  Confianza en el proxy
// ─────────────────────────────────────────────────────────────────────
// El backend siempre está detrás de nginx, que a su vez está detrás del
// túnel de Cloudflare. `trust proxy` con un número exacto (no `true`) es
// deliberado: con `true`, cualquiera podría mandar un X-Forwarded-For
// falso y saltarse el rate limit por IP.
app.set('trust proxy', 1);

// No revelar el framework. Es información gratis para quien busca
// vulnerabilidades conocidas de Express.
app.disable('x-powered-by');

// ─────────────────────────────────────────────────────────────────────
//  Seguridad de cabeceras
// ─────────────────────────────────────────────────────────────────────
// La CSP de las páginas la pone nginx (es quien sirve el HTML). Aquí
// helmet cubre las respuestas de la API, que son JSON: no necesitan CSP
// de scripts, pero sí nosniff, sin frames y sin referrer.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        sandbox: [],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
    hsts: env.esProduccion
      ? { maxAge: 63072000, includeSubDomains: true, preload: true }
      : false,
  })
);

// ─────────────────────────────────────────────────────────────────────
//  CORS
// ─────────────────────────────────────────────────────────────────────
// Lista blanca estricta. `credentials: true` es necesario para que el
// navegador mande las cookies de sesión, y por eso el origen NO puede ser
// '*' — la combinación está prohibida por la spec, y con razón.
const origenesPermitidos = new Set(
  [
    env.PUBLIC_URL,
    // Vite en desarrollo.
    ...(env.esProduccion ? [] : ['http://localhost:5173', 'http://localhost:3045']),
  ].filter(Boolean)
);

app.use(
  cors({
    origin(origen, callback) {
      // Sin cabecera Origin = misma-origen o herramienta local: se permite.
      if (!origen) return callback(null, true);
      if (origenesPermitidos.has(origen)) return callback(null, true);
      logger.warn({ origen }, 'CORS: origen rechazado');
      return callback(new Error('Origen no permitido por CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  })
);

// ─────────────────────────────────────────────────────────────────────
//  Parsers
// ─────────────────────────────────────────────────────────────────────
// Límite bajo en el JSON a propósito: ningún endpoint legítimo manda más
// de esto por body (los archivos van por multipart, con su propio límite).
// Sin límite, un body gigante es un DoS de memoria trivial.
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));
app.use(cookieParser());

// Protege contra contaminación de parámetros: ?rol=USER&rol=ADMIN haría
// que `req.query.rol` fuese un array y podría confundir a un validador
// escrito para un string.
app.use(hpp());

app.use(compression());

// ─────────────────────────────────────────────────────────────────────
//  Logging
// ─────────────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    // El healthcheck corre cada 15 s: loguearlo solo ensucia.
    autoLogging: {
      ignore: (req) => req.url === '/api/health',
    },
    customLogLevel(_req, res, err) {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  })
);

// ─────────────────────────────────────────────────────────────────────
//  Rutas
// ─────────────────────────────────────────────────────────────────────

// Healthcheck: antes del rate limit, porque Docker lo llama constantemente.
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, servicio: 'wander-api', hora: new Date().toISOString() });
});

// Comprobación profunda: incluye la DB. Para diagnóstico manual, no para
// el healthcheck de Docker (no conviene reiniciar el backend porque la DB
// tenga un hipo).
app.get('/api/health/completo', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      ok: true,
      db: 'ok',
      integraciones: env.integraciones,
    });
  } catch {
    res.status(503).json({ ok: false, db: 'error' });
  }
});

app.use('/api', limiteGeneral);

app.use('/api/auth', authRoutes);

// OAuth de Discord y Google (Fase 6). Va aparte de /api/auth porque la
// misma ruta sirve para entrar y para vincular con sesión activa.
app.use('/api/oauth', oauthRoutes);

// Gestión de cuentas vinculadas desde /configuracion.
app.use('/api/cuentas', cuentasRoutes);

app.use('/api/perfiles', perfilesRoutes);

// Social (Fase 7): seguir, feed, publicaciones, comentarios, reacciones,
// explorar y notificaciones.
app.use('/api/social', socialRoutes);

// Datos de proveedores externos (Steam en la Fase 5). Sirve de la caché
// de Postgres: el render de un perfil nunca sale a la red de Valve.
app.use('/api/externo', externoRoutes);

// SEO: nginx proxea /sitemap.xml aquí. Se genera al vuelo porque crece
// con cada perfil publicado.
app.use('/api/seo', seoRoutes);

// 404 y manejador de errores: siempre al final.
app.use('/api', noEncontrado);
app.use(manejadorErrores);

// ─────────────────────────────────────────────────────────────────────
//  Arranque
// ─────────────────────────────────────────────────────────────────────
const servidor = createServer(app);

async function arrancar(): Promise<void> {
  await esperarDb();
  logger.info('Conexión con la base de datos establecida.');

  servidor.listen(env.PORT, () => {
    logger.info(
      {
        puerto: env.PORT,
        entorno: env.NODE_ENV,
        url: env.PUBLIC_URL,
        integraciones: env.integraciones,
      },
      'Wander API escuchando'
    );
  });

  // Limpieza periódica de sesiones caducadas. Cada 6 h es suficiente:
  // las sesiones expiradas ya no autentican, esto solo libera espacio.
  const intervalo = setInterval(
    () => {
      limpiarSesionesViejas()
        .then((n) => {
          if (n > 0) logger.info({ borradas: n }, 'Sesiones caducadas limpiadas');
        })
        .catch((error) => logger.error({ error }, 'Fallo al limpiar sesiones'));
    },
    6 * 60 * 60 * 1000
  );
  intervalo.unref();

  // Refresco de las cachés de Steam. Va por delante del TTL para que el
  // visitante no pague nunca la espera de la llamada externa.
  if (env.integraciones.steam) {
    const refresco = setInterval(() => {
      refrescarCachesSteam()
        .then((n) => {
          if (n > 0) logger.info({ refrescados: n }, 'Cachés de Steam refrescadas');
        })
        .catch((error) => logger.error({ error }, 'Fallo en el job de refresco de Steam'));
    }, INTERVALO_REFRESCO_MS);
    refresco.unref();
  } else {
    logger.warn('Sin STEAM_API_KEY: el job de refresco de Steam queda desactivado.');
  }
}

// ─────────────────────────────────────────────────────────────────────
//  Apagado ordenado
// ─────────────────────────────────────────────────────────────────────
// Sin esto, un `docker compose restart` corta las peticiones a medias y
// puede dejar transacciones abiertas.
let apagando = false;
async function apagar(senal: string): Promise<void> {
  if (apagando) return;
  apagando = true;
  logger.info({ senal }, 'Apagando…');

  servidor.close(() => logger.info('Servidor HTTP cerrado.'));

  // Margen para que terminen las peticiones en vuelo.
  setTimeout(() => {
    logger.warn('Tiempo de espera agotado; forzando salida.');
    process.exit(1);
  }, 10_000).unref();

  try {
    await prisma.$disconnect();
    logger.info('Prisma desconectado.');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error al desconectar Prisma');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void apagar('SIGTERM'));
process.on('SIGINT', () => void apagar('SIGINT'));

// Un rechazo no manejado deja el proceso en estado indefinido. Se loguea y
// se sale para que Docker reinicie con estado limpio.
process.on('unhandledRejection', (razon) => {
  logger.fatal({ razon }, 'Promesa rechazada sin manejar');
  void apagar('unhandledRejection');
});
process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Excepción no capturada');
  void apagar('uncaughtException');
});

arrancar().catch((error) => {
  logger.fatal({ error }, 'No se pudo arrancar el servidor');
  process.exit(1);
});
