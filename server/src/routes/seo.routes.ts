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

router.get(
  '/sitemap.xml',
  asyncHandler(async (_req, res) => {
    const base = env.PUBLIC_URL.replace(/\/$/, '');

    // Solo perfiles publicados y públicos. Un perfil oculto que aparezca
    // en el sitemap es una fuga de privacidad, no un descuido de SEO.
    const perfiles = await prisma.perfil.findMany({
      where: {
        publicado: true,
        user: { perfilPublico: true },
      },
      select: {
        user: { select: { handle: true, updatedAt: true } },
      },
      // Google ignora los sitemaps de más de 50 000 URLs. Cuando se pase
      // de ahí habrá que partirlo en un índice de sitemaps.
      take: 45_000,
      orderBy: { user: { updatedAt: 'desc' } },
    });

    const entradas = [
      ...PAGINAS_FIJAS.map(
        ({ ruta, prioridad, frecuencia }) =>
          `  <url>\n` +
          `    <loc>${escaparXml(base + ruta)}</loc>\n` +
          `    <changefreq>${frecuencia}</changefreq>\n` +
          `    <priority>${prioridad}</priority>\n` +
          `  </url>`
      ),
      ...perfiles.map(
        ({ user }) =>
          `  <url>\n` +
          `    <loc>${escaparXml(`${base}/u/${user.handle}`)}</loc>\n` +
          `    <lastmod>${user.updatedAt.toISOString().slice(0, 10)}</lastmod>\n` +
          `    <changefreq>weekly</changefreq>\n` +
          `    <priority>0.7</priority>\n` +
          `  </url>`
      ),
    ];

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      entradas.join('\n') +
      `\n</urlset>\n`;

    res.type('application/xml').send(xml);
  })
);

export default router;
