import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { errores } from '../middlewares/errores.middleware';
import { crearSesion } from '../services/sesion.service';
import {
  resumenJugador,
  urlAutenticacionSteam,
  verificarRespuestaSteam,
} from '../services/steamAuth.service';
import { generarHandleLibre } from '../services/handle.service';
import { PLANTILLA_POR_DEFECTO } from '../schemas/plantillas';

/**
 * Login con Steam (OpenID 2.0) — cierre de la Fase 2.
 *
 * Dos rutas:
 *  · GET /api/auth/steam          → redirige a Steam.
 *  · GET /api/auth/steam/callback → Steam devuelve aquí al usuario.
 *
 * El callback es un GET con redirección (no una respuesta JSON) porque
 * quien llega es el NAVEGADOR volviendo de Steam, no fetch(). Termina
 * siempre en una página del sitio, con la sesión ya puesta en cookies.
 */

// ─────────────────────────────────────────────────────────────────────
//  GET /api/auth/steam
// ─────────────────────────────────────────────────────────────────────
export function iniciarSteam(_req: Request, res: Response): void {
  res.redirect(urlAutenticacionSteam());
}

// ─────────────────────────────────────────────────────────────────────
//  GET /api/auth/steam/callback
// ─────────────────────────────────────────────────────────────────────
export async function callbackSteam(req: Request, res: Response): Promise<void> {
  // El usuario pulsó "cancelar" en Steam: no es un error, es una vuelta.
  if (req.query['openid.mode'] === 'cancel') {
    res.redirect('/login?steam=cancelado');
    return;
  }

  const steamId = await verificarRespuestaSteam(req.query as Record<string, unknown>);
  if (!steamId) {
    logger.warn({ ip: req.ip }, 'Respuesta de Steam no verificada');
    res.redirect('/login?error=steam');
    return;
  }

  // ── ¿Ya conocemos este SteamID? ──
  // El @@unique([proveedor, proveedorId]) del schema garantiza que un
  // SteamID pertenece como mucho a un usuario, así que esto es la
  // identidad: si existe, se entra a ESA cuenta.
  const vinculo = await prisma.cuentaVinculada.findUnique({
    where: { proveedor_proveedorId: { proveedor: 'steam', proveedorId: steamId } },
    select: {
      userId: true,
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

  if (vinculo) {
    const u = vinculo.user;

    // Una cuenta suspendida no entra por la puerta de atrás de Steam.
    const suspendidoActivo =
      u.suspendido && (!u.suspendidoHasta || u.suspendidoHasta > new Date());
    if (suspendidoActivo) {
      res.redirect('/login?error=suspendido');
      return;
    }

    // Marcar que con esta cuenta se puede entrar: si el vínculo se creó
    // desde /configuracion (Fase 6) solo para traer datos, el primer login
    // por Steam lo asciende a método de acceso.
    await prisma.cuentaVinculada.update({
      where: { proveedor_proveedorId: { proveedor: 'steam', proveedorId: steamId } },
      data: { esMetodoLogin: true },
    });

    await crearSesion(res, u, {
      userAgent: req.get('user-agent'),
      ip: req.ip,
    });
    await prisma.user.update({
      where: { id: u.id },
      data: { ultimoAccesoEn: new Date() },
    });

    logger.info({ userId: u.id, steamId }, 'Login con Steam (cuenta existente)');
    res.redirect('/editor');
    return;
  }

  // ── Cuenta nueva ──
  // Steam no da correo: el usuario queda sin `email` y sin contraseña, y
  // entra solo por Steam. El schema ya contempla ambos como opcionales.
  const resumen = await resumenJugador(steamId);
  const handle = await generarHandleLibre(resumen?.nombre ?? null);
  const displayName = (resumen?.nombre ?? '').trim().slice(0, 40) || handle;

  try {
    const usuario = await prisma.user.create({
      data: {
        handle,
        displayName,
        avatarUrl: resumen?.avatar ?? null,
        cuentas: {
          create: {
            proveedor: 'steam',
            proveedorId: steamId,
            usuarioRemoto: resumen?.nombre ?? null,
            avatarRemoto: resumen?.avatar ?? null,
            esMetodoLogin: true,
          },
        },
        perfil: {
          create: {
            plantilla: PLANTILLA_POR_DEFECTO,
            tema: {},
            bloques: {
              create: [
                { tipo: 'hero', orden: 0, config: {} },
                { tipo: 'enlaces', orden: 1, config: { enlaces: [] } },
              ],
            },
          },
        },
      },
      select: { id: true, handle: true, rol: true, tokenVersion: true },
    });

    await crearSesion(res, usuario, {
      userAgent: req.get('user-agent'),
      ip: req.ip,
    });

    logger.info({ userId: usuario.id, steamId, handle }, 'Cuenta creada con Steam');
    // A una cuenta recién creada se la manda al editor: es donde tiene
    // algo que hacer.
    res.redirect('/editor?bienvenida=steam');
  } catch (error) {
    // Carrera improbable: dos callbacks simultáneos del mismo SteamID, o
    // el handle generado ocupado entre la comprobación y el insert.
    logger.error({ error, steamId }, 'Fallo al crear cuenta con Steam');
    throw errores.conflicto('No se pudo crear la cuenta. Inténtalo de nuevo.');
  }
}
