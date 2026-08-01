import { Router } from 'express';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { asyncHandler } from '../middlewares/errores.middleware';

/**
 * Rutas de SEO.
 *
 * El sitemap se genera aquí y no es un archivo estático porque crece con
 * cada perfil publicado: nginx lo proxea desde `/sitemap.xml`.
 */
const router = Router();

/**
 * El parámetro con el que se pide un idioma concreto (Fase 12).
 *
 * Tiene que valer **lo mismo** que `PARAM_IDIOMA` del cliente
 * (`client/src/i18n/index.ts`): aquí se escriben los `hreflang` y allí se
 * leen al arrancar. Si los dos nombres se separan, las etiquetas apuntan
 * a URLs que no cambian el idioma y el `hreflang` queda decorativo.
 */
const PARAM_IDIOMA = 'lang';

/** Los idiomas que la interfaz habla de verdad (espejo de `IDIOMAS`). */
const IDIOMAS: readonly string[] = ['es', 'en'];

/** Rutas fijas de la aplicación que sí conviene indexar. */
const PAGINAS_FIJAS: Array<{ ruta: string; prioridad: string; frecuencia: string }> = [
  { ruta: '/', prioridad: '1.0', frecuencia: 'weekly' },
  { ruta: '/explorar', prioridad: '0.8', frecuencia: 'daily' },
  { ruta: '/registro', prioridad: '0.5', frecuencia: 'monthly' },
  { ruta: '/login', prioridad: '0.3', frecuencia: 'monthly' },
  { ruta: '/privacidad', prioridad: '0.3', frecuencia: 'yearly' },
  { ruta: '/terminos', prioridad: '0.3', frecuencia: 'yearly' },
];

/** Escapa los caracteres que romperían el XML. */
function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Escapa para meterlo en un atributo HTML.
 *
 * Es la misma tabla que el XML y **no es opcional**: todo lo que sale de
 * aquí son datos escritos por usuarios (nombre, bio) que acaban dentro de
 * `content="…"` de un `<meta>`. Sin escapar, una bio con `"><script>` sale
 * del atributo y queda ejecutándose en una página que sirve el propio
 * dominio — el XSS almacenado que la CSP de nginx existe para evitar, pero
 * por la puerta de atrás.
 */
const escaparAtributo = escaparXml;

/**
 * Recorta a `max` caracteres en un límite de palabra.
 *
 * Las tarjetas se cortan solas en el cliente que las pinta, pero cada uno
 * corta a un largo distinto y a mitad de palabra. Recortar aquí deja el
 * texto legible en todos.
 */
function recortar(texto: string, max: number): string {
  const limpio = texto.replace(/\s+/g, ' ').trim();
  if (limpio.length <= max) return limpio;
  const cortado = limpio.slice(0, max);
  const espacio = cortado.lastIndexOf(' ');
  return `${(espacio > max * 0.6 ? cortado.slice(0, espacio) : cortado).trimEnd()}…`;
}

// ─────────────────────────────────────────────────────────────────────
//  Tarjetas OG por perfil (Fase 10)
// ─────────────────────────────────────────────────────────────────────

/**
 * Metadatos de un perfil para quien comparte el enlace.
 *
 * **Por qué existe este endpoint y no se resolvió en el cliente:** las
 * metas de `index.html` son estáticas y Wander es una SPA (decisión de §0:
 * los perfiles siguen siendo SPA en la v1). Un scraper de Discord, X o
 * WhatsApp **no ejecuta JavaScript**: lee el HTML tal cual llega. Cambiar
 * las metas desde React funciona para el navegador y no cambia nada para
 * quien pega el enlace, que es justo el caso que importa — es por donde
 * llega la mayoría del tráfico real.
 *
 * La solución es servirle a ESE cliente un HTML con las metas ya puestas.
 * Aquí se genera; nginx decide a quién dárselo (ver `location @perfil_og`).
 *
 * **Qué se responde cuando el perfil no es visible:** las metas genéricas
 * de Wander, con 200 y no 404. El endpoint respeta exactamente la misma
 * regla de visibilidad que `perfilPublico` —publicado, público y no
 * suspendido— y no distingue entre "no existe" y "oculto", porque
 * responder distinto convertiría las tarjetas en un oráculo para averiguar
 * qué handles tienen perfil privado.
 */
