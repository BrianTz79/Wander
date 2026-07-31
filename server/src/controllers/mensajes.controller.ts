import type { Request, Response } from 'express';

import { prisma } from '../config/prisma';
import { errores } from '../middlewares/errores.middleware';
import { detectarIdioma, limpiarTexto } from '../services/texto.service';
import { hayBloqueo, idsBloqueados, notificar, SELECT_AUTOR } from '../services/social.service';
import { atarArchivos, SELECT_ADJUNTO, validarAdjuntos } from '../services/archivos.service';
import {
  buscarDm,
  exigirAdmin,
  exigirParticipante,
  exigirPuedeEscribir,
  limpiarBorrado,
  puedeIniciarDm,
  SELECT_MENSAJE,
  vistaPrevia,
} from '../services/mensajes.service';
import { emitirAConversacion, emitirAUsuario } from '../sockets/chat';
import { MAX_PARTICIPANTES } from '../schemas/mensajes.schema';
import type {
  AbrirDmInput,
  AnadirParticipantesInput,
  BandejaInput,
  CrearGrupoInput,
  EditarGrupoInput,
  EditarMensajeInput,
  EnviarMensajeInput,
  MarcarLeidoInput,
  PaginaMensajesInput,
  SilenciarInput,
} from '../schemas/mensajes.schema';

/**
 * Mensajería (Fase 8): DMs, grupos y adjuntos.
 *
 * **Persistencia primero, socket después.** Cada endpoint que escribe
 * guarda en Postgres y solo entonces emite por socket. Si el socket está
 * caído el mensaje no se pierde — al reconectar se pide el historial por
 * REST, que es la fuente de verdad. El socket solo acelera; el chat
 * funciona entero con websockets bloqueados.
 *
 * Y como en la Fase 7: la autoría sale de la sesión, el bloqueo se
 * comprueba en cada interacción, y el borrado es suave.
 */

// ─────────────────────────────────────────────────────────────────────
//  Ayudantes
// ─────────────────────────────────────────────────────────────────────

async function usuarioPorHandle(handle: string) {
  const usuario = await prisma.user.findUnique({
    where: { handle: handle.toLowerCase() },
    select: { ...SELECT_AUTOR, suspendido: true, suspendidoHasta: true },
  });

  const suspendido =
    usuario?.suspendido && (!usuario.suspendidoHasta || usuario.suspendidoHasta > new Date());

  if (!usuario || suspendido) throw errores.noEncontrado('Esa cuenta no existe.');

  return usuario;
}

/**
 * Pinta una conversación para la bandeja: con quién es, cuántos mensajes
 * quedan sin leer y la vista previa del último.
 *
 * El nombre de un DM no está guardado en ninguna parte, y es correcto que
 * no lo esté: un DM se llama distinto para cada uno de los dos que lo
 * tienen. Se resuelve al pintarlo, desde el otro participante.
 */
function formaConversacion(
  conv: {
    id: string;
    esGrupo: boolean;
    nombre: string | null;
    iconoUrl: string | null;
    ultimoMsgEn: Date;
    ultimoMsgTexto: string | null;
    esSolicitud: boolean;
    participantes: {
      userId: string;
      rol: string;
      silenciado: boolean;
      leidoHastaId: string | null;
      user: { id: string; handle: string; displayName: string; avatarUrl: string | null };
    }[];
  },
  yo: string,
  sinLeer: number
) {
  const mio = conv.participantes.find((p) => p.userId === yo);
  const otros = conv.participantes.filter((p) => p.userId !== yo).map((p) => p.user);

  return {
    id: conv.id,
    esGrupo: conv.esGrupo,
    // En un grupo manda el nombre puesto; en un DM, quien está al otro lado.
    nombre: conv.esGrupo ? conv.nombre : (otros[0]?.displayName ?? null),
    iconoUrl: conv.esGrupo ? conv.iconoUrl : (otros[0]?.avatarUrl ?? null),
    handle: conv.esGrupo ? null : (otros[0]?.handle ?? null),
    ultimoMsgEn: conv.ultimoMsgEn,
    ultimoMsgTexto: conv.ultimoMsgTexto,
    esSolicitud: conv.esSolicitud,
    silenciado: mio?.silenciado ?? false,
    rol: mio?.rol ?? 'MIEMBRO',
    sinLeer,
    participantes: otros,
  };
}

