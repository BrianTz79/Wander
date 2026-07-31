import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma';
import { errores } from '../middlewares/errores.middleware';
import { detectarIdioma, limpiarTexto } from '../services/texto.service';
import {
  hayBloqueo,
  idsBloqueados,
  notificar,
  registrarActividad,
  SELECT_AUTOR,
} from '../services/social.service';
import type { JuegoSteam } from '../services/steam.service';
import type {
  BuscarInput,
  CrearComentarioInput,
  CrearPublicacionInput,
  EditarPublicacionInput,
  PaginacionInput,
  ReaccionInput,
} from '../schemas/social.schema';

/**
 * Capa social (Fase 7): seguir, publicar, comentar, reaccionar, feed y
 * explorar.
 *
 * Tres reglas atraviesan el archivo entero:
 *
 *  1. **La autoría sale de la sesión, nunca del cuerpo.** No existe un
 *     `autorId` que mande el cliente, así que no existe la categoría de
 *     bug "publicaste en nombre de otro".
 *  2. **El bloqueo se comprueba en cada interacción**, no solo al crear la
 *     relación: alguien puede bloquearte después de que ya te siguiera.
 *  3. **Borrado suave.** `borradoEn` en vez de DELETE, para que un hilo de
 *     comentarios no se rompa cuando el autor borra la publicación.
 */

// ─────────────────────────────────────────────────────────────────────
//  Ayudantes
// ─────────────────────────────────────────────────────────────────────

/** Resuelve un handle público a su usuario, o 404. */
async function usuarioPorHandle(handle: string) {
  const usuario = await prisma.user.findUnique({
    where: { handle: handle.toLowerCase() },
    select: { ...SELECT_AUTOR, suspendido: true, suspendidoHasta: true, perfilPublico: true },
  });

  const suspendido =
    usuario?.suspendido && (!usuario.suspendidoHasta || usuario.suspendidoHasta > new Date());

  // Un suspendido responde 404 igual que uno inexistente: la suspensión es
  // información de moderación, no algo que se anuncie al público.
  if (!usuario || suspendido) throw errores.noEncontrado('Esa cuenta no existe.');

  return usuario;
}

/**
 * Convierte una lista paginada en la respuesta con cursor.
 *
 * Se pide siempre UN elemento de más que el límite: si vuelve, es que hay
 * página siguiente. Así se sabe sin un `count(*)` aparte, que en una tabla
 * grande es caro y además cambia entre una petición y la siguiente.
 */
function paginar<T extends { id: string }>(filas: T[], limite: number) {
  const hayMas = filas.length > limite;
  const items = hayMas ? filas.slice(0, limite) : filas;
  return {
    items,
    cursor: hayMas ? (items[items.length - 1]?.id ?? null) : null,
  };
}

/**
 * Cláusula de cursor: "lo que va después de este id".
 *
 * El tipo de retorno se anota a mano con las dos claves opcionales. Sin
 * eso, TypeScript infiere la unión de `{cursor, skip}` y `{}`, y al
 * esparcirla en la consulta se queja de que a la segunda rama le faltan
 * propiedades que la primera sí tiene. Con ambas opcionales, las dos ramas
 * encajan en la misma forma.
 */
function desdeCursor(cursor: string | undefined): { cursor?: { id: string }; skip?: number } {
  return cursor ? { cursor: { id: cursor }, skip: 1 } : {};
}

/**
 * Nombre del juego que se etiqueta en una publicación.
 *
 * El cliente manda solo el `appid`; el nombre se resuelve aquí contra la
 * caché de Steam del propio autor. Aceptar el nombre del cliente permitiría
 * publicar "Elden Ring" con un espacio raro o inventarse un juego, y el
 * filtro por juego del feed dejaría de agrupar nada.
 *
 * Devuelve `null` si no se encuentra: la publicación se guarda igual con su
 * appid, y quien la lea verá el número en vez del nombre. Es mejor que
 * rechazar la publicación por un dato decorativo.
 */
async function nombreDeJuego(userId: string, appid: number): Promise<string | null> {
  const cache = await prisma.cacheExterno.findFirst({
    where: { userId, proveedor: 'steam', clave: { in: ['juegos', 'recientes'] } },
    select: { datos: true, clave: true },
  });
  if (!cache) return null;

  const datos = cache.datos as unknown;
  const lista: JuegoSteam[] = Array.isArray(datos)
    ? (datos as JuegoSteam[])
    : ((datos as { masJugados?: JuegoSteam[] })?.masJugados ?? []);

  return lista.find((j) => j.appid === appid)?.nombre ?? null;
}

