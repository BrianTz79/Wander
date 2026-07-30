import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { errores } from '../middlewares/errores.middleware';
import { borrarCache } from '../services/cache.service';
import { auditar } from './oauth.controller';
import { proveedorConfigurado, esProveedor, nombreProveedor } from '../services/oauth.service';
import {
  DESCRIPCION_VINCULACION,
  PERMISOS_POR_PROVEEDOR,
  PROVEEDORES_VINCULABLES,
  fusionarPermisos,
  normalizarPermisos,
  type PermisosInput,
  type ProveedorVinculable,
} from '../schemas/cuentas.schema';

/**
 * Gestión de cuentas vinculadas desde /configuracion (Fase 6).
 *
 * Todo aquí opera SIEMPRE sobre `req.usuario.id`. No hay ningún endpoint
 * que acepte un userId del cliente: es lo que hace imposible tocar las
 * vinculaciones de otra persona, sin depender de acordarse de comprobarlo
 * en cada método.
 *
 * Los tokens OAuth **nunca** se serializan. Ninguna de estas respuestas
 * incluye `accessTokenCif` ni `refreshTokenCif`: los `select` son
 * explícitos justo para que añadir un campo a la tabla no lo publique por
 * accidente.
 */

// ─────────────────────────────────────────────────────────────────────
//  GET /api/cuentas
// ─────────────────────────────────────────────────────────────────────
export async function listar(req: Request, res: Response): Promise<void> {
  const userId = req.usuario!.id;

  const [cuentas, usuario] = await Promise.all([
    prisma.cuentaVinculada.findMany({
      where: { userId },
      // Lista blanca de campos: los tokens cifrados no están, y no pueden
      // colarse aunque alguien añada columnas más adelante.
      select: {
        proveedor: true,
        usuarioRemoto: true,
        avatarRemoto: true,
        esMetodoLogin: true,
        permisos: true,
        sincronizadoEn: true,
        requiereReconexion: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, passwordHash: true },
    }),
  ]);

  const vinculadas = new Map(cuentas.map((c) => [c.proveedor, c]));

  /*
   * Se devuelve el catálogo COMPLETO, no solo lo vinculado: la pantalla
   * necesita pintar también los proveedores disponibles y decir cuáles
   * están apagados por falta de credenciales. Si el cliente tuviera esa
   * lista hardcodeada, activar un proveedor exigiría desplegar el frontend.
   */
  const catalogo = PROVEEDORES_VINCULABLES.map((proveedor) => {
    const cuenta = vinculadas.get(proveedor);
    return {
      proveedor,
      // Steam no pasa por oauth.service (es OpenID 2.0): su disponibilidad
      // la marca la API key.
      disponible: proveedor === 'steam' ? true : proveedorConfigurado(proveedor),
      vinculada: Boolean(cuenta),
      usuarioRemoto: cuenta?.usuarioRemoto ?? null,
      avatarRemoto: cuenta?.avatarRemoto ?? null,
      esMetodoLogin: cuenta?.esMetodoLogin ?? false,
      requiereReconexion: cuenta?.requiereReconexion ?? false,
      sincronizadoEn: cuenta?.sincronizadoEn ?? null,
      vinculadaEn: cuenta?.createdAt ?? null,
      permisos: cuenta ? normalizarPermisos(proveedor, cuenta.permisos) : null,
      // El catálogo de switches y el texto de "qué se lee" viajan juntos:
      // una sola fuente para la pantalla previa y para /privacidad.
      permisosDisponibles: PERMISOS_POR_PROVEEDOR[proveedor],
      descripcion: DESCRIPCION_VINCULACION[proveedor],
    };
  });

  res.json({
    cuentas: catalogo,
    // La UI necesita saber si desvincular dejaría al usuario sin entrada.
    tienePassword: Boolean(usuario?.passwordHash),
    tieneEmail: Boolean(usuario?.email),
  });
}

