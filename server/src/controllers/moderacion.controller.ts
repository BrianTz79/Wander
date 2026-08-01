import type { Request, Response } from 'express';

import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { errores } from '../middlewares/errores.middleware';
import { auditar } from './oauth.controller';
import type {
  CambiarRolInput,
  CrearReporteInput,
  LevantarSuspensionInput,
  ListarReportesInput,
  OcultarInput,
  ResolverReporteInput,
  SuspenderInput,
} from '../schemas/moderacion.schema';

/**
 * Moderación (Fase 10): reportar, revisar y actuar.
 *
 * Tres reglas atraviesan el archivo:
 *
 *  1. **Todo lo que hace un moderador queda en `AuditLog`.** Suspender una
 *     cuenta u ocultar una publicación son acciones de poder sobre otra
 *     persona; sin registro no hay forma de auditar un abuso, y quien
 *     modera también tiene que rendir cuentas.
 *  2. **Nadie modera hacia arriba ni hacia sí mismo.** Un MOD no puede
 *     tocar a un ADMIN ni a otro MOD, y nadie puede suspenderse solo. Sin
 *     esto, un moderador con la cuenta comprometida puede echar al resto
 *     del equipo antes de que nadie reaccione.
 *  3. **Ocultar reutiliza `borradoEn`**, el mismo campo del borrado del
 *     autor, para que no existan dos caminos de invisibilidad que cada
 *     consulta tenga que recordar filtrar por separado.
 */

// ─────────────────────────────────────────────────────────────────────
//  Ayudantes
// ─────────────────────────────────────────────────────────────────────

/** Jerarquía de roles. Solo se puede actuar sobre alguien estrictamente
 *  por debajo. */
const PESO_ROL: Record<string, number> = { USER: 0, MOD: 1, ADMIN: 2 };

/**
 * Resuelve el objetivo de una acción y comprueba que quien la ejecuta
 * puede ejercerla sobre él.
 *
 * Devuelve 404 y no 403 cuando el objetivo es de rango igual o mayor: que
 * un endpoint responda distinto para "no existe" y "es admin" convierte la
 * moderación en un directorio de quién tiene permisos.
 */
async function objetivoModerable(handle: string, actor: { id: string; rol: string }) {
  const objetivo = await prisma.user.findUnique({
    where: { handle: handle.toLowerCase() },
    select: { id: true, handle: true, displayName: true, rol: true, suspendido: true },
  });

  if (!objetivo) throw errores.noEncontrado('Esa cuenta no existe.');

  if (objetivo.id === actor.id) {
    throw errores.invalido('No puedes aplicarte una acción de moderación a ti mismo.');
  }

  if ((PESO_ROL[objetivo.rol] ?? 0) >= (PESO_ROL[actor.rol] ?? 0)) {
    throw errores.noEncontrado('Esa cuenta no existe.');
  }

  return objetivo;
}

/**
 * ¿Existe el objeto que se está reportando?
 *
 * Comprobarlo evita una cola llena de reportes contra ids inventados, que
 * es la forma más barata de inutilizar la moderación: si revisar cada
 * entrada cuesta un minuto y crearla cuesta una petición, la cola se
 * ahoga sola.
 */
async function objetoExiste(tipo: string, id: string): Promise<boolean> {
  switch (tipo) {
    case 'usuario':
    case 'perfil':
      return (await prisma.user.count({ where: { id } })) > 0;
    case 'publicacion':
      return (await prisma.publicacion.count({ where: { id } })) > 0;
    case 'comentario':
      return (await prisma.comentario.count({ where: { id } })) > 0;
    case 'mensaje':
      return (await prisma.mensaje.count({ where: { id } })) > 0;
    default:
      return false;
  }
}

// ─────────────────────────────────────────────────────────────────────
//  POST /api/moderacion/reportes  (cualquier usuario con sesión)
// ─────────────────────────────────────────────────────────────────────