/**
 * Marca en cada publicación si el usuario que mira ya reaccionó, y con qué.
 *
 * Se hace en UNA consulta para toda la página en vez de una por
 * publicación: con 20 elementos por página, la versión ingenua son 20
 * consultas para pintar 20 corazones.
 */
async function marcarMisReacciones(publicacionIds: string[], userId: string | undefined) {
  if (!userId || publicacionIds.length === 0) return new Map<string, string[]>();

  const mias = await prisma.reaccion.findMany({
    where: { userId, publicacionId: { in: publicacionIds } },
    select: { publicacionId: true, tipo: true },
  });

  const mapa = new Map<string, string[]>();
  for (const r of mias) {
    if (!r.publicacionId) continue;
    mapa.set(r.publicacionId, [...(mapa.get(r.publicacionId) ?? []), r.tipo]);
  }
  return mapa;
}

/** Forma en que viaja una publicación al cliente. */
type PublicacionCruda = Prisma.PublicacionGetPayload<{
  include: { autor: { select: typeof SELECT_AUTOR }; _count: { select: { comentarios: true; reacciones: true } } };
}>;

function serializarPublicacion(p: PublicacionCruda, misReacciones: string[]) {
  return {
    id: p.id,
    texto: p.texto,
    idioma: p.idioma,
    juegoAppid: p.juegoAppid,
    juegoNombre: p.juegoNombre,
    createdAt: p.createdAt,
    editadoEn: p.editadoEn,
    autor: p.autor,
    comentarios: p._count.comentarios,
    reacciones: p._count.reacciones,
    misReacciones,
  };
}

const INCLUDE_PUBLICACION = {
  autor: { select: SELECT_AUTOR },
  _count: { select: { comentarios: true, reacciones: true } },
} as const;

// ═════════════════════════════════════════════════════════════════════
//  SEGUIR
// ═════════════════════════════════════════════════════════════════════

// ── POST /api/social/usuarios/:handle/seguir ─────────────────────────
export async function seguir(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { handle } = req.paramsValidados as { handle: string };

  const objetivo = await usuarioPorHandle(handle);

  if (objetivo.id === yo) throw errores.invalido('No puedes seguirte a ti mismo.');

  // El bloqueo corta en ambas direcciones: ni quien bloquea ni quien fue
  // bloqueado pueden establecer la relación.
  if (await hayBloqueo(yo, objetivo.id)) {
    throw errores.sinPermiso('No puedes seguir a esta cuenta.');
  }

  /*
   * `upsert` y no `create`: seguir dos veces es lo que pasa cuando alguien
   * pulsa el botón con doble clic o con la conexión lenta. La operación es
   * idempotente a propósito — el resultado correcto de "seguir a quien ya
   * sigues" es "lo sigues", no un 409.
   */
  const yaSeguia = await prisma.seguimiento.findUnique({
    where: { seguidorId_seguidoId: { seguidorId: yo, seguidoId: objetivo.id } },
    select: { createdAt: true },
  });

  if (!yaSeguia) {
    await prisma.seguimiento.create({ data: { seguidorId: yo, seguidoId: objetivo.id } });
    // Solo se avisa la PRIMERA vez. Si no, seguir/dejar de seguir en bucle
    // sería una forma de llenarle las notificaciones a alguien.
    await notificar({
      destinatarioId: objetivo.id,
      emisorId: yo,
      tipo: 'seguimiento',
      datos: { handle: req.usuario!.handle },
    });
    await registrarActividad(yo, 'siguio-a', { handle: objetivo.handle });
  }

  res.json({ siguiendo: true });
}

// ── DELETE /api/social/usuarios/:handle/seguir ───────────────────────
export async function dejarDeSeguir(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { handle } = req.paramsValidados as { handle: string };

  const objetivo = await usuarioPorHandle(handle);

  // `deleteMany` no falla si no había nada que borrar: dejar de seguir a
  // quien no sigues ya te deja en el estado que pediste.
  await prisma.seguimiento.deleteMany({
    where: { seguidorId: yo, seguidoId: objetivo.id },
  });

  res.json({ siguiendo: false });
}

