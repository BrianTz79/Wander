import postcss, { type ChildNode, type Container, type Declaration, type Rule } from 'postcss';

/**
 * Sanitización del CSS propio del perfil (Fase 9) — la parte delicada.
 *
 * El trato con el usuario es: escribe CSS de verdad, con toda la potencia
 * que eso implica, PERO solo puede afectar a su propio perfil y nunca
 * puede convertirse en un vector contra quien lo visita.
 *
 * El modelo de amenaza no es "CSS feo", son cuatro cosas concretas:
 *
 *  1. **Salirse de su perfil.** Un `.navbar { display: none }` rompería la
 *     interfaz de Wander para todo el que entre al perfil; un `body {}`
 *     tocaría la página entera. Se resuelve prefijando CADA selector con
 *     `#perfil-<id>`, que es el contenedor del perfil y nada más.
 *  2. **Tapar la interfaz.** `position: fixed` saca un elemento del flujo y
 *     lo pega a la ventana, fuera del contenedor: es clickjacking sobre la
 *     propia página (un div transparente encima del botón de "seguir").
 *     El prefijo del selector NO protege de esto, porque el problema no
 *     está en a QUIÉN aplica la regla sino en lo que la regla hace.
 *  3. **Filtrar a hosts externos.** Un `background: url(//evil.com/x.png)`
 *     convierte cada visita al perfil en un aviso a un tercero con la IP y
 *     el user-agent de quien mira. La CSP ya lo bloquearía en el navegador,
 *     pero la defensa no puede depender de una sola capa.
 *  4. **Ejecutar código.** `expression()`, `-moz-binding` y `behavior` son
 *     XSS por CSS en navegadores viejos. Están muertos, y aun así se
 *     filtran: cuestan una línea y su ausencia costaría una vulnerabilidad.
 *
 * Decisión de fondo: **lista blanca en las at-rules, lista negra en las
 * propiedades.** Una lista blanca de propiedades sería más segura pero
 * mataría la promesa de la fase (nadie quiere un CSS con 30 propiedades
 * permitidas); las at-rules, en cambio, son pocas y las peligrosas son
 * justo las que dan capacidades nuevas (`@import` trae CSS de fuera), así
 * que ahí sí se enumeran las buenas.
 *
 * Lo que se guarda en `Perfil.cssPropio` es la SALIDA de esta función, y es
 * lo único que se sirve al público. El original va a `cssOriginal` solo
 * para que el usuario pueda seguir editando lo que escribió, y no se
 * expone en ninguna respuesta pública.
 */

// ─────────────────────────────────────────────────────────────────────
//  Límites
// ─────────────────────────────────────────────────────────────────────

/** Tope de entrada (§6). 20 KB es muchísimo CSS a mano y es poco que
 *  parsear: el coste del parseo lo paga el servidor en cada guardado. */
export const MAX_CSS_BYTES = 20 * 1024;

/** Tope de reglas. Protege el render del visitante: un CSS válido de 20 KB
 *  puede tener miles de selectores y el navegador los evalúa todos. */
export const MAX_REGLAS = 400;

/** Profundidad máxima de anidamiento de at-rules (`@media` dentro de
 *  `@supports` dentro de…). Sin tope, un anidamiento absurdo es una forma
 *  barata de hacer trabajar al parser y al navegador. */
const MAX_PROFUNDIDAD = 5;

// ─────────────────────────────────────────────────────────────────────
//  Listas
// ─────────────────────────────────────────────────────────────────────

/**
 * Propiedades prohibidas del todo.
 *
 * `position` NO está aquí porque se filtra por VALOR más abajo: `relative`
 * y `absolute` son legítimos y muy usados dentro del propio perfil; los
 * que se van son `fixed` y `sticky`, que escapan del contenedor.
 */
const PROPIEDADES_PROHIBIDAS = new Set([
  // XSS por CSS en navegadores viejos.
  'behavior',
  '-ms-behavior',
  '-moz-binding',
  // `content: attr(...)` puede sacar a la vista atributos que el perfil no
  // pinta (§6). Se prohíbe la propiedad entera: el `content` decorativo se
  // puede escribir con texto literal, y aun así no vale la pena el riesgo
  // de razonar sobre `attr()` dentro de expresiones anidadas.
  'content',
]);

