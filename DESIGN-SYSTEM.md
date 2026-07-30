# Sistema de Diseño — Estética Unificada (Portafolio Brian → OuroCore)

> Documento portable. Copia este archivo a cualquier proyecto nuevo para replicar
> la misma estética. Extraído de `PaginaOuroCorePortafolioBrian` (Next.js 16 +
> Tailwind v4) y adaptado para `PaginaOuroCore_V2` (Astro 4 + Tailwind v3).

---

## 1. Filosofía visual

La estética es **minimalista, monocromática y tipográficamente sobria**. Se apoya en:

- **Escala de grises `zinc`** como base absoluta — no hay color de marca en el fondo ni en el texto.
- **Color usado como acento puntual**, nunca como relleno. El azul (`blue-600` / `blue-400`)
  es el acento primario; morado, naranja, verde y rosa aparecen solo para *categorizar*
  tarjetas o iconos.
- **Bordes de 1px y sombras suaves** en lugar de glows, neones o degradados saturados.
- **Dark mode como estado por defecto**, pero ambos temas son ciudadanos de primera clase.
- Jerarquía por **peso tipográfico y opacidad**, no por saturación de color.

### Anti-patrones (lo que este sistema evita deliberadamente)

| Evitar | Usar en su lugar |
|---|---|
| Neón / cyan saturado (`#00F0FF`) | `blue-600` (light) / `blue-400` (dark) |
| `box-shadow` con glow de color | `shadow-sm` / `shadow-md` neutro |
| Degradados de fondo saturados | Fondo plano `zinc-50` / `zinc-950` |
| Blobs animados con `blur(80px)` | Grid sutil con máscara de desvanecido |
| Bordes de acento en todo | Bordes `zinc-200` / `zinc-800`, acento solo en hover |
| Texto con `opacity` arbitraria | Escala semántica `zinc-600` / `zinc-400` |

---

## 2. Tipografía

Una sola familia para todo. **No hay fuente separada para headings.**

```
Inter — 300, 400, 500, 600, 700, 800
```

