/**
 * E2E de la Fase 9 — CSS propio, contra el stack VIVO.
 *
 * Esta fase es distinta a las demás: casi todo lo que hay que probar es
 * que algo NO pasa. El CSS de un usuario es código que se ejecuta en el
 * navegador de todos los que visiten su perfil, así que la suite está
 * escrita como una lista de ataques, no como un flujo feliz:
 *
 *  1. **Que no se escape del perfil.** Ni por selector (`body`, `.navbar`),
 *     ni por propiedad (`position: fixed`), ni por anidamiento.
 *  2. **Que no llame a casa.** Ninguna `url()` a un host externo.
 *  3. **Que lo que se GUARDA sea lo sanitizado**, no lo que se mandó. Esto
 *     se comprueba leyendo la respuesta pública, que es lo que ve el
 *     visitante — no basta con que la API conteste 200.
 *  4. Que un perfil no pueda pisar a otro ni a la interfaz de Wander.
 *
 * Correrla desde dentro de la red Docker (el dominio público da error 1000
 * de Cloudflare desde el contenedor):
 *
 *   docker compose exec -T -e WANDER_INTERNO=1 -e WANDER_BASE=http://frontend:80 \
 *     backend node --input-type=module -e "$(cat docs/pruebas/e2e-fase9.mjs)"
 */

const BASE = process.env.WANDER_BASE ?? 'https://wander.ourocore.net';
const API = `${BASE}/api`;
const INTERNO = process.env.WANDER_INTERNO === '1';

let ok = 0;
let fallos = 0;
const errores = [];

