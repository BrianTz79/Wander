/**
 * Configuración de la CLI de Prisma para la imagen de PRODUCCIÓN.
 *
 * En desarrollo se usa `prisma.config.ts`, pero la imagen final no lleva
 * `tsx` ni TypeScript (se instala con `npm ci --omit=dev`), así que la CLI
 * no podría leer un config `.ts`. Sin este archivo, el `prisma migrate
 * deploy` del arranque falla con:
 *
 *   Error: The datasource.url property is required in your Prisma config
 *   file when using prisma migrate deploy.
 *
 * y el contenedor entra en bucle de reinicio.
 *
 * El Dockerfile lo copia como `prisma.config.js`. Mantener ambos en
 * sintonía: si cambia la ruta del esquema o de las migraciones, hay que
 * tocar los dos.
 */
const { defineConfig } = require('prisma/config');

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
