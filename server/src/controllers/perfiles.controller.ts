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
import { buscarPlantilla, PLANTILLA_PERSONALIZADA } from '../schemas/plantillas';
import { ErrorCss, sanitizarCss } from '../services/sanitizar.service';

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
  // Al dueño se le devuelve el CSS que ESCRIBIÓ (`cssOriginal`), no el
  // sanitizado: si el editor le mostrara la versión procesada, cada
  // guardado le reescribiría el archivo bajo los dedos y perdería sus
  // comentarios y su formato. El sanitizado va aparte, para la vista
  // previa, y es lo único que ve el público.
  cssPropio: true,
  cssOriginal: true,
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
  const { tema, plantilla, publicado, displayName, bio, cssPropio } =
    req.body as ActualizarPerfilInput;

  // Asegura que el perfil exista antes del update.
  const perfilActual = await perfilDe(userId);

  /*
   * Tema y plantilla escriben el mismo campo, así que el orden importa:
   *
   * - `plantilla` gana. El tema que se guarda es el DEL CATÁLOGO, no uno
   *   que mande el cliente: elegir "retro-crt" no puede ser la puerta para
   *   colar colores arbitrarios bajo un nombre conocido.
   * - un `tema` suelto es una edición a mano → el perfil deja de ser una
   *   plantilla y pasa a `personalizada`.
   */
  const preset = plantilla !== undefined ? buscarPlantilla(plantilla) : undefined;
  if (plantilla !== undefined && !preset) {
    throw errores.invalido('Esa plantilla no existe.');
  }

  const cambioDeTema = preset
    ? { tema: preset.tema, plantilla: preset.id }
    : tema !== undefined
      ? { tema, plantilla: PLANTILLA_PERSONALIZADA }
      : {};

  /*
   * CSS propio (Fase 9). Se guardan DOS versiones:
   *
   *  - `cssPropio`: el sanitizado. Es el único que se sirve al público.
   *  - `cssOriginal`: lo que la persona escribió, para que pueda seguir
   *    editándolo. NUNCA se envía a nadie más que a su dueño.
   *
   * Un `null` (o una cadena vacía) borra los dos: es el botón de
   * restaurar. Los avisos de lo que se quitó viajan en la respuesta para
   * poder decírselo — un sanitizador mudo deja a la persona mirando un CSS
   * que no hace nada sin saber por qué.
   */
  let cambioDeCss: { cssPropio?: string | null; cssOriginal?: string | null } = {};
  let avisosCss: string[] = [];

  if (cssPropio !== undefined) {
    if (cssPropio === null || !cssPropio.trim()) {
      cambioDeCss = { cssPropio: null, cssOriginal: null };
    } else {
      try {
        const resultado = sanitizarCss(cssPropio, perfilActual.id);
        cambioDeCss = { cssPropio: resultado.css || null, cssOriginal: cssPropio };
        avisosCss = resultado.avisos;
      } catch (error) {
        if (error instanceof ErrorCss) throw errores.invalido(error.message);
        throw error;
      }
    }
  }

  const [perfil, usuario] = await prisma.$transaction([
    prisma.perfil.update({
      where: { userId },
      data: {
        ...cambioDeTema,
        ...cambioDeCss,
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

  res.json({ perfil, usuario, ...(avisosCss.length > 0 ? { avisosCss } : {}) });
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
          // El id va porque el CSS del usuario está prefijado con
          // `#perfil-<id>`: sin él, el cliente no puede poner ese id en el
          // contenedor y ninguna regla casaría.
          id: true,
          plantilla: true,
          tema: true,
          publicado: true,
          vistas: true,
          // Solo el SANITIZADO. `cssOriginal` no sale de aquí ni para el
          // dueño: para editarlo ya está GET /perfiles/mio.
          cssPropio: true,
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
      id: usuario.perfil.id,
      plantilla: usuario.perfil.plantilla,
      tema: usuario.perfil.tema,
      publicado: usuario.perfil.publicado,
      vistas: usuario.perfil.vistas,
      cssPropio: usuario.perfil.cssPropio,
    },
    bloques: usuario.perfil.bloques,
    esPropio,
  });
}
