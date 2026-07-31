/**
 * Material del editor avanzado de CSS: presets, referencia de selectores y
 * prompts para pedirle ayuda a una IA.
 *
 * Todo lo que hay aquí es TEXTO (CSS y cadenas), no código que se ejecute.
 * Los presets se aplican metiéndolos en el editor y guardándolos por la
 * ruta normal, así que pasan por el mismo sanitizador que cualquier otro
 * CSS: no hay un camino privilegiado. Si un preset trajera algo prohibido,
 * el servidor lo quitaría igual — y eso es lo correcto.
 *
 * Los nombres y descripciones son CLAVES de i18n, no texto: si fueran
 * texto se congelarían en el idioma de arranque (regla de la Fase 6.5).
 */

export interface PresetCss {
  id: string;
  /** `cssPagina.presets.<id>Nombre` y `<id>Descripcion` en los catálogos. */
  clave: string;
  /** Colores para la miniatura: [fondo, tarjeta, acento]. */
  muestra: [string, string, string];
  css: string;
}

export const PRESETS_CSS: PresetCss[] = [
  {
    id: 'neon',
    clave: 'neon',
    muestra: ['#0d0221', '#1a0b3d', '#ff3ea5'],
    css: `/* Neón — morado oscuro con rosa eléctrico */
:root {
  --p-fondo: #0d0221;
  --p-tarjeta: #1a0b3d;
  --p-acento: #ff3ea5;
  --p-borde: #ff3ea5;
  --p-radio: 14px;
}

body {
  background: radial-gradient(circle at 50% 0%, #2a0f5c 0%, #0d0221 60%);
}

.wander-bloque section,
.wander-bloque-hero header {
  box-shadow: 0 0 24px rgba(255, 62, 165, 0.25);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.wander-bloque section:hover {
  transform: translateY(-4px);
  box-shadow: 0 0 36px rgba(255, 62, 165, 0.45);
}

h1 {
  background: linear-gradient(90deg, #ff3ea5, #21d4fd);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

h2 {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.8rem;
  opacity: 0.75;
}`,
  },
  {
    id: 'cristal',
    clave: 'cristal',
    muestra: ['#0f172a', '#1e293b', '#38bdf8'],
    css: `/* Cristal — tarjetas translúcidas con desenfoque */
:root {
  --p-fondo: #0f172a;
  --p-acento: #38bdf8;
  --p-borde: rgba(148, 163, 184, 0.25);
  --p-radio: 18px;
}

body {
  background:
    radial-gradient(circle at 15% 20%, rgba(56, 189, 248, 0.18), transparent 40%),
    radial-gradient(circle at 85% 10%, rgba(167, 139, 250, 0.18), transparent 40%),
    #0f172a;
}

.wander-bloque section,
.wander-bloque-hero header {
  background-color: rgba(30, 41, 59, 0.55);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(148, 163, 184, 0.25);
}`,
  },
  {
    id: 'minimal',
    clave: 'minimal',
    muestra: ['#fafafa', '#ffffff', '#171717'],
    css: `/* Minimal — claro, sin adornos, mucho aire */
:root {
  --p-fondo: #fafafa;
  --p-tarjeta: #ffffff;
  --p-texto: #171717;
  --p-acento: #171717;
  --p-borde: #e5e5e5;
  --p-radio: 4px;
}

.wander-bloque section,
.wander-bloque-hero header {
  border: 1px solid var(--p-borde);
  box-shadow: none;
}

h2 {
  font-weight: 500;
  text-transform: lowercase;
  letter-spacing: 0.02em;
  opacity: 0.5;
}

a:hover {
  opacity: 0.6;
}`,
  },
  {
    id: 'terminal',
    clave: 'terminal',
    muestra: ['#0c0c0c', '#111611', '#4ade80'],
    css: `/* Terminal — monoespaciado y verde fósforo */
:root {
  --p-fondo: #0c0c0c;
  --p-tarjeta: #111611;
  --p-texto: #d1fae5;
  --p-acento: #4ade80;
  --p-borde: #14532d;
  --p-radio: 0px;
}

.perfil-raiz {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
}

h2 {
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-size: 0.75rem;
}

.wander-bloque section,
.wander-bloque-hero header {
  border: 1px solid var(--p-borde);
}

a {
  text-decoration: underline;
  text-underline-offset: 3px;
}`,
  },
  {
    id: 'revista',
    clave: 'revista',
    muestra: ['#faf7f2', '#ffffff', '#b91c1c'],
    css: `/* Revista — serif, mucho contraste, acento rojo */
:root {
  --p-fondo: #faf7f2;
  --p-tarjeta: #ffffff;
  --p-texto: #1c1917;
  --p-acento: #b91c1c;
  --p-borde: #e7e5e4;
  --p-radio: 2px;
}

.perfil-raiz {
  font-family: Georgia, "Times New Roman", serif;
}

h1 {
  font-size: 3rem;
  line-height: 1.05;
  letter-spacing: -0.03em;
}

h2 {
  border-bottom: 2px solid var(--p-acento);
  padding-bottom: 0.4rem;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}`,
  },
];

