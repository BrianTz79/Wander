import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { errores } from '../middlewares/errores.middleware';
import {
  MAX_BLOQUES,
  SCHEMAS_BLOQUE,
  type ActualizarBloqueInput,
  type ActualizarPerfilInput,
  type CrearBloqueInput,
  type ReordenarBloquesInput,
  type TipoBloque,
} from '../schemas/perfil.schema';

/**
 * Perfiles y bloques (Fase 3).
 *
 * Modelo de autorización: TODAS las escrituras parten de "el perfil del
 * usuario autenticado" (lookup por userId), nunca de un perfilId que venga
 * del cliente. Así no existe la categoría de bug "editaste el bloque de
 * otro porque adivinaste su id".
 */

const SELECT_BLOQUE = {
  id: true,
  tipo: true,
  orden: true,
  visible: true,
  config: true,
} as const;

const SELECT_PERFIL_PROPIO = {
  id: true,
  plantilla: true,
  tema: true,
  publicado: true,
  vistas: true,
  bloques: { select: SELECT_BLOQUE, orderBy: { orden: 'asc' as const } },
} as const;

/** Perfil del usuario autenticado; lo crea si no existe (cinturón y
 *  tirantes: el registro ya lo crea, pero un login OAuth futuro podría
 *  llegar aquí sin él). */
async function perfilDe(userId: string) {
  const existente = await prisma.perfil.findUnique({
    where: { userId },
    select: SELECT_PERFIL_PROPIO,
  });
  if (existente) return existente;

  return prisma.perfil.create({
    data: {
      userId,
      bloques: { create: [{ tipo: 'hero', orden: 0, config: {} }] },
    },
    select: SELECT_PERFIL_PROPIO,
  });
}

/** Valida el `config` de un bloque con el schema de su tipo. */
function validarConfig(tipo: TipoBloque, config: unknown): object {
  const resultado = SCHEMAS_BLOQUE[tipo].safeParse(config ?? {});
  if (!resultado.success) {
    throw errores.invalido(
      'La configuración del bloque no es válida.',
      resultado.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message }))
    );
  }
  return resultado.data;
}

// ─────────────────────────────────────────────────────────────────────
//  GET /api/perfiles/mio
// ─────────────────────────────────────────────────────────────────────
export async function miPerfil(req: Request, res: Response): Promise<void> {
  const userId = req.usuario!.id;

  const [perfil, usuario] = await Promise.all([
    perfilDe(userId),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        handle: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        bannerUrl: true,
      },
    }),
  ]);

  res.json({ perfil, usuario });
}

// ─────────────────────────────────────────────────────────────────────
//  PATCH /api/perfiles/mio
// ─────────────────────────────────────────────────────────────────────
export async function actualizarPerfil(req: Request, res: Response): Promise<void> {
  const userId = req.usuario!.id;
  const { tema, publicado, displayName, bio } = req.body as ActualizarPerfilInput;

  // Asegura que el perfil exista antes del update.
  await perfilDe(userId);

  const [perfil, usuario] = await prisma.$transaction([
    prisma.perfil.update({
      where: { userId },
      data: {
        ...(tema !== undefined ? { tema } : {}),
        ...(publicado !== undefined ? { publicado } : {}),
      },
      select: SELECT_PERFIL_PROPIO,
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        ...(displayName !== undefined ? { displayName } : {}),
        ...(bio !== undefined ? { bio } : {}),
      },
      select: {
        handle: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        bannerUrl: true,
      },
    }),
  ]);

  res.json({ perfil, usuario });
}

// ─────────────────────────────────────────────────────────────────────
//  POST /api/perfiles/mio/bloques
// ─────────────────────────────────────────────────────────────────────
export async function crearBloque(req: Request, res: Response): Promise<void> {
  const userId = req.usuario!.id;
  const { tipo, config } = req.body as CrearBloqueInput;

  const perfil = await perfilDe(userId);

  if (perfil.bloques.length >= MAX_BLOQUES) {
    throw errores.invalido(`Un perfil no puede tener más de ${MAX_BLOQUES} bloques.`);
  }

  const configValidada = validarConfig(tipo, config);
  const ordenSiguiente =
    perfil.bloques.length === 0 ? 0 : Math.max(...perfil.bloques.map((b) => b.orden)) + 1;

  const bloque = await prisma.bloque.create({
    data: { perfilId: perfil.id, tipo, orden: ordenSiguiente, config: configValidada },
    select: SELECT_BLOQUE,
  });

  res.status(201).json({ bloque });
}

