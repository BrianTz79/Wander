-- Fase 6.5: idioma de la interfaz por usuario.
--
-- El DEFAULT hace que las cuentas que ya existen queden en 'es' sin
-- necesidad de un UPDATE aparte: es el idioma en el que se registraron y
-- el único que había hasta ahora, así que es también la respuesta correcta
-- para ellas.
ALTER TABLE "User" ADD COLUMN "idioma" TEXT NOT NULL DEFAULT 'es';