/**
 * Cuenta los mensajes sin leer de cada conversación, para toda la bandeja
 * de una vez.
 *
 * Se hace con **una** consulta agrupada y no con una por conversación: con
 * veinte hilos en pantalla, la versión ingenua son veinte viajes a la base
 * cada vez que alguien abre la bandeja.
 *
 * "Sin leer" = mensajes posteriores al que marcó como leído, de otros. Los
 * propios nunca cuentan: nadie tiene pendiente de leer lo que él escribió.
 */
async function contarSinLeer(
  yo: string,
  conversaciones: { id: string; participantes: { userId: string; leidoHastaId: string | null }[] }[]
): Promise<Map<string, number>> {
  const cuenta = new Map<string, number>();
  if (conversaciones.length === 0) return cuenta;

  /*
   * `leidoHastaId` guarda un id, pero para contar hace falta una FECHA: la
   * pregunta es "cuántos mensajes hay después de ese". Se resuelven todos
   * los ids marcados de un golpe y se traducen a su `createdAt`.
   */
  const marcados = conversaciones
    .map((c) => c.participantes.find((p) => p.userId === yo)?.leidoHastaId)
    .filter((id): id is string => Boolean(id));

  const fechas = new Map<string, Date>();
  if (marcados.length > 0) {
    const filas = await prisma.mensaje.findMany({
      where: { id: { in: marcados } },
      select: { id: true, createdAt: true },
    });
    for (const f of filas) fechas.set(f.id, f.createdAt);
  }

  const agrupado = await prisma.mensaje.groupBy({
    by: ['conversacionId'],
    where: {
      conversacionId: { in: conversaciones.map((c) => c.id) },
      autorId: { not: yo },
      borradoEn: null,
      // Los mensajes de sistema ("X se unió") no son algo que nadie tenga
      // pendiente de leer; contarlos haría que un grupo apareciera con
      // avisos por cambios administrativos.
      tipo: { not: 'sistema' },
      OR: conversaciones.map((c) => {
        const leido = c.participantes.find((p) => p.userId === yo)?.leidoHastaId;
        const desde = leido ? fechas.get(leido) : undefined;
        return desde
          ? { conversacionId: c.id, createdAt: { gt: desde } }
          : // Sin marca de lectura, todo lo ajeno está sin leer.
            { conversacionId: c.id };
      }),
    },
    _count: { _all: true },
  });

  for (const fila of agrupado) cuenta.set(fila.conversacionId, fila._count._all);
  return cuenta;
}

/**
 * Actualiza la vista previa y la hora del último mensaje.
 *
 * Se llama dentro de la misma transacción que crea el mensaje: si se
 * hiciera después y fallara, la bandeja mostraría el mensaje anterior y el
 * hilo aparecería ordenado en el sitio equivocado.
 */
function datosUltimoMensaje(texto: string | null, adjuntos: number) {
  return {
    ultimoMsgEn: new Date(),
    ultimoMsgTexto: vistaPrevia(texto, adjuntos),
  };
}

// ═════════════════════════════════════════════════════════════════════
//  BANDEJA
// ═════════════════════════════════════════════════════════════════════

// ── GET /api/mensajes/conversaciones ─────────────────────────────────
export async function bandeja(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { cursor, limite, solicitudes } = req.queryValidada as BandejaInput;

  /*
   * Se ordena por `ultimoMsgEn` y no por id, porque la bandeja tiene que
   * mostrar arriba lo que se movió hace menos. El cursor es entonces la
   * FECHA del último elemento recibido, no su id: con un cursor por id, un
   * hilo viejo que recibe un mensaje nuevo saltaría de sitio y la
   * paginación se descuadraría.
   */
  const desde = cursor ? new Date(cursor) : null;
  if (cursor && Number.isNaN(desde!.getTime())) {
    throw errores.invalido('Cursor inválido.');
  }

  const filas = await prisma.conversacion.findMany({
    where: {
      esSolicitud: solicitudes,
      participantes: { some: { userId: yo, salioEn: null } },
      ...(desde ? { ultimoMsgEn: { lt: desde } } : {}),
    },
    include: {
      participantes: {
        where: { salioEn: null },
        select: {
          userId: true,
          rol: true,
          silenciado: true,
          leidoHastaId: true,
          user: { select: SELECT_AUTOR },
        },
      },
    },
    orderBy: { ultimoMsgEn: 'desc' },
    take: limite + 1,
  });

  const hayMas = filas.length > limite;
  const items = hayMas ? filas.slice(0, limite) : filas;

  const sinLeer = await contarSinLeer(yo, items);

  res.json({
    items: items.map((c) => formaConversacion(c, yo, sinLeer.get(c.id) ?? 0)),
    cursor: hayMas ? (items[items.length - 1]?.ultimoMsgEn.toISOString() ?? null) : null,
  });
}

