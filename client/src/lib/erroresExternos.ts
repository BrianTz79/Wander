import type { TFunction } from 'i18next';

/**
 * Códigos de error que pueden volver en la query tras un flujo externo
 * (Steam por OpenID, Discord y Google por OAuth).
 *
 * **La lista blanca es el punto entero de este módulo.** Lo que llega en
 * la URL es texto que controla quien pone el enlace, así que solo se
 * traduce si coincide exactamente con un código conocido; cualquier otra
 * cosa cae en el mensaje genérico. Pintar en pantalla la cadena que venga
 * en `?error=` sería un XSS reflejado servido en bandeja.
 *
 * Los códigos son cortos y estables por la misma razón por la que el
 * callback no manda prosa: es una redirección del navegador, y el servidor
 * no sabe en qué idioma lee quien la va a recibir. El texto se elige aquí,
 * donde sí se sabe.
 */
const CODIGOS = [
  'steam',
  'suspendido',
  'proveedor',
  'state',
  'sin-codigo',
  'creacion',
  'sesion',
  // El caso importante: ya existe una cuenta con ese correo. NO se unen
  // automáticamente (eso permitiría apropiarse de una cuenta ajena con
  // solo controlar el correo), así que el texto explica qué hacer.
  'correo-en-uso',
  'ya-vinculada',
  'no-configurado',
] as const;

type CodigoExterno = (typeof CODIGOS)[number];

function esCodigoConocido(valor: string): valor is CodigoExterno {
  return (CODIGOS as readonly string[]).includes(valor);
}

/**
 * Traduce un código de la query. Devuelve cadena vacía si no había
 * ninguno, para que quien llama pueda usarlo directamente como condición.
 */
export function textoErrorExterno(codigo: string | null | undefined, t: TFunction): string {
  if (!codigo) return '';
  return esCodigoConocido(codigo)
    ? t(`erroresExternos.${codigo}`)
    : t('erroresExternos.generico');
}
