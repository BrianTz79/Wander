import { ExternalLink } from 'lucide-react';
import type { Bloque } from '../../lib/perfil';

interface Enlace {
  etiqueta: string;
  url: string;
}

/** Extrae y filtra los enlaces del config. El backend ya validó que las
 *  URLs sean http/https; el filtro repite la comprobación por si el dato
 *  llegó por otro camino (defensa en profundidad, no paranoia). */
function enlacesDe(bloque: Bloque): Enlace[] {
  const crudos = bloque.config['enlaces'];
  if (!Array.isArray(crudos)) return [];
  return crudos.filter(
    (e): e is Enlace =>
      typeof e === 'object' &&
      e !== null &&
      typeof (e as Enlace).etiqueta === 'string' &&
      typeof (e as Enlace).url === 'string' &&
      /^https?:\/\//.test((e as Enlace).url)
  );
}

/**
 * Bloque de enlaces: botones a los perfiles externos del usuario.
 *
 * `rel` importa: `noopener noreferrer` corta el acceso de la pestaña
 * destino a esta, y `nofollow ugc` le dice a los buscadores que es un
 * enlace puesto por un usuario — sin eso, Wander se vuelve una granja de
 * enlaces para spam de SEO.
 */
export function BloqueEnlaces({ bloque }: { bloque: Bloque }) {
  const titulo = typeof bloque.config['titulo'] === 'string' ? bloque.config['titulo'] : '';
  const enlaces = enlacesDe(bloque);

  if (enlaces.length === 0) return null;

  return (
    <section>
      {titulo && <h2 className="mb-3 text-xl font-bold">{titulo}</h2>}
      <div className="grid gap-3 sm:grid-cols-2">
        {enlaces.map((enlace, i) => (
          <a
            key={`${enlace.url}-${i}`}
            href={enlace.url}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            className="flex items-center justify-between gap-3 p-4 text-sm font-semibold
                       transition-transform hover:scale-[1.02] active:scale-[0.99]"
            style={{
              backgroundColor: 'var(--p-tarjeta)',
              border: '1px solid var(--p-borde)',
              borderRadius: 'var(--p-radio)',
            }}
          >
            <span className="truncate">{enlace.etiqueta}</span>
            <ExternalLink
              className="h-4 w-4 shrink-0"
              style={{ color: 'var(--p-acento)' }}
              aria-hidden="true"
            />
          </a>
        ))}
      </div>
    </section>
  );
}