export async function crearReporte(req: Request, res: Response): Promise<void> {
  const actor = req.usuario!;
  const datos = req.body as CrearReporteInput;

  /*
   * Reportar a una persona se hace por HANDLE, no por id.
   *
   * El perfil público no expone el id del usuario a nadie —y no tiene por
   * qué—, así que exigirlo dejaría el botón de reportar de un perfil sin
   * forma de nombrar a quién reporta. El handle sí es público y es lo que
   * el visitante tiene delante. Se resuelve aquí para que la fila de
   * `Reporte` siga guardando el id, que es lo estable: alguien puede
   * cambiarse el handle entre el reporte y su revisión.
   */
  if (datos.tipoObjeto === 'usuario' || datos.tipoObjeto === 'perfil') {
    // Se prueba por handle SIEMPRE y se cae al id si no hay coincidencia,
    // en vez de adivinar cuál de los dos es por su forma: los handles y
    // los cuid comparten alfabeto, así que cualquier heurística de
    // "empieza por c" fallaría con un handle legítimo como `cactus`.
    const porHandle = await prisma.user.findUnique({
      where: { handle: datos.objetoId.toLowerCase() },
      select: { id: true },
    });
    if (porHandle) datos.objetoId = porHandle.id;
  }

  if (!(await objetoExiste(datos.tipoObjeto, datos.objetoId))) {
    throw errores.noEncontrado('Eso que quieres reportar ya no existe.');
  }

  // Reportarse a uno mismo no es un ataque, pero tampoco es un reporte:
  // se corta aquí para no gastarle tiempo a nadie revisándolo.
  if (
    (datos.tipoObjeto === 'usuario' || datos.tipoObjeto === 'perfil') &&
    datos.objetoId === actor.id
  ) {
    throw errores.invalido('No puedes reportarte a ti mismo.');
  }

  /*
   * Un reporte por persona y objeto mientras siga pendiente.
   *
   * Sin esto, quien quiera hundir a otro puede mandar el mismo reporte
   * cien veces y la cola pasa a estar ordenada por quién insiste más, no
   * por qué es más grave. Se responde 200 igualmente para no revelar que
   * ya había uno — eso diría si alguien más reportó lo mismo.
   */
  const yaReportado = await prisma.reporte.findFirst({
    where: {
      reportadorId: actor.id,
      tipoObjeto: datos.tipoObjeto,
      objetoId: datos.objetoId,
      estado: 'PENDIENTE',
    },
    select: { id: true },
  });

  if (!yaReportado) {
    await prisma.reporte.create({
      data: {
        reportadorId: actor.id,
        tipoObjeto: datos.tipoObjeto,
        objetoId: datos.objetoId,
        motivo: datos.motivo,
        detalle: datos.detalle ?? null,
      },
    });

    logger.info(
      { tipoObjeto: datos.tipoObjeto, motivo: datos.motivo },
      'Reporte nuevo en la cola de moderación'
    );
  }

  res.status(201).json({ ok: true });
}

// ─────────────────────────────────────────────────────────────────────
//  GET /api/moderacion/reportes  (MOD/ADMIN)
// ─────────────────────────────────────────────────────────────────────

