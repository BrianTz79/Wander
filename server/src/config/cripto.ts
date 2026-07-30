import crypto from 'node:crypto';
import { env } from './env';

/**
 * Utilidades criptográficas.
 *
 * Aquí vive todo lo que toca secretos, para que haya un solo lugar que
 * auditar. Reglas que se siguen en este archivo:
 *
 *  · Los tokens OAuth se cifran en reposo con AES-256-GCM (autenticado:
 *    detecta manipulación, no solo la impide).
 *  · Nada de comparaciones de strings con `===` sobre material secreto:
 *    se usa timingSafeEqual para no filtrar información por tiempo.
 *  · Las IPs se guardan hasheadas con sal, no en claro: sirven para
 *    detectar abuso sin ser un registro de ubicación de la gente.
 */

const CLAVE = Buffer.from(env.ENCRYPTION_KEY, 'hex');
const ALGORITMO = 'aes-256-gcm';
const LARGO_IV = 12; // 96 bits, el recomendado para GCM
const LARGO_TAG = 16;

/**
 * Cifra un texto (típicamente un access/refresh token de OAuth).
 * Formato de salida: base64( iv | tag | ciphertext ).
 */
export function cifrar(textoPlano: string): string {
  const iv = crypto.randomBytes(LARGO_IV);
  const cipher = crypto.createCipheriv(ALGORITMO, CLAVE, iv);
  const cifrado = Buffer.concat([cipher.update(textoPlano, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, cifrado]).toString('base64');
}

/**
 * Descifra lo que produjo `cifrar`. Lanza si el dato fue manipulado o si
 * la clave cambió — nunca devuelve basura silenciosamente.
 */
export function descifrar(empaquetado: string): string {
  const bufer = Buffer.from(empaquetado, 'base64');
  if (bufer.length < LARGO_IV + LARGO_TAG) {
    throw new Error('Dato cifrado con formato inválido.');
  }
  const iv = bufer.subarray(0, LARGO_IV);
  const tag = bufer.subarray(LARGO_IV, LARGO_IV + LARGO_TAG);
  const cifrado = bufer.subarray(LARGO_IV + LARGO_TAG);

  const decipher = crypto.createDecipheriv(ALGORITMO, CLAVE, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString('utf8');
}

/** Variante tolerante: devuelve null en vez de lanzar. Para lecturas
 *  masivas donde un registro corrupto no debe tumbar la petición. */
export function descifrarSeguro(empaquetado: string | null | undefined): string | null {
  if (!empaquetado) return null;
  try {
    return descifrar(empaquetado);
  } catch {
    return null;
  }
}

/**
 * Hash de un refresh token para guardarlo en la tabla `Sesion`.
 * SHA-256 basta: el token ya es aleatorio de 256 bits, así que no hay
 * nada que un atacante pueda "adivinar" — no se necesita KDF lenta.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Hash de IP con sal derivada del secreto del servidor. Permite comparar
 * "¿es la misma IP que antes?" y contar intentos por IP, sin guardar la
 * dirección real de nadie.
 */
export function hashIp(ip: string | undefined): string | null {
  if (!ip) return null;
  return crypto.createHmac('sha256', CLAVE).update(ip).digest('hex').slice(0, 32);
}

/** Token opaco aleatorio, url-safe. Para refresh tokens, verificación de
 *  correo, state de OAuth y reseteo de contraseña. */
export function tokenAleatorio(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Comparación en tiempo constante. Para verificar tokens de un solo uso
 *  (state de OAuth, tokens de verificación) sin filtrar por timing. */
export function comparacionSegura(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // timingSafeEqual exige la misma longitud; hasheamos para normalizarla
  // sin revelar cuál es la diferencia.
  const hashA = crypto.createHash('sha256').update(bufA).digest();
  const hashB = crypto.createHash('sha256').update(bufB).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/** SHA-256 del contenido de un archivo, en hex. Deduplica subidas y
 *  permite detectar material ya reportado. */
export function hashContenido(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
