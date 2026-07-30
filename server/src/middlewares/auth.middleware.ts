import type { RequestHandler } from 'express';
import { prisma } from '../config/prisma';
import { COOKIE_ACCESS, verificarAccessToken } from '../services/sesion.service';
import { errores } from './errores.middleware';

/** Datos del usuario autenticado que se cuelgan de `req`. */
export interface UsuarioReq {
  id: string;
  handle: string;
  rol: string;
}

// Extiende el tipo de Request de Express con `req.usuario`.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: UsuarioReq;
    }
  }
}

/**
 * Lee el access token de la cookie y valida.
 *
 * Comprueba `tokenVersion` contra la DB: así un cambio de contraseña o un
 * "cerrar sesión en todas partes" invalida de inmediato los access tokens
 * que aún no han expirado. Es una consulta por petición autenticada, pero
 * el índice por PK la hace trivial y el precio de no hacerlo es una
 * ventana de 15 minutos en la que una sesión revocada sigue funcionando.
 */
async function resolverUsuario(token: string | undefined): Promise<UsuarioReq | null> {
  if (!token) return null;

  const payload = verificarAccessToken(token);
  if (!payload) return null;

  const usuario = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      handle: true,
      rol: true,
      tokenVersion: true,
      suspendido: true,
      suspendidoHasta: true,
    },
  });

  if (!usuario) return null;
  if (usuario.tokenVersion !== payload.tv) return null;

  // Suspensión: permanente (sin fecha) o vigente.
  if (usuario.suspendido && (!usuario.suspendidoHasta || usuario.suspendidoHasta > new Date())) {
    return null;
  }

  return { id: usuario.id, handle: usuario.handle, rol: usuario.rol };
}

/** Exige sesión válida. Responde 401 si no hay. */
export const requiereAuth: RequestHandler = async (req, _res, next) => {
  try {
    const usuario = await resolverUsuario(req.cookies?.[COOKIE_ACCESS]);
    if (!usuario) return next(errores.noAutenticado());
    req.usuario = usuario;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Adjunta el usuario si hay sesión, pero no falla si no la hay.
 * Para rutas que se ven distinto logueado (un perfil público muestra el
 * botón de seguir solo si se sabe quién es el visitante).
 */
export const authOpcional: RequestHandler = async (req, _res, next) => {
  try {
    const usuario = await resolverUsuario(req.cookies?.[COOKIE_ACCESS]);
    if (usuario) req.usuario = usuario;
    next();
  } catch {
    // Un token inválido en una ruta opcional no es un error: se sigue
    // como anónimo.
    next();
  }
};

/** Exige uno de los roles dados. Usar siempre DESPUÉS de requiereAuth. */
export const requiereRol =
  (...roles: string[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.usuario) return next(errores.noAutenticado());
    if (!roles.includes(req.usuario.rol)) return next(errores.sinPermiso());
    next();
  };

export const requiereAdmin = requiereRol('ADMIN');
export const requiereMod = requiereRol('ADMIN', 'MOD');
