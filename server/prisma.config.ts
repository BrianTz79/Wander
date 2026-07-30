import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Configuración de la CLI de Prisma.
 *
 * Desde Prisma 7 la URL de conexión no va en `schema.prisma`: se declara
 * aquí para las migraciones y la introspección. El cliente en runtime la
 * lee de DATABASE_URL igualmente, validada antes por `src/config/env.ts`.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