// ─────────────────────────────────────────────────────────────────────
//  PATCH /api/perfiles/mio/bloques/:id
// ─────────────────────────────────────────────────────────────────────
export async function actualizarBloque(req: Request, res: Response): Promise<void> {
  const userId = req.usuario!.id;
  const { id } = req.params as { id: string };
  const { config, visible } = req.body as ActualizarBloqueInput;

  // El where anidado por perfil→userId es la comprobación de propiedad.
  const existente = await prisma.bloque.findFirst({
    where: { id, perfil: { userId } },
    select: { id: true, tipo: true },
  });
  if (!existente) throw errores.noEncontrado('Ese bloque no existe.');

  const bloque = await prisma.bloque.update({
    where: { id: existente.id },
    data: {
      ...(config !== undefined
        ? { config: validarConfig(existente.tipo as TipoBloque, config) }
        : {}),
      ...(visible !== undefined ? { visible } : {}),
    },
    select: SELECT_BLOQUE,
  });

  res.json({ bloque });
}

// ─────────────────────────────────────────────────────────────────────
//  DELETE /api/perfiles/mio/bloques/:id
// ─────────────────────────────────────────────────────────────────────
export async function borrarBloque(req: Request, res: Response): Promise<void> {
  const userId = req.usuario!.id;
  const { id } = req.params as { id: string };

  const { count } = await prisma.bloque.deleteMany({
    where: { id, perfil: { userId } },
  });
  if (count === 0) throw errores.noEncontrado('Ese bloque no existe.');

  res.json({ ok: true });
}

// ─────────────────────────────────────────────────────────────────────
//  PUT /api/perfiles/mio/bloques/orden
// ─────────────────────────────────────────────────────────────────────
export async function reordenarBloques(req: Request, res: Response): Promise<void> {
  const userId = req.usuario!.id;
  const { orden } = req.body as ReordenarBloquesInput;

  const perfil = await perfilDe(userId);

  // La lista tiene que ser EXACTAMENTE los bloques del perfil: ni ids
  // ajenos, ni repetidos, ni de menos. Cualquier discrepancia = 400.
  const idsActuales = new Set(perfil.bloques.map((b) => b.id));
  const idsRecibidos = new Set(orden);
  if (idsActuales.size !== idsRecibidos.size || ![...idsActuales].every((i) => idsRecibidos.has(i))) {
    throw errores.invalido('La lista de orden no coincide con los bloques del perfil.');
  }

  await prisma.$transaction(
    orden.map((bloqueId, indice) =>
      prisma.bloque.update({ where: { id: bloqueId }, data: { orden: indice } })
    )
  );

  const bloques = await prisma.bloque.findMany({
    where: { perfilId: perfil.id },
    select: SELECT_BLOQUE,
    orderBy: { orden: 'asc' },
  });

  res.json({ bloques });
}

// ─────────────────────────────────────────────────────────────────────
//  GET /api/perfiles/:handle  (público)
// ─────────────────────────────────────────────────────────────────────
export async function perfilPublico(req: Request, res: Response): Promise<void> {
  const { handle } = (req.paramsValidados ?? req.params) as { handle: string };

  const usuario = await prisma.user.findUnique({
    where: { handle: handle.toLowerCase() },
    select: {
      id: true,
      handle: true,
      displayName: true,
      avatarUrl: true,
      bannerUrl: true,
      bio: true,
      ubicacion: true,
      mostrarUbicacion: true,
      perfilPublico: true,
      suspendido: true,
      suspendidoHasta: true,
      createdAt: true,
      perfil: {
        select: {
          plantilla: true,
          tema: true,
          publicado: true,
          vistas: true,
          bloques: {
            where: { visible: true },
            select: SELECT_BLOQUE,
            orderBy: { orden: 'asc' },
          },
        },
      },
    },
  });

  const esPropio = Boolean(req.usuario && usuario && req.usuario.id === usuario.id);

  // Un solo 404 para todos los casos de "no visible" (no existe, oculto,
  // sin publicar, suspendido). Diferenciarlos revelaría qué handles
  // existen con perfil privado.
  const suspendidoActivo =
    usuario?.suspendido && (!usuario.suspendidoHasta || usuario.suspendidoHasta > new Date());
  const visible =
    usuario?.perfil && usuario.perfilPublico && usuario.perfil.publicado && !suspendidoActivo;

  if (!usuario || !usuario.perfil || (!visible && !esPropio)) {
    throw errores.noEncontrado('Ese perfil no existe.');
  }

  // Contador de vistas: solo visitas ajenas, y sin bloquear la respuesta.
  if (!esPropio && visible) {
    prisma.perfil
      .update({ where: { userId: usuario.id }, data: { vistas: { increment: 1 } } })
      .catch((error) => logger.warn({ error }, 'No se pudo incrementar vistas'));
  }

  res.json({
    usuario: {
      handle: usuario.handle,
      displayName: usuario.displayName,
      avatarUrl: usuario.avatarUrl,
      bannerUrl: usuario.bannerUrl,
      bio: usuario.bio,
      ubicacion: usuario.mostrarUbicacion ? usuario.ubicacion : null,
      miembroDesde: usuario.createdAt,
    },
    perfil: {
      plantilla: usuario.perfil.plantilla,
      tema: usuario.perfil.tema,
      publicado: usuario.perfil.publicado,
      vistas: usuario.perfil.vistas,
    },
    bloques: usuario.perfil.bloques,
    esPropio,
  });
}
