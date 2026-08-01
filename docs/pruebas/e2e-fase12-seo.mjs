/**
 * SEO y GEO: `hreflang`, `llms.txt`, sitemap y tarjetas (Fase 12).
 *
 * Dos mitades muy distintas:
 *
 *  - **Por HTTP** (siempre): lo que reciben los rastreadores. El `hreflang`
 *    de las tarjetas y del sitemap, el `lang` del documento, `llms.txt` y
 *    `robots.txt`. Aquí no hace falta navegador porque el cliente al que
 *    se le sirve esto tampoco lo tiene.
 *  - **En un navegador** (solo con `playwright` instalado): que el
 *    `?lang=` de los `hreflang` de verdad cambie el idioma de la interfaz.
 *    Es la mitad que importa: un `hreflang` que apunta a una URL que no
 *    cambia el idioma es peor que no ponerlo, y eso NO se ve por curl —
 *    el HTML de la SPA es idéntico en los dos idiomas porque el texto lo
 *    pinta React.
 *
 * ── Cómo correrla ──────────────────────────────────────────────────
 *
 *   node docs/pruebas/e2e-fase12-seo.mjs
 *
 * Para la mitad del navegador (opcional, se salta sola si falta):
 *
 *   npm i playwright && npx playwright install chromium
 *
 * `WANDER_BASE` apunta a otra instancia si hace falta. Desde dentro de la
 * red Docker hay que usar `http://frontend:80`: el dominio público da
 * error 1000 de Cloudflare.
 */
const BASE = (process.env.WANDER_BASE ?? 'https://wander.ourocore.net').replace(/\/$/, '');

// Un perfil público que exista, para las comprobaciones de tarjeta.
const HANDLE = process.env.WANDER_HANDLE ?? 'mizllet';

// Los scrapers se distinguen por User-Agent (ver el `map $es_scraper` de
// nginx.conf): sin esto llega la SPA y no la tarjeta.
const UA_BOT = { 'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' };

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

async function traer(ruta, cabeceras = {}) {
  const r = await fetch(BASE + ruta, { headers: cabeceras, redirect: 'manual' });
  return { estado: r.status, tipo: r.headers.get('content-type') ?? '', texto: await r.text() };
}

// ─────────────────────────────────────────────────────────────────────
console.log('\n── Tarjeta de perfil: hreflang y lang ──');
// ─────────────────────────────────────────────────────────────────────

const tarjeta = await traer(`/u/${HANDLE}`, UA_BOT);
comprobar('la tarjeta del perfil responde 200', tarjeta.estado === 200, `estado ${tarjeta.estado}`);

/*
 * Las URLs canónicas las escribe el servidor desde `PUBLIC_URL`, **no**
 * desde el host por el que entró la petición — y así debe ser: una
 * canónica que copiara el `Host` haría que entrar por `127.0.0.1` o por
 * una IP interna publicara esa dirección como la buena. Por eso lo
 * esperado se construye sobre `PUBLIC_URL` y no sobre `BASE`, que puede
 * ser un túnel o el puerto local.
 */
const PUBLICO = (process.env.WANDER_PUBLIC_URL ?? 'https://wander.ourocore.net').replace(/\/$/, '');
const urlPerfil = `${PUBLICO}/u/${HANDLE}`;
comprobar(
  'declara hreflang="es" con ?lang=es',
  tarjeta.texto.includes(`<link rel="alternate" hreflang="es" href="${urlPerfil}?lang=es" />`)
);
comprobar(
  'declara hreflang="en" con ?lang=en',
  tarjeta.texto.includes(`<link rel="alternate" hreflang="en" href="${urlPerfil}?lang=en" />`)
);
comprobar(
  'declara x-default apuntando a la URL limpia',
  tarjeta.texto.includes(`<link rel="alternate" hreflang="x-default" href="${urlPerfil}" />`)
);

/*
 * La canónica NO lleva el parámetro. Es lo que evita que las dos
 * versiones se indexen como páginas distintas: entre ellas cambia el
 * idioma de la interfaz, no el contenido (la traducción de contenido
 * está aplazada, §8), así que serían contenido duplicado.
 */
comprobar(
  'la canónica apunta a la URL SIN ?lang',
  tarjeta.texto.includes(`<link rel="canonical" href="${urlPerfil}" />`) &&
    !tarjeta.texto.includes(`<link rel="canonical" href="${urlPerfil}?`)
);

