/**
 * Auditoría de accesibilidad de las pantallas CON SESIÓN (Fase 10).
 *
 * Se registra UNA cuenta y se reutiliza su contexto para todas las rutas,
 * porque el límite de registros es de 5 por hora y por IP. La cuenta se
 * asciende a ADMIN por SQL para poder auditar también `/admin`: el primer
 * administrador no se puede crear desde la aplicación, porque el endpoint
 * de roles ya exige serlo.
 *
 * ── Cómo correrla ──────────────────────────────────────────────────
 *
 *   npm i playwright @axe-core/playwright
 *   npx playwright install chromium
 *   node docs/pruebas/a11y-privadas.mjs
 *
 * ── Lo que encontró (31/07/2026) ───────────────────────────────────
 *
 *  · Dos defectos reales en `/editor`: el input de archivo del avatar sin
 *    nombre accesible (CRITICAL) y el contador de caracteres de la bio por
 *    debajo del contraste mínimo. Ambos corregidos.
 *  · Y **un fallo del producto que no era de accesibilidad**: las rutas
 *    rebotaban al login sin motivo. La causa era el límite de tasa de
 *    nginx: `/api/auth/yo` caía bajo la zona de contraseñas (5 r/m), y la
 *    SPA la llama en CADA carga de página, así que la tercera navegación
 *    de un minuto devolvía 429 y la guarda de rutas expulsaba al usuario.
 *    Se arregló sacando las lecturas de sesión de esa zona (ver el
 *    comentario largo en nginx.conf). Sin esta auditoría no se habría
 *    encontrado: se manifestaba como "la sesión se cae sola".
 */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { execSync } from 'node:child_process';

const BASE = process.env.WANDER_BASE ?? 'https://wander.ourocore.net';
const SUF = Math.random().toString(36).slice(2, 7);
const HANDLE = `a11y${SUF}`;
const PASS = 'Prueba-A11y-2026';

const RUTAS = ['/feed', '/editor', '/mensajes', '/notificaciones', '/configuracion', '/admin'];
const ANCHOS = [
  { nombre: 'movil', width: 390, height: 844 },
  { nombre: 'escritorio', width: 1440, height: 900 },
];

const navegador = await chromium.launch();
const ctx = await navegador.newContext({ viewport: ANCHOS[1] });
const pagina = await ctx.newPage();

// Registro por API dentro del navegador, para heredar sus cookies.
const alta = await pagina.request.post(`${BASE}/api/auth/registro`, {
  data: {
    email: `${HANDLE}@ejemplo.test`,
    password: PASS,
    handle: HANDLE,
    displayName: 'Auditoría',
    aceptaTerminos: true,
  },
});
if (!alta.ok()) {
  console.log(`No se pudo registrar: ${alta.status()} ${await alta.text()}`);
  process.exit(1);
}

function sql(consulta) {
  return execSync(
    `docker compose exec -T db psql -U wander -d wander -t -A -c ${JSON.stringify(consulta)}`,
    { cwd: new URL('../..', import.meta.url).pathname, encoding: 'utf8' }
  ).trim();
}
// ADMIN para poder auditar también /admin. El rol se lee de la base en
// cada petición, así que basta con recargar una página para que el
// authStore lo recoja.
sql(`UPDATE "User" SET rol='ADMIN' WHERE handle='${HANDLE}';`);
await pagina.goto(`${BASE}/feed`, { waitUntil: 'networkidle' });

const hallazgos = new Map();
const desbordes = [];

for (const vp of ANCHOS) {
  await pagina.setViewportSize({ width: vp.width, height: vp.height });

  for (const ruta of RUTAS) {
    try {
      await pagina.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle', timeout: 30000 });
      await pagina.waitForTimeout(800);

      let url = pagina.url();
      if (url.includes('/login')) {
        // La rotación del refresh token puede pillar a la SPA a medio
        // arrancar; se reintenta una vez antes de darla por perdida.
        await pagina.waitForTimeout(1500);
        await pagina.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle', timeout: 30000 });
        await pagina.waitForTimeout(800);
        url = pagina.url();
      }
      if (url.includes('/login')) {
        console.log(`  ! ${ruta}@${vp.nombre}: rebotó al login`);
        continue;
      }

      const { violations } = await new AxeBuilder({ page: pagina })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      for (const v of violations) {
        if (!hallazgos.has(v.id)) {
          hallazgos.set(v.id, {
            id: v.id,
            impacto: v.impact,
            descripcion: v.help,
            donde: new Set(),
            ejemplos: new Set(),
          });
        }
        const h = hallazgos.get(v.id);
        h.donde.add(`${ruta}@${vp.nombre}`);
        for (const n of v.nodes.slice(0, 2)) h.ejemplos.add(n.html.slice(0, 170));
      }

      const desborde = await pagina.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      if (desborde > 2) desbordes.push(`${ruta}@${vp.nombre}: +${desborde}px`);
    } catch (e) {
      console.log(`  ! ${ruta}@${vp.nombre}: ${e.message.split('\n')[0]}`);
    }
  }
}

await navegador.close();
sql(`DELETE FROM "User" WHERE handle='${HANDLE}';`);

console.log(`\n${'═'.repeat(60)}\nPANTALLAS CON SESIÓN\n${'═'.repeat(60)}`);
const orden = { critical: 0, serious: 1, moderate: 2, minor: 3 };
const lista = [...hallazgos.values()].sort(
  (a, b) => (orden[a.impacto] ?? 9) - (orden[b.impacto] ?? 9)
);
if (lista.length === 0) console.log('\n  Ninguna violación.\n');
else
  for (const h of lista) {
    console.log(`\n[${(h.impacto ?? '?').toUpperCase()}] ${h.id}`);
    console.log(`  ${h.descripcion}`);
    console.log(`  Dónde: ${[...h.donde].join(', ')}`);
    for (const ej of h.ejemplos) console.log(`  · ${ej}`);
  }

console.log(`\nDESBORDE: ${desbordes.length === 0 ? 'ninguno' : desbordes.join(', ')}\n`);