// ── GET /api/social/usuarios/:handle/relacion ────────────────────────
/** Estado social entre quien mira y el handle: contadores y si lo sigue. */
export async function relacion(req: Request, res: Response): Promise<void> {
  const yo = req.usuario?.id;
  const { handle } = req.paramsValidados as { handle: string };

  const objetivo = await usuarioPorHandle(handle);

  const [seguidores, siguiendo, sigo, meSigue, bloqueado] = await Promise.all([
    prisma.seguimiento.count({ where: { seguidoId: objetivo.id } }),
    prisma.seguimiento.count({ where: { seguidorId: objetivo.id } }),
    yo
      ? prisma.seguimiento.count({ where: { seguidorId: yo, seguidoId: objetivo.id } })
      : Promise.resolve(0),
    yo
      ? prisma.seguimiento.count({ where: { seguidorId: objetivo.id, seguidoId: yo } })
      : Promise.resolve(0),
    yo
      ? prisma.bloqueo.count({ where: { bloqueadorId: yo, bloqueadoId: objetivo.id } })
      : Promise.resolve(0),
  ]);

  res.json({
    handle: objetivo.handle,
    seguidores,
    siguiendo,
    // `false` para el visitante anónimo: no hay relación que reportar.
    losigo: sigo > 0,
    meSigue: meSigue > 0,
    bloqueado: bloqueado > 0,
    esPropio: yo === objetivo.id,
  });
}

// ── GET /api/social/usuarios/:handle/seguidores | /siguiendo ─────────
async function listaDeSeguimiento(req: Request, res: Response, direccion: 'seguidores' | 'siguiendo') {
  const { handle } = req.paramsValidados as { handle: string };
  const { cursor, limite } = req.queryValidada as PaginacionInput;

  const objetivo = await usuarioPorHandle(handle);

  // Los seguidores de X son la gente que sigue a X (`seguidoId: X`);
  // "siguiendo" es al revés. Un solo helper con la dirección invertida
  // evita dos consultas casi idénticas que se desincronizan al tocarlas.
  const where =
    direccion === 'seguidores' ? { seguidoId: objetivo.id } : { seguidorId: objetivo.id };

  const filas = await prisma.seguimiento.findMany({
    where,
    include: {
      seguidor: { select: SELECT_AUTOR },
      seguido: { select: SELECT_AUTOR },
    },
    orderBy: { createdAt: 'desc' },
    take: limite + 1,
    ...(cursor
      ? {
          // La PK es compuesta, así que el cursor viaja como "seguidorId:seguidoId".
          cursor: {
            seguidorId_seguidoId: {
              seguidorId: cursor.split(':')[0] ?? '',
              seguidoId: cursor.split(':')[1] ?? '',
            },
          },
          skip: 1,
        }
      : {}),
  });

  const hayMas = filas.length > limite;
  const items = (hayMas ? filas.slice(0, limite) : filas).map((f) =>
    direccion === 'seguidores' ? f.seguidor : f.seguido
  );
  const ultima = hayMas ? filas[limite - 1] : undefined;

  res.json({
    items,
    cursor: ultima ? `${ultima.seguidorId}:${ultima.seguidoId}` : null,
  });
}

export const seguidoresDe = (req: Request, res: Response) =>
  listaDeSeguimiento(req, res, 'seguidores');
export const siguiendoDe = (req: Request, res: Response) =>
  listaDeSeguimiento(req, res, 'siguiendo');

// ═════════════════════════════════════════════════════════════════════
//  BLOQUEO
// ═════════════════════════════════════════════════════════════════════

// ── POST /api/social/usuarios/:handle/bloquear ───────────────────────
export async function bloquear(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { handle } = req.paramsValidados as { handle: string };

  const objetivo = await usuarioPorHandle(handle);
  if (objetivo.id === yo) throw errores.invalido('No puedes bloquearte a ti mismo.');

  /*
   * Bloquear ROMPE el seguimiento en ambos sentidos, en la misma
   * transacción. Si solo se creara el bloqueo, quien fue bloqueado
   * seguiría apareciendo como seguidor y seguiría viendo las
   * publicaciones en su feed — el bloqueo no habría hecho nada de lo que
   * la gente espera que haga.
   */
  await prisma.$transaction([
    prisma.bloqueo.upsert({
      where: { bloqueadorId_bloqueadoId: { bloqueadorId: yo, bloqueadoId: objetivo.id } },
      create: { bloqueadorId: yo, bloqueadoId: objetivo.id },
      update: {},
    }),
    prisma.seguimiento.deleteMany({
      where: {
        OR: [
          { seguidorId: yo, seguidoId: objetivo.id },
          { seguidorId: objetivo.id, seguidoId: yo },
        ],
      },
    }),
    // Las notificaciones que ya había de esa persona también se van: son
    // justo el contacto del que el usuario quiere dejar de saber.
    prisma.notificacion.deleteMany({ where: { destinatarioId: yo, emisorId: objetivo.id } }),
  ]);

  res.json({ bloqueado: true });
}