// ── El `?lang=` tiene que llegar hasta el backend ──
//
// Pasa por un `rewrite` y un `proxy_pass` con variable en la URI, que es
// justo donde nginx pierde la query si no se le dice lo contrario. Y si
// se le dice dos veces, la manda duplicada (`?lang=en&lang=en`), Express
// la parsea como array y el idioma cae al respaldo sin ningún error.
const tarjetaEn = await traer(`/u/${HANDLE}?lang=en`, UA_BOT);
comprobar('con ?lang=en el documento sale en <html lang="en">', tarjetaEn.texto.includes('<html lang="en">'));
comprobar('con ?lang=en el og:locale es en_US', tarjetaEn.texto.includes('content="en_US"'));

const tarjetaEs = await traer(`/u/${HANDLE}?lang=es`, UA_BOT);
comprobar('con ?lang=es el documento sale en <html lang="es">', tarjetaEs.texto.includes('<html lang="es">'));
comprobar('con ?lang=es el og:locale es es_MX', tarjetaEs.texto.includes('content="es_MX"'));

// Un parámetro repetido se resuelve por el primero, no por el array
// entero convertido a texto.
const tarjetaDoble = await traer(`/u/${HANDLE}?lang=en&lang=es`, UA_BOT);
comprobar(
  'un ?lang repetido toma el primer valor',
  tarjetaDoble.texto.includes('<html lang="en">')
);

// Un idioma inventado no se refleja: la lista de idiomas es blanca.
const tarjetaBasura = await traer(`/u/${HANDLE}?lang=%22%3E%3Cscript%3E`, UA_BOT);
comprobar(
  'un ?lang inventado cae al respaldo y no se cuela en el HTML',
  !tarjetaBasura.texto.includes('<script>alert') && !tarjetaBasura.texto.includes('lang=""><script>')
);

// La SPA se sigue sirviendo a las personas aunque lleven el parámetro.
const comoPersona = await traer(`/u/${HANDLE}?lang=en`);
comprobar('a una persona con ?lang= se le sirve la SPA', comoPersona.texto.includes('id="root"'));

// ─────────────────────────────────────────────────────────────────────
console.log('\n── Sitemap ──');
// ─────────────────────────────────────────────────────────────────────