/**
 * Los ganchos estables a los que se puede agarrar el CSS de un perfil.
 *
 * **Esto es un contrato.** Por dentro los bloques usan clases de Tailwind,
 * que son de la herramienta y cambian entre versiones; agarrarse a ellas
 * sería escribir un CSS que se rompe solo. Lo de esta lista se mantiene.
 */
export interface GanchoCss {
  selector: string;
  /** Clave `cssPagina.ganchos.<clave>`. */
  clave: string;
}

export const GANCHOS_CSS: GanchoCss[] = [
  { selector: '.wander-bloque', clave: 'bloque' },
  { selector: '.wander-bloque-hero', clave: 'hero' },
  { selector: '.wander-bloque-enlaces', clave: 'enlaces' },
  { selector: '.wander-bloque-texto', clave: 'texto' },
  { selector: '.wander-bloque-steam-actividad', clave: 'steamActividad' },
  { selector: '.wander-bloque-estadisticas', clave: 'estadisticas' },
  { selector: '.wander-bloque-favoritos', clave: 'favoritos' },
  { selector: '.wander-bloque-discord-estado', clave: 'discordEstado' },
  { selector: '.wander-bloque-spotify', clave: 'spotify' },
  { selector: '.perfil-lateral', clave: 'lateral' },
  { selector: '.perfil-principal', clave: 'principal' },
  { selector: 'h1', clave: 'h1' },
  { selector: 'h2', clave: 'h2' },
  { selector: 'section', clave: 'section' },
  { selector: 'a', clave: 'enlace' },
  { selector: 'img', clave: 'imagen' },
];

/** Las variables del tema. Redefinirlas es la vía más limpia de cambiarlo
 *  todo de golpe: se usan en decenas de sitios a la vez. */
export const VARIABLES_CSS = [
  { nombre: '--p-fondo', clave: 'fondo' },
  { nombre: '--p-texto', clave: 'texto' },
  { nombre: '--p-acento', clave: 'acento' },
  { nombre: '--p-tarjeta', clave: 'tarjeta' },
  { nombre: '--p-borde', clave: 'borde' },
  { nombre: '--p-radio', clave: 'radio' },
] as const;

/**
 * El CSS que pinta hoy cada bloque, para copiar y modificar.
 *
 * Está escrito a mano a partir de los componentes reales (no generado): la
 * idea es que se lea y se entienda, no que sea un volcado. Cada uno usa
 * solo los ganchos de `GANCHOS_CSS`, así que sirve de ejemplo de cómo se
 * escribe algo que no se va a romper.
 */
export interface RecetaBloque {
  /** Clave `bloques.<clave>Nombre` — se reutiliza el catálogo del editor. */
  clave: string;
  selector: string;
  css: string;
}