// ── DELETE /api/social/usuarios/:handle/bloquear ─────────────────────
export async function desbloquear(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { handle } = req.paramsValidados as { handle: string };

  const objetivo = await usuarioPorHandle(handle);

  // Desbloquear NO restaura el seguimiento que el bloqueo deshizo: si
  // alguien quiere volver a seguir, lo hace a propósito.
  await prisma.bloqueo.deleteMany({ where: { bloqueadorId: yo, bloqueadoId: objetivo.id } });

  res.json({ bloqueado: false });
}

// ═════════════════════════════════════════════════════════════════════
//  PUBLICACIONES
// ═════════════════════════════════════════════════════════════════════

// ── POST /api/social/publicaciones ───────────────────────────────────
export async function crearPublicacion(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { texto, juegoAppid } = req.body as CrearPublicacionInput;

  const limpio = limpiarTexto(texto);
  if (limpio.length === 0) throw errores.invalido('La publicación no puede estar vacía.');

  const publicacion = await prisma.publicacion.create({
    data: {
      autorId: yo,
      texto: limpio,
      // Detectado al escribir. Hoy no lo lee nadie —traducir está aplazado
      // (PROYECTO.md §8)—, pero es el único momento en que se puede saber.
      idioma: detectarIdioma(limpio),
      ...(juegoAppid !== undefined
        ? { juegoAppid, juegoNombre: await nombreDeJuego(yo, juegoAppid) }
        : {}),
    },
    include: INCLUDE_PUBLICACION,
  });

  await registrarActividad(yo, 'publicacion', { publicacionId: publicacion.id });

  res.status(201).json({ publicacion: serializarPublicacion(publicacion, []) });
}

// ── PATCH /api/social/publicaciones/:id ──────────────────────────────
export async function editarPublicacion(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { id } = req.paramsValidados as { id: string };
  const { texto } = req.body as EditarPublicacionInput;

  // El `autorId` en el where ES la comprobación de propiedad: editar la
  // publicación de otro no da 403, da 404 — ni siquiera se confirma que
  // exista.
  const existente = await prisma.publicacion.findFirst({
    where: { id, autorId: yo, borradoEn: null },
    select: { id: true },
  });
  if (!existente) throw errores.noEncontrado('Esa publicación no existe.');

  const limpio = limpiarTexto(texto);
  if (limpio.length === 0) throw errores.invalido('La publicación no puede estar vacía.');

  const publicacion = await prisma.publicacion.update({
    where: { id: existente.id },
    data: {
      texto: limpio,
      // El idioma se recalcula: el texto es otro, y el anterior podría ser
      // de otro idioma.
      idioma: detectarIdioma(limpio),
      editadoEn: new Date(),
    },
    include: INCLUDE_PUBLICACION,
  });

  const mias = await marcarMisReacciones([publicacion.id], yo);
  res.json({ publicacion: serializarPublicacion(publicacion, mias.get(publicacion.id) ?? []) });
}

// ── DELETE /api/social/publicaciones/:id ─────────────────────────────
export async function borrarPublicacion(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const esMod = req.usuario!.rol === 'ADMIN' || req.usuario!.rol === 'MOD';
  const { id } = req.paramsValidados as { id: string };

  const { count } = await prisma.publicacion.updateMany({
    // Un moderador puede borrar cualquiera; el resto, solo las suyas.
    where: { id, borradoEn: null, ...(esMod ? {} : { autorId: yo }) },
    data: { borradoEn: new Date() },
  });
  if (count === 0) throw errores.noEncontrado('Esa publicación no existe.');

  res.json({ ok: true });
}

