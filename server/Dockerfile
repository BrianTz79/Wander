# ─────────────────────────────────────────────────────────────────────
#  Wander — backend (Express + Prisma + socket.io)
# ─────────────────────────────────────────────────────────────────────

# ── Etapa 1: dependencias + build ────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Copiar solo los manifiestos primero: si no cambian, Docker reutiliza la
# capa de npm ci aunque cambie el código.
COPY package*.json ./
RUN npm ci

# El cliente de Prisma se genera desde el esquema, así que hay que
# copiarlo antes de compilar. Desde Prisma 7 la CLI lee la URL de
# `prisma.config.ts`, no del esquema, así que ese archivo también hace
# falta o `generate` y `migrate deploy` fallan.
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Reinstalar solo dependencias de producción para la imagen final.
RUN npm ci --omit=dev && npx prisma generate


# ── Etapa 2: runtime ─────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# `wget` para el healthcheck; el resto de la imagen se queda mínima.
# `dumb-init` reenvía las señales correctamente para que Node reciba
# SIGTERM y cierre las conexiones de forma ordenada.
RUN apk add --no-cache dumb-init wget

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package*.json ./

# La CLI de Prisma necesita su config para el `migrate deploy` del
# arranque. Aquí no hay `tsx` (la imagen final se instala con
# `--omit=dev`), así que se usa la variante en JS plano en vez del
# `prisma.config.ts` de desarrollo.
COPY prisma.config.prod.js ./prisma.config.js

# Directorio de subidas. El bind-mount del compose lo sobreescribe, pero
# tiene que existir con los permisos correctos si se corre sin volumen.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

# Correr como usuario sin privilegios. Si alguien logra ejecución de
# código, no es root dentro del contenedor.
USER node

EXPOSE 4000

# `migrate deploy` aplica migraciones ya generadas (nunca genera nuevas ni
# borra datos, al contrario que `db push`). Si falla, el contenedor no
# arranca — mejor eso que servir con un esquema desalineado.
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