// ── GET /api/mensajes/no-leidos ──────────────────────────────────────
/**
 * Total de conversaciones con mensajes sin leer, para el punto de la
 * navbar. Devuelve el número de CONVERSACIONES y no de mensajes: "3" junto
 * al icono de mensajes se lee naturalmente como tres chats esperando, y no
 * como trescientos mensajes de un grupo activo.
 */
export async function noLeidos(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;

  const conversaciones = await prisma.conversacion.findMany({
    where: { esSolicitud: false, participantes: { some: { userId: yo, salioEn: null } } },
    select: {
      id: true,
      participantes: { where: { userId: yo }, select: { userId: true, leidoHastaId: true } },
    },
    // Un tope: quien tenga miles de conversaciones no necesita el número
    // exacto para saber que tiene mensajes.
    take: 200,
  });

  const cuenta = await contarSinLeer(yo, conversaciones);
  let hilos = 0;
  for (const n of cuenta.values()) if (n > 0) hilos++;

  const solicitudes = await prisma.conversacion.count({
    where: { esSolicitud: true, participantes: { some: { userId: yo, salioEn: null } } },
  });

  res.json({ conversaciones: hilos, solicitudes });
}

// ── GET /api/mensajes/conversaciones/:id ─────────────────────────────
export async function verConversacion(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { id } = req.paramsValidados as { id: string };

  await exigirParticipante(yo, id);

  const conv = await prisma.conversacion.findUniqueOrThrow({
    where: { id },
    include: {
      participantes: {
        where: { salioEn: null },
        select: {
          userId: true,
          rol: true,
          silenciado: true,
          leidoHastaId: true,
          user: { select: SELECT_AUTOR },
        },
      },
    },
  });

  const sinLeer = await contarSinLeer(yo, [conv]);

  res.json({ conversacion: formaConversacion(conv, yo, sinLeer.get(conv.id) ?? 0) });
}

// ═════════════════════════════════════════════════════════════════════
//  ABRIR CONVERSACIONES
// ═════════════════════════════════════════════════════════════════════

// ── POST /api/mensajes/dm ────────────────────────────────────────────
/**
 * Abre (o recupera) el DM con alguien.
 *
 * Es idempotente: si el hilo ya existe se devuelve el mismo, no se crea
 * otro. Sin eso, entrar dos veces desde un perfil dejaría la conversación
 * partida en dos y los mensajes repartidos entre ambas.
 */
export async function abrirDm(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { handle } = req.body as AbrirDmInput;

  const otro = await usuarioPorHandle(handle);

  /*
   * El DM consigo mismo se rechaza ANTES de buscar el hilo existente, y el
   * orden importa: `buscarDm(yo, yo)` sí encuentra conversaciones, porque
   * las dos condiciones `some` se satisfacen con la MISMA fila de
   * participante. Con la comprobación abajo (dentro de `puedeIniciarDm`),
   * pedir un DM con uno mismo devolvía 200 con el hilo de otra persona.
   * Lo cazó el E2E.
   */
  if (otro.id === yo) {
    throw errores.invalido('No puedes abrir una conversación contigo.');
  }

  const existente = await buscarDm(yo, otro.id);
  if (existente) {
    res.json({ conversacionId: existente, creada: false });
    return;
  }

  // Las reglas de quién puede escribirte solo se aplican al ABRIR el hilo.
  // Una vez existe, la conversación ya está consentida por ambas partes.
  const modo = await puedeIniciarDm(yo, otro.id);

  const conversacion = await prisma.conversacion.create({
    data: {
      esGrupo: false,
      creadorId: yo,
      esSolicitud: modo === 'solicitud',
      participantes: {
        create: [
          { userId: yo, rol: 'MIEMBRO' },
          { userId: otro.id, rol: 'MIEMBRO' },
        ],
      },
    },
    select: { id: true },
  });

  res.status(201).json({ conversacionId: conversacion.id, creada: true, esSolicitud: modo === 'solicitud' });
}

