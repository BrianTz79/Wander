import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

/**
 * Caché de datos externos (Fase 5).
 *
 * La regla que ordena toda la fase: **el render de un perfil NUNCA llama a
 * Steam.** Un visitante que abre /u/mizllet lee de Postgres y punto. Si el
 * render dependiera de la API de Steam, cada visita costaría una llamada
 * externa (cuota), sumaría cientos de milisegundos, y un Steam caído
 * dejaría los perfiles rotos — un fallo del proveedor no puede tumbar la
 * página de alguien.
 *
 * De ahí `obtenerConCache`: se sirve lo guardado mientras esté fresco, se
 * refresca cuando caduca, y —lo importante— si el refresco falla se sigue
 * sirviendo el dato viejo. Datos de hace tres horas son infinitamente
 * mejores que un hueco.
 */

/** Resultado de una lectura cacheada. `estado` permite a la UI decir la
 *  verdad ("datos de hace 2 h") en vez de fingir que todo va bien. */
export interface ResultadoCache<T> {
  datos: T;
  obtenidoEn: Date;
  /** `fresco` = recién traído o dentro del TTL.
   *  `viejo`   = el TTL venció pero el proveedor falló; esto es lo guardado. */
  estado: 'fresco' | 'viejo';
}

interface OpcionesCache<T> {
  userId: string;
  proveedor: string;
  clave: string;
  /** Cuánto vale el dato antes de volver a pedirlo. */
  ttlMs: number;
  /** Trae el dato del proveedor. Debe lanzar si falla; nunca devolver
   *  datos a medias, porque lo que devuelva se guarda como bueno. */
  traer: () => Promise<T>;
  /** Si es `true`, se ignora el TTL y se refresca sí o sí (botón
   *  "sincronizar ahora"). El límite de tasa lo pone la ruta. */
  forzar?: boolean;
}

/**
 * Tras varios fallos seguidos se deja de reintentar en cada visita: si la
 * API key está revocada o el perfil se volvió privado, insistir en cada
 * petición solo gasta latencia y cuota. Con el tope alcanzado se sirve lo
 * que haya y se reintenta cuando expire el respiro.
 */
const MAX_INTENTOS_FALLO = 5;
const RESPIRO_TRAS_FALLOS_MS = 30 * 60_000;

/**
 * Lee de la caché, refrescando si hace falta.
 *
 * Devuelve `null` solo cuando no hay NADA que servir: ni caché previa ni
 * una llamada exitosa. Quien lo use debe tratar ese caso como "todavía no
 * hay datos", no como un error de servidor.
 */
export async function obtenerConCache<T>(opciones: OpcionesCache<T>): Promise<ResultadoCache<T> | null> {
  const { userId, proveedor, clave, ttlMs, traer, forzar = false } = opciones;

  const guardado = await prisma.cacheExterno.findUnique({
    where: { userId_proveedor_clave: { userId, proveedor, clave } },
  });

  const ahora = new Date();
  const vigente = guardado !== null && guardado.expiraEn > ahora;

  if (vigente && !forzar) {
    return {
      datos: guardado.datos as T,
      obtenidoEn: guardado.obtenidoEn,
      estado: 'fresco',
    };
  }

  // Circuit breaker: demasiados fallos seguidos y aún dentro del respiro.
  // Solo aplica si hay algo que servir — sin datos, se reintenta igual,
  // porque la alternativa es no mostrar nada nunca.
  if (
    guardado &&
    guardado.intentosFallo >= MAX_INTENTOS_FALLO &&
    !forzar &&
    ahora.getTime() - guardado.obtenidoEn.getTime() < RESPIRO_TRAS_FALLOS_MS
  ) {
    return { datos: guardado.datos as T, obtenidoEn: guardado.obtenidoEn, estado: 'viejo' };
  }

  try {
    const frescos = await traer();

    const fila = await prisma.cacheExterno.upsert({
      where: { userId_proveedor_clave: { userId, proveedor, clave } },
      create: {
        userId,
        proveedor,
        clave,
        datos: frescos as Prisma.InputJsonValue,
        obtenidoEn: ahora,
        expiraEn: new Date(ahora.getTime() + ttlMs),
      },
      update: {
        datos: frescos as Prisma.InputJsonValue,
        obtenidoEn: ahora,
        expiraEn: new Date(ahora.getTime() + ttlMs),
        // Un éxito borra el historial de fallos: el contador mide fallos
        // CONSECUTIVOS, no fallos totales.
        ultimoError: null,
        intentosFallo: 0,
      },
    });

    return { datos: fila.datos as T, obtenidoEn: fila.obtenidoEn, estado: 'fresco' };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    logger.warn({ userId, proveedor, clave, error: mensaje }, 'Fallo al refrescar caché externa');

    if (guardado) {
      // Se anota el fallo pero NO se toca `datos` ni `obtenidoEn`: lo
      // viejo sigue sirviendo y `obtenidoEn` debe seguir diciendo cuándo
      // se trajo de verdad, no cuándo fallamos al reintentar.
      await prisma.cacheExterno
        .update({
          where: { id: guardado.id },
          data: { ultimoError: mensaje.slice(0, 300), intentosFallo: { increment: 1 } },
        })
        .catch(() => undefined);

      return { datos: guardado.datos as T, obtenidoEn: guardado.obtenidoEn, estado: 'viejo' };
    }

    // Ni caché ni respuesta: no hay nada que enseñar.
    return null;
  }
}

/** Borra la caché de un proveedor para un usuario. Lo usa la
 *  desvinculación (Fase 6): desvincular tiene que borrar de verdad. */
export async function borrarCache(userId: string, proveedor: string): Promise<number> {
  const { count } = await prisma.cacheExterno.deleteMany({ where: { userId, proveedor } });
  return count;
}
