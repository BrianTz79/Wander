import { createHash, randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

import { env } from '../config/env';
import { logger } from '../config/logger';
import { prisma } from '../config/prisma';
import { errores } from '../middlewares/errores.middleware';

/**
 * Subida de archivos (Fase 8): adjuntos de chat, imágenes de publicaciones
 * e iconos de grupo.
 *
 * La regla que ordena el archivo entero: **nada de lo que dice el cliente
 * sobre un archivo se cree**. Ni la extensión del nombre, ni el
 * `Content-Type` de la parte multipart. Ambos los escribe quien sube, así
 * que ambos se pueden mentir: subir `foto.png` con `Content-Type:
 * image/png` y dentro un HTML con `<script>` es trivial, y si eso acaba
 * servido desde nuestro dominio es un XSS almacenado contra todo el que
 * abra el enlace.
 *
 * Lo que sí se cree son los **magic bytes** — los primeros bytes del
 * contenido real, que es lo que `file-type` lee. Y ni siquiera eso basta
 * por sí solo: las imágenes se **reescriben** con sharp, así que lo que se
 * guarda es un archivo generado por nosotros a partir de los píxeles, no
 * el que subió el usuario. Un payload escondido en un campo de metadatos
 * no sobrevive a esa reescritura.
 */

// ─────────────────────────────────────────────────────────────────────
//  Detección de tipo (ESM dentro de CommonJS)
// ─────────────────────────────────────────────────────────────────────

/**
 * `file-type` 22 es **ESM puro** y este servidor compila a CommonJS, así
 * que un `import` estático no compila ni resuelve en runtime. Se carga con
 * `import()` dinámico, que TypeScript conserva tal cual al emitir CommonJS
 * y que Node sí sabe resolver hacia un paquete ESM.
 *
 * El módulo se cachea en una promesa a nivel de archivo: sin ella, cada
 * subida pagaría una resolución de módulo. Y se guarda la PROMESA y no el
 * módulo ya resuelto para que dos subidas simultáneas al arrancar no
 * disparen dos cargas.
 *
 * La alternativa era quedarse en `file-type` 16 (la última con CommonJS),
 * pero es de 2021: se perdería la detección de formatos que hoy sube la
 * gente, y este módulo es justo el que decide qué archivos son seguros.
 *
 * **Un detalle verificado y no supuesto:** al emitir CommonJS, TypeScript
 * convierte este `import()` en un `require()`, que históricamente reventaba
 * contra un paquete ESM puro. Funciona porque Node 22 carga ESM desde
 * `require()` de forma síncrona (lo exige `engines: node >=22`, y los
 * contenedores van con 22-alpine). Comprobado dentro del contenedor, no
 * solo en la máquina de desarrollo. Si algún día se bajara de Node 22, esto
 * es lo primero que se rompe.
 */
type DetectorTipo = (datos: Uint8Array) => Promise<{ mime: string; ext: string } | undefined>;

let detectorCargado: Promise<DetectorTipo> | null = null;

function detectorDeTipo(): Promise<DetectorTipo> {
  /*
   * El especificador va en una variable a propósito. Con `import('file-type')`
   * literal, TypeScript intenta resolver sus tipos, y `moduleResolution:
   * node` —el algoritmo clásico— no sabe leer el campo `exports` de un
   * paquete ESM, así que falla en compilación aunque en runtime funcione.
   *
   * Pasar por una variable evita esa resolución estática; la firma no se
   * pierde porque está declarada arriba en `DetectorTipo`, que es más
   * estrecha que la real y solo expone lo que este archivo usa.
   */
  const modulo = 'file-type';
  detectorCargado ??= (import(modulo) as Promise<{ fileTypeFromBuffer: DetectorTipo }>).then(
    (mod) => mod.fileTypeFromBuffer
  );
  return detectorCargado;
}

// ─────────────────────────────────────────────────────────────────────
//  Límites
// ─────────────────────────────────────────────────────────────────────

/**
 * Tope por archivo. 8 MB da de sobra para una captura de pantalla o un GIF
 * corto, que es el caso real. El límite lo aplica multer ANTES de leer el
 * cuerpo entero en memoria: sin él, subir un archivo de 2 GB es un DoS de
 * memoria de una sola petición.
 */
export const MAX_BYTES = 8 * 1024 * 1024;

/** Cuántos adjuntos caben en un mensaje o publicación. */
export const MAX_ADJUNTOS = 4;

/**
 * Lado máximo de una imagen guardada. Una captura de un monitor 4K son
 * 3840 px que nadie ve a ese tamaño en un feed; recomprimir a 1600
 * multiplica por diez el ahorro de disco y de datos móviles del que mira.
 */
const LADO_MAX = 1600;

/** Lado de la miniatura que se pinta en la lista antes de abrir. */
const LADO_MINIATURA = 400;

/**
 * Píxeles totales que sharp acepta descomprimir. Es la defensa contra la
 * «bomba de descompresión»: un PNG de 4 KB puede declarar 50000×50000 px y
 * reventar la memoria del servidor al expandirse. El archivo pasa el
 * límite de bytes sin problema porque comprimido es diminuto; lo que hay
 * que limitar es el tamaño DESCOMPRIMIDO.
 */
const MAX_PIXELES = 50 * 1024 * 1024;

/**
 * MIMEs aceptados, detectados por contenido. Lista blanca cerrada: todo lo
 * que no esté aquí se rechaza, en vez de una lista negra que hay que
 * recordar ampliar cada vez que aparece un formato peligroso nuevo.
 *
 * **SVG no está, y su ausencia es deliberada.** Un SVG es un documento XML
 * que puede llevar `<script>` dentro, así que es un vector de XSS
 * disfrazado de imagen. No hay forma segura de servirlo desde el mismo
 * origen sin sanearlo a fondo, y no compensa por un formato que casi nadie
 * adjunta en un chat.
 */
const IMAGENES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);