// ── POST /api/mensajes/grupos ────────────────────────────────────────
export async function crearGrupo(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { nombre, handles, iconoId } = req.body as CrearGrupoInput;

  // Sin duplicados y sin uno mismo: el creador se añade aparte, como ADMIN.
  const unicos = [...new Set(handles)].filter((h) => h !== req.usuario!.handle);
  if (unicos.length === 0) throw errores.invalido('Invita al menos a una persona.');

  const invitados = await prisma.user.findMany({
    where: { handle: { in: unicos }, suspendido: false },
    select: { id: true, handle: true },
  });

  if (invitados.length !== unicos.length) {
    throw errores.invalido('Alguna de esas cuentas no existe.');
  }

  /*
   * A un grupo no se puede meter a quien te bloqueó (ni a quien
   * bloqueaste). Si no se comprobara, añadir a alguien a un grupo sería la
   * forma trivial de saltarse un bloqueo y volver a escribirle.
   */
  const bloqueados = new Set(await idsBloqueados(yo));
  const conflicto = invitados.find((i) => bloqueados.has(i.id));
  if (conflicto) {
    throw errores.invalido('No puedes añadir a alguna de esas personas.');
  }

  if (invitados.length + 1 > MAX_PARTICIPANTES) {
    throw errores.invalido(`Un grupo admite como mucho ${MAX_PARTICIPANTES} participantes.`);
  }

  let iconoUrl: string | null = null;
  if (iconoId) {
    const icono = await prisma.archivo.findFirst({
      where: { id: iconoId, userId: yo, uso: 'icono-grupo' },
      select: { url: true },
    });
    if (!icono) throw errores.invalido('Ese icono no existe.');
    iconoUrl = icono.url;
  }

  const conversacion = await prisma.conversacion.create({
    data: {
      esGrupo: true,
      nombre: limpiarTexto(nombre),
      iconoUrl,
      creadorId: yo,
      ultimoMsgTexto: null,
      participantes: {
        create: [
          { userId: yo, rol: 'ADMIN' },
          ...invitados.map((i) => ({ userId: i.id, rol: 'MIEMBRO' })),
        ],
      },
    },
    select: { id: true },
  });

  // A cada invitado se le avisa: un grupo que aparece en la bandeja sin
  // ningún aviso es fácil de no ver nunca.
  for (const invitado of invitados) {
    await notificar({
      destinatarioId: invitado.id,
      emisorId: yo,
      tipo: 'mensaje',
      datos: { conversacionId: conversacion.id, grupo: nombre, evento: 'invitacion' },
    });
    emitirAUsuario(invitado.id, 'conv:nueva', { conversacionId: conversacion.id });
  }

  res.status(201).json({ conversacionId: conversacion.id });
}

// ═════════════════════════════════════════════════════════════════════
//  MENSAJES
// ═════════════════════════════════════════════════════════════════════

// ── GET /api/mensajes/conversaciones/:id/mensajes ────────────────────
/**
 * Historial de una conversación, paginado hacia atrás.
 *
 * Este endpoint es **la fuente de verdad** del chat (§8): el socket solo
 * adelanta lo que ya está aquí. Por eso el chat sigue funcionando aunque
 * los websockets estén bloqueados por un proxy corporativo.
 */
