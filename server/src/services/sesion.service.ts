import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { hashIp, hashToken, tokenAleatorio } from '../config/cripto';
import { logger } from '../config/logger';

/**
 * Gestión de sesiones.
 *
 * Diseño y por qué:
 *
 *  · El access token es un JWT corto (15 min) que va en una cookie
 *    httpOnly. No se guarda en localStorage — con contenido y CSS de
 *    usuarios en juego, un XSS que pueda leer el token sería un secuestro
 *    de cuenta. httpOnly hace que el JS de la página no lo vea nunca.
 *
 *  · El refresh token es opaco y aleatorio (no un JWT), se guarda HASHEADO
 *    en la tabla `Sesion`, y ROTA en cada uso. Guardar el hash significa
 *    que una filtración de la DB no da sesiones utilizables.
 *
 *  · La rotación permite detectar reuso: si llega un refresh token que ya
 *    fue usado, es señal de robo → se revocan todas las sesiones del
 *    usuario.
 *
 *  · `tokenVersion` en User invalida todo de golpe (cambio de contraseña,
 *    "cerrar sesión en todas partes") sin tener que borrar filas.
 */

const MIN = 60;
const DIA = 24 * 60 * MIN;

export const DURACION_ACCESS_S = 15 * MIN; // 15 minutos
export const DURACION_REFRESH_S = 30 * DIA; // 30 días

export const COOKIE_ACCESS = 'wander_at';
export const COOKIE_REFRESH = 'wander_rt';

export interface PayloadAccess {
  sub: string; // userId
  handle: string;
  rol: string;
  tv: number; // tokenVersion
}

/** Opciones comunes de cookie. `sameSite: 'lax'` deja que los callbacks de
 *  OAuth (redirect GET desde otro dominio) lleguen con la cookie puesta,
 *  y sigue bloqueando el CSRF de peticiones POST cross-site.
 *
 *  El `path` importa: el access token viaja a toda la API, pero el
 *  refresh (credencial de 30 días) solo lo leen /api/auth/refresh y
 *  /api/auth/logout — acotarlo a /api/auth evita mandarlo en cada
 *  petición y reduce la superficie por la que podría filtrarse. */
function opcionesCookie(maxEdadS: number, path = '/') {
  return {
    httpOnly: true,
    secure: env.esProduccion,
    sameSite: 'lax' as const,
    path,
    maxAge: maxEdadS * 1000,
  };
}

const PATH_REFRESH = '/api/auth';

export function firmarAccessToken(payload: PayloadAccess): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: DURACION_ACCESS_S,
    issuer: 'wander',
    audience: 'wander-web',
  });
}

export function verificarAccessToken(token: string): PayloadAccess | null {
  try {
    return jwt.verify(token, env.JWT_SECRET, {
      issuer: 'wander',
      audience: 'wander-web',
    }) as PayloadAccess;
  } catch {
    return null;
  }
}

/**
 * Crea una sesión nueva: guarda el refresh hasheado y pone ambas cookies.
 */
export async function crearSesion(
  res: Response,
  usuario: { id: string; handle: string; rol: string; tokenVersion: number },
  meta: { userAgent?: string | undefined; ip?: string | undefined }
): Promise<void> {
  const refresh = tokenAleatorio(48);

  await prisma.sesion.create({
    data: {
      userId: usuario.id,
      tokenHash: hashToken(refresh),
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
      ipHash: hashIp(meta.ip),
      expiraEn: new Date(Date.now() + DURACION_REFRESH_S * 1000),
    },
  });

  const access = firmarAccessToken({
    sub: usuario.id,
    handle: usuario.handle,
    rol: usuario.rol,
    tv: usuario.tokenVersion,
  });

  res.cookie(COOKIE_ACCESS, access, opcionesCookie(DURACION_ACCESS_S));
  res.cookie(COOKIE_REFRESH, refresh, opcionesCookie(DURACION_REFRESH_S, PATH_REFRESH));
}

/**
 * Rota un refresh token: valida, revoca el viejo y emite uno nuevo.
 * Devuelve null si el token no sirve (expirado, revocado o desconocido).
 *
 * Si llega un token ya revocado, se asume robo y se revocan TODAS las
 * sesiones del usuario.
 */
export async function rotarSesion(
  res: Response,
  refreshRecibido: string,
  meta: { userAgent?: string | undefined; ip?: string | undefined }
): Promise<{ id: string; handle: string; rol: string } | null> {
  const hash = hashToken(refreshRecibido);

  const sesion = await prisma.sesion.findUnique({
    where: { tokenHash: hash },
    include: {
      user: {
        select: {
          id: true,
          handle: true,
          rol: true,
          tokenVersion: true,
          suspendido: true,
          suspendidoHasta: true,
        },
      },
    },
  });

  if (!sesion) return null;

  // Token ya revocado presentado de nuevo → señal de robo.
  if (sesion.revocadaEn) {
    logger.warn(
      { userId: sesion.userId },
      'Reuso de refresh token revocado: se revocan todas las sesiones del usuario.'
    );
    await prisma.sesion.updateMany({
      where: { userId: sesion.userId, revocadaEn: null },
      data: { revocadaEn: new Date() },
    });
    return null;
  }

  if (sesion.expiraEn < new Date()) return null;

  const u = sesion.user;
  if (u.suspendido && (!u.suspendidoHasta || u.suspendidoHasta > new Date())) return null;

  // Rotación: revocar el viejo y crear el nuevo en una transacción, para
  // que no exista un instante con dos válidos ni con ninguno.
  const nuevoRefresh = tokenAleatorio(48);
  await prisma.$transaction([
    prisma.sesion.update({
      where: { id: sesion.id },
      data: { revocadaEn: new Date() },
    }),
    prisma.sesion.create({
      data: {
        userId: u.id,
        tokenHash: hashToken(nuevoRefresh),
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
        ipHash: hashIp(meta.ip),
        expiraEn: new Date(Date.now() + DURACION_REFRESH_S * 1000),
      },
    }),
  ]);

  const access = firmarAccessToken({
    sub: u.id,
    handle: u.handle,
    rol: u.rol,
    tv: u.tokenVersion,
  });

  res.cookie(COOKIE_ACCESS, access, opcionesCookie(DURACION_ACCESS_S));
  res.cookie(COOKIE_REFRESH, nuevoRefresh, opcionesCookie(DURACION_REFRESH_S, PATH_REFRESH));

  return { id: u.id, handle: u.handle, rol: u.rol };
}

/** Cierra la sesión actual. */
export async function cerrarSesion(res: Response, refresh?: string): Promise<void> {
  if (refresh) {
    await prisma.sesion
      .updateMany({
        where: { tokenHash: hashToken(refresh), revocadaEn: null },
        data: { revocadaEn: new Date() },
      })
      .catch(() => undefined);
  }
  res.clearCookie(COOKIE_ACCESS, { path: '/' });
  res.clearCookie(COOKIE_REFRESH, { path: PATH_REFRESH });
}

/** Cierra todas las sesiones e invalida todos los access tokens vivos. */
export async function cerrarTodasLasSesiones(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.sesion.updateMany({
      where: { userId, revocadaEn: null },
      data: { revocadaEn: new Date() },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    }),
  ]);
}

/** Limpia sesiones expiradas o revocadas hace más de 30 días. */
export async function limpiarSesionesViejas(): Promise<number> {
  const corte = new Date(Date.now() - 30 * DIA * 1000);
  const { count } = await prisma.sesion.deleteMany({
    where: {
      OR: [{ expiraEn: { lt: new Date() } }, { revocadaEn: { lt: corte } }],
    },
  });
  return count;
}
