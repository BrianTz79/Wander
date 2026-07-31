/**
 * Verificación de la puerta de entrada a la mensajería (Fase 10), en un
 * navegador real contra el stack vivo.
 *
 * Lo que se comprueba es justo lo que faltaba: que se pueda EMPEZAR una
 * conversación. Antes la API existía pero ningún botón la llamaba.
 *
 * ── Cómo correrla ──────────────────────────────────────────────────
 *
 *   CUENTAS='[{...A},{...B},{...C}]' node docs/pruebas/e2e-fase10-mensajes.mjs
 *
 * Hacen falta TRES cuentas con el perfil publicado. A y B se usan para el
 * flujo feliz; C solo para comprobar que `privacidadDm` se respeta, y tiene
 * que ser una cuenta con la que A NO tenga ya un DM abierto (`abrirDm` es
 * idempotente: si el hilo existe, el botón lleva a él y la comprobación
 * dejaría de medir lo que pretende).
 *
 * **Ojo con los límites de tasa** (§ pendientes de PROYECTO.md): son 5
 * registros por hora y 5 inicios de sesión por 15 min, POR IP. Esta suite
 * abre varios contextos de navegador, así que inicia sesión una sola vez
 * por cuenta y reutiliza las cookies. Los contadores viven en memoria:
 * `docker compose restart backend` los pone a cero.
 *
 * Al terminar, limpiar:
 *   DELETE FROM "User" WHERE email LIKE '%@ejemplo.test';
 *   DELETE FROM "Conversacion" c WHERE NOT EXISTS (
 *     SELECT 1 FROM "Participante" p WHERE p."conversacionId" = c.id);
 * La segunda hace falta porque `Conversacion` no tiene FK a `User`.
 */
import { chromium } from 'playwright';

const BASE = process.env.WANDER_BASE ?? 'https://wander.ourocore.net';
const cuentas = JSON.parse(process.env.CUENTAS);
const [A, B, C] = cuentas;

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

const SUF = Math.random().toString(36).slice(2, 6);
const GRUPO = `Grupo F10 ${SUF}`;
const navegador = await chromium.launch();

/*
 * Las cookies se piden UNA VEZ por cuenta y se reutilizan.
 *
 * `limiteAuth` son 5 inicios de sesión por IP cada 15 minutos, y esta suite
 * abre media docena de contextos: iniciando sesión en cada uno, a mitad de
 * la tanda el servidor devuelve 429, la sesión no se crea y la guarda de
 * rutas manda a `/login`. La prueba entonces «falla» por algo que no tiene
 * nada que ver con lo que está midiendo — pasó, y el diagnóstico fue que la
 * página era `/login`, no que faltara el botón.
 */
const galletasPorCuenta = new Map();

async function sesion(cuenta, viewport) {
  const ctx = await navegador.newContext({ locale: 'es-MX', ...(viewport ? { viewport } : {}) });
  const p = await ctx.newPage();

  if (!galletasPorCuenta.has(cuenta.email)) {
    const r = await p.request.post(`${BASE}/api/auth/login`, {
      data: { email: cuenta.email, password: cuenta.password },
    });
    if (!r.ok()) throw new Error(`login de ${cuenta.email}: ${r.status()} (¿límite de tasa?)`);
    galletasPorCuenta.set(cuenta.email, (await p.request.storageState()).cookies);
  }

  await ctx.addCookies(galletasPorCuenta.get(cuenta.email));
  return { ctx, pag: p };
}

