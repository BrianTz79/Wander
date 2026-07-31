import multer from 'multer';

import { MAX_ADJUNTOS, MAX_BYTES } from '../services/archivos.service';

/**
 * Recepción de archivos subidos (Fase 8).
 *
 * **`memoryStorage` y no `diskStorage`, a propósito.** Guardar en disco
 * primero significaría escribir el archivo del usuario tal cual antes de
 * saber siquiera qué es; a partir de ahí, cualquier fallo en la validación
 * deja basura en el sistema de ficheros, y hay una ventana en la que un
 * archivo sin verificar existe en una ruta del servidor. Con el buffer en
 * memoria, lo único que llega al disco es lo que ya pasó por la detección
 * de tipo real y por la reescritura de sharp.
 *
 * El precio es tener el archivo en RAM, y por eso el límite de tamaño de
 * multer es la pieza que hace esto seguro: son 8 MB por archivo y 4
 * archivos como mucho, así que el techo por petición está acotado.
 *
 * **No hay `fileFilter` por MIME.** Sería teatro: el `Content-Type` de una
 * parte multipart lo escribe quien sube, así que filtrar por él solo frena
 * a quien no lo intenta. El filtro de verdad son los magic bytes, y ese
 * vive en `archivos.service.ts` sobre el contenido ya recibido.
 */
export const subida = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_BYTES,
    files: MAX_ADJUNTOS,
    // Sin este tope, un multipart con cien mil campos vacíos consume CPU
    // en el parseo sin superar ningún límite de tamaño.
    fields: 10,
    // El nombre de archivo no se usa para nada (ver `extensionDe`), pero
    // multer igualmente lo parsea: acotarlo evita gastar memoria en él.
    fieldNameSize: 100,
  },
});