// ── GET /api/social/publicaciones/:id ────────────────────────────────
export async function verPublicacion(req: Request, res: Response): Promise<void> {
  const yo = req.usuario?.id;
  const { id } = req.paramsValidados as { id: string };

  const publicacion = await prisma.publicacion.findFirst({
    where: { id, borradoEn: null },
    include: INCLUDE_PUBLICACION,
  });
  if (!publicacion) throw errores.noEncontrado('Esa publicación no existe.');

  // Una publicación de alguien con quien hay bloqueo no se muestra, aunque
  // se llegue por enlace directo.
  if (yo && (await hayBloqueo(yo, publicacion.autorId))) {
    throw errores.noEncontrado('Esa publicación no existe.');
  }

  const mias = await marcarMisReacciones([publicacion.id], yo);
  res.json({ publicacion: serializarPublicacion(publicacion, mias.get(publicacion.id) ?? []) });
}

// ── GET /api/social/usuarios/:handle/publicaciones ───────────────────
export async function publicacionesDe(req: Request, res: Response): Promise<void> {
  const yo = req.usuario?.id;
  const { handle } = req.paramsValidados as { handle: string };
  const { cursor, limite } = req.queryValidada as PaginacionInput;

  const objetivo = await usuarioPorHandle(handle);

  if (yo && (await hayBloqueo(yo, objetivo.id))) {
    // Mismo 404 que si no existiera: el muro de alguien con quien hay
    // bloqueo no se lee.
    throw errores.noEncontrado('Esa cuenta no existe.');
  }

  const filas = await prisma.publicacion.findMany({
    where: { autorId: objetivo.id, borradoEn: null },
    include: INCLUDE_PUBLICACION,
    orderBy: { createdAt: 'desc' },
    take: limite + 1,
    ...desdeCursor(cursor),
  });

  const { items, cursor: siguiente } = paginar(filas, limite);
  const mias = await marcarMisReacciones(
    items.map((p) => p.id),
    yo
  );

  res.json({
    items: items.map((p) => serializarPublicacion(p, mias.get(p.id) ?? [])),
    cursor: siguiente,
  });
}

// ═════════════════════════════════════════════════════════════════════
//  FEED
// ═════════════════════════════════════════════════════════════════════

// ── GET /api/social/feed ─────────────────────────────────────────────
/**
 * El feed de quien tiene sesión: publicaciones de la gente a la que sigue,
 * más las suyas.
 *
 * Las propias van incluidas a propósito. Un feed que no muestra lo que
 * acabas de publicar se siente roto: no tienes forma de comprobar que
 * salió bien.
 */
export async function feed(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { cursor, limite } = req.queryValidada as PaginacionInput;

  const [siguiendo, bloqueados] = await Promise.all([
    prisma.seguimiento.findMany({ where: { seguidorId: yo }, select: { seguidoId: true } }),
    idsBloqueados(yo),
  ]);

  const autores = [yo, ...siguiendo.map((s) => s.seguidoId)];
  const excluidos = new Set(bloqueados);
  const visibles = autores.filter((id) => !excluidos.has(id));

  const filas = await prisma.publicacion.findMany({
    where: { autorId: { in: visibles }, borradoEn: null },
    include: INCLUDE_PUBLICACION,
    orderBy: { createdAt: 'desc' },
    take: limite + 1,
    ...desdeCursor(cursor),
  });

  const { items, cursor: siguienteCursor } = paginar(filas, limite);
  const mias = await marcarMisReacciones(
    items.map((p) => p.id),
    yo
  );

  res.json({
    items: items.map((p) => serializarPublicacion(p, mias.get(p.id) ?? [])),
    cursor: siguienteCursor,
    // Con esto el cliente distingue "no sigues a nadie todavía" de "la
    // gente que sigues no ha publicado", que son dos vacíos distintos y
    // piden mensajes distintos.
    sigueAAlguien: siguiendo.length > 0,
  });
}

// ═════════════════════════════════════════════════════════════════════
//  COMENTARIOS
// ═════════════════════════════════════════════════════════════════════