export async function mensajes(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { id } = req.paramsValidados as { id: string };
  const { antes, limite } = req.queryValidada as PaginaMensajesInput;

  const pertenencia = await exigirParticipante(yo, id);

  let corte: Date | undefined;
  if (antes) {
    const ancla = await prisma.mensaje.findFirst({
      where: { id: antes, conversacionId: id },
      select: { createdAt: true },
    });
    // Un cursor que no es de esta conversación se ignora en vez de
    // devolver un error: pedir "lo anterior a un mensaje que no está aquí"
    // no tiene una respuesta correcta, y romper el scroll por eso es peor.
    corte = ancla?.createdAt;
  }

  /*
   * En un grupo, los mensajes de quien tienes bloqueado no se pintan. No se
   * te saca del grupo por bloquear a alguien —eso castigaría a quien
   * bloquea— pero tampoco tienes que seguir leyéndole.
   */
  const bloqueados = pertenencia.esGrupo ? await idsBloqueados(yo) : [];

  const filas = await prisma.mensaje.findMany({
    where: {
      conversacionId: id,
      ...(corte ? { createdAt: { lt: corte } } : {}),
      ...(bloqueados.length > 0 ? { autorId: { notIn: bloqueados } } : {}),
    },
    select: SELECT_MENSAJE,
    orderBy: { createdAt: 'desc' },
    take: limite + 1,
  });

  const hayMas = filas.length > limite;
  const items = hayMas ? filas.slice(0, limite) : filas;

  res.json({
    // Se devuelven en orden cronológico aunque se consulten al revés: la
    // consulta va `desc` porque lo que interesa es el final del hilo, pero
    // pintarlo así obligaría al cliente a invertir la lista siempre.
    items: items.map(limpiarBorrado).reverse(),
    cursor: hayMas ? (items[items.length - 1]?.id ?? null) : null,
  });
}

// ── POST /api/mensajes/conversaciones/:id/mensajes ───────────────────
export async function enviar(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { id } = req.paramsValidados as { id: string };
  const { texto, adjuntos, respondeAId } = req.body as EnviarMensajeInput;

  const pertenencia = await exigirParticipante(yo, id);
  await exigirPuedeEscribir(yo, id, pertenencia.esGrupo);

  // Los adjuntos se validan ANTES de crear nada: si fallaran después,
  // quedaría un mensaje vacío publicado en la conversación.
  await validarAdjuntos(yo, adjuntos);

  const limpio = texto ? limpiarTexto(texto) : '';
  if (!limpio && adjuntos.length === 0) {
    // El texto puede quedar vacío tras limpiarlo aunque llegara "lleno":
    // por ejemplo si era solo caracteres de control.
    throw errores.invalido('El mensaje no puede estar vacío.');
  }

  // Responder a un mensaje de otra conversación colaría contenido ajeno
  // como cita dentro de este hilo.
  if (respondeAId) {
    const original = await prisma.mensaje.count({
      where: { id: respondeAId, conversacionId: id },
    });
    if (original === 0) throw errores.invalido('Ese mensaje no está en esta conversación.');
  }

  const tipo = adjuntos.length > 0 && !limpio ? 'imagen' : 'texto';

  /*
   * Transacción: el mensaje, sus adjuntos y la vista previa de la bandeja
   * van juntos o no van. Si la vista previa se escribiera aparte y fallara,
   * la conversación aparecería en la bandeja con el mensaje anterior y
   * ordenada por una fecha que ya no es la suya.
   */
  const mensaje = await prisma.$transaction(async (tx) => {
    const creado = await tx.mensaje.create({
      data: {
        conversacionId: id,
        autorId: yo,
        texto: limpio || null,
        idioma: limpio ? detectarIdioma(limpio) : null,
        tipo,
        respondeAId: respondeAId ?? null,
      },
      select: { id: true },
    });

    if (adjuntos.length > 0) {
      await tx.archivo.updateMany({
        where: { id: { in: adjuntos }, userId: yo, mensajeId: null, publicacionId: null },
        data: { mensajeId: creado.id },
      });
    }

    await tx.conversacion.update({
      where: { id },
      data: datosUltimoMensaje(limpio || null, adjuntos.length),
    });

    return tx.mensaje.findUniqueOrThrow({ where: { id: creado.id }, select: SELECT_MENSAJE });
  });

  /*
   * Persistido: ahora se emite. El orden importa — si se emitiera primero
   * y la escritura fallara, algunos clientes tendrían en pantalla un
   * mensaje que no existe en la base y que desaparecería al recargar.
   */
  emitirAConversacion(id, 'mensaje:nuevo', { mensaje });

  // Aviso a los demás participantes que no tengan el hilo silenciado.
  const otros = await prisma.participante.findMany({
    where: { conversacionId: id, userId: { not: yo }, salioEn: null, silenciado: false },
    select: { userId: true },
  });

  for (const p of otros) {
    emitirAUsuario(p.userId, 'conv:actualizada', { conversacionId: id });
    await notificar({
      destinatarioId: p.userId,
      emisorId: yo,
      tipo: 'mensaje',
      datos: {
        conversacionId: id,
        extracto: vistaPrevia(limpio || null, adjuntos.length),
      },
    });
  }

  res.status(201).json({ mensaje });
}

