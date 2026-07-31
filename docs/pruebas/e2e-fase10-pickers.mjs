/**
 * Verificación de los dos arreglos de los selectores, en un navegador real
 * contra el stack vivo:
 *
 *  1. El de emojis PINTA emojis (antes: shadow DOM con solo el `<style>`).
 *  2. Ningún panel se sale por arriba ni por abajo de la ventana — que es
 *     lo que impedía buscar GIFs.
 */
import { chromium } from 'playwright';

const BASE = process.env.WANDER_BASE ?? 'https://wander.ourocore.net';
const cuenta = JSON.parse(process.env.CUENTA);

let ok = 0;
let fallos = 0;
const errores = [];
function comprobar(nombre, cond, detalle = '') {
  if (cond) {
    ok++;
    console.log(`  ✓ ${nombre}`);
  } else {
    fallos++;
    errores.push(`${nombre}${detalle ? ` — ${detalle}` : ''}`);
    console.log(`  ✗ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  }
}

const navegador = await chromium.launch();

async function abrirSesion(ctx) {
  const p = await ctx.newPage();
  await p.request.post(`${BASE}/api/auth/login`, {
    data: { email: cuenta.email, password: cuenta.password },
  });
  await ctx.addCookies((await p.request.storageState()).cookies);
  return p;
}

// ── 1. Emojis en el feed ────────────────────────────────────────────
{
  console.log('\n── Selector de emojis (feed) ──');
  const ctx = await navegador.newContext({ locale: 'es-MX' });
  const pag = await abrirSesion(ctx);
  const fallosDeRed = [];
  pag.on('pageerror', (e) => fallosDeRed.push(e.message));

  await pag.goto(`${BASE}/feed`, { waitUntil: 'networkidle' });
  await pag.locator('button[aria-label="Emojis"]').first().click();
  await pag.waitForTimeout(3500);

  const r = await pag.evaluate(() => {
    const p = document.querySelector('em-emoji-picker');
    const sr = p?.shadowRoot;
    const caja = p?.getBoundingClientRect();
    return {
      // Los botones de emoji no tienen clase `.emoji`: son los de las
      // filas dentro de `.category`.
      botonesEmoji: sr ? sr.querySelectorAll('.category button').length : -1,
      buscador: sr?.querySelector('input[type="search"]')?.placeholder ?? null,
      categorias: sr ? sr.querySelectorAll('#nav button').length : -1,
      top: caja?.top ?? null,
      bottom: caja?.bottom ?? null,
      alturaVentana: window.innerHeight,
    };
  });

  comprobar('el picker pinta emojis', r.botonesEmoji > 100, `botones=${r.botonesEmoji}`);
  comprobar('tiene barra de búsqueda', Boolean(r.buscador), `placeholder=${r.buscador}`);
  comprobar('el buscador está en español', r.buscador === 'Buscar', `="${r.buscador}"`);
  comprobar('tiene categorías', r.categorias > 3, `n=${r.categorias}`);
  comprobar('no se sale por arriba', r.top >= 0, `top=${Math.round(r.top)}`);
  comprobar(
    'no se sale por abajo',
    r.bottom <= r.alturaVentana,
    `bottom=${Math.round(r.bottom)} ventana=${r.alturaVentana}`
  );
  comprobar('sin peticiones fallidas', fallosDeRed.length === 0, fallosDeRed.join(' | '));
  await ctx.close();
}

// ── 2. GIFs en el feed ──────────────────────────────────────────────
{
  console.log('\n── Selector de GIFs (feed) ──');
  const ctx = await navegador.newContext({ locale: 'es-MX' });
  const pag = await abrirSesion(ctx);
  await pag.goto(`${BASE}/feed`, { waitUntil: 'networkidle' });

  // El botón solo aparece cuando `/api/archivos/limites` responde que hay
  // clave de Giphy, así que hay que esperarlo en vez de mirarlo de golpe.
  const botonGif = pag.locator('button[aria-label="Buscar GIFs"]');
  await botonGif.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  if ((await botonGif.count()) === 0) {
    comprobar('hay botón de GIF (requiere GIPHY_API_KEY)', false, 'no está en el DOM');
  } else {
    await botonGif.first().click();
    await pag.waitForTimeout(3000);

    const r = await pag.evaluate(() => {
      const inp = document.querySelector('input[type="search"]');
      const panel = inp?.closest('div.absolute');
      const caja = panel?.getBoundingClientRect();
      const cajaInput = inp?.getBoundingClientRect();
      return {
        hayPanel: Boolean(panel),
        top: caja?.top ?? null,
        bottom: caja?.bottom ?? null,
        inputTop: cajaInput?.top ?? null,
        inputVisible: cajaInput ? cajaInput.top >= 0 && cajaInput.bottom <= window.innerHeight : false,
        imagenes: panel?.querySelectorAll('img').length ?? -1,
        alturaVentana: window.innerHeight,
      };
    });

    comprobar('el panel de GIFs existe', r.hayPanel);
    comprobar('no se sale por arriba', r.top >= 0, `top=${Math.round(r.top)}`);
    comprobar(
      'no se sale por abajo',
      r.bottom <= r.alturaVentana,
      `bottom=${Math.round(r.bottom)} ventana=${r.alturaVentana}`
    );
    // Lo que reportó el usuario: la barra de búsqueda quedaba fuera.
    comprobar('la barra de búsqueda es visible', r.inputVisible, `top=${Math.round(r.inputTop)}`);
    comprobar('llegan GIFs de Giphy', r.imagenes > 0, `imgs=${r.imagenes}`);

    // Y que se pueda buscar de verdad.
    await pag.locator('input[type="search"]').first().fill('gato');
    await pag.waitForTimeout(2500);
    const tras = await pag.evaluate(() => {
      const inp = document.querySelector('input[type="search"]');
      return inp?.closest('div.absolute')?.querySelectorAll('img').length ?? -1;
    });
    comprobar('buscar "gato" devuelve resultados', tras > 0, `imgs=${tras}`);
  }
  await ctx.close();
}

// ── 3. Ventana baja: el panel se adapta ─────────────────────────────
{
  console.log('\n── Ventana baja (600×500) ──');
  const ctx = await navegador.newContext({ locale: 'es-MX', viewport: { width: 600, height: 500 } });
  const pag = await abrirSesion(ctx);
  await pag.goto(`${BASE}/feed`, { waitUntil: 'networkidle' });
  await pag.locator('button[aria-label="Emojis"]').first().click();
  await pag.waitForTimeout(3500);

  const r = await pag.evaluate(() => {
    const p = document.querySelector('em-emoji-picker');
    const c = p?.getBoundingClientRect();
    return {
      top: c?.top ?? null,
      bottom: c?.bottom ?? null,
      alto: c?.height ?? null,
      ventana: window.innerHeight,
      botones: p?.shadowRoot?.querySelectorAll('.category button').length ?? -1,
    };
  });

  comprobar('sigue pintando emojis', r.botones > 100, `botones=${r.botones}`);
  comprobar('cabe en la ventana', r.top >= 0 && r.bottom <= r.ventana,
    `top=${Math.round(r.top)} bottom=${Math.round(r.bottom)} ventana=${r.ventana}`);
  comprobar('el alto se recortó', r.alto < 435, `alto=${Math.round(r.alto)}`);
  await ctx.close();
}

await navegador.close();
console.log(`\n${'='.repeat(50)}\n  ${ok} en verde, ${fallos} en rojo`);
if (errores.length) {
  console.log('\nFallos:');
  for (const e of errores) console.log(`  · ${e}`);
}
process.exit(fallos ? 1 : 0);
