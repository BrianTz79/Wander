import { z } from 'zod';

/**
 * Validación de entrada para autenticación y registro.
 */

/**
 * Handles que nadie puede registrar. Dos motivos:
 *  1. Colisión con rutas de la app (/u/login sería ambiguo).
 *  2. Suplantación: "soporte" o "admin" se usan para estafar a otros.
 * La lista también se siembra en la tabla HandleReservado para poder
 * añadir más sin redeploy.
 */
export const HANDLES_RESERVADOS = new Set([
  'admin', 'administrador', 'administrator', 'root', 'sistema', 'system',
  'soporte', 'support', 'ayuda', 'help', 'staff', 'mod', 'moderador',
  'wander', 'oficial', 'official', 'equipo', 'team', 'seguridad', 'security',
  'api', 'app', 'www', 'mail', 'correo', 'ftp', 'cdn', 'static', 'assets',
  'login', 'logout', 'registro', 'register', 'signup', 'signin', 'auth',
  'oauth', 'callback', 'perfil', 'profile', 'u', 'usuario', 'user', 'users',
  'explorar', 'explore', 'buscar', 'search', 'feed', 'inicio', 'home',
  'mensajes', 'messages', 'chat', 'dm', 'configuracion', 'settings',
  'ajustes', 'privacidad', 'privacy', 'terminos', 'terms', 'legal',
  'acerca', 'about', 'contacto', 'contact', 'blog', 'docs', 'ayudanos',
  'null', 'undefined', 'true', 'false', 'me', 'yo', 'mio', 'mia', 'new', 'nuevo',
  'sitemap', 'robots', 'favicon', 'manifest', 'uploads', 'socket',
]);

/**
 * Handle: 3-24 caracteres, letras/números/guion/guion bajo.
 * · Debe empezar por letra o número (evita "_admin" imitando a admin).
 * · Sin dobles guiones ni terminar en separador.
 * · Se normaliza a minúsculas para que no existan "Mizllet" y "mizllet".
 */
export const handleSchema = z
  .string()
  .trim()
  .min(3, 'El nombre de usuario necesita al menos 3 caracteres.')
  .max(24, 'El nombre de usuario no puede pasar de 24 caracteres.')
  .regex(
    /^[a-zA-Z0-9](?:[a-zA-Z0-9_-]*[a-zA-Z0-9])?$/,
    'Solo letras, números, guion y guion bajo. Debe empezar y terminar con letra o número.'
  )
  .refine((v) => !/[-_]{2,}/.test(v), 'No puede tener dos guiones o guiones bajos seguidos.')
  .transform((v) => v.toLowerCase())
  .refine((v) => !HANDLES_RESERVADOS.has(v), 'Ese nombre de usuario está reservado.');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Ese correo no parece válido.')
  .max(254, 'El correo es demasiado largo.');

/**
 * Contraseña: mínimo 12 caracteres.
 *
 * Se prioriza la LONGITUD sobre las reglas de composición (una mayúscula,
 * un símbolo…). Las reglas de composición empujan a la gente a
 * "Password1!" — predecible — mientras que una frase larga es mucho más
 * fuerte y más fácil de recordar. Esto sigue la guía del NIST SP 800-63B.
 *
 * El máximo de 128 no es estético: argon2 sobre una entrada enorme es un
 * vector de DoS por CPU.
 */
export const passwordSchema = z
  .string()
  .min(12, 'La contraseña necesita al menos 12 caracteres. Una frase es más segura que un símbolo.')
  .max(128, 'La contraseña no puede pasar de 128 caracteres.')
  .refine((v) => v.trim().length >= 12, 'La contraseña no puede ser solo espacios.')
  .refine(
    (v) => !/^(.)\1+$/.test(v),
    'Esa contraseña es demasiado simple: no puede ser un solo carácter repetido.'
  );

export const registroSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  handle: handleSchema,
  displayName: z
    .string()
    .trim()
    .min(1, 'Escribe un nombre para mostrar.')
    .max(40, 'El nombre para mostrar no puede pasar de 40 caracteres.'),
  // Consentimiento explícito de términos y privacidad. Debe ser true.
  aceptaTerminos: z.literal(true, {
    error: 'Debes aceptar los términos y la política de privacidad para registrarte.',
  }),
});

export const loginSchema = z.object({
  // En login NO se valida el formato del correo más allá de que sea texto:
  // decirle "correo inválido" a quien se equivoca no aporta, y un schema
  // laxo evita revelar qué formatos existen en la base.
  email: z.string().trim().toLowerCase().min(1, 'Escribe tu correo.').max(254),
  password: z.string().min(1, 'Escribe tu contraseña.').max(128),
});

export const cambiarPasswordSchema = z.object({
  passwordActual: z.string().min(1, 'Escribe tu contraseña actual.').max(128),
  passwordNueva: passwordSchema,
});

/** Para quien se registró con Steam/Discord y luego quiere elegir handle. */
export const completarPerfilSchema = z.object({
  handle: handleSchema,
  displayName: z.string().trim().min(1).max(40),
  email: emailSchema.optional(),
  aceptaTerminos: z.literal(true, {
    error: 'Debes aceptar los términos y la política de privacidad.',
  }),
});

/**
 * Preferencias de interfaz (Fase 6.5).
 *
 * `z.enum` y no `z.string()`: el idioma acaba en `<html lang>` y algún día
 * en la elección de plantilla de correo, así que la lista cerrada es la
 * garantía de que ahí nunca llega nada que no sea un idioma que existe.
 * Los catálogos del cliente viven en `client/src/i18n/locales/`.
 */
export const preferenciasSchema = z
  .object({
    idioma: z.enum(['es', 'en'], { error: 'Ese idioma no está disponible.' }).optional(),
    /**
     * "Reproducir música en los perfiles" (Fase 11).
     *
     * Es de CUENTA y no del navegador porque gana sobre lo que decida cada
     * perfil visitado: quien lo apaga lo hace una vez y le sigue a todos
     * sus dispositivos. El volumen concreto sí vive en el navegador, que
     * es una preferencia del momento.
     */
    reproducirMusica: z.boolean().optional(),
    /**
     * "Aparecer en buscadores" (§13).
     *
     * El campo existía en el schema desde la migración inicial pero no lo
     * aplicaba nadie ni había forma de cambiarlo. Desde la Fase 10 se
     * respeta: apagarlo saca el perfil del `sitemap.xml` y le pone
     * `noindex` a su tarjeta. La tarjeta se sigue generando a propósito —
     * pegar tu enlace en un chat y que se vea bien no es lo mismo que
     * salir en Google.
     */
    permitirIndexado: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'No hay nada que actualizar.',
  });

export type RegistroInput = z.infer<typeof registroSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PreferenciasInput = z.infer<typeof preferenciasSchema>;
