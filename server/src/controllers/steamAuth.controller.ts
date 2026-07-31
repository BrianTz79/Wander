import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { crearSesion } from '../services/sesion.service';
import {
  resumenJugador,
  urlAutenticacionSteam,
  verificarRespuestaSteam,
} from '../services/steamAuth.service';
import { crearState, leerState } from '../services/oauth.service';
import { generarHandleLibre } from '../services/handle.service';
import { PLANTILLA_POR_DEFECTO } from '../schemas/plantillas';
import { permisosPorDefecto } from '../schemas/cuentas.schema';
import { auditar } from './oauth.controller';

/**
 * Login y vinculación con Steam (OpenID 2.0) — Fase 2, corregido en la 9.5.
 *
 * Dos rutas:
 *  · GET /api/auth/steam          → redirige a Steam.
 *  · GET /api/auth/steam/callback → Steam devuelve aquí al usuario.
 *
 * El callback es un GET con redirección (no una respuesta JSON) porque
 * quien llega es el NAVEGADOR volviendo de Steam, no fetch(). Termina
 * siempre en una página del sitio, con la sesión ya puesta en cookies.
 *
 * **Igual que en OAuth, una misma pareja de rutas cubre dos flujos:**
 *
 *  · **Entrar** (sin sesión) → crea o recupera una cuenta de Wander.
 *  · **Vincular** (con sesión) → añade Steam a la cuenta actual.
 *
 * Que esto faltara era el bug: quien entraba con Google y pulsaba
 * «conectar Steam» en /configuracion acababa con una SEGUNDA cuenta,
 * porque el callback solo sabía crear. La intención se decide ahora al
 * SALIR y viaja firmada dentro del `state`, el mismo mecanismo que usa
 * `oauth.controller`. No se deduce al volver mirando la cookie: eso haría
 * que vincular con la sesión caducada creara una cuenta nueva en
 * silencio, que es exactamente el fallo que se está arreglando.
 *
 * El `state` trae además la protección CSRF de la que este flujo carecía:
 * sin él, cualquiera podía provocar una vuelta al callback.
 */

/** A dónde vuelve el usuario. Misma forma que en `oauth.controller` para
 *  que ambos flujos hablen el vocabulario que la UI ya sabe traducir. */
function volver(res: Response, destino: string, clave: string, valor: string): void {
  const url = new URL(destino, 'https://wander.local');
  url.searchParams.set(clave, valor);
  res.redirect(`${url.pathname}${url.search}`);
}

// ─────────────────────────────────────────────────────────────────────
//  GET /api/auth/steam
// ─────────────────────────────────────────────────────────────────────
export function iniciarSteam(req: Request, res: Response): void {
  // ¿Entrar o vincular? Lo decide la sesión AHORA, no el callback después.
  const intencion = req.usuario ? 'vincular' : 'login';
  const state = crearState({
    i: intencion,
    p: 'steam',
    ...(req.usuario ? { u: req.usuario.id } : {}),
  });

  res.redirect(urlAutenticacionSteam(state));
}

// ─────────────────────────────────────────────────────────────────────
//  GET /api/auth/steam/callback
// ─────────────────────────────────────────────────────────────────────
export async function callbackSteam(req: Request, res: Response): Promise<void> {
  /*
   * El `state` viaja por `openid.return_to`, así que Steam lo devuelve
   * como un parámetro más de la query. Se lee ANTES que nada porque
   * decide incluso a dónde volver si el flujo falla.
   */
  const contenido = leerState(req.query['state'], 'steam');

  // El usuario pulsó "cancelar" en Steam: no es un error, es una vuelta.
  if (req.query['openid.mode'] === 'cancel') {
    const destino = contenido?.i === 'vincular' ? '/configuracion' : '/login';
    volver(res, destino, 'steam', 'cancelado');
    return;
  }

  /*
   * Sin un state válido no se sigue. Antes este flujo no tenía ninguno, y
   * por eso no podía distinguir "entrar" de "vincular" — que es el bug que
   * creaba cuentas duplicadas — ni defenderse de una vuelta forzada.
   */
  if (!contenido) {
    logger.warn({ ip: req.ip }, 'Callback de Steam con state inválido');
    volver(res, '/login', 'error', 'state');
    return;
  }

  const destinoFallo = contenido.i === 'vincular' ? '/configuracion' : '/login';

  const steamId = await verificarRespuestaSteam(req.query as Record<string, unknown>);
  if (!steamId) {
    logger.warn({ ip: req.ip }, 'Respuesta de Steam no verificada');
    volver(res, destinoFallo, 'error', 'steam');
    return;
  }

  // Vincular a la cuenta que inició el flujo, no a la de la cookie.
  if (contenido.i === 'vincular') {
    await vincularSteam(req, res, steamId, contenido.u!);
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
      volver(res, '/login', 'error', 'suspendido');
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

    await auditar(u.id, 'login', { proveedor: 'steam' }, req);

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
            permisos: permisosPorDefecto('steam'),
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

    await auditar(usuario.id, 'login', { proveedor: 'steam', cuentaNueva: true }, req);

    logger.info({ userId: usuario.id, steamId, handle }, 'Cuenta creada con Steam');
    // A una cuenta recién creada se la manda al editor: es donde tiene
    // algo que hacer.
    res.redirect('/editor?bienvenida=steam');
  } catch (error) {
    // Carrera improbable: dos callbacks simultáneos del mismo SteamID, o
    // el handle generado ocupado entre la comprobación y el insert.
    // Se redirige en vez de lanzar: quien llega aquí es un navegador, y una
    // excepción le daría un JSON de error en pantalla en vez de una página.
    logger.error({ error, steamId }, 'Fallo al crear cuenta con Steam');
    volver(res, '/login', 'error', 'creacion');
  }
}

