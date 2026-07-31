# CSS propio — ejemplo para probar en tu perfil

Un CSS listo para pegar en **`/editor` → panel «CSS propio» → Abrir**, y la explicación de
qué hace cada parte, qué se va a quitar y por qué.

Todo lo que aparece aquí está **pasado por el sanitizador real** antes de escribirlo: las
salidas que se muestran son las que devuelve `sanitizarCss()`, no una aproximación.

---

## 1. Lo primero que hay que saber: a qué te puedes agarrar

Por dentro los bloques están pintados con clases de Tailwind, que son de la herramienta y
cambian entre versiones: agarrarse a ellas es escribir un CSS que se rompa solo. Para eso
existen las clases `wander-*`, que **sí** son un contrato estable.

| Te puedes agarrar a | Qué es |
|---|---|
| `.wander-bloque` | Cualquier bloque de tu perfil |
| `.wander-bloque-hero` | El bloque de avatar, nombre y bio |
| `.wander-bloque-enlaces` | El bloque de enlaces |
| `.wander-bloque-favoritos` | La rejilla de juegos favoritos |
| `.wander-bloque-steam-actividad` | Lo que juegas últimamente |
| `.wander-bloque-estadisticas` | Los contadores |
| `.perfil-lateral` / `.perfil-principal` | Las dos columnas de escritorio |
| `header`, `h1` | Tu avatar, tu nombre y tu handle |
| `section`, `h2` | Cada bloque y su título |
| `ul`, `li`, `a`, `img` | Listas, enlaces y carátulas |
| `--p-fondo`, `--p-texto`, `--p-acento`, `--p-tarjeta`, `--p-borde`, `--p-radio` | Las variables de **tu tema** |

Redefinir una variable es la forma más limpia de cambiar el perfil entero de un golpe:
tocas `--p-acento` y se actualizan los catorce sitios que la usan.

> **Todo esto está también dentro de la app**, en `/editor` → **Edición avanzada**, con
> presets que se aplican de un clic, el CSS de cada bloque para copiar y un contexto listo
> para pegarle a una IA. Este archivo es la versión larga para leer fuera.

---

## 2. El ejemplo — pégalo tal cual

Tema neón sobre morado oscuro. Cambia colores, añade brillo a las tarjetas y las levanta
un poco al pasar el ratón.

```css
/* ── 1. Repinta el tema entero desde las variables ── */
:root {
  --p-fondo: #0d0221;
  --p-tarjeta: #1a0b3d;
  --p-acento: #ff3ea5;
  --p-borde: #ff3ea5;
  --p-radio: 14px;
}

/* ── 2. El fondo del perfil ── */
body {
  background: radial-gradient(circle at 50% 0%, #2a0f5c 0%, #0d0221 60%);
}

/* ── 3. Tu nombre con degradado ── */
header h1 {
  background: linear-gradient(90deg, #ff3ea5, #21d4fd);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -0.03em;
}

/* ── 4. Cada bloque, con brillo y reacción al ratón ── */
section {
  border: 1px solid var(--p-borde);
  box-shadow: 0 0 24px rgba(255, 62, 165, 0.25);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

section:hover {
  transform: translateY(-4px);
  box-shadow: 0 0 36px rgba(255, 62, 165, 0.45);
}

/* ── 5. Los títulos de bloque ── */
section h2 {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.8rem;
  opacity: 0.75;
}

/* ── 6. Enlaces ── */
a:hover {
  text-decoration: underline wavy var(--p-acento);
}

/* ── 7. Una animación propia ── */
@keyframes latido {
  0%, 100% { opacity: 0.6; }
  50%      { opacity: 1; }
}

header img {
  animation: latido 2.4s ease-in-out infinite;
  border: 2px solid var(--p-acento);
}

/* ── 8. En móvil, sin brillos ── */
@media (max-width: 640px) {
  section {
    box-shadow: none;
  }
}
```

**Esto pasa entero, sin un solo aviso.** Lo único que cambia el sanitizador es ponerle a
cada selector el prefijo de tu perfil y renombrar la animación:

```css
#perfil-<tuId> { --p-fondo: #0d0221; … }
#perfil-<tuId> { background: radial-gradient(…); }   /* el `body` se reescribe aquí */
#perfil-<tuId> header h1 { … }
#perfil-<tuId> section:hover { transform: translateY(-4px); … }
@keyframes p-<tuId>-latido { … }                      /* renombrada */
#perfil-<tuId> header img { animation: p-<tuId>-latido 2.4s ease-in-out infinite; }
@media (max-width: 640px) { #perfil-<tuId> section { box-shadow: none } }
```

Fíjate en dos cosas:

- **`body` no desaparece: se convierte en tu contenedor.** Escribes como si tu perfil fuera
  la página entera y el sanitizador lo traduce. Por eso el fondo funciona.
