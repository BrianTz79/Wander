import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '../config/logger';
import { env } from '../config/env';

/**
 * Error de aplicación con código HTTP. Lanzar esto desde un controlador es
 * la forma normal de devolver un 4xx con mensaje para el usuario.
 */
export class ErrorApp extends Error {
  constructor(
    public readonly estado: number,
    mensaje: string,
    public readonly codigo?: string,
    public readonly detalles?: unknown
  ) {
    super(mensaje);
    this.name = 'ErrorApp';
  }
}

export const errores = {
  noAutenticado: (msg = 'Necesitas iniciar sesión.') => new ErrorApp(401, msg, 'NO_AUTENTICADO'),
  sinPermiso: (msg = 'No tienes permiso para hacer esto.') => new ErrorApp(403, msg, 'SIN_PERMISO'),
  noEncontrado: (msg = 'No se encontró.') => new ErrorApp(404, msg, 'NO_ENCONTRADO'),
  conflicto: (msg: string) => new ErrorApp(409, msg, 'CONFLICTO'),
  invalido: (msg: string, detalles?: unknown) => new ErrorApp(400, msg, 'INVALIDO', detalles),
  demasiadas: (msg = 'Demasiadas peticiones. Espera un momento.') =>
    new ErrorApp(429, msg, 'RATE_LIMIT'),
};

/** Envuelve un handler async para que los rejects lleguen al manejador de
 *  errores sin tener que escribir try/catch en cada controlador. */
export const asyncHandler =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/** 404 para rutas de API que no existen. */
export const noEncontrado: RequestHandler = (req, _res, next) => {
  next(new ErrorApp(404, `Ruta no encontrada: ${req.method} ${req.path}`, 'RUTA_NO_ENCONTRADA'));
};

/**
 * Manejador central de errores.
 *
 * Principio de seguridad: al cliente se le manda lo mínimo necesario para
 * corregir su petición. Los stack traces, los mensajes de Postgres y los
 * nombres de columna se quedan en los logs del servidor — filtrarlos le
 * regala a un atacante el mapa del esquema.
 */
export const manejadorErrores: ErrorRequestHandler = (err, req, res, _next) => {
  // ── Errores de validación de zod ──
  if (err instanceof ZodError) {
    const detalles = err.issues.map((i) => ({
      campo: i.path.join('.'),
      mensaje: i.message,
    }));
    res.status(400).json({ error: 'Los datos enviados no son válidos.', detalles });
    return;
  }

  // ── Errores conocidos de Prisma ──
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 = violación de unicidad. Es el único que traducimos a un
    // mensaje útil, y sin decir qué columna exacta chocó.
    if (err.code === 'P2002') {
      const campos = (err.meta?.['target'] as string[] | undefined) ?? [];
      const nombre = campos.includes('handle')
        ? 'Ese nombre de usuario ya está tomado.'
        : campos.includes('email')
          ? 'Ese correo ya está registrado.'
          : 'Ese valor ya existe.';
      res.status(409).json({ error: nombre });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'No se encontró.' });
      return;
    }
    logger.error({ err, codigo: err.code, ruta: req.path }, 'Error de Prisma');
    res.status(500).json({ error: 'Error interno.' });
    return;
  }

  // ── Errores de aplicación ──
  if (err instanceof ErrorApp) {
    // Los 5xx propios sí se loguean; los 4xx son esperables.
    if (err.estado >= 500) {
      logger.error({ err, ruta: req.path }, err.message);
    }
    res.status(err.estado).json({
      error: err.message,
      ...(err.codigo ? { codigo: err.codigo } : {}),
      ...(err.detalles ? { detalles: err.detalles } : {}),
    });
    return;
  }

  // ── Errores de multer (subidas) ──
  if (typeof err === 'object' && err && 'code' in err) {
    const codigo = (err as { code: string }).code;
    if (codigo === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'El archivo es demasiado grande.' });
      return;
    }
    if (codigo === 'LIMIT_FILE_COUNT' || codigo === 'LIMIT_UNEXPECTED_FILE') {
      res.status(400).json({ error: 'Demasiados archivos o campo inesperado.' });
      return;
    }
  }

  // ── Cualquier otra cosa: 500 genérico ──
  // Se loguea todo (con stack) pero se responde sin detalle alguno.
  logger.error({ err, ruta: req.path, metodo: req.method }, 'Error no manejado');
  res.status(500).json({
    error: 'Error interno del servidor.',
    // Solo en desarrollo se expone el mensaje real, para depurar.
    ...(env.esProduccion ? {} : { debug: err instanceof Error ? err.message : String(err) }),
  });
};
