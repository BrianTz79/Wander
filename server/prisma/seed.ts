import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { HANDLES_RESERVADOS } from '../src/schemas/auth.schema';

/**
 * Seed de la base de datos. Idempotente a propósito: se puede correr las
 * veces que haga falta sin duplicar nada (`skipDuplicates`).
 *
 * Siembra la tabla HandleReservado con la misma lista fija del código.
 * ¿Para qué, si el schema ya la valida? Porque la tabla permite AÑADIR
 * reservas sin redeploy (un nombre problemático que aparezca después),
 * y el registro comprueba ambas.
 */

const adaptador = new PrismaPg({ connectionString: process.env['DATABASE_URL'] ?? '' });
const prisma = new PrismaClient({ adapter: adaptador });

async function main(): Promise<void> {
  const { count } = await prisma.handleReservado.createMany({
    data: [...HANDLES_RESERVADOS].map((handle) => ({
      handle,
      motivo: 'lista base',
    })),
    skipDuplicates: true,
  });
  console.log(`HandleReservado: ${count} handles nuevos sembrados (${HANDLES_RESERVADOS.size} en la lista).`);
}

main()
  .catch((error) => {
    console.error('Fallo el seed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