router.get(
  '/perfil/:handle',
  asyncHandler(async (req, res) => {
    const base = env.PUBLIC_URL.replace(/\/$/, '');
    const handleCrudo = String(req.params['handle'] ?? '');

    // El handle entra en la URL canónica, así que se valida con la misma
    // forma que acepta el registro en vez de confiar en el parámetro.
    const handle = /^[a-zA-Z0-9_-]{3,24}$/.test(handleCrudo) ? handleCrudo.toLowerCase() : null;

    const usuario = handle
      ? await prisma.user.findUnique({
          where: { handle },
          select: {
            handle: true,
            displayName: true,
            avatarUrl: true,
            bannerUrl: true,
            bio: true,
            idioma: true,
            perfilPublico: true,
            permitirIndexado: true,
            suspendido: true,
            suspendidoHasta: true,
            perfil: { select: { publicado: true } },
          },
        })
      : null;

    const suspendidoActivo =
      usuario?.suspendido && (!usuario.suspendidoHasta || usuario.suspendidoHasta > new Date());
    const visible =
      usuario?.perfil?.publicado && usuario.perfilPublico && !suspendidoActivo ? usuario : null;

    const titulo = visible
      ? `${recortar(visible.displayName, 60)} (@${visible.handle}) — Wander`
      : 'Wander — tu identidad como jugador';

    const descripcion = visible
      ? visible.bio?.trim()
        ? recortar(visible.bio, 160)
        : `El perfil de jugador de ${recortar(visible.displayName, 40)} en Wander.`
      : 'Conecta tus cuentas, arma tu perfil de jugador y compártelo en un solo enlace.';

    /*
     * La imagen de la tarjeta: banner, si no avatar, si no la genérica.
     *
     * Solo se aceptan rutas de `/uploads/` y las URLs de los proveedores
     * que el backend ya escribe él mismo (Steam, Discord, Google). Un
     * `avatarUrl` con un host cualquiera no puede llegar aquí —el schema
     * de perfil lo impide— pero esta comprobación es la que garantiza que
     * el `og:image` de wander.ourocore.net nunca apunte a un servidor de
     * un tercero elegido por el usuario.
     */
    const candidata = visible?.bannerUrl ?? visible?.avatarUrl ?? null;
    const imagen =
      candidata && /^\/uploads\/[\w./-]+$/.test(candidata) && !candidata.includes('..')
        ? base + candidata
        : candidata && /^https:\/\/[\w.-]+\.(steamstatic\.com|discordapp\.com|googleusercontent\.com)\//.test(candidata)
          ? candidata
          : `${base}/og.png`;

    const url = visible ? `${base}/u/${visible.handle}` : base + '/';

    /*
     * `hreflang` (Fase 12, §13).
     *
     * El idioma de Wander vive en el navegador y no en la ruta, así que
     * hasta aquí no había **dos direcciones** que enlazar entre sí y por
     * eso la etiqueta quedó pendiente tras la Fase 6.5. La pareja es
     * ahora la URL limpia y la misma con `?lang=`, que el cliente respeta
     * al arrancar (ver `detectarIdioma`).
     *
     * La **canónica sigue siendo la URL sin parámetro** a propósito: lo
     * que cambia entre las dos versiones es el chrome de la interfaz, no
     * el contenido —la bio, los bloques y las publicaciones son los
     * mismos bytes, porque la traducción de contenido está aplazada
     * (§8)—. Declararlas como dos páginas indexables por separado sería
     * pedirle a Google que indexe contenido duplicado; `hreflang` +
     * canónica única es justo la combinación que dice «es la misma
     * página, servida en dos idiomas».
     *
     * `x-default` apunta a la URL limpia porque es la que negocia el
     * idioma sola: quien la abre sin parámetro cae en el suyo por
     * `navigator.languages`.
     */
    const alternativas = [
      `<link rel="alternate" hreflang="es" href="${escaparAtributo(`${url}?${PARAM_IDIOMA}=es`)}" />`,
      `<link rel="alternate" hreflang="en" href="${escaparAtributo(`${url}?${PARAM_IDIOMA}=en`)}" />`,
      `<link rel="alternate" hreflang="x-default" href="${escaparAtributo(url)}" />`,
    ].join('\n');

    /*
     * El `lang` del documento.
     *
     * Estaba fijo en `es` para todo el mundo, incluido el perfil de
     * alguien que escribe su bio en inglés. Es el atributo que usan el
     * buscador para saber en qué idioma está el texto y los lectores de
     * pantalla para elegir la voz, así que mentirle tiene coste real. Se
     * toma del `?lang=` si viene, y si no del idioma de la cuenta, que es
     * la mejor pista disponible sobre en qué idioma está escrita la bio.
     */
    // `?lang=en&lang=es` llega como array: Express agrupa los parámetros
    // repetidos. Se toma el primero en vez de pasarlo por `String()`,
    // que daría `"en,es"` y caería al respaldo sin decir nada. Cualquiera
    // puede repetir un parámetro en una URL, así que esto no depende de
    // que nginx se porte bien.
    const crudo = req.query[PARAM_IDIOMA];
    const pedido = Array.isArray(crudo) ? String(crudo[0] ?? '') : String(crudo ?? '');
    const idiomaPagina = IDIOMAS.includes(pedido) ? pedido : (visible?.idioma ?? 'es');

    // `summary_large_image` solo cuando la imagen es realmente ancha. El
    // avatar es cuadrado: estirado a 1200×630 sale con franjas o recortado
    // por la cara. Con `summary` se pinta pequeño y cuadrado, que es lo
    // que es.
    const tarjetaAncha = !visible?.bannerUrl && candidata ? 'summary' : 'summary_large_image';

    const html = `<!doctype html>
<html lang="${escaparAtributo(idiomaPagina)}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escaparAtributo(titulo)}</title>
<meta name="description" content="${escaparAtributo(descripcion)}" />
${
  visible && !visible.permitirIndexado
    ? /*
       * Quien apagó "aparecer en buscadores" (§13) sale con `noindex`.
       *
       * Ojo con la diferencia respecto al sitemap: allí el perfil
       * directamente NO aparece, aquí sí se genera la tarjeta. Es
       * deliberado — pegar tu propio enlace en un chat y que se vea bien
       * no es lo mismo que salir en Google, y son dos cosas que la gente
       * quiere por separado. `noindex` cubre justo esa diferencia: el
       * scraper de Discord lo ignora y pinta la tarjeta; Googlebot lo
       * obedece y no lo indexa.
       */
      '<meta name="robots" content="noindex, nofollow" />\n'
    : ''
}<link rel="canonical" href="${escaparAtributo(url)}" />
${alternativas}
<meta property="og:type" content="profile" />
<meta property="og:locale" content="${escaparAtributo(idiomaPagina === 'en' ? 'en_US' : 'es_MX')}" />
<meta property="og:site_name" content="Wander" />
<meta property="og:url" content="${escaparAtributo(url)}" />
<meta property="og:title" content="${escaparAtributo(titulo)}" />
<meta property="og:description" content="${escaparAtributo(descripcion)}" />
<meta property="og:image" content="${escaparAtributo(imagen)}" />
${visible ? `<meta property="profile:username" content="${escaparAtributo(visible.handle)}" />\n` : ''}<meta name="twitter:card" content="${tarjetaAncha}" />
<meta name="twitter:title" content="${escaparAtributo(titulo)}" />
<meta name="twitter:description" content="${escaparAtributo(descripcion)}" />
<meta name="twitter:image" content="${escaparAtributo(imagen)}" />
${
  visible
    ? `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        url,
        mainEntity: {
          '@type': 'Person',
          name: visible.displayName,
          alternateName: `@${visible.handle}`,
          url,
          ...(visible.bio?.trim() ? { description: recortar(visible.bio, 300) } : {}),
          ...(imagen.endsWith('/og.png') ? {} : { image: imagen }),
        },
        // `</script>` dentro de una bio cerraría la etiqueta antes de
        // tiempo; JSON.stringify no lo escapa porque para JSON es texto
        // válido. El reemplazo de abajo es lo que lo impide.
      }).replace(/</g, '\\u003c')}</script>`
    : ''
}
<meta http-equiv="refresh" content="0; url=${escaparAtributo(url)}" />
</head>
<body>
<h1>${escaparAtributo(visible ? visible.displayName : 'Wander')}</h1>
<p>${escaparAtributo(descripcion)}</p>
<p><a href="${escaparAtributo(url)}">${escaparAtributo(url)}</a></p>
</body>
</html>
`;

    res
      .type('text/html; charset=utf-8')
      // Media hora: suficiente para que una tanda de reenvíos del mismo
      // enlace no pegue a la base cada vez, y poco para que cambiar el
      // nombre o la bio se refleje pronto en las tarjetas nuevas.
      .set('Cache-Control', 'public, max-age=1800')
      .send(html);
  })
);