// ─────────────────────────────────────────────────────────────────────
//  Flujo B: vincular Steam a la cuenta ya iniciada
// ─────────────────────────────────────────────────────────────────────
/**
 * Añade Steam a una cuenta existente. Es el camino que faltaba, y el que
 * hace que «entré con Google y conecté Steam» termine con UNA cuenta.
 *
 * Espeja a `vincular()` de `oauth.controller`, incluidas sus dos reglas:
 * el usuario sale del `state` firmado (no de la cookie, que pudo caducar
 * mientras el usuario estaba en Steam), y una cuenta remota que ya es de
 * otra persona no se mueve ni se roba.
 */
async function vincularSteam(
  req: Request,
  res: Response,
  steamId: string,
  userId: string
): Promise<void> {
  const usuario = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!usuario) {
    volver(res, '/login', 'error', 'sesion');
    return;
  }

  // ¿Este SteamID ya está en Wander?
  const existente = await prisma.cuentaVinculada.findUnique({
    where: { proveedor_proveedorId: { proveedor: 'steam', proveedorId: steamId } },
    select: { userId: true },
  });

  if (existente && existente.userId !== userId) {
    /*
     * Pertenece a OTRO usuario. El @@unique([proveedor, proveedorId])
     * existe justo para que una cuenta remota identifique a una sola
     * persona: si se permitiera moverla, quien tuviera acceso temporal a
     * un Steam podría desvincularlo de su dueño y quedárselo.
     */
    logger.warn({ userId, steamId }, 'Intento de vincular un Steam ya usado por otro usuario');
    volver(res, '/configuracion', 'error', 'ya-vinculada');
    return;
  }

  // El resumen es un extra: si Steam falla, la vinculación sigue adelante
  // con los datos que ya hubiera. Nunca se rompe por un avatar.
  const resumen = await resumenJugador(steamId);

  await prisma.cuentaVinculada.upsert({
    where: { userId_proveedor: { userId, proveedor: 'steam' } },
    create: {
      userId,
      proveedor: 'steam',
      proveedorId: steamId,
      usuarioRemoto: resumen?.nombre ?? null,
      avatarRemoto: resumen?.avatar ?? null,
      // Vincular NO convierte el proveedor en método de acceso: son dos
      // cosas distintas (§5 de PROYECTO.md). Se asciende solo cuando
      // alguien entra de verdad por esta vía.
      esMetodoLogin: false,
      permisos: permisosPorDefecto('steam'),
    },
    update: {
      // Reconectar: se refrescan los datos y se limpia el aviso, sin tocar
      // los permisos que el usuario ya eligió ni degradar `esMetodoLogin`
      // si esta cuenta ya servía para entrar.
      proveedorId: steamId,
      usuarioRemoto: resumen?.nombre ?? null,
      avatarRemoto: resumen?.avatar ?? null,
      requiereReconexion: false,
    },
  });

  await auditar(userId, 'vinculacion', { proveedor: 'steam' }, req);
  logger.info({ userId, steamId }, 'Cuenta de Steam vinculada');
  volver(res, '/configuracion', 'vinculado', 'steam');
}