// ─────────────────────────────────────────────────────────────────────
//  PATCH /api/cuentas/:proveedor/permisos
// ─────────────────────────────────────────────────────────────────────
export async function actualizarPermisos(req: Request, res: Response): Promise<void> {
  const userId = req.usuario!.id;
  const { proveedor } = req.paramsValidados as { proveedor: ProveedorVinculable };
  const { permisos } = req.body as PermisosInput;

  const cuenta = await prisma.cuentaVinculada.findUnique({
    where: { userId_proveedor: { userId, proveedor } },
    select: { permisos: true },
  });

  if (!cuenta) throw errores.noEncontrado('No tienes esa cuenta vinculada.');

  // Las claves que no existen en el catálogo del proveedor se descartan:
  // `permisos` es JSON libre en la DB, así que sin este filtro se podría
  // guardar cualquier cosa dentro de la columna.
  const fusionados = fusionarPermisos(proveedor, cuenta.permisos, permisos);

  await prisma.cuentaVinculada.update({
    where: { userId_proveedor: { userId, proveedor } },
    data: { permisos: fusionados },
  });

  logger.info({ userId, proveedor }, 'Permisos de cuenta vinculada actualizados');
  res.json({ proveedor, permisos: fusionados });
}

// ─────────────────────────────────────────────────────────────────────
//  DELETE /api/cuentas/:proveedor
// ─────────────────────────────────────────────────────────────────────
/**
 * Desvincular. Dos cosas que tienen que pasar de verdad:
 *
 *  1. **No dejar al usuario fuera de su propia cuenta.** Si el proveedor
 *     que se quita es el único método de acceso y no hay contraseña, se
 *     rechaza con una explicación. Es la regla 3 de §5.
 *
 *  2. **Borrar de verdad.** Se borra la fila Y su `CacheExterno`, en una
 *     transacción. `borrarCache` existe desde la Fase 5 exactamente para
 *     esto: si la caché sobreviviera, "desvinculé Steam" seguiría pintando
 *     los juegos en el perfil, que es justo lo contrario de lo prometido.
 */
export async function desvincular(req: Request, res: Response): Promise<void> {
  const userId = req.usuario!.id;
  const { proveedor } = req.paramsValidados as { proveedor: ProveedorVinculable };

  const [cuenta, usuario, metodosLogin] = await Promise.all([
    prisma.cuentaVinculada.findUnique({
      where: { userId_proveedor: { userId, proveedor } },
      select: { esMetodoLogin: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } }),
    prisma.cuentaVinculada.count({ where: { userId, esMetodoLogin: true } }),
  ]);

  if (!cuenta) throw errores.noEncontrado('No tienes esa cuenta vinculada.');

  const tienePassword = Boolean(usuario?.passwordHash);
  const esUltimaEntrada = cuenta.esMetodoLogin && metodosLogin <= 1 && !tienePassword;

  if (esUltimaEntrada) {
    throw errores.invalido(
      `${nombreProveedor2(proveedor)} es tu única forma de entrar a Wander. ` +
        'Ponle una contraseña a tu cuenta o vincula otro proveedor antes de quitarlo.'
    );
  }

  /*
   * Fila y caché se borran juntas. Si se borrara la fila y fallara la
   * caché, quedarían datos de un proveedor ya desvinculado sin nada que
   * los relacione con él — huérfanos que ningún flujo volvería a limpiar.
   */
  await prisma.$transaction([
    prisma.cuentaVinculada.delete({ where: { userId_proveedor: { userId, proveedor } } }),
    prisma.cacheExterno.deleteMany({ where: { userId, proveedor } }),
  ]);

  await auditar(userId, 'desvinculacion', { proveedor }, req);
  logger.info({ userId, proveedor }, 'Cuenta desvinculada y caché borrada');

  res.json({ desvinculada: true, proveedor });
}

/** Nombre presentable, también para Steam (que no está en oauth.service). */
function nombreProveedor2(proveedor: ProveedorVinculable): string {
  if (proveedor === 'steam') return 'Steam';
  return esProveedor(proveedor) ? nombreProveedor(proveedor) : proveedor;
}

// ─────────────────────────────────────────────────────────────────────
//  GET /api/cuentas/privacidad
// ─────────────────────────────────────────────────────────────────────
/**
 * Qué lee y qué guarda cada proveedor, en lenguaje llano. Es público a
 * propósito: /privacidad debe poder leerse ANTES de registrarse, que es
 * justo cuando alguien decide si le da sus datos a este sitio.
 */
export function descripcionPrivacidad(_req: Request, res: Response): void {
  res.json({
    proveedores: PROVEEDORES_VINCULABLES.map((proveedor) => ({
      proveedor,
      nombre: nombreProveedor2(proveedor),
      disponible: proveedor === 'steam' ? true : proveedorConfigurado(proveedor),
      descripcion: DESCRIPCION_VINCULACION[proveedor],
      permisos: PERMISOS_POR_PROVEEDOR[proveedor],
    })),
  });
}