// ── PATCH /api/mensajes/:id ──────────────────────────────────────────
export async function editar(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { id } = req.paramsValidados as { id: string };
  const { texto } = req.body as EditarMensajeInput;

  const original = await prisma.mensaje.findUnique({
    where: { id },
    select: { autorId: true, conversacionId: true, borradoEn: true },
  });

  // 404 y no 403 si es de otro: confirmar que el mensaje existe ya sería
  // filtrar contenido de una conversación ajena.
  if (!original || original.autorId !== yo) {
    throw errores.noEncontrado('Ese mensaje no existe.');
  }
  if (original.borradoEn) throw errores.invalido('Ese mensaje está borrado.');

  await exigirParticipante(yo, original.conversacionId);

  const limpio = limpiarTexto(texto);
  if (!limpio) throw errores.invalido('El mensaje no puede estar vacío.');

  const mensaje = await prisma.mensaje.update({
    where: { id },
    data: { texto: limpio, idioma: detectarIdioma(limpio), editadoEn: new Date() },
    select: SELECT_MENSAJE,
  });

  emitirAConversacion(original.conversacionId, 'mensaje:editado', { mensaje });

  res.json({ mensaje });
}

// ── DELETE /api/mensajes/:id ─────────────────────────────────────────
/**
 * Borrado suave. El texto y los adjuntos dejan de servirse (§
 * `limpiarBorrado`), pero la fila queda para que los mensajes que
 * respondían a este no apunten a la nada.
 *
 * Un ADMIN de grupo puede borrar mensajes ajenos: es la herramienta mínima
 * de moderación de un grupo, y sin ella el creador no tiene forma de
 * limpiar lo que alguien pegue.
 */
export async function borrar(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { id } = req.paramsValidados as { id: string };

  const original = await prisma.mensaje.findUnique({
    where: { id },
    select: { autorId: true, conversacionId: true, borradoEn: true },
  });
  if (!original) throw errores.noEncontrado('Ese mensaje no existe.');

  const pertenencia = await exigirParticipante(yo, original.conversacionId);

  const esAutor = original.autorId === yo;
  const esAdminDeGrupo = pertenencia.esGrupo && pertenencia.rol === 'ADMIN';
  if (!esAutor && !esAdminDeGrupo) {
    throw errores.noEncontrado('Ese mensaje no existe.');
  }

  if (!original.borradoEn) {
    await prisma.mensaje.update({ where: { id }, data: { borradoEn: new Date() } });
  }

  emitirAConversacion(original.conversacionId, 'mensaje:borrado', {
    mensajeId: id,
    conversacionId: original.conversacionId,
  });

  res.json({ borrado: true });
}

// ── POST /api/mensajes/conversaciones/:id/leido ──────────────────────
export async function marcarLeido(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { id } = req.paramsValidados as { id: string };
  const { mensajeId } = req.body as MarcarLeidoInput;

  await exigirParticipante(yo, id);

  const existe = await prisma.mensaje.count({ where: { id: mensajeId, conversacionId: id } });
  if (existe === 0) throw errores.invalido('Ese mensaje no está en esta conversación.');

  await prisma.participante.update({
    where: { conversacionId_userId: { conversacionId: id, userId: yo } },
    data: { leidoHastaId: mensajeId },
  });

  // Se avisa al resto para pintar el "visto". Solo el hecho de haber
  // leído: no se manda nada del contenido.
  emitirAConversacion(id, 'leido', { conversacionId: id, userId: yo, mensajeId });

  res.json({ leidoHastaId: mensajeId });
}

// ── POST /api/mensajes/conversaciones/:id/silenciar ──────────────────
export async function silenciar(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { id } = req.paramsValidados as { id: string };
  const { silenciado } = req.body as SilenciarInput;

  await exigirParticipante(yo, id);

  await prisma.participante.update({
    where: { conversacionId_userId: { conversacionId: id, userId: yo } },
    data: { silenciado },
  });

  res.json({ silenciado });
}

