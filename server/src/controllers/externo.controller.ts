import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { errores } from '../middlewares/errores.middleware';
import { datosSteamDe } from '../services/steam.service';

/**
 * Datos de proveedores externos para pintar los bloques (Fase 5).
 *
 * Van en su propio endpoint, y no dentro de `GET /api/perfiles/:handle`,
 * por una razón concreta: el perfil debe responder rápido y desde la DB
 * propia. Steam se pide aparte, así el perfil se pinta enseguida y los
 * bloques de Steam rellenan cuando llegan. Si Steam tarda 8 segundos, el
 * perfil ya está en pantalla.
 */

/** Steam vinculado de un usuario, o `null`. */
async function steamIdDe(userId: string): Promise<string | null> {
  const cuenta = await prisma.cuentaVinculada.findUnique({
    where: { userId_proveedor: { userId, proveedor: 'steam' } },
    select: { proveedorId: true },
  });
  return cuenta?.proveedorId ?? null;
}

// ─────────────────────────────────────────────────────────────────────
//  GET /api/externo/steam/:handle   (público)
// ─────────────────────────────────────────────────────────────────────
export async function steamDeHandle(req: Request, res: Response): Promise<void> {
  const { handle } = (req.paramsValidados ?? req.params) as { handle: string };

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

  /*
   * MISMA regla de visibilidad que `perfilPublico`, y con el mismo 404
   * indistinguible. Si este endpoint fuera más permisivo, sería la vía
   * para saber si un handle existe (y con qué SteamID) aunque su perfil
   * esté oculto — justo lo que el 404 único del perfil evita.
   */
  const suspendidoActivo =
    usuario?.suspendido && (!usuario.suspendidoHasta || usuario.suspendidoHasta > new Date());
  const visible =
    usuario?.perfil && usuario.perfilPublico && usuario.perfil.publicado && !suspendidoActivo;

  if (!usuario || !usuario.perfil || (!visible && !esPropio)) {
    throw errores.noEncontrado('Ese perfil no existe.');
  }

  const steamId = await steamIdDe(usuario.id);
  if (!steamId) {
    // No es un error: este usuario simplemente no tiene Steam vinculado.
    // El cliente lo trata como "sin datos" y no pinta los bloques.
    res.json({ vinculado: false, datos: null });
    return;
  }

  const datos = await datosSteamDe(usuario.id, steamId);
  res.json({ vinculado: true, datos });
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

  const steamId = await steamIdDe(userId);
  if (!steamId) {
    throw errores.invalido('No tienes una cuenta de Steam vinculada.');
  }

  const datos = await datosSteamDe(userId, steamId, { forzar: true });

  await prisma.cuentaVinculada
    .update({
      where: { userId_proveedor: { userId, proveedor: 'steam' } },
      data: { sincronizadoEn: new Date() },
    })
    .catch(() => undefined);

  res.json({ vinculado: true, datos });
}
