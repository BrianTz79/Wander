-- Fase 7: social (seguir, publicaciones, comentarios, reacciones, feed).
--
-- Las tablas ya existían desde la migración inicial. Esta migración añade
-- dos cosas que la Fase 7 sí necesita:
--
--   1. El campo `idioma` en el contenido escrito por gente.
--   2. Los índices ÚNICOS PARCIALES de `Reaccion`, que el esquema daba por
--      hechos y que en realidad no existían.

-- ── 1. Idioma del contenido ──────────────────────────────────────────
--
-- Nullable y sin DEFAULT a propósito. Un default ('es') sería una MENTIRA
-- sobre las filas que ya existan: diría que están en español sin que nadie
-- lo haya comprobado. Nulo significa "no se sabe", que es la verdad.
--
-- Se rellena al escribir, desde el primer día, aunque hoy nada lo lea: la
-- traducción de contenido está aplazada hasta nuevo aviso (PROYECTO.md §8),
-- pero esta columna es la única parte de aquel diseño que NO se puede
-- añadir después — el idioma de un texto viejo ya no se le puede preguntar
-- a quien lo escribió.
ALTER TABLE "Publicacion" ADD COLUMN "idioma" TEXT;
ALTER TABLE "Comentario"  ADD COLUMN "idioma" TEXT;
-- `Mensaje` se incluye aunque la mensajería sea la Fase 8: la tabla está
-- vacía hoy, así que añadir la columna ahora es gratis y evita exactamente
-- el problema que se acaba de describir cuando llegue la fase.
ALTER TABLE "Mensaje"     ADD COLUMN "idioma" TEXT;

-- ── 2. Unicidad real de las reacciones ───────────────────────────────
--
-- El esquema decía "los índices parciales de Postgres se añaden en la
-- migración", pero la migración inicial nunca los añadió: creó dos índices
-- únicos normales sobre columnas que pueden ser NULL.
--
-- En Postgres, dos NULL nunca son iguales, así que
-- UNIQUE("userId","publicacionId","tipo") NO impide dos filas con
-- publicacionId NULL: un mismo usuario podía dar "me gusta" al mismo PERFIL
-- tantas veces como quisiera, inflando el contador sin límite. Lo mismo al
-- revés con las publicaciones.
--
-- La corrección es un índice único PARCIAL por cada caso, que solo cubre
-- las filas donde la columna en cuestión no es nula.
DROP INDEX IF EXISTS "Reaccion_userId_perfilUserId_tipo_key";
DROP INDEX IF EXISTS "Reaccion_userId_publicacionId_tipo_key";

-- Por si ya se hubieran colado duplicados con los índices rotos: deja la
-- fila más antigua de cada grupo y borra el resto. Sin esto, la creación
-- del índice único fallaría y la migración se quedaría a medias.
DELETE FROM "Reaccion" a
  USING "Reaccion" b
 WHERE a."perfilUserId" IS NOT NULL
   AND a."userId" = b."userId"
   AND a."perfilUserId" = b."perfilUserId"
   AND a."tipo" = b."tipo"
   AND a."createdAt" > b."createdAt";

DELETE FROM "Reaccion" a
  USING "Reaccion" b
 WHERE a."publicacionId" IS NOT NULL
   AND a."userId" = b."userId"
   AND a."publicacionId" = b."publicacionId"
   AND a."tipo" = b."tipo"
   AND a."createdAt" > b."createdAt";

CREATE UNIQUE INDEX "Reaccion_userId_perfilUserId_tipo_key"
    ON "Reaccion"("userId", "perfilUserId", "tipo")
 WHERE "perfilUserId" IS NOT NULL;

CREATE UNIQUE INDEX "Reaccion_userId_publicacionId_tipo_key"
    ON "Reaccion"("userId", "publicacionId", "tipo")
 WHERE "publicacionId" IS NOT NULL;

-- ── 3. Índices que la Fase 7 estrena de verdad ───────────────────────
--
-- El feed pide "las publicaciones de la gente a la que sigo, más nuevas
-- primero, sin las borradas". El índice de la migración inicial es
-- ("autorId","createdAt") y no sabe nada de `borradoEn`, así que Postgres
-- tenía que leer y descartar las borradas una por una.
--
-- Este índice parcial solo contiene las publicaciones vivas, que son las
-- únicas que el feed mira nunca.
CREATE INDEX "Publicacion_vivas_autor_idx"
    ON "Publicacion"("autorId", "createdAt" DESC)
 WHERE "borradoEn" IS NULL;

CREATE INDEX "Publicacion_vivas_idx"
    ON "Publicacion"("createdAt" DESC)
 WHERE "borradoEn" IS NULL;

-- Mismo razonamiento para los hilos de comentarios de una publicación.
CREATE INDEX "Comentario_vivos_publicacion_idx"
    ON "Comentario"("publicacionId", "createdAt")
 WHERE "borradoEn" IS NULL;

-- ── 4. Búsqueda de /explorar ─────────────────────────────────────────
--
-- `pg_trgm` permite que un ILIKE '%texto%' use índice. Sin él, buscar gente
-- es un recorrido completo de la tabla de usuarios, que es justo lo que se
-- vuelve caro cuando la plataforma crezca.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "User_handle_trgm_idx"      ON "User" USING GIN ("handle" gin_trgm_ops);
CREATE INDEX "User_displayName_trgm_idx" ON "User" USING GIN ("displayName" gin_trgm_ops);