// ── 0. El botón respeta `privacidadDm` ──────────────────────────────
/*
 * Por defecto `privacidadDm` es «seguidos», así que A no puede escribirle
 * a C mientras C no le siga. El botón tiene que DECIRLO, no fallar en
 * silencio ni navegar a una conversación que no existe.
 *
 * Se usa una TERCERA cuenta y no B: `abrirDm` es idempotente, así que en
 * cuanto el resto de la suite abre el DM con B, volver a pulsar el botón
 * llevaría —correctamente— al hilo que ya existe, y la comprobación
 * dependería del orden en que se corren las secciones.
 */
{
  console.log('\n── El botón respeta la privacidad de DMs ──');
  const { ctx, pag } = await sesion(A);
  await pag.goto(`${BASE}/u/${C.handle}`, { waitUntil: 'networkidle' });
  await pag.waitForTimeout(1500);
  await pag.getByRole('button', { name: 'Mensaje', exact: true }).first().click();
  await pag.waitForTimeout(3000);

  comprobar('no navega si el servidor lo rechaza', !/\/mensajes\//.test(pag.url()), pag.url());
  const aviso = await pag.getByText(/solo acepta mensajes/i).count();
  comprobar('explica por qué no se puede', aviso > 0);
  await ctx.close();
}

// ── 1. Botón «Mensaje» en el perfil de otra persona ─────────────────
{
  console.log('\n── Botón «Mensaje» en el perfil ──');
  const { ctx, pag } = await sesion(A);

  /*
   * Para que el DM esté permitido, B sigue a A. Es la regla real del
   * producto («seguidos»), no un rodeo de la prueba.
   */
  const sesionB = await sesion(B);
  const seg = await sesionB.pag.request.post(
    `${BASE}/api/social/usuarios/${A.handle}/seguir`
  );
  comprobar('B sigue a A (permite el DM)', seg.ok(), `estado=${seg.status()}`);
  await sesionB.ctx.close();

  await pag.goto(`${BASE}/u/${B.handle}`, { waitUntil: 'networkidle' });
  await pag.waitForTimeout(2000);

  const boton = pag.getByRole('button', { name: 'Mensaje', exact: true });
  const hay = (await boton.count()) > 0;
  comprobar('el perfil ajeno tiene botón «Mensaje»', hay);

  if (hay) {
    await boton.first().click();
    await pag.waitForURL(/\/mensajes\/.+/, { timeout: 15000 }).catch(() => {});
    comprobar('lleva a la conversación', /\/mensajes\/.+/.test(pag.url()), pag.url());

    // Y se puede escribir de verdad.
    const area = pag.locator('#mensaje');
    await area.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    if (await area.count()) {
      await area.fill('Hola desde la prueba de la Fase 10');
      await pag.getByRole('button', { name: 'Enviar' }).first().click();
      await pag.waitForTimeout(2500);
      const pintado = await pag
        .getByText('Hola desde la prueba de la Fase 10')
        .count();
      comprobar('el mensaje se envía y se pinta', pintado > 0);
    } else {
      comprobar('hay caja para escribir', false, 'no apareció #mensaje');
    }
  }
  await ctx.close();
}

// ── 2. El propio perfil NO ofrece escribirse a uno mismo ────────────
{
  console.log('\n── Perfil propio ──');
  const { ctx, pag } = await sesion(A);
  await pag.goto(`${BASE}/u/${A.handle}`, { waitUntil: 'networkidle' });
  await pag.waitForTimeout(2000);
  const n = await pag.getByRole('button', { name: 'Mensaje', exact: true }).count();
  comprobar('el perfil propio no tiene botón «Mensaje»', n === 0, `encontrados=${n}`);
  await ctx.close();
}

// ── 3. Diálogo de nueva conversación en /mensajes ───────────────────
{
  console.log('\n── Diálogo «Nueva conversación» ──');
  const { ctx, pag } = await sesion(A);
  await pag.goto(`${BASE}/mensajes`, { waitUntil: 'domcontentloaded' });
  await pag.waitForTimeout(4000);

  // `exact` + el primero: al abrirse el diálogo, su pestaña se llama igual
  // que este botón y la búsqueda por rol se volvería ambigua.
  const abrir = pag.locator('aside button.btn-primario');
  await abrir.first().waitFor({ state: 'visible', timeout: 25000 }).catch(() => {});
  const nBotones = await abrir.count();
  if (nBotones === 0) {
    console.log(
      '    DIAGNÓSTICO:',
      JSON.stringify(
        await pag.evaluate(() => ({
          url: location.href,
          hayAside: !!document.querySelector('aside'),
          texto: document.body.innerText.slice(0, 200),
        }))
      )
    );
  }
  comprobar('hay botón «Nueva conversación»', nBotones > 0);

  await abrir.first().click();
  const dialogo = pag.getByRole('dialog');
  await dialogo.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  comprobar('se abre el diálogo', await dialogo.isVisible().catch(() => false));

  // Buscar a B por su handle.
  await pag.locator('#buscar-personas').fill(B.handle);
  await pag.waitForTimeout(2500);
  const resultado = pag.getByRole('button', { name: new RegExp(B.handle, 'i') });
  comprobar('la búsqueda encuentra a la otra persona', (await resultado.count()) > 0);

  // Escape lo cierra.
  await pag.keyboard.press('Escape');
  await pag.waitForTimeout(600);
  comprobar('Escape cierra el diálogo', !(await dialogo.isVisible().catch(() => false)));
  await ctx.close();
}

// ── 4. Crear un grupo ───────────────────────────────────────────────
{
  console.log('\n── Crear un grupo ──');
  const { ctx, pag } = await sesion(A);
  await pag.goto(`${BASE}/mensajes`, { waitUntil: 'domcontentloaded' });
  await pag.waitForTimeout(4000);
  await pag.locator('aside button.btn-primario').first().click();
  await pag.getByRole('dialog').waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});

  await pag.getByRole('tab', { name: 'Nuevo grupo' }).click();
  await pag.locator('#nombre-grupo').fill(GRUPO);
  await pag.locator('#buscar-personas').fill(B.handle);
  await pag.waitForTimeout(2500);

  const persona = pag.getByRole('button', { name: new RegExp(B.handle, 'i') });
  if (await persona.count()) {
    await persona.first().click();
    await pag.waitForTimeout(500);

    const crear = pag.getByRole('button', { name: 'Crear grupo' });
    comprobar('el botón de crear se habilita', await crear.first().isEnabled());
    await crear.first().click();
    await pag.waitForURL(/\/mensajes\/.+/, { timeout: 15000 }).catch(() => {});
    comprobar('el grupo se crea y se abre', /\/mensajes\/.+/.test(pag.url()), pag.url());

    // El nombre del grupo sale en la cabecera del hilo.
    await pag.waitForTimeout(2000);
    const conNombre = await pag.getByText(GRUPO).count();
    comprobar('el hilo muestra el nombre del grupo', conNombre > 0);
  } else {
    comprobar('se puede elegir a alguien para el grupo', false, 'no salió en la búsqueda');
  }
  await ctx.close();
}