// ── POST /api/social/publicaciones/:id/comentarios ───────────────────
export async function comentarPublicacion(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { id } = req.paramsValidados as { id: string };
  const { texto, respondeAId } = req.body as CrearComentarioInput;

  const publicacion = await prisma.publicacion.findFirst({
    where: { id, borradoEn: null },
    select: { id: true, autorId: true },
  });
  if (!publicacion) throw errores.noEncontrado('Esa publicación no existe.');

  if (await hayBloqueo(yo, publicacion.autorId)) {
    throw errores.sinPermiso('No puedes comentar en esta publicación.');
  }

  const limpio = limpiarTexto(texto);
  if (limpio.length === 0) throw errores.invalido('El comentario no puede estar vacío.');

  // Solo un nivel de anidación (§4): responder a una respuesta cuelga del
  // comentario raíz, no del que se respondió. Sin esto, los hilos crecen en
  // profundidad indefinida y no hay forma sensata de pintarlos.
  let raizId: string | undefined;
  if (respondeAId) {
    const padre = await prisma.comentario.findFirst({
      where: { id: respondeAId, publicacionId: publicacion.id, borradoEn: null },
      select: { id: true, respondeAId: true },
    });
    if (!padre) throw errores.invalido('Ese comentario no existe en esta publicación.');
    raizId = padre.respondeAId ?? padre.id;
  }

  const comentario = await prisma.comentario.create({
    data: {
      texto: limpio,
      idioma: detectarIdioma(limpio),
      autorId: yo,
      publicacionId: publicacion.id,
      ...(raizId ? { respondeAId: raizId } : {}),
    },
    include: { autor: { select: SELECT_AUTOR } },
  });

  await notificar({
    destinatarioId: publicacion.autorId,
    emisorId: yo,
    tipo: 'comentario',
    datos: { publicacionId: publicacion.id, extracto: limpio.slice(0, 80) },
  });

  res.status(201).json({ comentario });
}

// ── GET /api/social/publicaciones/:id/comentarios ────────────────────
export async function comentariosDe(req: Request, res: Response): Promise<void> {
  const yo = req.usuario?.id;
  const { id } = req.paramsValidados as { id: string };
  const { cursor, limite } = req.queryValidada as PaginacionInput;

  const publicacion = await prisma.publicacion.findFirst({
    where: { id, borradoEn: null },
    select: { id: true, autorId: true },
  });
  if (!publicacion) throw errores.noEncontrado('Esa publicación no existe.');

  const bloqueados = yo ? await idsBloqueados(yo) : [];

  const filas = await prisma.comentario.findMany({
    where: {
      publicacionId: publicacion.id,
      borradoEn: null,
      // Los comentarios de gente bloqueada no se ven, ni siquiera dentro de
      // una publicación de un tercero.
      ...(bloqueados.length > 0 ? { autorId: { notIn: bloqueados } } : {}),
    },
    include: { autor: { select: SELECT_AUTOR } },
    // Ascendente: una conversación se lee en el orden en que ocurrió.
    orderBy: { createdAt: 'asc' },
    take: limite + 1,
    ...desdeCursor(cursor),
  });

  const { items, cursor: siguiente } = paginar(filas, limite);
  res.json({ items, cursor: siguiente });
}

// ── POST /api/social/usuarios/:handle/comentarios ────────────────────
/** Comentario en el muro de un perfil (no en una publicación). */
export async function comentarPerfil(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { handle } = req.paramsValidados as { handle: string };
  const { texto } = req.body as CrearComentarioInput;

  const objetivo = await usuarioPorHandle(handle);

  if (await hayBloqueo(yo, objetivo.id)) {
    throw errores.sinPermiso('No puedes comentar en este perfil.');
  }

  const limpio = limpiarTexto(texto);
  if (limpio.length === 0) throw errores.invalido('El comentario no puede estar vacío.');

  const comentario = await prisma.comentario.create({
    data: {
      texto: limpio,
      idioma: detectarIdioma(limpio),
      autorId: yo,
      perfilUserId: objetivo.id,
    },
    include: { autor: { select: SELECT_AUTOR } },
  });

  await notificar({
    destinatarioId: objetivo.id,
    emisorId: yo,
    tipo: 'comentario',
    datos: { handle: objetivo.handle, extracto: limpio.slice(0, 80) },
  });

  res.status(201).json({ comentario });
}