export const RECETAS_BLOQUE: RecetaBloque[] = [
  {
    clave: 'hero',
    selector: '.wander-bloque-hero',
    css: `/* Hero: avatar, nombre, handle y bio */
.wander-bloque-hero header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
  padding-block: 2.5rem;
}

.wander-bloque-hero img {
  width: 6rem;
  height: 6rem;
  border-radius: 9999px;
  object-fit: cover;
  border: 2px solid var(--p-borde);
}

.wander-bloque-hero h1 {
  font-size: 1.875rem;
  font-weight: 800;
  letter-spacing: -0.025em;
}`,
  },
  {
    clave: 'enlaces',
    selector: '.wander-bloque-enlaces',
    css: `/* Enlaces: rejilla de botones a tus perfiles */
.wander-bloque-enlaces a {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  background-color: var(--p-tarjeta);
  border: 1px solid var(--p-borde);
  border-radius: var(--p-radio);
  transition: transform 0.2s ease;
}

.wander-bloque-enlaces a:hover {
  transform: scale(1.02);
}`,
  },
  {
    clave: 'favoritos',
    selector: '.wander-bloque-favoritos',
    css: `/* Favoritos: rejilla de carátulas de Steam.
   Cámbiale las columnas para que quepan más o menos. */
.wander-bloque-favoritos .grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

@media (min-width: 1024px) {
  .wander-bloque-favoritos .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.wander-bloque-favoritos img {
  width: 100%;
  border-radius: var(--p-radio);
}`,
  },
  {
    clave: 'steamActividad',
    selector: '.wander-bloque-steam-actividad',
    css: `/* Actividad de Steam: lista de lo jugado últimamente */
.wander-bloque-steam-actividad li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  background-color: var(--p-tarjeta);
  border: 1px solid var(--p-borde);
  border-radius: var(--p-radio);
}

.wander-bloque-steam-actividad li:hover {
  border-color: var(--p-acento);
}`,
  },
  {
    clave: 'estadisticas',
    selector: '.wander-bloque-estadisticas',
    css: `/* Estadísticas: los contadores grandes */
.wander-bloque-estadisticas .grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  text-align: center;
}

.wander-bloque-estadisticas p:first-child {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--p-acento);
}`,
  },
];

/**
 * Prompts para pedirle ayuda a una IA.
 *
 * Llevan dentro el contexto de Wander a propósito. Sin él, cualquier
 * modelo inventa clases que aquí no existen (`.profile-card`, `.bio`) y
 * devuelve un CSS que no hace nada — que es la forma más rápida de que
 * alguien concluya que "el editor no sirve".
 */
export const CONTEXTO_IA = `Estoy escribiendo CSS para mi perfil en Wander.

Reglas del entorno:
- Mi CSS se limita solo a mi perfil: todos los selectores se prefijan
  automáticamente. Escribe como si mi perfil fuera la página entera; puedes
  usar \`body\` y se traduce a mi contenedor.
- Selectores estables que SÍ existen: .wander-bloque, .wander-bloque-hero,
  .wander-bloque-enlaces, .wander-bloque-texto, .wander-bloque-favoritos,
  .wander-bloque-steam-actividad, .wander-bloque-estadisticas,
  .wander-bloque-discord-estado, .wander-bloque-spotify, .perfil-lateral,
  .perfil-principal, y las etiquetas h1, h2, section, a, img, ul, li.
- NO inventes otras clases: por dentro uso Tailwind y esas clases cambian.
- Variables del tema que puedes redefinir: --p-fondo, --p-texto, --p-acento,
  --p-tarjeta, --p-borde, --p-radio.
- Está PROHIBIDO y se elimina al guardar: position: fixed y sticky, @import,
  @font-face, url() a sitios externos, expression(), y la propiedad
  \`content\` (así que ::before y ::after no sirven para nada).
- Máximo 20 KB y 400 reglas.

Lo que quiero: `;

export interface IdeaPrompt {
  /** Clave `cssPagina.ideas.<clave>`. */
  clave: string;
}

export const IDEAS_PROMPT: IdeaPrompt[] = [
  { clave: 'neonRosa' },
  { clave: 'tarjetasCristal' },
  { clave: 'animarHover' },
  { clave: 'fondoDegradado' },
  { clave: 'compactar' },
  { clave: 'tipografia' },
];