// ── POST /api/mensajes/conversaciones/:id/aceptar ────────────────────
/**
 * Acepta una solicitud: el hilo pasa a la bandeja principal.
 *
 * Es lo que convierte la bandeja de solicitudes en algo útil — quien
 * escribe a un desconocido no aparece entre sus conversaciones normales
 * hasta que este decide que sí.
 */
export async function aceptarSolicitud(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { id } = req.paramsValidados as { id: string };

  await exigirParticipante(yo, id);

  const conv = await prisma.conversacion.findUniqueOrThrow({
    where: { id },
    select: { esSolicitud: true, creadorId: true },
  });

  // Quien la inició no puede "aceptar" su propia solicitud y colarse así en
  // la bandeja principal del otro.
  if (conv.creadorId === yo) {
    throw errores.sinPermiso('Tiene que aceptarla la otra persona.');
  }
  if (!conv.esSolicitud) {
    res.json({ aceptada: true });
    return;
  }

  await prisma.conversacion.update({ where: { id }, data: { esSolicitud: false } });

  res.json({ aceptada: true });
}

// ═════════════════════════════════════════════════════════════════════
//  GRUPOS
// ═════════════════════════════════════════════════════════════════════

/**
 * Mensaje de sistema ("X se unió", "Y salió").
 *
 * Se guarda como un mensaje más con `tipo: 'sistema'` en vez de como un
 * evento aparte: así aparece en el hilo en su sitio cronológico, que es
 * donde tiene sentido leerlo, y no hace falta una segunda tabla ni mezclar
 * dos listas al pintar.
 *
 * El texto guardado es una CLAVE (`participante-anadido`), no una frase: el
 * mismo mensaje lo leen personas con la interfaz en español y en inglés, y
 * una frase guardada quedaría congelada en el idioma de quien la provocó.
 */
async function mensajeDeSistema(
  conversacionId: string,
  evento: string,
  datos: Record<string, string>
): Promise<void> {
  const mensaje = await prisma.mensaje.create({
    data: {
      conversacionId,
      // El autor de un mensaje de sistema es el propio sistema, pero
      // `autorId` no es nullable; se usa quien provocó el evento y el
      // cliente lo pinta como aviso por su `tipo`, no por su autor.
      autorId: datos['porId']!,
      texto: JSON.stringify({ evento, ...datos }),
      tipo: 'sistema',
    },
    select: SELECT_MENSAJE,
  });

  await prisma.conversacion.update({
    where: { id: conversacionId },
    data: { ultimoMsgEn: new Date() },
  });

  emitirAConversacion(conversacionId, 'mensaje:nuevo', { mensaje });
}

// ── PATCH /api/mensajes/grupos/:id ───────────────────────────────────
export async function editarGrupo(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { id } = req.paramsValidados as { id: string };
  const { nombre, iconoId } = req.body as EditarGrupoInput;

  await exigirAdmin(yo, id);

  let iconoUrl: string | undefined;
  if (iconoId) {
    const icono = await prisma.archivo.findFirst({
      where: { id: iconoId, userId: yo, uso: 'icono-grupo' },
      select: { url: true },
    });
    if (!icono) throw errores.invalido('Ese icono no existe.');
    iconoUrl = icono.url;
  }

  const conversacion = await prisma.conversacion.update({
    where: { id },
    data: {
      ...(nombre !== undefined ? { nombre: limpiarTexto(nombre) } : {}),
      ...(iconoUrl !== undefined ? { iconoUrl } : {}),
    },
    select: { id: true, nombre: true, iconoUrl: true },
  });

  emitirAConversacion(id, 'conv:actualizada', { conversacionId: id });

  res.json({ conversacion });
}

