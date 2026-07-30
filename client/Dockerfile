# ─────────────────────────────────────────────────────────────────────
#  Wander — frontend (Vite → build estático servido por nginx)
#
#  Corrección deliberada sobre PaginaClips: allí el frontend corre Vite en
#  modo dev en producción con bind-mount. Aquí se construye el bundle y lo
#  sirve nginx, que es lo que corresponde.
# ─────────────────────────────────────────────────────────────────────

# ── Etapa 1: build ───────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Los manifiestos primero: si no cambian, la capa de npm ci se reutiliza
# aunque cambie el código.
COPY package*.json ./
RUN npm ci

# Vite congela las VITE_* dentro del bundle al construir, así que el valor
# tiene que estar presente en ESTA etapa, no en la de runtime.
# Nunca poner secretos aquí: acabarían en el JS que descarga cualquiera.
ARG VITE_PUBLIC_URL
ENV VITE_PUBLIC_URL=$VITE_PUBLIC_URL

COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src

# `npm run build` corre `tsc -b && vite build`: un error de tipos rompe la
# imagen en vez de colarse a producción.
RUN npm run build


# ── Etapa 2: runtime ─────────────────────────────────────────────────
FROM nginx:1.29-alpine AS runtime

# La configuración NO se copia: el compose la monta desde ./nginx.conf en
# modo solo lectura, para poder ajustar CSP o proxies sin reconstruir.
# Se borra la de por defecto para que no quede sirviendo el "Welcome".
RUN rm -f /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# nginx en primer plano: en segundo plano el contenedor terminaría al
# instante y Docker lo daría por caído.
CMD ["nginx", "-g", "daemon off;"]
