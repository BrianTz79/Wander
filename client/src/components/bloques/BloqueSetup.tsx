import type { Bloque } from '../../lib/perfil';
import { TEXTO_SUAVE } from '../../lib/perfil';

interface Pieza {
  etiqueta: string;
  valor: string;
}

/** Extrae y filtra las piezas del config. El backend ya validó la forma;
 *  esto es la misma defensa en profundidad que hace `BloqueEnlaces`, por si
 *  el dato llegó de una versión anterior o por otro camino. */
function piezasDe(bloque: Bloque): Pieza[] {
  const crudas = bloque.config['piezas'];
  if (!Array.isArray(crudas)) return [];
  return crudas.filter(
    (p): p is Pieza =>
      typeof p === 'object' &&
      p !== null &&
      typeof (p as Pieza).etiqueta === 'string' &&
      typeof (p as Pieza).valor === 'string' &&
      ((p as Pieza).etiqueta.trim() !== '' || (p as Pieza).valor.trim() !== '')
  );
}

/**
 * Bloque de setup: la lista de componentes del equipo.
 *
 * Es una `<dl>` y no una tabla ni una lista de `<div>`: cada fila es
 * literalmente un término y su descripción ("Tarjeta gráfica" → "RX 7900
 * XTX"), que es para lo que existe esa etiqueta. Un lector de pantalla lee
 * el par junto; con dos `<span>` sueltos leería veinte palabras seguidas
 * sin saber cuál explica a cuál.
 */
export function BloqueSetup({ bloque }: { bloque: Bloque }) {
  const titulo = typeof bloque.config['titulo'] === 'string' ? bloque.config['titulo'] : '';
  const piezas = piezasDe(bloque);

  if (piezas.length === 0) return null;

  return (
    <section>
      {titulo && <h2 className="mb-3 text-xl font-bold">{titulo}</h2>}
      <dl
        className="grid gap-x-6 gap-y-0 sm:grid-cols-2"
        style={{
          backgroundColor: 'var(--p-tarjeta)',
          border: '1px solid var(--p-borde)',
          borderRadius: 'var(--p-radio)',
          padding: '0.5rem 1rem',
        }}
      >
        {piezas.map((pieza, i) => (
          <div
            key={`${pieza.etiqueta}-${i}`}
            className="flex flex-wrap items-baseline justify-between gap-x-3 py-2.5"
            style={{
              // Sin borde en la última fila de cada columna. Se resuelve
              // con el borde superior a partir del segundo elemento en vez
              // de con `:last-child`, que en una rejilla de dos columnas no
              // cae donde uno espera.
              borderTop: i === 0 ? 'none' : '1px solid var(--p-borde)',
            }}
          >
            <dt className="text-sm font-medium" style={TEXTO_SUAVE}>
              {pieza.etiqueta}
            </dt>
            <dd className="min-w-0 text-right text-sm font-semibold break-words">{pieza.valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