function comprobar(nombre, condicion, detalle = '') {
  if (condicion) {
    ok++;
    console.log(`  ✓ ${nombre}`);
  } else {
    fallos++;
    errores.push(`${nombre}${detalle ? ` — ${detalle}` : ''}`);
    console.log(`  ✗ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  }
}

function seccion(titulo) {
  console.log(`\n── ${titulo} ${'─'.repeat(Math.max(0, 60 - titulo.length))}`);
}

function crearCliente(ipSimulada = null) {
  const galletas = new Map();
  return {
    galletas,
    async fetch(url, opciones = {}) {
      const cabeceras = new Headers(opciones.headers ?? {});
      if (INTERNO && ipSimulada) cabeceras.set('cf-connecting-ip', ipSimulada);
      if (galletas.size > 0) {
        cabeceras.set('cookie', [...galletas.entries()].map(([k, v]) => `${k}=${v}`).join('; '));
      }
      const r = await fetch(url, { ...opciones, headers: cabeceras, redirect: 'manual' });
      for (const [nombre, valor] of r.headers) {
        if (nombre.toLowerCase() !== 'set-cookie') continue;
        for (const trozo of valor.split(/,(?=[^;]+?=)/)) {
          const [par] = trozo.split(';');
          const idx = par.indexOf('=');
          if (idx > 0) {
            const k = par.slice(0, idx).trim();
            const v = par.slice(idx + 1).trim();
            if (v === '' || v === 'deleted') galletas.delete(k);
            else galletas.set(k, v);
          }
        }
      }
      return r;
    },
    json(url, opciones) {
      return this.fetch(url, opciones).then(async (r) => ({
        status: r.status,
        cuerpo: await r.json().catch(() => null),
      }));
    },
  };
}

const sufijo = Date.now().toString(36).slice(-6);
const usuarios = ['a', 'b'].map((letra) => ({
  email: `e2e9-${letra}-${sufijo}@ejemplo.test`,
  password: 'ContrasenaLarga123!',
  handle: `e2e9${letra}${sufijo}`,
  displayName: `Prueba ${letra.toUpperCase()}`,
}));

async function registrar(cliente, datos) {
  return cliente.fetch(`${API}/auth/registro`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...datos, aceptaTerminos: true }),
  });
}

/** Guarda CSS en el perfil propio y devuelve {status, cuerpo}. */
function guardarCss(cliente, css) {
  return cliente.json(`${API}/perfiles/mio`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cssPropio: css }),
  });
}

async function principal() {
  console.log(`\n🔍 E2E Fase 9 (CSS propio) — ${BASE}\n`);

  // ═══════════════════════════════════════════════════════════════════
  seccion('0. Preparación: dos usuarios con perfil publicado');

  const base = 50 + (Date.now() % 150);
  const A = crearCliente(`198.51.100.${base}`);
  const B = crearCliente(`198.51.100.${base + 1}`);
  const anon = crearCliente(`198.51.100.${base + 2}`);

  const registros = await Promise.all([registrar(A, usuarios[0]), registrar(B, usuarios[1])]);
  for (const [i, r] of registros.entries()) {
    comprobar(`Se registra el usuario ${'AB'[i]}`, r.status === 201 || r.status === 200, `HTTP ${r.status}`);
  }

  // Publicar los dos perfiles: un perfil sin publicar es 404 para anon y
  // no se podría comprobar lo que ve el visitante.
  for (const [i, cliente] of [A, B].entries()) {
    const r = await cliente.json(`${API}/perfiles/mio`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ publicado: true }),
    });
    comprobar(`Se publica el perfil de ${'AB'[i]}`, r.status === 200, `HTTP ${r.status}`);
  }

  const mio = await A.json(`${API}/perfiles/mio`);
  const perfilIdA = mio.cuerpo?.perfil?.id;
  comprobar('El perfil propio trae su id', typeof perfilIdA === 'string' && perfilIdA.length > 0);
  const scopeA = `#perfil-${perfilIdA}`;

  // ═══════════════════════════════════════════════════════════════════
  seccion('1. El scope: todo selector queda dentro del perfil');

  {
    const r = await guardarCss(A, '.tarjeta { color: red } .otra { color: blue }');
    comprobar('Se acepta un CSS normal', r.status === 200, `HTTP ${r.status}`);
    const css = r.cuerpo?.perfil?.cssPropio ?? '';
    comprobar('Cada selector queda prefijado', (css.match(/#perfil-/g) ?? []).length === 2, css);
    comprobar('No queda ningún selector sin prefijo', !/(^|})\s*\.tarjeta/.test(css), css);
  }

  {
    // El ataque clásico: apagar la interfaz de Wander desde un perfil.
    const r = await guardarCss(A, '.navbar { display: none } body { display: none }');
    comprobar('Se acepta (prefijado), no se rechaza', r.status === 200, `HTTP ${r.status}`);
    const css = r.cuerpo?.perfil?.cssPropio ?? '';
    comprobar('`.navbar` queda dentro del perfil', css.includes(`${scopeA} .navbar`), css);
    comprobar(
      '`body` se reescribe al contenedor, no queda suelto',
      !/(^|[},])\s*body\s*{/.test(css),
      css
    );
  }

  {
    const r = await guardarCss(A, ':root { --x: 1px } html { background: red }');
    const css = r.cuerpo?.perfil?.cssPropio ?? '';
    comprobar('`:root` no sobrevive tal cual', !css.includes(':root'), css);
    comprobar('`html` no sobrevive tal cual', !/(^|[},])\s*html\s*{/.test(css), css);
  }

  {
    // Las comas dentro de :is() no deben partir el selector.
    const r = await guardarCss(A, ':is(.a, .b) .c, .d { color: red }');
    const css = r.cuerpo?.perfil?.cssPropio ?? '';
    comprobar('`:is(a, b)` no se parte por su coma interna', css.includes(':is(.a, .b)'), css);
    comprobar('La coma de primer nivel sí separa y prefija las dos partes',
      (css.match(/#perfil-/g) ?? []).length === 2, css);
  }

  // ═══════════════════════════════════════════════════════════════════
  seccion('2. Propiedades que se escapan del contenedor');

  for (const [nombre, valor] of [['fixed', 'fixed'], ['sticky', 'sticky']]) {
    const r = await guardarCss(A, `.capa { position: ${valor}; top: 0; left: 0 }`);
    const css = r.cuerpo?.perfil?.cssPropio ?? '';
    comprobar(`Se quita \`position: ${nombre}\``, !css.includes(valor), css);
    comprobar(`Se avisa de que se quitó \`position: ${nombre}\``,
      (r.cuerpo?.avisosCss ?? []).some((a) => a.includes('position')), JSON.stringify(r.cuerpo?.avisosCss));
  }

  {
    // `relative`/`absolute` son legítimos DENTRO del perfil y no se tocan.
    const r = await guardarCss(A, '.a { position: relative } .b { position: absolute }');
    const css = r.cuerpo?.perfil?.cssPropio ?? '';
    comprobar('`position: relative` se conserva', css.includes('relative'), css);
    comprobar('`position: absolute` se conserva', css.includes('absolute'), css);
  }

  // ═══════════════════════════════════════════════════════════════════
  seccion('3. Nada de llamar a casa');

  for (const url of [
    'url(https://evil.example/pixel.png)',
    'url(//evil.example/pixel.png)',
    'url("http://evil.example/x.png")',
  ]) {
    const r = await guardarCss(A, `.a { background: ${url} }`);
    const css = r.cuerpo?.perfil?.cssPropio ?? '';
    comprobar(`Se quita una url externa: ${url}`, !css.includes('evil.example'), css);
  }

  {
    const r = await guardarCss(A, '@import url(//evil.example/x.css); .a { color: red }');
    const css = r.cuerpo?.perfil?.cssPropio ?? '';
    comprobar('Se quita `@import`', !css.includes('@import'), css);
    comprobar('Pero el resto del CSS sobrevive', css.includes('color: red'), css);
  }

  {
    const r = await guardarCss(A, '@font-face { font-family: x; src: url(//evil.example/f.woff) }');
    const css = r.cuerpo?.perfil?.cssPropio ?? '';
    comprobar('Se quita `@font-face`', !css.includes('font-face'), css);
  }

  {
    // Una variable CSS con una url externa, usada después: si el filtro
    // solo mirara `background`, esto se colaría.
    const r = await guardarCss(A, '.a { --f: url(//evil.example/x); background: var(--f) }');
    const css = r.cuerpo?.perfil?.cssPropio ?? '';
    comprobar('Se filtra también el valor de una variable CSS', !css.includes('evil.example'), css);
  }

  {
    // Las rutas propias sí se permiten: es donde viven los adjuntos.
    const r = await guardarCss(A, '.a { background: url(/uploads/x.png) }');
    const css = r.cuerpo?.perfil?.cssPropio ?? '';
    comprobar('Se permite una url de /uploads/', css.includes('/uploads/x.png'), css);
  }

  {
    const r = await guardarCss(A, '.a { background: url(data:image/png;base64,iVBORw0KGgo=) }');
    const css = r.cuerpo?.perfil?.cssPropio ?? '';
    comprobar('Se permite un data: de imagen', css.includes('data:image/png'), css);
  }

  {
    const r = await guardarCss(A, '.a { background: url("data:text/html;base64,PHNjcmlwdD4=") }');
    const css = r.cuerpo?.perfil?.cssPropio ?? '';
    comprobar('Se rechaza un data: que NO es imagen', !css.includes('text/html'), css);
  }

  // ═══════════════════════════════════════════════════════════════════
  seccion('4. Ejecución de código por CSS');

  for (const [nombre, css] of [
    ['expression()', '.a { width: expression(alert(1)) }'],
    ['-moz-binding', '.a { -moz-binding: url(/uploads/x.xml) }'],
    ['behavior', '.a { behavior: url(/uploads/x.htc) }'],
    ['content: attr()', '.a::after { content: attr(data-x) }'],
  ]) {
    const r = await guardarCss(A, css);
    const guardado = r.cuerpo?.perfil?.cssPropio ?? '';
    comprobar(`Se quita ${nombre}`, guardado === '' || guardado === null || !/(expression|binding|behavior|attr)/i.test(guardado), guardado);
  }

  // ═══════════════════════════════════════════════════════════════════
  seccion('5. Animaciones: el nombre es global, se renombra');

  {
    const r = await guardarCss(A, '@keyframes spin { from { opacity: 0 } to { opacity: 1 } } .a { animation: spin 1s }');
    const css = r.cuerpo?.perfil?.cssPropio ?? '';
    comprobar('El @keyframes se renombra con el id del perfil',
      css.includes(`@keyframes p-${perfilIdA}-spin`), css);
    comprobar('La referencia en `animation` se renombra igual',
      css.includes(`animation: p-${perfilIdA}-spin`), css);
    comprobar('No queda un `@keyframes spin` global', !/@keyframes spin\b/.test(css), css);
    comprobar('Los fotogramas NO se prefijan (from/to intactos)',
      css.includes('from') && css.includes('to') && !/#perfil-\S+ from/.test(css), css);
  }

  // ═══════════════════════════════════════════════════════════════════
  seccion('6. Límites y sintaxis');

  {
    const r = await guardarCss(A, '.a { color: red');
    comprobar('Un CSS que no parsea se RECHAZA con 400', r.status === 400, `HTTP ${r.status}`);
    comprobar('El error explica que es de sintaxis',
      /sintaxis/i.test(r.cuerpo?.error ?? ''), r.cuerpo?.error);
  }

  {
    const r = await guardarCss(A, 'a{color:red}'.repeat(500));
    comprobar('Un CSS con demasiadas reglas se rechaza', r.status === 400, `HTTP ${r.status}`);
  }

  {
    // 30 KB de CSS válido: por encima del tope de 20 KB.
    const r = await guardarCss(A, `.a { color: red; /* ${'x'.repeat(30000)} */ }`);
    comprobar('Un CSS de más de 20 KB se rechaza', r.status === 400, `HTTP ${r.status}`);
  }

  {
    // El CSS del ataque anterior NO puede haber quedado guardado.
    const r = await A.json(`${API}/perfiles/mio`);
    const css = r.cuerpo?.perfil?.cssPropio ?? '';
    comprobar('Tras los rechazos, el CSS guardado sigue siendo el último válido',
      !css.includes('x'.repeat(100)), css.slice(0, 80));
  }

  // ═══════════════════════════════════════════════════════════════════
  seccion('7. Lo que ve el visitante');

  {
    await guardarCss(A, '.tarjeta { border: 2px solid #f0f }');
    const r = await anon.json(`${API}/perfiles/${usuarios[0].handle}`);
    comprobar('El perfil público responde 200', r.status === 200, `HTTP ${r.status}`);

    const perfil = r.cuerpo?.perfil ?? {};
    comprobar('El perfil público incluye el CSS sanitizado', typeof perfil.cssPropio === 'string');
    comprobar('Ese CSS viene prefijado', (perfil.cssPropio ?? '').includes(scopeA), perfil.cssPropio);
    comprobar('El perfil público incluye el id para el scope', perfil.id === perfilIdA);

    // Lo importante de la fase: el ORIGINAL no sale nunca al público.
    comprobar('El CSS original NO se expone al visitante',
      !('cssOriginal' in perfil), JSON.stringify(Object.keys(perfil)));
  }

  {
    // El dueño sí recupera lo que escribió, para poder seguir editándolo.
    const r = await A.json(`${API}/perfiles/mio`);
    comprobar('El dueño sí recibe su CSS original',
      r.cuerpo?.perfil?.cssOriginal === '.tarjeta { border: 2px solid #f0f }',
      r.cuerpo?.perfil?.cssOriginal);
  }

  // ═══════════════════════════════════════════════════════════════════
  seccion('8. Aislamiento entre perfiles');

  {
    // B intenta escribir CSS con el scope de A a mano. Como el prefijado
    // se aplica igualmente, el resultado queda bajo el scope de B y no
    // puede tocar el perfil de A.
    const r = await guardarCss(B, `${scopeA} .tarjeta { display: none }`);
    const css = r.cuerpo?.perfil?.cssPropio ?? '';
    const perfilIdB = (await B.json(`${API}/perfiles/mio`)).cuerpo?.perfil?.id;
    comprobar('El CSS de B queda bajo el scope de B', css.includes(`#perfil-${perfilIdB}`), css);
    comprobar('B no puede escribir una regla que aplique al scope de A',
      !css.trimStart().startsWith(scopeA), css);
  }

  {
    // El CSS de B no aparece en el perfil de A.
    const r = await anon.json(`${API}/perfiles/${usuarios[0].handle}`);
    comprobar('El perfil de A no trae nada del CSS de B',
      !(r.cuerpo?.perfil?.cssPropio ?? '').includes('display: none'),
      r.cuerpo?.perfil?.cssPropio);
  }

  // ═══════════════════════════════════════════════════════════════════
  seccion('9. Autorización y restaurar');

  {
    const r = await anon.json(`${API}/perfiles/mio`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cssPropio: '.x { color: red }' }),
    });
    comprobar('Sin sesión no se puede guardar CSS', r.status === 401, `HTTP ${r.status}`);
  }

  {
    const r = await guardarCss(A, '');
    comprobar('Restaurar (cadena vacía) responde 200', r.status === 200, `HTTP ${r.status}`);
    comprobar('Restaurar deja el CSS en null', r.cuerpo?.perfil?.cssPropio === null,
      JSON.stringify(r.cuerpo?.perfil?.cssPropio));
    comprobar('Restaurar borra también el original', r.cuerpo?.perfil?.cssOriginal === null,
      JSON.stringify(r.cuerpo?.perfil?.cssOriginal));
  }

  {
    const r = await anon.json(`${API}/perfiles/${usuarios[0].handle}`);
    comprobar('Tras restaurar, el visitante ya no recibe CSS',
      r.cuerpo?.perfil?.cssPropio === null, JSON.stringify(r.cuerpo?.perfil?.cssPropio));
  }

  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`  ✓ ${ok} correctas   ✗ ${fallos} fallidas`);
  if (fallos > 0) {
    console.log('\n  Fallos:');
    for (const e of errores) console.log(`   · ${e}`);
  }
  console.log(`\n  Cuentas de prueba creadas (borrar al terminar):`);
  for (const u of usuarios) console.log(`   · ${u.handle}`);
  console.log(`${'═'.repeat(64)}\n`);
  process.exit(fallos > 0 ? 1 : 0);
}

principal().catch((e) => {
  console.error('\n💥 Error inesperado en la suite:', e);
  process.exit(1);
});