// ── 5. La conversación aparece en la bandeja de B ───────────────────
{
  console.log('\n── La otra persona la recibe ──');
  const { ctx, pag } = await sesion(B);
  await pag.goto(`${BASE}/mensajes`, { waitUntil: 'domcontentloaded' });
  await pag.waitForTimeout(4000);
  await pag.waitForTimeout(2500);

  const bandeja = await pag.locator('aside button').allTextContents();
  const texto = bandeja.join(' | ');
  // El DM llega como solicitud si B no sigue a A; el grupo va a la bandeja.
  const enBandeja = new RegExp(GRUPO).test(texto);

  if (!enBandeja) {
    // Puede estar en «Solicitudes»: se mira ahí también.
    await pag.getByRole('tab', { name: 'Solicitudes' }).click();
    await pag.waitForTimeout(2000);
    const sol = (await pag.locator('aside button').allTextContents()).join(' | ');
    comprobar(
      'la conversación le llega (bandeja o solicitudes)',
      new RegExp(GRUPO).test(sol) || new RegExp(A.displayName, 'i').test(sol),
      `bandeja=[${texto}] solicitudes=[${sol}]`
    );
  } else {
    comprobar('la conversación le llega', true);
  }
  await ctx.close();
}

// ── 6. Móvil: el botón sigue accesible ──────────────────────────────
{
  console.log('\n── Móvil (390×844) ──');
  const { ctx, pag } = await sesion(A, { width: 390, height: 844 });
  await pag.goto(`${BASE}/mensajes`, { waitUntil: 'domcontentloaded' });
  await pag.waitForTimeout(4000);
  await pag.waitForTimeout(1500);
  const b = pag.getByRole('button', { name: 'Nueva conversación' });
  comprobar('el botón es visible en móvil', await b.first().isVisible().catch(() => false));

  await b.first().click();
  await pag.waitForTimeout(1200);
  const cabe = await pag.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return null;
    const c = d.getBoundingClientRect();
    return c.left >= 0 && c.right <= window.innerWidth && c.top >= 0;
  });
  comprobar('el diálogo cabe en la pantalla', cabe === true, `cabe=${cabe}`);
  await ctx.close();
}

await navegador.close();
console.log(`\n${'='.repeat(50)}\n  ${ok} en verde, ${fallos} en rojo`);
if (errores.length) {
  console.log('\nFallos:');
  for (const e of errores) console.log(`  · ${e}`);
}
process.exit(fallos ? 1 : 0);
