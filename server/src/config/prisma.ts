import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from './env';

/**
 * Cliente único de Prisma. En desarrollo se guarda en `globalThis` para
 * que el hot-reload de tsx no abra una conexión nueva en cada recarga
 * (acaba agotando el pool de Postgres).
 *
 * Prisma 7 ya no lleva motor binario propio: exige un *driver adapter*
 * explícito. Sin él, el constructor lanza
 * `PrismaClientConstructorValidationError` al arrancar.
 */

const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adaptador = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma =
  globalParaPrisma.prisma ??
  new PrismaClient({
    adapter: adaptador,
    // En producción solo errores y avisos: loguear cada query llena el
    // disco y puede filtrar datos de usuarios a los logs.
    log: env.esProduccion ? ['error', 'warn'] : ['error', 'warn', 'query'],
  });

if (!env.esProduccion) globalParaPrisma.prisma = prisma;

/**
 * Espera a que Postgres acepte conexiones. El healthcheck del compose ya
 * lo garantiza, pero en un reinicio de la DB el backend sigue vivo y esto
 * evita que la primera petición falle.
 */
export async function esperarDb(intentos = 15, esperaMs = 2000): Promise<void> {
  for (let i = 1; i <= intentos; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (error) {
      if (i === intentos) throw error;
      console.warn(`Base de datos no lista (intento ${i}/${intentos}), reintentando…`);
      await new Promise((r) => setTimeout(r, esperaMs));
    }
  }
}
