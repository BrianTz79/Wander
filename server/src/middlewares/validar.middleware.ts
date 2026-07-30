import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

/**
 * Valida y NORMALIZA la entrada con un schema de zod.
 *
 * Lo importante: reemplaza `req.body` por el resultado parseado. Como los
 * schemas no usan `.passthrough()`, los campos no declarados se descartan.
 * Eso mata de raíz el mass assignment: aunque alguien mande
 * `{"rol": "ADMIN"}` al endpoint de editar perfil, el campo no llega al
 * controlador ni a Prisma.
 */
export const validarBody =
  (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    const resultado = schema.safeParse(req.body);
    if (!resultado.success) return next(resultado.error);
    req.body = resultado.data;
    next();
  };

export const validarQuery =
  (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    const resultado = schema.safeParse(req.query);
    if (!resultado.success) return next(resultado.error);
    // `req.query` es un getter en Express 5, así que no se puede asignar
    // directamente; se guarda aparte.
    Object.defineProperty(req, 'queryValidada', { value: resultado.data, writable: false });
    next();
  };

export const validarParams =
  (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    const resultado = schema.safeParse(req.params);
    if (!resultado.success) return next(resultado.error);
    Object.defineProperty(req, 'paramsValidados', { value: resultado.data, writable: false });
    next();
  };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      queryValidada?: unknown;
      paramsValidados?: unknown;
    }
  }
}
