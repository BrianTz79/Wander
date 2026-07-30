# Wander

**Tu identidad como jugador, en un solo enlace.**

https://wander.ourocore.net

Wander es una plataforma web donde cualquier jugador crea su **perfil de gamer** y lo
comparte: una especie de "LinkedIn de los videojuegos". En vez de experiencia laboral,
tu identidad como jugador — los juegos que juegas, tus horas, tus logros, tu setup y
tus perfiles en cada plataforma.

## ¿Qué la hace distinta?

- **Los datos se traen solos.** Vinculas Steam y tus juegos, horas y logros aparecen
  automáticamente. No es un "link en la bio" que hay que actualizar a mano.
- **Personalización real.** Bloques que añades, quitas y reordenas, control total del
  tema (colores, tipografía, bordes) y, más adelante, CSS propio para quien sepa.
- **Social de verdad.** Seguir jugadores, feed de actividad, comentarios y mensajería
  privada con grupos y adjuntos (en desarrollo).
- **Transparente con tus datos.** Cada vinculación dice exactamente qué se lee y qué
  se guarda, con permisos granulares y desvinculación que borra de verdad.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 · Vite 8 · TypeScript · Tailwind 4 · zustand |
| Backend | Express 5 · TypeScript · zod · argon2id · socket.io |
| Base de datos | PostgreSQL 17 · Prisma 7 |
| Infraestructura | Docker Compose · nginx · túnel de Cloudflare |

## Desarrollo

```bash
cp .env.example .env        # rellenar los secretos (openssl rand -hex 32)
docker compose up -d        # db + backend + frontend + túnel

# Migraciones y seed (manual, idempotente):
cd server
npx prisma migrate deploy
npm run seed
```

El frontend se construye para producción y lo sirve nginx; en desarrollo local,
`npm run dev` en `client/` (Vite con proxy a `localhost:4000`) y en `server/`.

## Estado

En desarrollo activo. La autenticación, el editor de perfil por bloques y los perfiles
públicos ya funcionan; las integraciones (Steam, Discord), el paquete social y la
mensajería están en camino. El documento maestro con la planeación completa, las
decisiones y el estado por fases está en [PROYECTO.md](PROYECTO.md).
