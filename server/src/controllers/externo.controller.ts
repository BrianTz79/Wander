import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { errores } from '../middlewares/errores.middleware';
import { datosSteamDe } from '../services/steam.service';
import { datosDiscordDe } from '../services/lanyard.service';
import { normalizarPermisos } from '../schemas/cuentas.schema';

/**
 * Datos de proveedores externos para pintar los bloques (Fase 5).
 *
 * Van en su propio endpoint, y no dentro de `GET /api/perfiles/:handle`,
 * por una razón concreta: el perfil debe responder rápido y desde la DB
 * propia. Steam se pide aparte, así el perfil se pinta enseguida y los
 * bloques de Steam rellenan cuando llegan. Si Steam tarda 8 segundos, el
 * perfil ya está en pantalla.
 */

/** Cuenta vinculada de un proveedor, con sus permisos. `null` si no la
 *  tiene. Los permisos se normalizan aquí para que un vínculo antiguo (sin
 *  una clave añadida después) no dé `undefined` al consultarlo. */
async function cuentaDe(
  userId: string,
  proveedor: string
): Promise<{ proveedorId: string; permisos: Record<string, boolean> } | null> {
  const cuenta = await prisma.cuentaVinculada.findUnique({
    where: { userId_proveedor: { userId, proveedor } },
    select: { proveedorId: true, permisos: true },
  });
  if (!cuenta) return null;
  return {
    proveedorId: cuenta.proveedorId,
    permisos: normalizarPermisos(proveedor as never, cuenta.permisos),
  };
}

/**
 * Resuelve un handle aplicando la MISMA regla de visibilidad que el perfil
 * público, con el mismo 404 indistinguible.
 *
 * Está factorizado porque ahora hay dos endpoints externos (Steam y
 * Discord) y la regla tiene que ser literalmente la misma en ambos: si uno
 * fuera más permisivo, sería la vía para averiguar qué handles existen con
 * el perfil oculto — justo lo que el 404 único del perfil evita.
 */
async function usuarioVisible(req: Request, handle: string): Promise<{ id: string }> {
  const usuario = await prisma.user.findUnique({
    where: { handle: handle.toLowerCase() },
    select: {
      id: true,
      perfilPublico: true,
      suspendido: true,
      suspendidoHasta: true,
      perfil: { select: { publicado: true } },
    },
  });

  const esPropio = Boolean(req.usuario && usuario && req.usuario.id === usuario.id);

  const suspendidoActivo =
    usuario?.suspendido && (!usuario.suspendidoHasta || usuario.suspendidoHasta > new Date());
  const visible =
    usuario?.perfil && usuario.perfilPublico && usuario.perfil.publicado && !suspendidoActivo;

  if (!usuario || !usuario.perfil || (!visible && !esPropio)) {
    throw errores.noEncontrado('Ese perfil no existe.');
  }

  return { id: usuario.id };
}

// ─────────────────────────────────────────────────────────────────────
//  GET /api/externo/steam/:handle   (público)
// ─────────────────────────────────────────────────────────────────────
export async function steamDeHandle(req: Request, res: Response): Promise<void> {
  const { handle } = (req.paramsValidados ?? req.params) as { handle: string };

  const usuario = await usuarioVisible(req, handle);

  const cuenta = await cuentaDe(usuario.id, 'steam');
  if (!cuenta) {
    // No es un error: este usuario simplemente no tiene Steam vinculado.
    // El cliente lo trata como "sin datos" y no pinta los bloques.
    res.json({ vinculado: false, datos: null });
    return;
  }

  const datos = await datosSteamDe(usuario.id, cuenta.proveedorId);

  /*
   * El consentimiento se aplica AQUÍ, al servir, y no solo al pintar en el
   * cliente. Si el filtro viviera en React, el dato seguiría viajando en la
   * respuesta HTTP y cualquiera podría leerlo con las herramientas de
   * desarrollo — un switch de privacidad que no quita el dato de la red no
   * es un switch de privacidad.
   */
  res.json({ vinculado: true, datos: aplicarPermisosSteam(datos, cuenta.permisos) });
}