En Next.js se carga con `next/font/google`; en Astro/HTML plano:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
```

```css
body {
  font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### Escala tipográfica

| Rol | Clases Tailwind | Notas |
|---|---|---|
| Hero H1 | `text-5xl md:text-7xl font-extrabold tracking-tight` | Con degradado de texto (§5.1) |
| Hero subtítulo | `text-xl md:text-3xl font-medium` | `zinc-600` / `zinc-400` |
| H2 de sección | `text-3xl md:text-5xl font-bold` | `zinc-900` / `white` |
| H2 secundario | `text-3xl font-bold` | |
| H3 / título de tarjeta | `text-2xl font-bold` | |
| H3 pequeño | `text-lg font-semibold` | |
| Cuerpo | `text-base md:text-lg leading-relaxed` | `zinc-600` / `zinc-400` |
| Cuerpo pequeño | `text-sm` | |
| Etiqueta / badge | `text-xs font-medium` | |
| Botón | `text-sm font-semibold` | |
| Fecha / mono | `text-sm font-mono` | `blue-600` / `blue-400` |

**Regla:** los títulos siempre `font-bold` o superior; el cuerpo nunca pasa de `font-medium`.

---

## 3. Paleta de colores

### 3.1 Tokens semánticos (shadcn/ui, formato HSL sin `hsl()`)

Estos son los tokens canónicos. Se consumen como `hsl(var(--token))`.

```css
:root {
  --background: 0 0% 100%;
  --foreground: 0 0% 3.9%;
  --card: 0 0% 100%;
  --card-foreground: 0 0% 3.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 0 0% 3.9%;
  --primary: 0 0% 9%;
  --primary-foreground: 0 0% 98%;
  --secondary: 0 0% 96.1%;
  --secondary-foreground: 0 0% 9%;
  --muted: 0 0% 96.1%;
  --muted-foreground: 0 0% 45.1%;
  --accent: 0 0% 96.1%;
  --accent-foreground: 0 0% 9%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;
  --border: 0 0% 89.8%;
  --input: 0 0% 89.8%;
  --ring: 0 0% 3.9%;
  --radius: 0.5rem;
}

.dark {
  --background: 0 0% 3.9%;
  --foreground: 0 0% 98%;
  --card: 0 0% 3.9%;
  --card-foreground: 0 0% 98%;
  --popover: 0 0% 3.9%;
  --popover-foreground: 0 0% 98%;
  --primary: 0 0% 98%;
  --primary-foreground: 0 0% 9%;
  --secondary: 0 0% 14.9%;
  --secondary-foreground: 0 0% 98%;
  --muted: 0 0% 14.9%;
  --muted-foreground: 0 0% 63.9%;
  --accent: 0 0% 14.9%;
  --accent-foreground: 0 0% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 0 0% 98%;
  --border: 0 0% 14.9%;
  --input: 0 0% 14.9%;
  --ring: 0 0% 83.1%;
}
```

> **Nota:** el tema es *acromático puro* (saturación 0%). Todo el color entra por las
> clases de acento de Tailwind, no por los tokens.

### 3.2 Escala `zinc` — uso real por rol

| Rol | Light | Dark |
|---|---|---|
| Fondo de página | `bg-zinc-50` | `dark:bg-zinc-950` |
| Fondo de sección alterna | `bg-white` | `dark:bg-zinc-900/30` |
| Fondo de tarjeta | `bg-white` | `dark:bg-zinc-900/40` |
| Fondo de tarjeta anidada | `bg-zinc-50` | `dark:bg-zinc-950` |
| Borde | `border-zinc-200` | `dark:border-zinc-800` |
| Borde sutil | `border-zinc-200` | `dark:border-zinc-800/50` |
| Texto principal | `text-zinc-900` | `dark:text-white` |
| Texto secundario | `text-zinc-600` | `dark:text-zinc-400` |
| Texto terciario | `text-zinc-500` | `dark:text-zinc-400` |
| Hover de superficie | `hover:bg-zinc-100` | `dark:hover:bg-zinc-800` |
| Badge neutro | `bg-zinc-200` | `dark:bg-zinc-900/80` |

### 3.3 Acentos de color

El **azul es el acento primario** (enlaces, fechas, énfasis). Los demás colores
solo distinguen categorías de tarjetas.

| Color | Icono/Texto (L) | Icono/Texto (D) | Fondo (L) | Fondo (D) | Borde hover (L) | Borde hover (D) |
|---|---|---|---|---|---|---|
| **Blue** (primario) | `text-blue-600` | `dark:text-blue-400` | `bg-blue-100` | `dark:bg-blue-500/10` | `hover:border-blue-300` | `dark:hover:border-blue-500/50` |
| **Purple** | `text-purple-600` | `dark:text-purple-400` | `bg-purple-100` | `dark:bg-purple-500/10` | `hover:border-purple-300` | `dark:hover:border-purple-500/50` |
| **Orange** | `text-orange-600` | `dark:text-orange-400` | `bg-orange-100` | `dark:bg-orange-500/10` | `hover:border-orange-300` | `dark:hover:border-orange-500/50` |
| **Green** | `text-green-600` | `dark:text-green-400` | `bg-green-100` | `dark:bg-green-500/10` | `hover:border-green-300` | `dark:hover:border-green-500/50` |
| **Pink** | `text-pink-600` | `dark:text-pink-400` | `bg-pink-100` | `dark:bg-pink-500/10` | `hover:border-pink-300` | `dark:hover:border-pink-500/50` |

**Patrón de fórmula** (sustituye `{c}` por el color):

```
Icono contenedor : bg-{c}-100 dark:bg-{c}-500/10
                   text-{c}-600 dark:text-{c}-400
                   border-{c}-200 dark:border-{c}-500/20
Badge de estado  : bg-{c}-50 dark:bg-{c}-500/10
                   text-{c}-700 dark:text-{c}-400
Sombra hover     : hover:shadow-md dark:hover:shadow-{c}-900/20
```

---

## 4. Espaciado, radios y contenedores

### Radios

| Token | Valor | Uso |
|---|---|---|
| `rounded-md` | `0.375rem` | Botones de icono, items de menú |
| `rounded-lg` | `0.5rem` | Botones principales (`--radius`) |
| `rounded-xl` | `0.75rem` | Contenedores de icono (`h-14 w-14`) |
| `rounded-2xl` | `1rem` | **Tarjetas** — el radio característico |
| `rounded-full` | — | Badges, avatares, pills |

### Ritmo vertical de secciones

```
Hero              : py-24 lg:py-32
Sección destacada : py-24
Sección normal    : py-20
```

### Contenedor

```html
<div class="container mx-auto px-4 sm:px-6 lg:px-8">   <!-- navbar/footer -->
<div class="container mx-auto px-4 md:px-6">           <!-- secciones -->
```

Anchos máximos internos: `max-w-3xl` (texto), `max-w-4xl` (prosa centrada),
`max-w-5xl` (timeline), `max-w-7xl` (grids).

### Grids

```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
```

---

## 5. Recetas de componentes

### 5.1 Título con degradado (hero)

```html
<h1 class="text-5xl md:text-7xl font-extrabold tracking-tight mb-6
           bg-clip-text text-transparent
           bg-gradient-to-r from-zinc-900 to-zinc-500
           dark:from-zinc-100 dark:to-zinc-500">
  Título
</h1>
```

> El degradado es **monocromático** (zinc → zinc), nunca de dos tonos de color.

### 5.2 Fondo de grid del hero

Reemplaza a los blobs/partículas. Rejilla de 30px que se desvanece hacia abajo.

```html
<div class="absolute inset-0
  bg-[linear-gradient(to_right,#0000000a_1px,transparent_1px),linear-gradient(to_bottom,#0000000a_1px,transparent_1px)]
  dark:bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)]
  bg-[size:30px_30px]
  [mask-image:linear-gradient(to_bottom,white,transparent)]"></div>
```

### 5.3 Botón primario

```html
<a class="inline-flex h-12 items-center justify-center rounded-lg
          bg-zinc-900 dark:bg-white px-8
          text-sm font-semibold text-white dark:text-zinc-950
          transition-all hover:bg-zinc-800 dark:hover:bg-zinc-200
          hover:scale-105 active:scale-95">Acción</a>
```

### 5.4 Botón secundario

```html
<a class="inline-flex h-12 items-center justify-center rounded-lg gap-2
          border border-zinc-300 dark:border-zinc-700
          bg-white/50 dark:bg-zinc-900/50 px-8
          text-sm font-semibold text-zinc-900 dark:text-white
          transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800
          hover:scale-105 active:scale-95">Acción</a>
```

**Interacción estándar de botón:** `hover:scale-105` + `active:scale-95`.

### 5.5 Tarjeta con acento de color

```html
<a class="group rounded-2xl border border-zinc-200 dark:border-zinc-800
          bg-white dark:bg-zinc-900/40 p-6 xl:p-8
          shadow-sm dark:shadow-md transition-all
          hover:scale-[1.02] hover:bg-zinc-50 dark:hover:bg-zinc-900
          hover:border-blue-300 dark:hover:border-blue-500/50
          hover:shadow-md dark:hover:shadow-blue-900/20
          flex flex-col h-full">

  <!-- Icono -->
  <div class="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl
              bg-blue-100 dark:bg-blue-500/10
              text-blue-600 dark:text-blue-400
              border border-blue-200 dark:border-blue-500/20">
    <svg class="h-7 w-7">…</svg>
  </div>

  <h3 class="mb-3 text-2xl font-bold text-zinc-900 dark:text-white">Título</h3>
  <p class="mb-6 text-zinc-600 dark:text-zinc-400 flex-1 text-base md:text-lg">Texto</p>

  <!-- Pie con badge + flecha -->
  <div class="flex items-center justify-between mt-auto pt-6
              border-t border-zinc-200 dark:border-zinc-800 flex-wrap gap-4">
    <span class="text-xs font-medium text-blue-700 dark:text-blue-400
                 bg-blue-50 dark:bg-blue-500/10 px-3 py-1 rounded-full">Estado</span>
    <svg class="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform">…</svg>
  </div>
</a>
```

**Escala hover de tarjeta:** `hover:scale-[1.02]` (más sutil que un botón).

### 5.6 Tarjeta neutra (sin acento)

```html
<div class="p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-950
            border border-zinc-200 dark:border-zinc-800/60 shadow-sm">
  <h3 class="text-lg font-semibold mb-6 flex items-center
             border-b border-zinc-200 dark:border-zinc-800 pb-3
             text-zinc-900 dark:text-white">Título</h3>
</div>
```

### 5.7 Badge / pill de habilidad

```html
<span class="px-3 py-1.5 rounded-full text-sm font-medium
             bg-zinc-200 dark:bg-zinc-900/80
             text-zinc-800 dark:text-zinc-300
             border border-zinc-300 dark:border-zinc-800">Docker</span>
```

### 5.8 Enlace "leer más"

```html
<a class="inline-flex items-center text-sm font-semibold
          text-blue-600 dark:text-blue-400
          hover:text-blue-700 dark:hover:text-blue-300
          transition-colors group">
  Leer más
  <svg class="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform">…</svg>
</a>
```

### 5.9 Navbar

```html
<nav class="sticky top-0 z-50 w-full
            border-b border-zinc-200 dark:border-zinc-800/40
            bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md
            supports-[backdrop-filter]:bg-white/60
            dark:supports-[backdrop-filter]:bg-zinc-950/60
            transition-colors">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex h-16 items-center justify-between">…</div>
  </div>
</nav>
```

- Altura fija `h-16`, `sticky` (no `fixed`).
- Enlace activo: `text-zinc-900 dark:text-white`; inactivo: `text-zinc-600 dark:text-zinc-400`.
- **Sin subrayado animado** — el estado activo se marca solo por color.

### 5.10 Footer

```html
<footer class="w-full border-t border-zinc-200 dark:border-zinc-800
               bg-white dark:bg-zinc-950 py-8 md:py-12 mt-auto">
```

Iconos sociales: `text-zinc-500 dark:text-zinc-400` con hover al color de la marca
(`hover:text-blue-600` LinkedIn, `hover:text-pink-600` Instagram, etc.).

### 5.11 Sección alterna (banda)

```html
<section class="py-20 bg-white dark:bg-zinc-900/30
                border-y border-zinc-200 dark:border-zinc-800/50">
```

Alternar con `bg-zinc-50 dark:bg-zinc-950` genera el ritmo visual de la página.

### 5.12 Timeline / experiencia

```html
<div class="w-full flex flex-col md:flex-row gap-6 p-6 md:p-8 rounded-2xl
            bg-white dark:bg-zinc-900/40
            border border-zinc-200 dark:border-zinc-800/60 shadow-sm">
  <div class="md:w-1/3">
    <span class="text-sm font-mono text-blue-600 dark:text-blue-400 mb-2">2024</span>
  </div>
  <div class="md:w-2/3 md:border-l border-zinc-200 dark:border-zinc-800 md:pl-8">…</div>
</div>
```

---

## 6. Movimiento

| Elemento | Transición |
|---|---|
| Color / fondo | `transition-colors` (~150ms) |
| Transformación | `transition-transform` |
| Combinada | `transition-all` |
| Botón hover | `hover:scale-105` |
| Botón activo | `active:scale-95` |
| Tarjeta hover | `hover:scale-[1.02]` |
| Flecha en `group` | `group-hover:translate-x-1` |

**Sin** animaciones de entrada por scroll, parallax, partículas ni efectos magnéticos.
El movimiento responde solo a la intención directa del usuario (hover, click).

### Accesibilidad

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 7. Tema claro/oscuro

- Estrategia: **clase** (`darkMode: 'class'` en Tailwind), clase `.dark` en `<html>`.
- **Por defecto: oscuro.**
- El script de inicialización debe correr **antes del primer render** para evitar FOUC.

```html
<script is:inline>
  (function () {
    var stored = localStorage.getItem('theme');
    if (stored !== 'light') document.documentElement.classList.add('dark');
  })();
</script>
```

> En Next.js esto lo resuelve `next-themes` con
> `attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange`.

**Importante:** cada utilidad de color necesita su par `dark:`. No existe un modo
"automático" — el sistema es explícito en ambos temas.

---

## 8. Iconografía

- **Librería:** [Lucide](https://lucide.dev) — `lucide-react` en React; SVG inline en Astro.
- **Trazo:** `stroke-width="2"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, `fill="none"`.
- **Tamaños:** `h-4 w-4` (inline en texto), `h-5 w-5` (navbar), `h-6 w-6` (social),
  `h-7 w-7` (dentro de contenedor `h-14 w-14`).
- Siempre `aria-hidden="true"` cuando el icono es decorativo.
- **No usar emoji** como iconografía de interfaz.

---

## 9. Setup por stack

### Tailwind v4 (Next.js)

`globals.css` — tokens dentro de `@theme` + `@layer utilities` (ver §3.1).

```css
@import "tailwindcss";
@custom-variant dark (&:is(.dark *));

@theme {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-primary: hsl(var(--primary));
  /* … resto de tokens */
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
}
```

### Tailwind v3 (Astro)

> **Ojo con la polaridad del tema.** El portafolio marca el tema *oscuro* con
> `.dark` en `<html>`. Este proyecto (OuroCore) hace lo inverso: marca el tema
> *claro* con `html.light` y el oscuro es la ausencia de clase. Para que las
> utilidades `dark:` sigan escribiéndose igual que en el portafolio, se usa un
> variant personalizado:
>
> ```js
> darkMode: ['variant', 'html:not(.light) &'],
> ```
>
> Si tu proyecto usa `.dark` como el portafolio, deja `darkMode: 'class'`.

```js
// tailwind.config.mjs
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: ['variant', 'html:not(.light) &'], // o 'class' si marcas .dark
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
};
```

---

## 10. Checklist de migración

Al llevar esta estética a un proyecto existente:

- [ ] Sustituir la fuente de headings por **Inter** (una sola familia).
- [ ] Eliminar variables de acento neón; adoptar tokens de §3.1.
- [ ] Cambiar fondos a `zinc-50` / `zinc-950` y superficies a `white` / `zinc-900/40`.
- [ ] Convertir bordes de acento a `zinc-200` / `zinc-800`.
- [ ] Reemplazar glows (`box-shadow` de color) por `shadow-sm` / `shadow-md`.
- [ ] Cambiar radio de tarjetas a `rounded-2xl`.
- [ ] Sustituir emoji de UI por iconos Lucide.
- [ ] Quitar partículas / blobs; usar el grid con máscara (§5.2) solo en el hero.
- [ ] Quitar animaciones de scroll-reveal y efectos magnéticos.
- [ ] Añadir `hover:scale-105` / `active:scale-95` a botones y `hover:scale-[1.02]` a tarjetas.
- [ ] Verificar que **cada** utilidad de color tenga su par `dark:`.
- [ ] Confirmar que el script de tema corre antes del primer render.

---

## 11. Cómo se aplicó en OuroCore V2 (referencia de implementación)

Notas concretas de la migración de este proyecto, útiles como plantilla:

### Archivos clave

| Archivo | Rol |
|---|---|
| `src/styles/global.css` | Tokens, base, tarjetas, botones, modal, scrollbar |
| `tailwind.config.mjs` | Variant `dark:`, Inter, tokens de color y radios |
| `src/components/icons.ts` | Librería de iconos Lucide + mapa emoji→icono + clases de acento |
| `src/components/Icon.astro` | Render de icono por `name`, `brand` o `emoji` |
| `src/layouts/BaseLayout.astro` | Carga de Inter, script de tema, `<body>` |

### Aliases legacy (truco de migración)

En vez de reescribir a mano cientos de `style="color: var(--color-accent-cyan)"`,
las variables antiguas se **remapearon** a la paleta nueva en `global.css`:

```css
--color-accent-cyan: #60a5fa;  /* antes #00F0FF */
--color-surface:     #18181b;  /* zinc-900 */
--color-text:        #fafafa;  /* zinc-50  */
```

Después se convirtieron los inline styles a clases Tailwind con un script, y los
aliases quedaron como red de seguridad. Los componentes `HeroParticles`,
`ScrollReveal` y `MagneticButton` **conservan su nombre** pero ya no animan —
así ninguna página tuvo que cambiar sus imports.

### Rotación de acentos en grids

Las tarjetas de servicio reciben `index={i}` y rotan por
`ACCENTS = [blue, purple, orange, green, pink]`:

```astro
{items.map((item, i) => <ServiceCard … index={i} />)}
```

Las clases viven en `accentIconClasses`, `accentHoverClasses` y
`accentTextClasses` (`icons.ts`) — nunca se construyen con interpolación
(`bg-${color}-100` **no funciona**: Tailwind no puede detectarlas al compilar).

### Iconos

Los emoji de los JSON de i18n se traducen a Lucide vía `byEmoji` en `icons.ts`,
así que el contenido puede seguir usando emoji sin que lleguen a la interfaz.
Los logos de marca (GitHub, YouTube, …) van aparte en `brandPaths` y se usan con
`<Icon brand="github" />`, porque son paths rellenos y no de trazo.

### Ritmo de secciones

`SectionBg` acepta `variant="base" | "alt"` y se alternan para conseguir las
bandas de §5.11.