// ── GET /api/social/usuarios/:handle/comentarios ─────────────────────
export async function comentariosDePerfil(req: Request, res: Response): Promise<void> {
  const yo = req.usuario?.id;
  const { handle } = req.paramsValidados as { handle: string };
  const { cursor, limite } = req.queryValidada as PaginacionInput;

  const objetivo = await usuarioPorHandle(handle);
  const bloqueados = yo ? await idsBloqueados(yo) : [];

  const filas = await prisma.comentario.findMany({
    where: {
      perfilUserId: objetivo.id,
      borradoEn: null,
      ...(bloqueados.length > 0 ? { autorId: { notIn: bloqueados } } : {}),
    },
    include: { autor: { select: SELECT_AUTOR } },
    orderBy: { createdAt: 'desc' },
    take: limite + 1,
    ...desdeCursor(cursor),
  });

  const { items, cursor: siguiente } = paginar(filas, limite);
  res.json({ items, cursor: siguiente });
}

// ── DELETE /api/social/comentarios/:id ───────────────────────────────
export async function borrarComentario(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const esMod = req.usuario!.rol === 'ADMIN' || req.usuario!.rol === 'MOD';
  const { id } = req.paramsValidados as { id: string };

  /*
   * Quién puede borrar un comentario:
   *  - su autor,
   *  - el dueño del perfil donde está (es su muro),
   *  - el autor de la publicación donde está (es su hilo),
   *  - un moderador.
   */
  const comentario = await prisma.comentario.findFirst({
    where: { id, borradoEn: null },
    select: {
      id: true,
      autorId: true,
      perfilUserId: true,
      publicacion: { select: { autorId: true } },
    },
  });
  if (!comentario) throw errores.noEncontrado('Ese comentario no existe.');

  const puede =
    esMod ||
    comentario.autorId === yo ||
    comentario.perfilUserId === yo ||
    comentario.publicacion?.autorId === yo;

  if (!puede) throw errores.noEncontrado('Ese comentario no existe.');

  await prisma.comentario.update({
    where: { id: comentario.id },
    data: { borradoEn: new Date() },
  });

  res.json({ ok: true });
}

// ═════════════════════════════════════════════════════════════════════
//  REACCIONES
// ═════════════════════════════════════════════════════════════════════

// ── PUT /api/social/publicaciones/:id/reaccion ───────────────────────
/**
 * Alterna la reacción: si ya estaba, la quita; si no, la pone.
 *
 * Un solo endpoint que alterna, en vez de POST/DELETE separados, porque es
 * exactamente lo que hace el botón: pulsar dos veces vuelve al inicio. Con
 * dos endpoints, el cliente tendría que saber el estado actual para elegir
 * cuál llamar, y se equivocaría cada vez que dos pestañas se
 * desincronizaran.
 */
export async function reaccionar(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { id } = req.paramsValidados as { id: string };
  const { tipo } = req.body as ReaccionInput;

  const publicacion = await prisma.publicacion.findFirst({
    where: { id, borradoEn: null },
    select: { id: true, autorId: true },
  });
  if (!publicacion) throw errores.noEncontrado('Esa publicación no existe.');

  if (await hayBloqueo(yo, publicacion.autorId)) {
    throw errores.sinPermiso('No puedes reaccionar a esta publicación.');
  }

  const existente = await prisma.reaccion.findFirst({
    where: { userId: yo, publicacionId: publicacion.id, tipo },
    select: { id: true },
  });

  if (existente) {
    await prisma.reaccion.delete({ where: { id: existente.id } });
  } else {
    await prisma.reaccion.create({
      data: { userId: yo, publicacionId: publicacion.id, tipo },
    });
    await notificar({
      destinatarioId: publicacion.autorId,
      emisorId: yo,
      tipo: 'reaccion',
      datos: { publicacionId: publicacion.id, reaccion: tipo },
    });
  }

  const [total, mias] = await Promise.all([
    prisma.reaccion.count({ where: { publicacionId: publicacion.id } }),
    prisma.reaccion.findMany({
      where: { userId: yo, publicacionId: publicacion.id },
      select: { tipo: true },
    }),
  ]);

  res.json({
    reaccionado: !existente,
    reacciones: total,
    misReacciones: mias.map((m) => m.tipo),
  });
}

// ═════════════════════════════════════════════════════════════════════
//  EXPLORAR
// ═════════════════════════════════════════════════════════════════════

// ── GET /api/social/explorar ─────────────────────────────────────────
/**
 * Descubrimiento: gente y publicaciones.
 *
 * Sin `q` devuelve perfiles publicados ordenados por vistas — el "qué hay
 * aquí" para quien acaba de llegar. Con `q` busca por handle y por nombre.
 */