// ── POST /api/mensajes/grupos/:id/participantes ──────────────────────
export async function anadirParticipantes(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { id } = req.paramsValidados as { id: string };
  const { handles } = req.body as AnadirParticipantesInput;

  await exigirAdmin(yo, id);

  const unicos = [...new Set(handles)];
  const invitados = await prisma.user.findMany({
    where: { handle: { in: unicos }, suspendido: false },
    select: { id: true, handle: true },
  });
  if (invitados.length !== unicos.length) {
    throw errores.invalido('Alguna de esas cuentas no existe.');
  }

  // Igual que al crear: añadir a alguien a un grupo no puede ser la vía
  // para saltarse un bloqueo.
  const bloqueados = new Set(await idsBloqueados(yo));
  if (invitados.some((i) => bloqueados.has(i.id))) {
    throw errores.invalido('No puedes añadir a alguna de esas personas.');
  }

  const actuales = await prisma.participante.count({
    where: { conversacionId: id, salioEn: null },
  });
  if (actuales + invitados.length > MAX_PARTICIPANTES) {
    throw errores.invalido(`Un grupo admite como mucho ${MAX_PARTICIPANTES} participantes.`);
  }

  for (const invitado of invitados) {
    /*
     * `upsert` y no `create`: quien se fue del grupo ya tiene su fila con
     * `salioEn` puesto, y un `create` chocaría con el índice único. Volver
     * a añadirlo es limpiar esa fecha, no crear un participante nuevo.
     */
    await prisma.participante.upsert({
      where: { conversacionId_userId: { conversacionId: id, userId: invitado.id } },
      create: { conversacionId: id, userId: invitado.id, rol: 'MIEMBRO' },
      update: { salioEn: null, rol: 'MIEMBRO' },
    });

    await mensajeDeSistema(id, 'participante-anadido', {
      porId: yo,
      porHandle: req.usuario!.handle,
      handle: invitado.handle,
    });

    await notificar({
      destinatarioId: invitado.id,
      emisorId: yo,
      tipo: 'mensaje',
      datos: { conversacionId: id, evento: 'invitacion' },
    });
    emitirAUsuario(invitado.id, 'conv:nueva', { conversacionId: id });
  }

  res.json({ anadidos: invitados.length });
}

// ── DELETE /api/mensajes/grupos/:id/participantes/:handle ────────────
export async function quitarParticipante(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { id, handle } = req.paramsValidados as { id: string; handle: string };

  await exigirAdmin(yo, id);

  const objetivo = await usuarioPorHandle(handle);
  if (objetivo.id === yo) {
    throw errores.invalido('Para salir del grupo usa la opción de salir.');
  }

  const participante = await prisma.participante.findUnique({
    where: { conversacionId_userId: { conversacionId: id, userId: objetivo.id } },
    select: { salioEn: true },
  });
  if (!participante || participante.salioEn) {
    throw errores.noEncontrado('Esa persona no está en el grupo.');
  }

  await prisma.participante.update({
    where: { conversacionId_userId: { conversacionId: id, userId: objetivo.id } },
    data: { salioEn: new Date() },
  });

  await mensajeDeSistema(id, 'participante-quitado', {
    porId: yo,
    porHandle: req.usuario!.handle,
    handle: objetivo.handle,
  });

  emitirAUsuario(objetivo.id, 'conv:salida', { conversacionId: id });

  res.json({ quitado: true });
}

// ── POST /api/mensajes/conversaciones/:id/salir ──────────────────────
export async function salir(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { id } = req.paramsValidados as { id: string };

  const pertenencia = await exigirParticipante(yo, id);
  if (!pertenencia.esGrupo) {
    throw errores.invalido('De un mensaje directo no se puede salir.');
  }

  await prisma.participante.update({
    where: { conversacionId_userId: { conversacionId: id, userId: yo } },
    data: { salioEn: new Date() },
  });

  /*
   * Si el que se va era el único ADMIN, se asciende al participante más
   * antiguo. Un grupo sin administrador queda congelado para siempre: nadie
   * puede renombrarlo, añadir gente ni moderar, y no hay forma de
   * arreglarlo desde dentro.
   */
  const quedanAdmins = await prisma.participante.count({
    where: { conversacionId: id, rol: 'ADMIN', salioEn: null },
  });

  if (quedanAdmins === 0) {
    const sucesor = await prisma.participante.findFirst({
      where: { conversacionId: id, salioEn: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (sucesor) {
      await prisma.participante.update({ where: { id: sucesor.id }, data: { rol: 'ADMIN' } });
    }
  }

  await mensajeDeSistema(id, 'participante-salio', {
    porId: yo,
    porHandle: req.usuario!.handle,
    handle: req.usuario!.handle,
  });

  res.json({ salido: true });
}
