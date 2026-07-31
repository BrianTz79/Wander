/**
 * Texto escrito por gente: limpieza y detección de idioma (Fase 7).
 *
 * Todo lo que un usuario escribe y otro va a leer —publicaciones y
 * comentarios— pasa por aquí antes de tocar la base de datos.
 */

// ─────────────────────────────────────────────────────────────────────
//  Limpieza
// ─────────────────────────────────────────────────────────────────────

/**
 * Normaliza el texto de una publicación o comentario.
 *
 * **Esto NO es la defensa contra XSS.** La defensa es que el cliente pinta
 * el texto como texto (`{texto}` en JSX, nunca `dangerouslySetInnerHTML`),
 * así que un `<script>` guardado tal cual se vería literalmente como
 * `<script>` y no se ejecutaría. Guardar el texto SIN tocar es además lo
 * correcto: si alguien escribe `if (a < b && c > d)` en una publicación
 * sobre código, eso es lo que quiso escribir, y "sanitizarlo" a
 * `if (a  d)` sería corromper su mensaje.
 *
 * Lo que sí se hace es lo que arregla problemas reales de presentación:
 *
 *  - Quitar los caracteres de control invisibles, incluidos los de
 *    dirección bidireccional (U+202A–U+202E, U+2066–U+2069). Esos son el
 *    truco del "Trojan Source": permiten que un texto se RENDERICE en un
 *    orden distinto al que tiene guardado, así que quien lee ve algo que
 *    no es lo que hay. No hay ningún uso legítimo de ellos en una
 *    publicación de una plataforma de gamers.
 *  - Colapsar los saltos de línea seguidos. Sin esto, doscientos
 *    `Enter` estiran el feed de todo el mundo.
 */
export function limpiarTexto(entrada: string): string {
  return (
    entrada
      // Normalización Unicode: dos textos que se ven idénticos pasan a
      // guardarse idénticos.
      .normalize('NFC')
      // Windows manda \r\n: se iguala a \n ANTES de barrer los controles.
      // El barrido se llevaría el \r por delante de todos modos, pero así
      // "a\r\nb" queda como "a\nb" por decisión y no por accidente.
      .replace(/\r\n?/g, '\n')
      // Controles C0/C1 salvo el salto de línea (\n = U+000A), más los
      // marcadores bidi (U+200E-U+200F, U+202A-U+202E, U+2066-U+2069), el
      // espacio de ancho cero (U+200B) y el BOM (U+FEFF).
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
      // Máximo dos saltos seguidos: deja separar párrafos, no estirar.
      .replace(/\n{3,}/g, '\n\n')
      // Espacios y tabulaciones al final de cada línea.
      .replace(/[ \t]+$/gm, '')
      .trim()
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Detección de idioma
// ─────────────────────────────────────────────────────────────────────

/**
 * En qué idioma está escrito un texto.
 *
 * **Por qué está escrito a mano y no con una librería:** la única pregunta
 * que Wander necesita responder es «¿español o inglés?», que son los dos
 * idiomas de la plataforma. Una librería de detección trae modelos de 50+
 * idiomas y varios megabytes para contestar una pregunta binaria.
 *
 * **Y por qué se guarda si no se usa todavía:** la traducción de contenido
 * está aplazada hasta nuevo aviso (PROYECTO.md §8) — hoy nadie lee este
 * campo. Se rellena igualmente porque es la única pieza de aquel diseño que
 * no se puede añadir después: el idioma de un texto viejo ya no se le puede
 * preguntar a quien lo escribió. La columna es nullable y `null` significa
 * «no se sabe», no «español».
 *
 * El método son palabras funcionales (artículos, preposiciones,
 * conjunciones), que es lo que de verdad distingue un idioma de otro: son
 * las más frecuentes y las que no se toman prestadas entre lenguas. Los
 * sustantivos no sirven — "gaming", "loot" y "clutch" aparecen igual en
 * ambos.
 */

const PALABRAS_ES = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'en', 'con', 'por', 'para', 'sin', 'sobre', 'desde', 'hasta',
  'que', 'porque', 'pero', 'aunque', 'como', 'cuando', 'donde',
  'y', 'o', 'ni', 'si', 'no',
  'me', 'te', 'se', 'nos', 'le', 'les', 'lo', 'mi', 'tu', 'su', 'sus',
  'yo', 'tú', 'él', 'ella', 'ellos', 'nosotros', 'ustedes',
  'es', 'era', 'fue', 'son', 'está', 'están', 'estoy', 'ser', 'estar',
  'hay', 'tiene', 'tengo', 'hacer', 'muy', 'más', 'menos', 'ya', 'también',
  'esto', 'esta', 'este', 'eso', 'ese', 'esa', 'todo', 'toda', 'nada',
  'bien', 'mal', 'ahora', 'siempre', 'nunca', 'después', 'antes',
]);

const PALABRAS_EN = new Set([
  'the', 'a', 'an',
  'of', 'in', 'on', 'at', 'with', 'by', 'for', 'from', 'to', 'into', 'about',
  'that', 'this', 'these', 'those', 'which', 'because', 'but', 'though',
  'and', 'or', 'nor', 'if', 'not',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'them',
  'my', 'your', 'his', 'its', 'our', 'their',
  'is', 'was', 'were', 'are', 'am', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could',
  'very', 'more', 'less', 'just', 'also', 'still', 'already',
  'all', 'nothing', 'good', 'bad', 'now', 'always', 'never', 'after', 'before',
]);

/**
 * Caracteres que solo existen en español de los dos idiomas. Valen como
 * pista fuerte: nadie escribe «ñ» ni «¿» en inglés por accidente.
 */
const SENALES_ES = /[ñáéíóúü¿¡]/i;

/**
 * Mínimo de palabras para arriesgar una respuesta. Con menos, cualquier
 * conclusión es una moneda al aire: "gg" y "ez" no están en ningún idioma,
 * y "no" está en los dos.
 */
const MIN_PALABRAS = 4;

export function detectarIdioma(texto: string): 'es' | 'en' | null {
  // Se quitan antes las cosas que no son de ningún idioma y que además
  // salen mucho en una plataforma de juegos: URLs, menciones y emoji.
  const limpio = texto
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[@#]\S+/g, ' ')
    // Deja letras (con acentos), y convierte todo lo demás en separador.
    .replace(/[^\p{L}\s]+/gu, ' ');

  const palabras = limpio.split(/\s+/).filter(Boolean);
  if (palabras.length < MIN_PALABRAS) return null;

  let es = 0;
  let en = 0;
  for (const palabra of palabras) {
    if (PALABRAS_ES.has(palabra)) es++;
    if (PALABRAS_EN.has(palabra)) en++;
  }

  // Los caracteres exclusivos del español pesan como dos palabras: son más
  // fiables que una palabra suelta, que puede ser un préstamo.
  if (SENALES_ES.test(texto)) es += 2;

  // Empate o dos textos igual de plausibles: mejor `null` que inventar.
  // `null` es un estado previsto (significa "no se sabe"), y quien lo lea
  // simplemente no ofrecerá nada basado en el idioma.
  if (es === en) return null;
  // Exigir al menos una coincidencia evita que un texto de puros
  // sustantivos ("Elden Ring Nightreign duo queue") acabe etiquetado por
  // un solo acierto accidental.
  if (Math.max(es, en) === 0) return null;

  return es > en ? 'es' : 'en';
}