/** Recorta los datos de Steam según lo que el usuario haya consentido. */
function aplicarPermisosSteam(
  datos: Awaited<ReturnType<typeof datosSteamDe>>,
  permisos: Record<string, boolean>
): Awaited<ReturnType<typeof datosSteamDe>> {
  return {
    ...datos,
    // El resumen se conserva (avatar y nombre), pero el estado en línea se
    // neutraliza si no está consentido: es el único campo sensible ahí.
    resumen:
      datos.resumen && !permisos['mostrarEstado']
        ? { ...datos.resumen, estado: 0 }
        : datos.resumen,
    recientes: permisos['mostrarActividad'] ? datos.recientes : [],
    estadisticas: permisos['mostrarJuegos'] ? datos.estadisticas : null,
    masJugados: permisos['mostrarJuegos'] ? datos.masJugados : [],
  };
}

// ─────────────────────────────────────────────────────────────────────
//  GET /api/externo/discord/:handle   (público)
// ─────────────────────────────────────────────────────────────────────
/**
 * Presencia de Discord en vivo (Fase 6), vía Lanyard.
 *
 * Mismo contrato que el de Steam: misma regla de visibilidad, mismo 404
 * indistinguible, y la respuesta se recorta según el consentimiento antes
 * de salir del servidor.
 */
export async function discordDeHandle(req: Request, res: Response): Promise<void> {
  const { handle } = (req.paramsValidados ?? req.params) as { handle: string };

  const usuario = await usuarioVisible(req, handle);

  const cuenta = await cuentaDe(usuario.id, 'discord');
  if (!cuenta) {
    res.json({ vinculado: false, datos: null });
    return;
  }

  // Sin consentimiento de presencia no se llama siquiera a Lanyard: no
  // tiene sentido gastar una petición para tirar el resultado después.
  const quierePresencia = cuenta.permisos['mostrarPresencia'] === true;
  const quiereSpotify = cuenta.permisos['mostrarSpotify'] === true;

  if (!quierePresencia && !quiereSpotify) {
    res.json({ vinculado: true, datos: null });
    return;
  }

  const datos = await datosDiscordDe(usuario.id, cuenta.proveedorId);

  const presencia = datos.presencia
    ? {
        ...datos.presencia,
        estado: quierePresencia ? datos.presencia.estado : 'offline',
        actividades: quierePresencia ? datos.presencia.actividades : [],
        spotify: quiereSpotify ? datos.presencia.spotify : null,
      }
    : null;

  res.json({ vinculado: true, datos: { ...datos, presencia } });
}

// ─────────────────────────────────────────────────────────────────────
//  POST /api/externo/steam/sincronizar   (requiere sesión)
// ─────────────────────────────────────────────────────────────────────
/**
 * "Sincronizar ahora" desde el editor: salta el TTL y repide a Steam.
 *
 * Solo actúa sobre la propia cuenta (sale de `req.usuario`, no de un id
 * del cliente) y lleva `limiteExterno` en la ruta: sin ese límite, un
 * botón que dispara cuatro llamadas a Steam es un amplificador para gastar
 * nuestra cuota de API con un bucle de clics.
 */
export async function sincronizarSteam(req: Request, res: Response): Promise<void> {
  const userId = req.usuario!.id;

  const cuenta = await cuentaDe(userId, 'steam');
  if (!cuenta) {
    throw errores.invalido('No tienes una cuenta de Steam vinculada.');
  }

  const datos = await datosSteamDe(userId, cuenta.proveedorId, { forzar: true });

  await prisma.cuentaVinculada
    .update({
      where: { userId_proveedor: { userId, proveedor: 'steam' } },
      data: { sincronizadoEn: new Date() },
    })
    .catch(() => undefined);

  res.json({ vinculado: true, datos });
}