- **La animación se llama `latido` al escribirla y `p-<tuId>-latido` al guardarse.** El
  nombre de un `@keyframes` es global a toda la página: si dos perfiles usaran `latido`,
  o si usaras el mismo nombre que una animación de Wander, se pisarían. Renombrarla es lo
  que evita que tu CSS se salga de tu perfil por esa rendija.

---

## 3. El ejemplo que NO pasa — para ver la defensa trabajando

Pega esto y mira la lista de avisos amarilla:

```css
.navbar { display: none }                          /* apagar la barra de Wander */
.overlay { position: fixed; inset: 0; z-index: 9999 }  /* tapar la página */
@import url("//tracker.example/x.css");            /* traer CSS de fuera */
.espia { background: url(https://tracker.example/pixel.png) }  /* avisar a un tercero */
.x { width: expression(alert(1)) }                 /* ejecutar JS (IE) */
.y::after { content: attr(data-token) }            /* sacar un atributo a la vista */
@font-face { font-family: f; src: url(https://tracker.example/f.woff) }
```

Se guarda esto, y nada más:

```css
#perfil-<tuId> .navbar { display: none }
#perfil-<tuId> .overlay { inset: 0; z-index: 9999 }
```

Con seis avisos:

```
· Se quitó `position: fixed`.
· Se quitó `@import`.
· Se quitó `background: url(https://tracker.example/pixel.png)`.
· Se quitó `width: expression(alert(1))`.
· Se quitó `content: attr(data-token)`.
· Se quitó `@font-face`.
```

`.navbar` **sí se guarda**, y está bien que se guarde: ya no significa «la barra de
Wander», significa «un elemento con clase `navbar` dentro de mi perfil». Como ahí no hay
ninguno, no hace nada. La regla no se borra porque no hace falta: **prefijarla ya la
desarmó.**

---

## 4. Límites y cosas que te van a extrañar

| Cosa | Qué pasa |
|---|---|
| `position: fixed` y `sticky` | Se quitan (se escaparían de tu perfil). `relative` y `absolute` funcionan |
| `url()` a otro sitio | Se quita. Solo valen `/uploads/…` (tus archivos) y `data:image/…` |
| `@import`, `@font-face` | Se quitan enteros — los dos cargan cosas de fuera |
| `content` | **Prohibida siempre**, incluso `content: ""` |
| Un error de sintaxis | **No se guarda nada** y te dice la línea |
| Más de 20 KB o de 400 reglas | Se rechaza |
| `@media`, `@supports`, `@keyframes`, `@layer`, `@container` | Funcionan |

### La consecuencia molesta de prohibir `content`

**`::before` y `::after` no te van a servir para nada.** Un pseudo-elemento sin `content`
no llega a existir, y `content` está prohibida sin excepción, así que:

```css
section h2::before { content: "▸ "; color: var(--p-acento); }
```

se guarda como `#perfil-<tuId> section h2::before { color: var(--p-acento) }` — una regla
válida sobre un elemento que nunca se pinta. **No se rompe nada, simplemente no se ve.**

Es un precio real de la fase: `content: attr(…)` puede sacar a la vista atributos que el
perfil no muestra, y se optó por prohibir la propiedad entera en vez de intentar distinguir
`attr()` dentro de expresiones anidadas. Si algún día se quiere recuperar la decoración con
`::before`, lo correcto sería permitir `content` **solo con cadenas literales**, nunca con
`attr()` ni `url()`.

---

## 5. Si rompes tu perfil

Nada de lo que escribas aquí puede dejarte fuera:

- El **botón «Restaurar»** del panel borra tu CSS y te devuelve el perfil como estaba.
- `body { display: none }` es legal y **sí apaga tu propio perfil** (se traduce a
  `#perfil-<tuId> { display: none }`). No toca Wander ni el perfil de nadie más — solo el
  tuyo. El editor sigue funcionando, así que entras a `/editor` y le das a Restaurar.
- Tu CSS se guarda en dos versiones: la sanitizada, que es la que se sirve, y **la que tú
  escribiste**, que es la que ves al volver al editor — con tus comentarios y tu formato
  intactos.

---

## 6. Cómo probarlo en 30 segundos

1. Entra a `/editor`.
2. Abre el panel **«CSS propio»** (abajo de todo, tras los bloques).
3. Pega el bloque de la sección 2 y pulsa **Guardar CSS**.
4. La **vista previa de la derecha** se actualiza al momento — lleva el mismo id de scope
   que el perfil real, así que lo que ves ahí es lo que verá cualquiera.
5. Abre tu `/u/<tuHandle>` en otra pestaña para confirmarlo.
6. Ahora pega el bloque de la sección 3 y mira los avisos.
7. **Restaurar** para dejarlo como estaba.