router.get(
  '/sitemap.xml',
  asyncHandler(async (_req, res) => {
    const base = env.PUBLIC_URL.replace(/\/$/, '');

    // Solo perfiles publicados y públicos. Un perfil oculto que aparezca
    // en el sitemap es una fuga de privacidad, no un descuido de SEO.
    //
    // `permitirIndexado` es el consentimiento explícito de aparecer en
    // buscadores (§13). Existía en el schema desde la migración inicial y
    // **no lo aplicaba nadie**: hasta la Fase 10, apagarlo no hacía nada y
    // el perfil salía en el sitemap igual. Una casilla de privacidad que
    // no se respeta es peor que no tenerla.
    const perfiles = await prisma.perfil.findMany({
      where: {
        publicado: true,
        user: { perfilPublico: true, permitirIndexado: true },
      },
      select: {
        user: { select: { handle: true, updatedAt: true } },
      },
      // Google ignora los sitemaps de más de 50 000 URLs. Cuando se pase
      // de ahí habrá que partirlo en un índice de sitemaps.
      take: 45_000,
      orderBy: { user: { updatedAt: 'desc' } },
    });

    /**
     * Las alternativas de idioma de una URL, en el formato del sitemap.
     *
     * Es el mismo `hreflang` de las tarjetas pero por la otra vía: Google
     * acepta las dos y pide que, si se declaran, **todas las versiones se
     * apunten entre sí** — incluida cada una a sí misma. De ahí que la
     * lista incluya `es`, `en` y `x-default` en todas las entradas y no
     * solo "la otra".
     */
    const alternativas = (loc: string) =>
      `    <xhtml:link rel="alternate" hreflang="es" href="${escaparXml(`${loc}?${PARAM_IDIOMA}=es`)}"/>\n` +
      `    <xhtml:link rel="alternate" hreflang="en" href="${escaparXml(`${loc}?${PARAM_IDIOMA}=en`)}"/>\n` +
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${escaparXml(loc)}"/>\n`;

    const entradas = [
      ...PAGINAS_FIJAS.map(({ ruta, prioridad, frecuencia }) => {
        const loc = base + ruta;
        return (
          `  <url>\n` +
          `    <loc>${escaparXml(loc)}</loc>\n` +
          alternativas(loc) +
          `    <changefreq>${frecuencia}</changefreq>\n` +
          `    <priority>${prioridad}</priority>\n` +
          `  </url>`
        );
      }),
      ...perfiles.map(({ user }) => {
        const loc = `${base}/u/${user.handle}`;
        return (
          `  <url>\n` +
          `    <loc>${escaparXml(loc)}</loc>\n` +
          alternativas(loc) +
          `    <lastmod>${user.updatedAt.toISOString().slice(0, 10)}</lastmod>\n` +
          `    <changefreq>weekly</changefreq>\n` +
          `    <priority>0.7</priority>\n` +
          `  </url>`
        );
      }),
    ];

    // El espacio de nombres `xhtml` NO es opcional: sin declararlo, los
    // `<xhtml:link>` de dentro son XML inválido y Google rechaza el
    // sitemap entero, no solo las alternativas.
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
      `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
      entradas.join('\n') +
      `\n</urlset>\n`;

    res.type('application/xml').send(xml);
  })
);

export default router;
