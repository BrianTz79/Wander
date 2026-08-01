/**
 * Auditoría de accesibilidad y responsive de las pantallas PÚBLICAS
 * (Fase 10).
 *
 * Pasa axe-core (WCAG 2.1 AA) por cada pantalla en tres anchos y reporta
 * las violaciones agrupadas por regla. También comprueba lo que axe no
 * mira: que el documento no haga scroll horizontal, que es el fallo de
 * responsive que más se nota en un teléfono.
 *
 * ── Cómo correrla ──────────────────────────────────────────────────
 *
 *   npm i playwright @axe-core/playwright   # no son dependencias del
 *   npx playwright install chromium         # proyecto: solo del arnés
 *   node docs/pruebas/a11y-publicas.mjs
 *
 * La primera pasada (31/07/2026) encontró tres elementos por debajo del
 * 4.5:1 de contraste —el separador «o» del login, el prefijo `/u/` del
 * registro y el enlace de "inicia sesión para comentar"— y ningún
 * desborde. Corregidos, quedó en cero.
 *
 * El enlace del muro es el caso interesante: lo colorea `--p-acento`, que
 * elige el dueño del perfil, así que no se puede garantizar un contraste
 * desde Wander. Se resolvió haciendo que no dependa solo del color (hereda
 * el color de texto y el acento va en el subrayado).
 */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const BASE = process.env.WANDER_BASE ?? 'https://wander.ourocore.net';

const RUTAS = [
  '/',
  '/login',
  '/registro',
  '/explorar',
  '/u/mizllet',
  '/privacidad',
  '/terminos',
];

const ANCHOS = [
  { nombre: 'movil', width: 390, height: 844 },
  { nombre: 'tablet', width: 768, height: 1024 },
  { nombre: 'escritorio', width: 1440, height: 900 },
];

const navegador = await chromium.launch();
const hallazgos = new Map();
const desbordes = [];

for (const vp of ANCHOS) {
  const ctx = await navegador.newContext({ viewport: { width: vp.width, height: vp.height } });
  const pagina = await ctx.newPage();

  for (const ruta of RUTAS) {
    try {
      await pagina.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle', timeout: 30000 });
      await pagina.waitForTimeout(600);

      const { violations } = await new AxeBuilder({ page: pagina })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      for (const v of violations) {
        const clave = `${v.id}`;
        if (!hallazgos.has(clave)) {
          hallazgos.set(clave, {
            id: v.id,
            impacto: v.impact,
            descripcion: v.help,
            donde: new Set(),
            ejemplos: new Set(),
          });
        }
        const h = hallazgos.get(clave);
        h.donde.add(`${ruta}@${vp.nombre}`);
        for (const n of v.nodes.slice(0, 2)) {
          h.ejemplos.add(n.html.slice(0, 160));
        }
      }

      // Scroll horizontal: el body nunca debe desbordar en móvil.
      const desborde = await pagina.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      if (desborde > 2) desbordes.push(`${ruta}@${vp.nombre}: +${desborde}px`);
    } catch (e) {
      console.log(`  ! ${ruta}@${vp.nombre}: ${e.message.split('\n')[0]}`);
    }
  }

  await ctx.close();
}

await navegador.close();

console.log(`\n${'═'.repeat(60)}`);
console.log('VIOLACIONES DE ACCESIBILIDAD (axe-core, WCAG 2.1 AA)');
console.log('═'.repeat(60));

const orden = { critical: 0, serious: 1, moderate: 2, minor: 3 };
const lista = [...hallazgos.values()].sort(
  (a, b) => (orden[a.impacto] ?? 9) - (orden[b.impacto] ?? 9)
);

if (lista.length === 0) {
  console.log('\n  Ninguna. \n');
} else {
  for (const h of lista) {
    console.log(`\n[${(h.impacto ?? '?').toUpperCase()}] ${h.id}`);
    console.log(`  ${h.descripcion}`);
    console.log(`  Dónde: ${[...h.donde].join(', ')}`);
    for (const ej of h.ejemplos) console.log(`  · ${ej}`);
  }
}

console.log(`\n${'═'.repeat(60)}`);
console.log('DESBORDE HORIZONTAL');
console.log('═'.repeat(60));
console.log(desbordes.length === 0 ? '\n  Ninguno.\n' : `\n  ${desbordes.join('\n  ')}\n`);