/**
 * Video corto: un clip de una jugada es contenido natural aquí. No se
 * recomprime (transcodificar exige ffmpeg y minutos de CPU por clip), así
 * que se acepta solo el contenedor cuyo tipo se puede verificar y se sirve
 * con `Content-Disposition: attachment` desde una CSP que prohíbe scripts.
 */
const VIDEOS = new Set(['video/mp4', 'video/webm']);

/**
 * Audio: notas de voz y el audio de fondo de perfil (Fase 11).
 */
const AUDIOS = new Set(['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/webm']);

export const MIMES_PERMITIDOS = new Set([...IMAGENES, ...VIDEOS, ...AUDIOS]);

/**
 * Cuota total por usuario. Sin un tope, una sola cuenta puede llenar el
 * disco del host y tumbar Postgres, que vive en el mismo volumen.
 */
const CUOTA_BYTES = 500 * 1024 * 1024;

/** Usos válidos de un archivo. Cerrado, como el catálogo de permisos. */
export const USOS = [
  'adjunto',
  'publicacion',
  'avatar',
  'banner',
  'galeria',
  'audio-perfil',
  'icono-grupo',
] as const;
export type UsoArchivo = (typeof USOS)[number];

// ─────────────────────────────────────────────────────────────────────
//  Rutas en disco
// ─────────────────────────────────────────────────────────────────────

/**
 * Los archivos se reparten en subcarpetas por año y mes.
 *
 * No es estética: un solo directorio con cientos de miles de entradas hace
 * lentas las operaciones del sistema de ficheros, y además vuelve
 * inmanejable cualquier limpieza o copia de seguridad selectiva.
 */
function carpetaDelMes(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  return `${ahora.getFullYear()}/${mes}`;
}

/**
 * Extensión que le corresponde a un MIME ya verificado.
 *
 * Se deriva del MIME detectado, **nunca del nombre que mandó el usuario**.
 * Ese nombre puede ser `../../etc/passwd` o `foto.php.png`, y usarlo para
 * componer una ruta es la vulnerabilidad de path traversal de manual. Aquí
 * el nombre del usuario no llega a tocar el disco en ningún momento: el
 * archivo se llama `<uuid>.<ext>`, con ambas partes generadas por nosotros.
 */
