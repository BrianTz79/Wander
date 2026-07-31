import type { Request, Response } from 'express';

import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { errores } from '../middlewares/errores.middleware';
import {
  guardarArchivo,
  MAX_ADJUNTOS,
  MAX_BYTES,
  registrarGifExterno,
  SELECT_ADJUNTO,
  type UsoArchivo,
} from '../services/archivos.service';
import { buscarGifs } from '../services/giphy.service';
import type { BuscarGifsInput, GifExternoInput, SubirInput } from '../schemas/archivos.schema';

/**
 * Subida de archivos y buscador de GIFs (Fase 8).
 *
 * Los tres endpoints comparten una regla: **el dueño sale de la sesión**.
 * No existe un `userId` en el cuerpo, así que no existe la categoría de bug
 * "subiste un archivo a nombre de otro" ni "adjuntaste el archivo de otro".
 */

// ── POST /api/archivos ───────────────────────────────────────────────
/**
 * Sube uno o varios archivos y devuelve sus ids.
 *
 * La subida va **separada** de crear el mensaje o la publicación, y eso es
 * deliberado: así el cliente puede enseñar la miniatura mientras se escribe
 * el texto, y una foto de 6 MB no bloquea el envío del mensaje. El archivo
 * queda registrado sin dueño lógico hasta que se manda el mensaje que lo
 * lleva; los que nunca lleguen a usarse los barre `limpiarHuerfanos`.
 */
export async function subir(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { uso } = req.body as SubirInput;

  const archivos = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (archivos.length === 0) throw errores.invalido('No llegó ningún archivo.');
  if (archivos.length > MAX_ADJUNTOS) {
    throw errores.invalido(`Máximo ${MAX_ADJUNTOS} archivos.`);
  }

  /*
   * En serie y no con `Promise.all`. Cada imagen pasa por sharp, que es
   * trabajo intensivo de CPU: procesar cuatro a la vez en un servidor de un
   * solo contenedor solo consigue que las cuatro vayan lentas y que el
   * resto de peticiones se queden esperando su turno en el event loop.
   */
  const guardados = [];
  for (const archivo of archivos) {
    guardados.push(
      await guardarArchivo({ userId: yo, datos: archivo.buffer, uso: uso as UsoArchivo })
    );
  }

  res.status(201).json({
    archivos: guardados.map((a) => ({
      id: a.id,
      url: a.url,
      miniaturaUrl: a.miniaturaUrl,
      mime: a.mime,
      bytes: a.bytes,
      ancho: a.ancho,
      alto: a.alto,
      externo: a.externo,
    })),
  });
}

// ── DELETE /api/archivos/:id ─────────────────────────────────────────
/**
 * Quita un adjunto que aún no se ha enviado.
 *
 * Solo se admite si el archivo sigue **suelto**: una vez atado a un mensaje
 * o a una publicación, quitarlo es cosa de borrar ese mensaje o esa
 * publicación, no de este endpoint. Si no, alguien podría vaciar de
 * imágenes una publicación ya enviada y dejar los comentarios hablando de
 * algo que ya no está.
 */
export async function borrar(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const { id } = req.paramsValidados as { id: string };

  const { count } = await prisma.archivo.deleteMany({
    where: { id, userId: yo, mensajeId: null, publicacionId: null },
  });

  if (count === 0) throw errores.noEncontrado('Ese archivo no existe o ya se usó.');

  res.json({ borrado: true });
}

// ── GET /api/archivos/gifs ───────────────────────────────────────────
/**
 * Proxy del buscador de Giphy. Va por el servidor para no publicar la clave
 * en el bundle del cliente y para que la CSP siga sin permitir conexiones a
 * terceros (§ giphy.service.ts).
 */
export async function gifs(req: Request, res: Response): Promise<void> {
  const { q } = req.queryValidada as BuscarGifsInput;
  const resultados = await buscarGifs(q ?? '');
  res.json({ gifs: resultados });
}

// ── POST /api/archivos/gif ───────────────────────────────────────────
/**
 * Registra un GIF elegido en el buscador como adjunto.
 *
 * No se descarga: se guarda la URL de Giphy con `externo: true`. El
 * servicio comprueba que el host sea del proveedor — sin ese filtro, este
 * endpoint sería la vía para hacer que cada persona que abre un chat pida
 * una imagen a un servidor cualquiera y le revele su IP.
 */
export async function gifExterno(req: Request, res: Response): Promise<void> {
  const yo = req.usuario!.id;
  const datos = req.body as GifExternoInput;

  const archivo = await registrarGifExterno({ userId: yo, ...datos });

  res.status(201).json({
    archivo: {
      id: archivo.id,
      url: archivo.url,
      miniaturaUrl: archivo.miniaturaUrl,
      mime: archivo.mime,
      bytes: archivo.bytes,
      ancho: archivo.ancho,
      alto: archivo.alto,
      externo: archivo.externo,
    },
  });
}

// ── GET /api/archivos/limites ────────────────────────────────────────
/**
 * Lo que el cliente necesita saber para no dejar intentar lo imposible:
 * cuánto pesa como mucho un archivo, cuántos caben y si el buscador de
 * GIFs está disponible en este servidor.
 *
 * Se manda desde aquí en vez de escribirlo en el cliente porque los
 * límites viven en el backend: dos copias acabarían diciendo cosas
 * distintas, y sería el cliente el que mintiera.
 */
export async function limites(_req: Request, res: Response): Promise<void> {
  res.json({
    maxBytes: MAX_BYTES,
    maxAdjuntos: MAX_ADJUNTOS,
    gifs: env.integraciones.giphy,
  });
}

export { SELECT_ADJUNTO };