/**
 * At-rules permitidas. Todo lo demás se descarta, incluido `@import`
 * (traería CSS de un host externo, saltándose todo esto) y `@charset`.
 *
 * `@font-face` NO está: cargaría una fuente, y las únicas fuentes
 * alcanzables serían de un host externo — la misma fuga que `url()`.
 */
const AT_RULES_PERMITIDAS = new Set([
  'media',
  'supports',
  'keyframes',
  '-webkit-keyframes',
  'layer',
  'container',
]);

/**
 * At-rules cuyos hijos son fotogramas (`from`, `to`, `50%`), NO selectores.
 * Prefijarlos con `#perfil-<id>` los rompería: `#perfil-x from {}` no
 * casa con nada y la animación entera dejaría de existir.
 */
const AT_RULES_DE_FOTOGRAMAS = new Set(['keyframes', '-webkit-keyframes']);

/**
 * Funciones y palabras peligrosas en el VALOR de una declaración.
 *
 * `url()` se trata aparte (se permite `data:` de imagen), el resto son
 * ejecución de código o carga remota sin excusa posible.
 */
const VALORES_PROHIBIDOS = [
  /expression\s*\(/i, // IE: ejecuta JS desde CSS
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /-moz-binding/i,
  /behavior\s*:/i,
  /@import/i, // dentro de un valor, por si el parser lo dejó pasar
  /image-set\s*\(/i, // otra vía de carga remota
];

/**
 * `url()` con origen externo. Se acepta `data:image/...` (el usuario puede
 * incrustar una imagen pequeña) y las rutas del propio sitio (`/uploads/…`),
 * y se rechaza cualquier host: `//evil.com`, `http://`, `https://`.
 *
 * Ojo: `data:` NO es inocuo por definición — `data:text/html` sería un
 * documento. Por eso se exige que el tipo sea de imagen.
 */
function urlEsSegura(valorUrl: string): boolean {
  const limpio = valorUrl.trim().replace(/^["']|["']$/g, '').trim();

  // Protocolo relativo (`//host`) y absolutos con host.
  if (/^\/\//.test(limpio)) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(limpio)) {
    // Tiene esquema: solo se admite data: de imagen.
    return /^data:image\/(png|jpe?g|gif|webp|avif)\s*;/i.test(limpio);
  }

  // Sin esquema: ruta del propio sitio. Se limita a /uploads/ para que no
  // sirva de sonda de qué rutas existen en el servidor.
  return limpio.startsWith('/uploads/');
}

/** Revisa todas las `url()` que aparezcan en un valor. */
function urlsSeguras(valor: string): boolean {
  const encontradas = valor.matchAll(/url\s*\(([^)]*)\)/gi);
  for (const coincidencia of encontradas) {
    if (!urlEsSegura(coincidencia[1] ?? '')) return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────
//  Selectores
// ─────────────────────────────────────────────────────────────────────

/**
 * Selectores que apuntan a la raíz del documento. No se descartan: se
 * REESCRIBEN al contenedor del perfil (§6), porque la intención de quien
 * escribe `body { background: red }` en su CSS de perfil es clarísima —
 * quiere el fondo de SU perfil — y descartarlo sería incomprensible.
 */
const SELECTORES_RAIZ = /^(:root|html|body)$/i;

/**
 * Prefija un selector con el scope del perfil.
 *
 * Casos que hay que tratar y no son obvios:
 *
 *  - `body` / `html` / `:root` → se convierten EN el contenedor, no en un
 *    descendiente suyo (`#perfil-x`, no `#perfil-x body`, que no casaría
 *    con nada porque dentro del contenedor no hay ningún `<body>`).
 *  - `&` de anidamiento nativo → se sustituye por el scope.
 *  - Selectores que ya empiezan por el scope → se dejan (idempotencia).
 *  - `:is()/:where()/:not()` con comas dentro: la lista de selectores se
 *    parte por comas de PRIMER nivel, contando paréntesis. Partir por
 *    `,` a secas rompería `:is(a, b)` en dos selectores inválidos.
 */
export function prefijarSelector(selector: string, scope: string): string {
  return partirPorComas(selector)
    .map((parte) => {
      const limpio = parte.trim();
      if (!limpio) return null;

      // Ya tiene el scope: no se duplica. Se comprueba que lo que sigue no
      // sea parte de otro identificador (`#perfil-abcd` empieza por
      // `#perfil-abc` sin ser el mismo perfil), así que el carácter
      // siguiente tiene que cerrar el identificador.
      if (limpio === scope || new RegExp(`^${escaparRegex(scope)}(?![\\w-])`).test(limpio)) {
        return limpio;
      }

      // El `&` del anidamiento nativo se resuelve al scope.
      if (limpio.includes('&')) {
        return limpio.replace(/&/g, scope);
      }

      // La raíz del documento pasa a ser el contenedor.
      if (SELECTORES_RAIZ.test(limpio)) return scope;

      // `body.algo` / `html > .x` → el contenedor con ese mismo resto.
      const conRaiz = limpio.match(/^(:root|html|body)\b(.*)$/i);
      if (conRaiz) {
        const resto = (conRaiz[2] ?? '').trim();
        if (!resto) return scope;
        // `body > .x` mantiene el combinador; `body.x` se pega al scope.
        return /^[>+~]/.test(resto) ? `${scope} ${resto}` : `${scope}${resto}`;
      }

      // Pseudo-elementos y pseudo-clases sueltas (`::selection`, `:hover`)
      // se aplican al propio contenedor, no a un descendiente.
      if (limpio.startsWith(':')) return `${scope}${limpio}`;

      return `${scope} ${limpio}`;
    })
    .filter((s): s is string => s !== null)
    .join(', ');
}

/**
 * Parte una lista de selectores por las comas de primer nivel.
 * Respeta paréntesis (`:is(a, b)`) y comillas (`[data-x=","]`).
 */
function partirPorComas(selector: string): string[] {
  const partes: string[] = [];
  let actual = '';
  let profundidad = 0;
  let comilla: string | null = null;

  for (const caracter of selector) {
    if (comilla) {
      actual += caracter;
      if (caracter === comilla) comilla = null;
      continue;
    }
    if (caracter === '"' || caracter === "'") {
      comilla = caracter;
      actual += caracter;
      continue;
    }
    if (caracter === '(' || caracter === '[') profundidad++;
    if (caracter === ')' || caracter === ']') profundidad--;
    if (caracter === ',' && profundidad === 0) {
      partes.push(actual);
      actual = '';
      continue;
    }
    actual += caracter;
  }
  partes.push(actual);
  return partes;
}

// ─────────────────────────────────────────────────────────────────────
//  Declaraciones
// ─────────────────────────────────────────────────────────────────────

/** ¿Se queda esta declaración? */
function declaracionPermitida(decl: Declaration): boolean {
  const prop = decl.prop.trim().toLowerCase();
  const valor = decl.value;

  if (PROPIEDADES_PROHIBIDAS.has(prop)) return false;

  // Variables CSS (`--x: …`): se permiten, pero su valor pasa por los
  // mismos filtros. Si no, `--fondo: url(//evil.com/x)` usada después en
  // un `background: var(--fondo)` se saltaría todo el análisis.
  if (VALORES_PROHIBIDOS.some((patron) => patron.test(valor))) return false;
  if (!urlsSeguras(valor)) return false;

  // `position: fixed | sticky` escapa del contenedor del perfil.
  if (prop === 'position' && /\b(fixed|sticky)\b/i.test(valor)) return false;

  return true;
}

// ─────────────────────────────────────────────────────────────────────
//  Animaciones
// ─────────────────────────────────────────────────────────────────────

/**
 * Renombra las animaciones del usuario con su scope.
 *
 * Prefijar selectores NO aísla los `@keyframes`: su nombre vive en un
 * espacio GLOBAL del documento. Si alguien declara `@keyframes spin`, ese
 * nombre pisa el `spin` de la interfaz de Wander (el de los spinners de
 * carga) en toda la página mientras su perfil esté abierto — animar el
 * spinner con la animación de un usuario es exactamente la clase de fuga
 * que esta fase evita. Se renombran a `p-<id>-<nombre>` y se reescriben
 * las referencias en `animation` y `animation-name`.
 *
 * Solo se renombra lo que el propio usuario declaró: una referencia a un
 * nombre que él no definió no se toca (no existe en el documento, así que
 * no anima nada; y si algún día Wander expone animaciones públicas, este
 * es el comportamiento correcto).
 */
function renombrarAnimaciones(raiz: Container<ChildNode>, perfilId: string) {
  const declaradas = new Map<string, string>();

  raiz.walkAtRules((at) => {
    if (!AT_RULES_DE_FOTOGRAMAS.has(at.name.toLowerCase())) return;
    const nombre = at.params.trim();
    if (!nombre || declaradas.has(nombre)) return;
    const nuevo = `p-${perfilId}-${nombre}`;
    declaradas.set(nombre, nuevo);
    at.params = nuevo;
  });

  if (declaradas.size === 0) return;

  raiz.walkDecls((decl) => {
    const prop = decl.prop.trim().toLowerCase();
    if (prop !== 'animation' && prop !== 'animation-name') return;

    // Se sustituye por palabras completas para no tocar un `linear` que
    // contenga el nombre ni renombrar dos veces.
    decl.value = decl.value.replace(/[\w-]+/g, (palabra) => declaradas.get(palabra) ?? palabra);
  });
}

// ─────────────────────────────────────────────────────────────────────
//  Sanitización
// ─────────────────────────────────────────────────────────────────────

export interface ResultadoSanitizado {
  /** CSS listo para servir, ya prefijado. Cadena vacía si no quedó nada. */
  css: string;
  /** Cuántas reglas sobrevivieron. */
  reglas: number;
  /**
   * Qué se quitó, para poder DECÍRSELO al usuario. Un sanitizador
   * silencioso es una pesadilla de depuración: la persona ve que su CSS no
   * hace nada y no tiene forma de saber por qué.
   */
  avisos: string[];
}

export class ErrorCss extends Error {}

/**
 * Sanitiza el CSS de un perfil.
 *
 * @param entrada CSS tal como lo escribió el usuario.
 * @param perfilId Id del perfil; da el scope `#perfil-<id>`.
 * @throws ErrorCss si no parsea o si excede los límites duros.
 */
export function sanitizarCss(entrada: string, perfilId: string): ResultadoSanitizado {
  const avisos: string[] = [];

  // El límite se mide en BYTES, no en caracteres: un CSS lleno de emojis
  // ocupa el triple en la base de datos de lo que sugiere `.length`.
  const bytes = Buffer.byteLength(entrada, 'utf8');
  if (bytes > MAX_CSS_BYTES) {
    throw new ErrorCss(`El CSS ocupa ${Math.ceil(bytes / 1024)} KB y el máximo son ${MAX_CSS_BYTES / 1024} KB.`);
  }

  if (!entrada.trim()) return { css: '', reglas: 0, avisos };

  const scope = `#perfil-${perfilId}`;

  // Parser ESTRICTO a propósito (§6.1: "si no parsea, rechazar"). El
  // `safe-parser` existe para arreglar CSS roto adivinando la intención, y
  // adivinar es justo lo que no se quiere en una frontera de seguridad:
  // un CSS que el sanitizador y el navegador interpretan distinto es el
  // origen clásico del bypass. Si no parsea, es un error del usuario y se
  // le dice dónde.
  let raiz;
  try {
    raiz = postcss.parse(entrada, { from: undefined });
  } catch (error) {
    const detalle = error instanceof Error ? error.message.replace(/^<css input>:/, 'línea ') : '';
    throw new ErrorCss(`El CSS tiene un error de sintaxis. ${detalle}`.trim());
  }

  let reglas = 0;

  /**
   * Recorre un contenedor podando lo que no pasa el filtro.
   *
   * Se itera sobre una COPIA de los hijos porque `remove()` muta la lista
   * original y un `for` sobre ella se saltaría elementos.
   *
   * `dentroDeRegla` distingue una regla de primer nivel de una ANIDADA
   * dentro de otra. Solo se prefijan las primeras: una regla anidada ya
   * está bajo un selector prefijado, y volver a prefijarla cambiaría a qué
   * casa. En `.a { &:hover {} }` el `&` significa `.a`, así que sustituirlo
   * por el scope convertiría "la .a del perfil al pasar el ratón" en "el
   * contenedor del perfil al pasar el ratón" — otra regla distinta.
   * Anidar no es una vía de escape: el descendiente de un selector
   * prefijado sigue estando dentro del contenedor.
   */
  function procesar(
    contenedor: Container<ChildNode>,
    profundidad: number,
    dentroDeFotogramas: boolean,
    dentroDeRegla: boolean
  ) {
    for (const nodo of [...(contenedor.nodes ?? [])]) {
      if (nodo.type === 'comment') {
        nodo.remove();
        continue;
      }

      if (nodo.type === 'decl') {
        if (!declaracionPermitida(nodo)) {
          avisos.push(`Se quitó \`${nodo.prop}: ${recortar(nodo.value)}\`.`);
          nodo.remove();
        }
        continue;
      }

      if (nodo.type === 'atrule') {
        const nombre = nodo.name.toLowerCase();

        if (!AT_RULES_PERMITIDAS.has(nombre)) {
          avisos.push(`Se quitó \`@${nodo.name}\`.`);
          nodo.remove();
          continue;
        }

        // El propio prelude puede traer una URL (`@media` no, pero un
        // `@supports (background: url(...))` sí).
        if (!urlsSeguras(nodo.params) || VALORES_PROHIBIDOS.some((p) => p.test(nodo.params))) {
          avisos.push(`Se quitó \`@${nodo.name} ${recortar(nodo.params)}\`.`);
          nodo.remove();
          continue;
        }

        if (profundidad >= MAX_PROFUNDIDAD) {
          avisos.push('Se quitaron reglas anidadas demasiado adentro.');
          nodo.remove();
          continue;
        }

        if (nodo.nodes) {
          // Una at-rule NO cuenta como "estar dentro de una regla": las
          // reglas de dentro de un `@media` son de primer nivel y sí hay
          // que prefijarlas. Lo que sí se hereda es el contexto de la
          // regla que envuelva al `@media`, si la hay.
          procesar(
            nodo as unknown as Container<ChildNode>,
            profundidad + 1,
            dentroDeFotogramas || AT_RULES_DE_FOTOGRAMAS.has(nombre),
            dentroDeRegla
          );
          // Una at-rule que se quedó sin contenido no aporta nada.
          if (nodo.nodes.length === 0) nodo.remove();
        }
        continue;
      }

      if (nodo.type === 'rule') {
        const regla = nodo as Rule;

        // Dentro de @keyframes los "selectores" son fotogramas: se dejan
        // como están (prefijarlos rompería la animación) y solo se filtran
        // sus declaraciones. Lo mismo con las reglas anidadas, que heredan
        // el scope de su padre.
        if (!dentroDeFotogramas && !dentroDeRegla) {
          regla.selector = prefijarSelector(regla.selector, scope);
          if (!regla.selector.trim()) {
            regla.remove();
            continue;
          }
        }

        procesar(regla as unknown as Container<ChildNode>, profundidad + 1, dentroDeFotogramas, true);

        if (regla.nodes.length === 0) {
          regla.remove();
          continue;
        }

        reglas++;
        if (reglas > MAX_REGLAS) {
          throw new ErrorCss(`El CSS tiene más de ${MAX_REGLAS} reglas. Simplifícalo un poco.`);
        }
      }
    }
  }

  procesar(raiz as unknown as Container<ChildNode>, 0, false, false);

  // Después de podar: lo que se quitó ya no hace falta renombrarlo.
  renombrarAnimaciones(raiz as unknown as Container<ChildNode>, perfilId);

  const css = raiz.toString().trim();

  return { css, reglas, avisos: [...new Set(avisos)].slice(0, 20) };
}

/** Escapa un literal para meterlo dentro de una expresión regular. */
function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Recorta un fragmento para meterlo en un aviso sin volcar 2 KB. */
function recortar(texto: string, maximo = 40): string {
  const limpio = texto.replace(/\s+/g, ' ').trim();
  return limpio.length > maximo ? `${limpio.slice(0, maximo)}…` : limpio;
}