function extensionDe(mime: string): string {
  const tabla: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/mp4': 'm4a',
    'audio/webm': 'weba',
  };
  return tabla[mime] ?? 'bin';
}

// ─────────────────────────────────────────────────────────────────────
//  Procesado
// ─────────────────────────────────────────────────────────────────────

interface ArchivoProcesado {
  url: string;
  miniaturaUrl: string | null;
  mime: string;
  bytes: number;
  ancho: number | null;
  alto: number | null;
  hashSha256: string;
}

/**
 * Recomprime una imagen y genera su miniatura.
 *
 * **Reescribir la imagen es una medida de seguridad, no de ahorro.** Al
 * decodificar los píxeles y volver a codificarlos desde cero se pierde todo
 * lo que venía alrededor: los metadatos EXIF (que incluyen la
 * geolocalización exacta de dónde se tomó una foto — publicar eso sin
 * avisar es una fuga de privacidad real), los perfiles de color raros, los
 * segmentos de comentario donde se puede esconder un payload, y los datos
 * pegados después del final del archivo.
 *
 * `sharp` no copia metadatos salvo que se le pida explícitamente con
 * `.withMetadata()`, así que no llamarlo es justo lo correcto aquí.
 */
async function procesarImagen(
  datos: Buffer,
  mime: string,
  base: string,
  carpeta: string
): Promise<ArchivoProcesado> {
  // `animated: true` conserva todos los fotogramas: sin esto un GIF
  // animado se guardaría como una imagen fija, que es exactamente lo que
  // nadie quiere de un GIF.
  const esAnimado = mime === 'image/gif' || mime === 'image/webp';
  const entrada = sharp(datos, {
    animated: esAnimado,
    limitInputPixels: MAX_PIXELES,
  });

  const meta = await entrada.metadata();

  /*
   * Los animados se rotan y redimensionan igual, pero se mantienen en su
   * formato: convertir un GIF a JPEG lo dejaría fijo. El resto va a WebP,
   * que pesa bastante menos que PNG o JPEG a calidad equivalente.
   */
  const salidaMime = esAnimado ? mime : 'image/webp';
  const ext = extensionDe(salidaMime);
  const nombre = `${base}.${ext}`;

  let pipeline = entrada
    /*
     * `.rotate()` sin argumentos aplica la orientación EXIF y luego la
     * descarta. Es necesario porque al tirar los metadatos se pierde el
     * campo de orientación: sin esta llamada, una foto tomada en vertical
     * con el móvil se guardaría girada 90°.
     */
    .rotate()
    .resize({
      width: LADO_MAX,
      height: LADO_MAX,
      fit: 'inside',
      // No agrandar una imagen pequeña: solo la haría borrosa y más pesada.
      withoutEnlargement: true,
    });

  pipeline = esAnimado
    ? mime === 'image/gif'
      ? pipeline.gif()
      : pipeline.webp({ quality: 82 })
    : pipeline.webp({ quality: 82 });

  const procesado = await pipeline.toBuffer();
  await writeFile(path.join(carpeta, nombre), procesado);

  /*
   * Miniatura: siempre WebP fijo, incluso para un GIF. Una lista de chat
   * con seis GIFs animados a tamaño completo descargándose a la vez es
   * justo lo que hace que el móvil de alguien vaya a tirones; el animado
   * se carga al abrirlo.
   */
  const nombreMini = `${base}-mini.webp`;
  const mini = await sharp(datos, { limitInputPixels: MAX_PIXELES })
    .rotate()
    .resize({ width: LADO_MINIATURA, height: LADO_MINIATURA, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();
  await writeFile(path.join(carpeta, nombreMini), mini);

  const relativa = carpeta.replace(env.UPLOAD_DIR, '').replace(/^\//, '');

  return {
    url: `/uploads/${relativa}/${nombre}`,
    miniaturaUrl: `/uploads/${relativa}/${nombreMini}`,
    mime: salidaMime,
    bytes: procesado.length,
    // Las dimensiones se leen del ORIGINAL y se ajustan al redimensionado:
    // sirven para reservar el hueco en el layout antes de que la imagen
    // cargue, y así la lista no da el salto clásico al aparecer cada foto.
    ancho: meta.width ? Math.min(meta.width, LADO_MAX) : null,
    alto: meta.height ? Math.min(meta.height, LADO_MAX) : null,
    hashSha256: createHash('sha256').update(procesado).digest('hex'),
  };
}

/**
 * Guarda un archivo que no es imagen (video o audio) tal cual.
 *
 * No se recomprime: transcodificar video exige ffmpeg y minutos de CPU por
 * clip, lo que convertiría cada subida en una operación bloqueante. La
 * seguridad aquí no viene de reescribir el contenido sino de cómo se
 * sirve: nginx lo entrega con `Content-Disposition: attachment`,
 * `X-Content-Type-Options: nosniff` y una CSP de `script-src 'none'` +
 * `sandbox`, así que aunque el archivo escondiera HTML, el navegador no lo
 * ejecutaría como documento.
 */
async function guardarTalCual(
  datos: Buffer,
  mime: string,
  base: string,
  carpeta: string
): Promise<ArchivoProcesado> {
  const nombre = `${base}.${extensionDe(mime)}`;
  await writeFile(path.join(carpeta, nombre), datos);

  const relativa = carpeta.replace(env.UPLOAD_DIR, '').replace(/^\//, '');

  return {
    url: `/uploads/${relativa}/${nombre}`,
    miniaturaUrl: null,
    mime,
    bytes: datos.length,
    ancho: null,
    alto: null,
    hashSha256: createHash('sha256').update(datos).digest('hex'),
  };
}

// ─────────────────────────────────────────────────────────────────────
//  API pública
// ─────────────────────────────────────────────────────────────────────

/**
 * Valida, procesa y registra un archivo subido.
 *
 * Devuelve la fila de `Archivo` ya creada, todavía **sin dueño**: el
 * `mensajeId` o `publicacionId` se rellena después, cuando se crea el
 * mensaje o la publicación que lo lleva. Los que nunca lleguen a atarse a
 * nada quedan huérfanos y los barre `limpiarHuerfanos`.
 *
 * El orden importa: primero se comprueba la cuota, luego el tipo real, y
 * solo al final se escribe en disco. Al revés, un archivo rechazado ya
 * habría gastado espacio.
 */
export async function guardarArchivo(opciones: {
  userId: string;
  datos: Buffer;
  uso: UsoArchivo;
}) {
  const { userId, datos, uso } = opciones;

  if (datos.length === 0) throw errores.invalido('El archivo está vacío.');
  if (datos.length > MAX_BYTES) {
    throw errores.invalido(`El archivo supera el límite de ${Math.floor(MAX_BYTES / 1024 / 1024)} MB.`);
  }

  // ── Cuota ──
  const { _sum } = await prisma.archivo.aggregate({
    where: { userId, externo: false },
    _sum: { bytes: true },
  });
  if ((_sum.bytes ?? 0) + datos.length > CUOTA_BYTES) {
    throw errores.invalido('Alcanzaste el límite de almacenamiento de tu cuenta.');
  }

  /*
   * El tipo REAL, leído de los magic bytes del contenido. Un archivo cuyo
   * tipo no se puede determinar se rechaza en vez de asumir uno: "no sé
   * qué es esto" nunca debe resolverse optimistamente cuando lo que sigue
   * es guardarlo y servirlo a terceros.
   */
  const fileTypeFromBuffer = await detectorDeTipo();
  const detectado = await fileTypeFromBuffer(datos);
  if (!detectado || !MIMES_PERMITIDOS.has(detectado.mime)) {
    throw errores.invalido('Ese tipo de archivo no se admite. Sube una imagen, un video o un audio.');
  }

  const mime = detectado.mime;

  // El audio de fondo del perfil y los iconos tienen su propia forma; el
  // resto acepta cualquier tipo permitido.
  if (uso === 'icono-grupo' && !IMAGENES.has(mime)) {
    throw errores.invalido('El icono de un grupo tiene que ser una imagen.');
  }
  if (uso === 'audio-perfil' && !AUDIOS.has(mime)) {
    throw errores.invalido('El audio de perfil tiene que ser un archivo de audio.');
  }

  const carpeta = path.join(env.UPLOAD_DIR, carpetaDelMes());
  await mkdir(carpeta, { recursive: true });

  // Nombre generado, nunca el del usuario (ver `extensionDe`).
  const base = randomUUID();

  let procesado: ArchivoProcesado;
  try {
    procesado = IMAGENES.has(mime)
      ? await procesarImagen(datos, mime, base, carpeta)
      : await guardarTalCual(datos, mime, base, carpeta);
  } catch (error) {
    /*
     * Si sharp falla, el archivo era inválido por dentro aunque sus magic
     * bytes dijeran otra cosa — un PNG truncado, o una bomba de
     * descompresión que chocó con `limitInputPixels`. Se responde 400 y no
     * 500: el problema es del archivo que mandaron, no del servidor.
     */
    logger.warn({ error, mime, userId }, 'No se pudo procesar el archivo subido');
    throw errores.invalido('No se pudo procesar el archivo. ¿Está completo y no está dañado?');
  }

  return prisma.archivo.create({
    data: {
      userId,
      url: procesado.url,
      miniaturaUrl: procesado.miniaturaUrl,
      mime: procesado.mime,
      bytes: procesado.bytes,
      ancho: procesado.ancho,
      alto: procesado.alto,
      hashSha256: procesado.hashSha256,
      uso,
      externo: false,
    },
  });
}

/**
 * Registra un GIF de un proveedor externo (Giphy).
 *
 * No se rehospeda: se guarda solo la URL, con `externo: true`. Copiar a
 * nuestro disco los GIFs de todo el mundo multiplicaría el almacenamiento
 * sin aportar nada — el proveedor ya los sirve desde su CDN, y su host está
 * en `img-src` de la CSP.
 *
 * Por eso mismo la URL **no puede venir del cliente sin filtrar**: si se
 * aceptara cualquier URL, alguien pondría la de un servidor suyo y cada
 * persona que abriera el chat le revelaría su IP y su user-agent. Solo se
 * admiten hosts del proveedor.
 */
const HOSTS_GIF = new Set([
  'media.giphy.com',
  'media0.giphy.com',
  'media1.giphy.com',
  'media2.giphy.com',
  'media3.giphy.com',
  'media4.giphy.com',
  'i.giphy.com',
]);

export async function registrarGifExterno(opciones: {
  userId: string;
  url: string;
  miniaturaUrl?: string;
  ancho?: number;
  alto?: number;
}) {
  const { userId, url, miniaturaUrl } = opciones;

  let parseada: URL;
  try {
    parseada = new URL(url);
  } catch {
    throw errores.invalido('La URL del GIF no es válida.');
  }

  if (parseada.protocol !== 'https:' || !HOSTS_GIF.has(parseada.hostname)) {
    throw errores.invalido('Solo se admiten GIFs del buscador integrado.');
  }

  // La miniatura, si viene, tiene que pasar el mismo filtro: si no, sería
  // el hueco por donde colar la URL arbitraria que el campo principal ya
  // rechaza.
  if (miniaturaUrl) {
    try {
      const mini = new URL(miniaturaUrl);
      if (mini.protocol !== 'https:' || !HOSTS_GIF.has(mini.hostname)) {
        throw errores.invalido('Solo se admiten GIFs del buscador integrado.');
      }
    } catch {
      throw errores.invalido('La URL del GIF no es válida.');
    }
  }

  return prisma.archivo.create({
    data: {
      userId,
      url: parseada.toString(),
      miniaturaUrl: miniaturaUrl ?? null,
      mime: 'image/gif',
      // No se descarga, así que no se sabe cuánto pesa. Cero es honesto y
      // además hace que los GIFs externos no consuman la cuota de disco,
      // que es lo correcto: no ocupan disco nuestro.
      bytes: 0,
      ancho: opciones.ancho ?? null,
      alto: opciones.alto ?? null,
      uso: 'adjunto',
      externo: true,
    },
  });
}

/**
 * Comprueba que unos archivos son del usuario y están libres, y los ata a
 * su mensaje o publicación.
 *
 * **La comprobación de propiedad es el punto entero.** Sin ella, alguien
 * podría mandar en su publicación el id de un archivo ajeno y adjuntar a su
 * nombre la imagen privada de otro. Y `mensajeId`/`publicacionId` nulos
 * garantiza que un archivo no se pueda reasignar de un mensaje ya enviado a
 * otro sitio.
 */
export async function atarArchivos(
  userId: string,
  ids: string[],
  destino: { mensajeId: string } | { publicacionId: string }
): Promise<void> {
  if (ids.length === 0) return;

  const { count } = await prisma.archivo.updateMany({
    where: {
      id: { in: ids },
      userId,
      mensajeId: null,
      publicacionId: null,
    },
    data: destino,
  });

  if (count !== ids.length) {
    throw errores.invalido('Alguno de los archivos no existe o ya se usó en otra parte.');
  }
}

/**
 * Valida que unos ids de adjunto son utilizables ANTES de crear el mensaje
 * o la publicación que los llevará.
 *
 * Existe para no dejar a medias: si se creara primero el mensaje y el atado
 * fallara después, quedaría un mensaje vacío publicado. Comprobar antes
 * permite rechazar la petición entera sin haber escrito nada.
 */
export async function validarAdjuntos(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  if (ids.length > MAX_ADJUNTOS) {
    throw errores.invalido(`Máximo ${MAX_ADJUNTOS} archivos.`);
  }

  const encontrados = await prisma.archivo.count({
    where: { id: { in: ids }, userId, mensajeId: null, publicacionId: null },
  });

  if (encontrados !== ids.length) {
    throw errores.invalido('Alguno de los archivos no existe o ya se usó en otra parte.');
  }
}

/** Los campos de un adjunto que se mandan al cliente. */
export const SELECT_ADJUNTO = {
  id: true,
  url: true,
  miniaturaUrl: true,
  mime: true,
  bytes: true,
  ancho: true,
  alto: true,
  externo: true,
} as const;

/**
 * Borra los archivos que se subieron pero nunca se ataron a nada.
 *
 * Pasa de forma natural: alguien adjunta una foto, se arrepiente y cierra
 * la pestaña sin enviar el mensaje. Sin este barrido esos archivos se
 * quedan en disco para siempre, ocupando cuota de una cuenta que ya no los
 * ve por ninguna parte.
 *
 * El margen de 24 h es lo que evita borrar un archivo recién subido que
 * todavía está esperando a que su autor pulse "enviar".
 */
export async function limpiarHuerfanos(): Promise<number> {
  const limite = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const huerfanos = await prisma.archivo.findMany({
    where: {
      mensajeId: null,
      publicacionId: null,
      externo: false,
      createdAt: { lt: limite },
      // Los avatares, banners y el audio de perfil no cuelgan de un mensaje
      // ni de una publicación: su dueño es el propio perfil, así que un
      // `mensajeId` nulo en ellos es lo normal y no significa "huérfano".
      uso: { in: ['adjunto', 'publicacion'] },
    },
    select: { id: true, url: true, miniaturaUrl: true },
    take: 500,
  });

  if (huerfanos.length === 0) return 0;

  for (const archivo of huerfanos) {
    for (const url of [archivo.url, archivo.miniaturaUrl]) {
      if (!url) continue;
      try {
        // La URL guardada es `/uploads/<relativa>`; en disco cuelga de
        // UPLOAD_DIR. Se reconstruye desde nuestra propia URL, que no
        // contiene nada escrito por el usuario.
        await unlink(path.join(env.UPLOAD_DIR, url.replace(/^\/uploads\//, '')));
      } catch (error) {
        // Que el archivo ya no esté en disco no es un problema: el
        // objetivo era que dejara de existir.
        logger.debug({ error, url }, 'No se pudo borrar un archivo huérfano');
      }
    }
  }

  const { count } = await prisma.archivo.deleteMany({
    where: { id: { in: huerfanos.map((a) => a.id) } },
  });

  return count;
}