export async function listarReportes(req: Request, res: Response): Promise<void> {
  const { estado, cursor, limite } = req.queryValidada as ListarReportesInput;

  const filas = await prisma.reporte.findMany({
    where: { estado },
    orderBy: { createdAt: 'desc' },
    take: limite + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hayMas = filas.length > limite;
  const pagina = hayMas ? filas.slice(0, limite) : filas;

  /*
   * El contenido reportado se resuelve aquí y no se le pide al moderador
   * que lo vaya a buscar: sin ver el texto, revisar es adivinar.
   *
   * Lo que se enseña está acotado a propósito. De un `mensaje` solo sale
   * el texto y su autor, nunca el resto de la conversación: el reporte
   * autoriza a mirar LO REPORTADO, no a leer el buzón de dos personas.
   */
  const contextos = await Promise.all(
    pagina.map(async (r) => {
      try {
        switch (r.tipoObjeto) {
          case 'usuario':
          case 'perfil': {
            const u = await prisma.user.findUnique({
              where: { id: r.objetoId },
              select: { handle: true, displayName: true, bio: true, suspendido: true },
            });
            return u
              ? { tipo: r.tipoObjeto, handle: u.handle, autor: u.displayName, texto: u.bio ?? '', suspendido: u.suspendido }
              : null;
          }
          case 'publicacion': {
            const p = await prisma.publicacion.findUnique({
              where: { id: r.objetoId },
              select: {
                texto: true,
                borradoEn: true,
                autor: { select: { handle: true, displayName: true } },
              },
            });
            return p
              ? {
                  tipo: 'publicacion',
                  handle: p.autor.handle,
                  autor: p.autor.displayName,
                  texto: p.texto.slice(0, 500),
                  oculto: p.borradoEn !== null,
                }
              : null;
          }
          case 'comentario': {
            const c = await prisma.comentario.findUnique({
              where: { id: r.objetoId },
              select: {
                texto: true,
                borradoEn: true,
                autor: { select: { handle: true, displayName: true } },
              },
            });
            return c
              ? {
                  tipo: 'comentario',
                  handle: c.autor.handle,
                  autor: c.autor.displayName,
                  texto: c.texto.slice(0, 500),
                  oculto: c.borradoEn !== null,
                }
              : null;
          }
          case 'mensaje': {
            const m = await prisma.mensaje.findUnique({
              where: { id: r.objetoId },
              select: {
                texto: true,
                borradoEn: true,
                autor: { select: { handle: true, displayName: true } },
              },
            });
            return m
              ? {
                  tipo: 'mensaje',
                  handle: m.autor.handle,
                  autor: m.autor.displayName,
                  texto: (m.texto ?? '').slice(0, 500),
                  oculto: m.borradoEn !== null,
                }
              : null;
          }
          default:
            return null;
        }
      } catch (error) {
        logger.warn({ error, reporteId: r.id }, 'No se pudo resolver el contexto de un reporte');
        return null;
      }
    })
  );

  res.json({
    reportes: pagina.map((r, i) => ({
      id: r.id,
      tipoObjeto: r.tipoObjeto,
      objetoId: r.objetoId,
      motivo: r.motivo,
      detalle: r.detalle,
      estado: r.estado,
      createdAt: r.createdAt,
      resolucion: r.resolucion,
      // `null` = el objeto ya no existe (lo borró su autor). El reporte se
      // sigue enseñando para poder cerrarlo.
      contexto: contextos[i] ?? null,
    })),
    siguiente: hayMas ? (pagina[pagina.length - 1]?.id ?? null) : null,
  });
}

// ─────────────────────────────────────────────────────────────────────
//  GET /api/moderacion/resumen  (MOD/ADMIN)
// ─────────────────────────────────────────────────────────────────────

/** Cifras de la cabecera del panel. Una consulta agregada en vez de traer
 *  las filas: el panel solo necesita los números. */
export async function resumen(_req: Request, res: Response): Promise<void> {
  const [pendientes, revisados, descartados, suspendidos, usuarios] = await Promise.all([
    prisma.reporte.count({ where: { estado: 'PENDIENTE' } }),
    prisma.reporte.count({ where: { estado: 'REVISADO' } }),
    prisma.reporte.count({ where: { estado: 'DESCARTADO' } }),
    prisma.user.count({ where: { suspendido: true } }),
    prisma.user.count(),
  ]);

  res.json({ pendientes, revisados, descartados, suspendidos, usuarios });
}

// ─────────────────────────────────────────────────────────────────────
//  PATCH /api/moderacion/reportes/:id  (MOD/ADMIN)
// ─────────────────────────────────────────────────────────────────────

export async function resolverReporte(req: Request, res: Response): Promise<void> {
  const actor = req.usuario!;
  const { id } = req.params as { id: string };
  const datos = req.body as ResolverReporteInput;

  const reporte = await prisma.reporte.findUnique({ where: { id } });
  if (!reporte) throw errores.noEncontrado('Ese reporte no existe.');
  if (reporte.estado !== 'PENDIENTE') {
    throw errores.conflicto('Ese reporte ya está resuelto.');
  }

  // La acción va ANTES de cerrar el reporte: si ocultar falla, el reporte
  // sigue pendiente y alguien lo verá otra vez. Al revés quedaría cerrado
  // sin que se hubiera hecho nada.
  if (datos.accion === 'ocultar') {
    await ocultarObjeto(reporte.tipoObjeto, reporte.objetoId, actor, {
      motivo: datos.resolucion ?? `Reporte ${reporte.motivo}`,
      reporteId: reporte.id,
    });
  } else if (datos.accion === 'suspender') {
    const autorId = await autorDelObjeto(reporte.tipoObjeto, reporte.objetoId);
    if (!autorId) throw errores.noEncontrado('Ya no existe la cuenta responsable de eso.');

    const objetivo = await prisma.user.findUnique({
      where: { id: autorId },
      select: { handle: true },
    });
    if (!objetivo) throw errores.noEncontrado('Ya no existe la cuenta responsable de eso.');

    await aplicarSuspension(objetivo.handle, actor, {
      dias: datos.dias,
      motivo: datos.resolucion ?? `Reporte ${reporte.motivo}`,
      reporteId: reporte.id,
      req,
    });
  }

  await prisma.reporte.update({
    where: { id },
    data: {
      estado: datos.estado,
      revisadoPor: actor.id,
      revisadoEn: new Date(),
      resolucion: datos.resolucion ?? null,
    },
  });

  await auditar(
    actor.id,
    'reporte-resuelto',
    {
      reporteId: id,
      estado: datos.estado,
      accion: datos.accion,
      tipoObjeto: reporte.tipoObjeto,
      objetoId: reporte.objetoId,
    },
    req
  );

  res.json({ ok: true });
}

// ─────────────────────────────────────────────────────────────────────
//  Acciones
// ─────────────────────────────────────────────────────────────────────

/** Quién escribió el objeto reportado. Necesario para poder suspender
 *  desde la resolución de un reporte sin pedir el handle otra vez. */
async function autorDelObjeto(tipo: string, id: string): Promise<string | null> {
  switch (tipo) {
    case 'usuario':
    case 'perfil':
      return id;
    case 'publicacion':
      return (
        await prisma.publicacion.findUnique({ where: { id }, select: { autorId: true } })
      )?.autorId ?? null;
    case 'comentario':
      return (
        await prisma.comentario.findUnique({ where: { id }, select: { autorId: true } })
      )?.autorId ?? null;
    case 'mensaje':
      return (
        await prisma.mensaje.findUnique({ where: { id }, select: { autorId: true } })
      )?.autorId ?? null;
    default:
      return null;
  }
}

/** Oculta publicación o comentario marcando `borradoEn`. Los otros tipos
 *  no se ocultan: a un usuario se le suspende, no se le "oculta". */
async function ocultarObjeto(
  tipo: string,
  id: string,
  actor: { id: string; rol: string },
  meta: { motivo: string; reporteId?: string }
): Promise<void> {
  const ahora = new Date();

  if (tipo === 'publicacion') {
    const existe = await prisma.publicacion.count({ where: { id } });
    if (!existe) throw errores.noEncontrado('Esa publicación ya no existe.');
    await prisma.publicacion.update({ where: { id }, data: { borradoEn: ahora } });
  } else if (tipo === 'comentario') {
    const existe = await prisma.comentario.count({ where: { id } });
    if (!existe) throw errores.noEncontrado('Ese comentario ya no existe.');
    await prisma.comentario.update({ where: { id }, data: { borradoEn: ahora } });
  } else {
    throw errores.invalido('Ese tipo de contenido no se puede ocultar.');
  }

  logger.info({ tipo, id, moderadorId: actor.id, ...meta }, 'Contenido ocultado por moderación');
}

/** Aplica la suspensión y la audita. Compartida por la resolución de
 *  reportes y por el endpoint directo. */
async function aplicarSuspension(
  handle: string,
  actor: { id: string; rol: string },
  opciones: { dias?: number; motivo: string; reporteId?: string; req: Request }
): Promise<{ handle: string; hasta: Date | null }> {
  const objetivo = await objetivoModerable(handle, actor);

  const hasta = opciones.dias
    ? new Date(Date.now() + opciones.dias * 24 * 60 * 60 * 1000)
    : null;

  await prisma.user.update({
    where: { id: objetivo.id },
    data: { suspendido: true, suspendidoHasta: hasta },
  });

  /*
   * Se le cierran TODAS las sesiones.
   *
   * Sin esto la suspensión no empieza hasta que a la persona le caduque el
   * token de acceso: mientras tanto sigue publicando y escribiendo con la
   * sesión que ya tenía abierta, que es justo lo que se quería frenar.
   */
  await prisma.sesion.deleteMany({ where: { userId: objetivo.id } });

  await auditar(
    actor.id,
    'suspension',
    {
      objetivoId: objetivo.id,
      objetivoHandle: objetivo.handle,
      hasta: hasta?.toISOString() ?? 'permanente',
      motivo: opciones.motivo,
      ...(opciones.reporteId ? { reporteId: opciones.reporteId } : {}),
    },
    opciones.req
  );

  logger.warn(
    { objetivoHandle: objetivo.handle, moderadorId: actor.id, hasta },
    'Cuenta suspendida'
  );

  return { handle: objetivo.handle, hasta };
}

// ─────────────────────────────────────────────────────────────────────
//  POST /api/moderacion/suspender  (MOD/ADMIN)
// ─────────────────────────────────────────────────────────────────────

export async function suspender(req: Request, res: Response): Promise<void> {
  const actor = req.usuario!;
  const datos = req.body as SuspenderInput;

  const resultado = await aplicarSuspension(datos.handle, actor, {
    dias: datos.dias,
    motivo: datos.motivo,
    req,
  });

  res.json({ ok: true, ...resultado });
}

// ─────────────────────────────────────────────────────────────────────
//  POST /api/moderacion/levantar  (MOD/ADMIN)
// ─────────────────────────────────────────────────────────────────────

export async function levantarSuspension(req: Request, res: Response): Promise<void> {
  const actor = req.usuario!;
  const { handle } = req.body as LevantarSuspensionInput;

  const objetivo = await objetivoModerable(handle, actor);

  await prisma.user.update({
    where: { id: objetivo.id },
    data: { suspendido: false, suspendidoHasta: null },
  });

  await auditar(
    actor.id,
    'suspension-levantada',
    { objetivoId: objetivo.id, objetivoHandle: objetivo.handle },
    req
  );

  res.json({ ok: true });
}

// ─────────────────────────────────────────────────────────────────────
//  POST /api/moderacion/ocultar  (MOD/ADMIN)
// ─────────────────────────────────────────────────────────────────────

export async function ocultar(req: Request, res: Response): Promise<void> {
  const actor = req.usuario!;
  const datos = req.body as OcultarInput;

  await ocultarObjeto(datos.tipo, datos.id, actor, {
    motivo: datos.motivo ?? 'Sin motivo registrado',
  });

  await auditar(
    actor.id,
    'contenido-oculto',
    { tipo: datos.tipo, objetoId: datos.id, motivo: datos.motivo ?? null },
    req
  );

  res.json({ ok: true });
}

// ─────────────────────────────────────────────────────────────────────
//  POST /api/moderacion/rol  (solo ADMIN)
// ─────────────────────────────────────────────────────────────────────

export async function cambiarRol(req: Request, res: Response): Promise<void> {
  const actor = req.usuario!;
  const datos = req.body as CambiarRolInput;

  const objetivo = await prisma.user.findUnique({
    where: { handle: datos.handle },
    select: { id: true, handle: true, rol: true },
  });
  if (!objetivo) throw errores.noEncontrado('Esa cuenta no existe.');

  // Nadie se cambia el rol a sí mismo: el último ADMIN degradándose deja
  // la instancia sin nadie que pueda volver a subir a otro.
  if (objetivo.id === actor.id) {
    throw errores.invalido('No puedes cambiarte el rol a ti mismo.');
  }

  if (objetivo.rol === datos.rol) {
    res.json({ ok: true, rol: objetivo.rol });
    return;
  }

  // Quitarle ADMIN al último que queda deja la plataforma sin quien
  // administre, y recuperarlo exige entrar a la base de datos a mano.
  if (objetivo.rol === 'ADMIN' && datos.rol !== 'ADMIN') {
    const admins = await prisma.user.count({ where: { rol: 'ADMIN' } });
    if (admins <= 1) {
      throw errores.conflicto('No puedes quitar el último administrador.');
    }
  }

  await prisma.user.update({ where: { id: objetivo.id }, data: { rol: datos.rol } });

  await auditar(
    actor.id,
    'cambio-rol',
    { objetivoId: objetivo.id, objetivoHandle: objetivo.handle, de: objetivo.rol, a: datos.rol },
    req
  );

  logger.warn(
    { objetivoHandle: objetivo.handle, de: objetivo.rol, a: datos.rol, actorId: actor.id },
    'Rol cambiado'
  );

  res.json({ ok: true, rol: datos.rol });
}