const sitemap = await traer('/sitemap.xml');
comprobar('el sitemap responde 200', sitemap.estado === 200, `estado ${sitemap.estado}`);
comprobar('declara el espacio de nombres xhtml', sitemap.texto.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"'));
comprobar('lleva alternativas hreflang', sitemap.texto.includes('<xhtml:link rel="alternate" hreflang="es"'));
comprobar('lleva x-default', sitemap.texto.includes('hreflang="x-default"'));

/*
 * Que el XML sea válido no es un detalle: un `<xhtml:link>` sin su
 * espacio de nombres declarado invalida el documento ENTERO y Google
 * descarta el sitemap completo, no solo las alternativas.
 */
let sitemapValido = true;
try {
  const { XMLParser, XMLValidator } = await import('fast-xml-parser').catch(() => ({}));
  if (XMLValidator) {
    sitemapValido = XMLValidator.validate(sitemap.texto) === true;
    void XMLParser;
  } else {
    // Sin parser disponible: comprobación mínima de que abre y cierra.
    sitemapValido =
      sitemap.texto.trimStart().startsWith('<?xml') && sitemap.texto.trimEnd().endsWith('</urlset>');
  }
} catch {
  sitemapValido = false;
}
comprobar('el sitemap es XML bien formado', sitemapValido);

// ─────────────────────────────────────────────────────────────────────
console.log('\n── llms.txt y robots.txt (GEO) ──');
// ─────────────────────────────────────────────────────────────────────

const llms = await traer('/llms.txt');
comprobar('llms.txt responde 200', llms.estado === 200, `estado ${llms.estado}`);
comprobar('llms.txt se sirve como texto plano', llms.tipo.includes('text/plain'), llms.tipo);
comprobar('llms.txt describe qué es Wander', llms.texto.includes('# Wander'));
comprobar('llms.txt documenta el parámetro de idioma', llms.texto.includes('?lang='));

/*
 * El archivo venía de las Fases 1-3 y se quedó describiendo una versión
 * de Wander que ya no existe. Un `llms.txt` desactualizado es peor que no
 * tenerlo: es exactamente el texto que un motor generativo va a citar.
 */
comprobar(
  'llms.txt ya no dice que la mensajería esté "en construcción"',
  !/en construcci[óo]n/i.test(llms.texto)
);
comprobar(
  'llms.txt no promete los logros de Steam, que no están hechos',
  !/aparecen los juegos, las\s+horas jugadas y los logros/i.test(llms.texto)
);
comprobar('llms.txt menciona lo que sí existe (mensajería)', /mensajer[íi]a/i.test(llms.texto));

const robots = await traer('/robots.txt');
comprobar('robots.txt responde 200', robots.estado === 200, `estado ${robots.estado}`);
comprobar('robots.txt apunta al sitemap', robots.texto.includes('Sitemap:'));
comprobar('robots.txt permite a los rastreadores de IA', robots.texto.includes('GPTBot') && robots.texto.includes('ClaudeBot'));

// ─────────────────────────────────────────────────────────────────────
console.log('\n── Landing ──');
// ─────────────────────────────────────────────────────────────────────

const landing = await traer('/');
comprobar('la landing declara hreflang es', landing.texto.includes('hreflang="es"'));
comprobar('la landing declara hreflang en', landing.texto.includes('hreflang="en"'));
comprobar('la landing declara x-default', landing.texto.includes('hreflang="x-default"'));
comprobar(
  'la canónica de la landing no lleva ?lang',
  landing.texto.includes(`<link rel="canonical" href="${PUBLICO}/" />`)
);

// ─────────────────────────────────────────────────────────────────────
//  Mitad de navegador: que el ?lang= cambie el idioma DE VERDAD
// ─────────────────────────────────────────────────────────────────────

let chromium = null;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.log('\n── Navegador ──\n  · playwright no está instalado: se salta esta mitad.');
}

if (chromium) {
  console.log('\n── Navegador: el ?lang= manda de verdad ──');
  const nav = await chromium.launch();

  try {
    /*
     * Contexto con el navegador en español para que el respaldo por
     * `navigator.languages` NO sea inglés: así, si la página sale en
     * inglés, es porque el `?lang=` funcionó y no porque el navegador ya
     * lo pidiera.
     */
    const ctx = await nav.newContext({ locale: 'es-MX' });
    const pag = await ctx.newPage();

    await pag.goto(`${BASE}/?lang=en`, { waitUntil: 'domcontentloaded' });
    // La SPA tarda en montar: con esperas cortas salen falsos negativos.
    await pag.waitForTimeout(2500);
    const langEn = await pag.getAttribute('html', 'lang');
    comprobar('con ?lang=en el <html lang> del navegador es en', langEn === 'en', `era ${langEn}`);

    await pag.goto(`${BASE}/?lang=es`, { waitUntil: 'domcontentloaded' });
    await pag.waitForTimeout(2500);
    const langEs = await pag.getAttribute('html', 'lang');
    comprobar('con ?lang=es el <html lang> del navegador es es', langEs === 'es', `era ${langEs}`);

    /*
     * El `?lang=` gana al `localStorage`.
     *
     * Es la prioridad que hace que el `hreflang` sirva: quien ya visitó
     * Wander tiene un idioma guardado, y si ese ganara, el enlace en
     * inglés del buscador le abriría la página en español.
     */
    await pag.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await pag.evaluate(() => localStorage.setItem('wander-idioma', 'es'));
    await pag.goto(`${BASE}/?lang=en`, { waitUntil: 'domcontentloaded' });
    await pag.waitForTimeout(2500);
    const ganaUrl = await pag.getAttribute('html', 'lang');
    comprobar(
      'el ?lang= gana al idioma guardado en el navegador',
      ganaUrl === 'en',
      `era ${ganaUrl}`
    );

    await ctx.close();
  } finally {
    await nav.close();
  }
}

// ─────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`  ${ok} pasan, ${fallos} fallan`);
if (errores.length) {
  console.log('\n  Fallos:');
  for (const e of errores) console.log(`   · ${e}`);
}
console.log(`${'─'.repeat(60)}\n`);
process.exit(fallos ? 1 : 0);