export async function explorar(req: Request, res: Response): Promise<void> {
  const yo = req.usuario?.id;
  const { q, juegoAppid, cursor, limite } = req.queryValidada as BuscarInput;

  const bloqueados = yo ? await idsBloqueados(yo) : [];

  /*
   * Quién puede salir en explorar. Las tres condiciones son de privacidad,
   * no de presentación:
   *  - `mostrarEnBusqueda`: el opt-out explícito del usuario.
   *  - `perfilPublico` + `perfil.publicado`: un perfil sin publicar no se
   *    lista aunque exista.
   *  - sin suspender, y sin bloqueo con quien mira.
   */
  const whereUsuarios: Prisma.UserWhereInput = {
    mostrarEnBusqueda: true,
    perfilPublico: true,
    suspendido: false,
    perfil: { is: { publicado: true } },
    ...(bloqueados.length > 0 ? { id: { notIn: bloqueados } } : {}),
    ...(q
      ? {
          OR: [
            { handle: { contains: q, mode: 'insensitive' } },
            { displayName: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const usuarios = await prisma.user.findMany({
    where: whereUsuarios,
    select: {
      ...SELECT_AUTOR,
      bio: true,
      perfil: { select: { vistas: true } },
      _count: { select: { seguidores: true } },
    },
    // Sin búsqueda, los más vistos primero: es el escaparate. Con
    // búsqueda, también por vistas — con dos idiomas y sin ranking de
    // relevancia, "el perfil más visto que coincide" es el orden más útil
    // y, sobre todo, es estable para el cursor.
    orderBy: [{ perfil: { vistas: 'desc' } }, { id: 'asc' }],
    take: limite + 1,
    ...desdeCursor(cursor),
  });

  const paginados = paginar(usuarios, limite);

  /*
   * Publicaciones: solo cuando hay filtro (texto o juego). Sin filtro, un
   * "todas las publicaciones de la plataforma" sería una portada pública
   * de contenido sin curar, que es justo donde el spam aparece primero.
   */
  let publicaciones: ReturnType<typeof serializarPublicacion>[] = [];
  if (q || juegoAppid !== undefined) {
    const filas = await prisma.publicacion.findMany({
      where: {
        borradoEn: null,
        ...(bloqueados.length > 0 ? { autorId: { notIn: bloqueados } } : {}),
        ...(juegoAppid !== undefined ? { juegoAppid } : {}),
        ...(q ? { texto: { contains: q, mode: 'insensitive' as const } } : {}),
        // Solo de cuentas visibles: quien se sale de la búsqueda tampoco
        // aparece aquí.
        autor: { mostrarEnBusqueda: true, perfilPublico: true, suspendido: false },
      },
      include: INCLUDE_PUBLICACION,
      orderBy: { createdAt: 'desc' },
      take: limite,
    });

    const mias = await marcarMisReacciones(
      filas.map((p) => p.id),
      yo
    );
    publicaciones = filas.map((p) => serializarPublicacion(p, mias.get(p.id) ?? []));
  }

  res.json({
    usuarios: paginados.items.map((u) => ({
      id: u.id,
      handle: u.handle,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      bio: u.bio,
      vistas: u.perfil?.vistas ?? 0,
      seguidores: u._count.seguidores,
    })),
    cursor: paginados.cursor,
    publicaciones,
  });
}

// ═════════════════════════════════════════════════════════════════════
//  NOTIFICACIONES
// ═════════════════════════════════════════════════════════════════════

// ── GET /api/social/notificaciones ───────────────────────────────────
export async function notificaciones(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { cursor, limite } = req.queryValidada as PaginacionInput;

  const filas = await prisma.notificacion.findMany({
    where: { destinatarioId: yo },
    include: { emisor: { select: SELECT_AUTOR } },
    orderBy: { createdAt: 'desc' },
    take: limite + 1,
    ...desdeCursor(cursor),
  });

  const { items, cursor: siguiente } = paginar(filas, limite);
  const sinLeer = await prisma.notificacion.count({
    where: { destinatarioId: yo, leidaEn: null },
  });

  res.json({ items, cursor: siguiente, sinLeer });
}

// ── POST /api/social/notificaciones/leidas ───────────────────────────
export async function marcarLeidas(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;

  const { count } = await prisma.notificacion.updateMany({
    where: { destinatarioId: yo, leidaEn: null },
    data: { leidaEn: new Date() },
  });

  res.json({ marcadas: count });
}
