/**
 * El reproductor de música en un navegador real (Fase 11).
 *
 * Comprueba lo que la suite de API no puede ver: que el reproductor se
 * pinte, que el autoplay bloqueado no rompa nada, que el volumen del
 * visitante se recuerde entre perfiles y que el ajuste de cuenta gane.
 *
 * ── Cómo correrla ──────────────────────────────────────────────────
 *
 * `playwright` NO es dependencia del proyecto (solo del arnés de pruebas),
 * así que se instala aparte y la suite se corre desde donde esté:
 *
 *   npm i playwright && npx playwright install chromium
 *   node <ruta a este archivo>
 *
 * Chromium bloquea el autoplay igual que Chrome real mientras no se le
 * pase `--autoplay-policy`, que es justo lo que aquí interesa comprobar:
 * no se le pasa a propósito.
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';

const BASE = process.env.WANDER_BASE ?? 'https://wander.ourocore.net';
const SUF = Math.random().toString(36).slice(2, 7);
const H = `repro${SUF}`;

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

function sql(c) {
  return execSync(
    `docker compose exec -T db psql -U wander -d wander -t -A -c ${JSON.stringify(c)}`,
    { cwd: new URL('../..', import.meta.url).pathname, encoding: 'utf8' }
  ).trim();
}

function wav(seg = 1) {
  const tasa = 8000;
  const m = tasa * seg;
  const b = Buffer.alloc(44 + m * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + m * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22); b.writeUInt32LE(tasa, 24); b.writeUInt32LE(tasa * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(m * 2, 40);
  return b;
}

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
const pag = await ctx.newPage();

// Cuenta con música y perfil publicado.
const alta = await pag.request.post(`${BASE}/api/auth/registro`, {
  data: { email: `${H}@ejemplo.test`, password: 'Prueba-Repro-2026', handle: H, displayName: 'Repro', aceptaTerminos: true },
});
if (!alta.ok()) { console.log('registro falló', alta.status(), await alta.text()); process.exit(1); }

const sub = await pag.request.post(`${BASE}/api/archivos`, {
  multipart: {
    archivos: { name: 'x.wav', mimeType: 'audio/wav', buffer: wav(2) },
    uso: 'audio-perfil',
  },
});
const audioUrl = (await sub.json())?.archivos?.[0]?.url;

await pag.request.patch(`${BASE}/api/perfiles/mio`, {
  data: { audioUrl, audioTitulo: 'Tema', audioArtista: 'Suite', audioVolumen: 40, audioAutoplay: true, audioLoop: true, publicado: true },
});

console.log(`\nReproductor en navegador — @${H}\n`);

console.log('── Se pinta y es usable ──');
await pag.goto(`${BASE}/u/${H}`, { waitUntil: 'networkidle' });
await pag.waitForTimeout(1500);

const region = pag.getByRole('region', { name: /música|music/i });
comprobar('el reproductor aparece en el perfil', await region.isVisible().catch(() => false));

const audioEl = pag.locator('audio');
comprobar('hay un elemento <audio>', (await audioEl.count()) === 1, `hay ${await audioEl.count()}`);
comprobar(
  'muestra el título y el artista',
  (await region.textContent().catch(() => '') ?? '').includes('Tema'),
  await region.textContent().catch(() => '(sin región)')
);

console.log('\n── Autoplay bloqueado: no rompe nada ──');
{
  // Chromium sin `--autoplay-policy` bloquea igual que Chrome real.
  const pausado = await audioEl.evaluate((el) => el.paused).catch(() => null);
  comprobar('el audio queda pausado si el navegador lo bloquea', pausado === true, `paused=${pausado}`);

  const botonPlay = pag.getByRole('button', { name: /reproducir|play/i });
  comprobar('se ofrece un botón de reproducir', await botonPlay.isVisible().catch(() => false));

  // Al pulsar hay interacción real, así que el navegador ya deja sonar.
  await botonPlay.click();
  await pag.waitForTimeout(900);
  const sonando = await audioEl.evaluate((el) => !el.paused).catch(() => null);
  comprobar('al pulsar, empieza a sonar', sonando === true, `paused=${!sonando}`);
}

console.log('\n── El volumen es del visitante ──');
{
  const vol = await audioEl.evaluate((el) => Math.round(el.volume * 100));
  comprobar('arranca al volumen que propuso el dueño (40)', vol === 40, `es ${vol}`);

  const control = pag.locator('#volumen-perfil');
  await control.fill('15');
  await pag.waitForTimeout(400);
  const vol2 = await audioEl.evaluate((el) => Math.round(el.volume * 100));
  comprobar('el visitante puede cambiarlo', vol2 === 15, `es ${vol2}`);

  const guardado = await pag.evaluate(() => localStorage.getItem('wander:volumen-perfil'));
  comprobar('la preferencia se guarda para otros perfiles', guardado === '15', `guardado: ${guardado}`);

  // Recargar: el volumen del visitante gana sobre el del dueño.
  await pag.reload({ waitUntil: 'networkidle' });
  await pag.waitForTimeout(1200);
  const vol3 = await pag.locator('audio').evaluate((el) => Math.round(el.volume * 100));
  comprobar('al volver, manda el volumen del visitante y no el del perfil', vol3 === 15, `es ${vol3}`);
}

console.log('\n── Silenciar ──');
{
  const botonMute = pag.getByRole('button', { name: /silenciar|mute/i });
  await botonMute.click();
  await pag.waitForTimeout(400);
  const mudo = await pag.locator('audio').evaluate((el) => el.muted);
  comprobar('el botón de silencio corta el sonido', mudo === true, `muted=${mudo}`);
  const g = await pag.evaluate(() => localStorage.getItem('wander:silencio-perfil'));
  comprobar('el silencio también se recuerda', g === '1', `guardado: ${g}`);
}

console.log('\n── El ajuste de cuenta gana ──');
{
  sql(`UPDATE "User" SET "reproducirMusica"=false WHERE handle='${H}';`);
  await pag.goto(`${BASE}/u/${H}`, { waitUntil: 'networkidle' });
  await pag.waitForTimeout(1500);

  const hayAudio = await pag.locator('audio').count();
  comprobar('con la música apagada, ni se monta el <audio>', hayAudio === 0, `hay ${hayAudio}`);
  const hayRegion = await pag.getByRole('region', { name: /música|music/i }).isVisible().catch(() => false);
  comprobar('tampoco se pinta el reproductor', hayRegion === false);
}

await nav.close();
sql(`DELETE FROM "User" WHERE handle='${H}';`);
console.log('\n  · cuenta de prueba borrada');

console.log(`\n${'─'.repeat(50)}`);
console.log(`  ${ok} correctas · ${fallos} fallidas`);
if (fallos > 0) { console.log('\nFallos:'); for (const e of errores) console.log(`  · ${e}`); }
process.exit(fallos > 0 ? 1 : 0);
