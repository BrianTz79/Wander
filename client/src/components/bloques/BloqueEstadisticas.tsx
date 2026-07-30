import type { Bloque } from '../../lib/perfil';
import { useSteam } from '../../lib/steamContexto';
import { estadoTexto, horasDe, numero } from '../../lib/steam';
import { EsqueletoSteam } from './steamComunes';

/**
 * Estadísticas de Steam: contadores grandes (juegos, horas, nivel).
 *
 * Nota de GEO (§13): los contadores llevan su etiqueta en prosa al lado,
 * no solo el número. "942 juegos en la biblioteca" se puede citar; un "942"
 * suelto en una rejilla, no.
 */
export function BloqueEstadisticas({ bloque }: { bloque: Bloque }) {
  const { datos, cargando, vinculado } = useSteam();

  const titulo =
    typeof bloque.config['titulo'] === 'string' && bloque.config['titulo'].trim() !== ''
      ? bloque.config['titulo']
      : 'En números';

  if (cargando) return <EsqueletoSteam titulo={titulo} filas={1} />;
  if (!vinculado || !datos?.estadisticas) return null;

  const { totalJuegos, minutosTotales, nivel } = datos.estadisticas;

  // Cada contador es opcional: quien no quiera enseñar sus horas puede
  // apagarlas sin perder el bloque entero.
  const contadores: Array<{ valor: string; etiqueta: string }> = [];

  if (bloque.config['mostrarTotalJuegos'] !== false && totalJuegos > 0) {
    contadores.push({ valor: numero(totalJuegos), etiqueta: totalJuegos === 1 ? 'juego' : 'juegos' });
  }
  if (bloque.config['mostrarHoras'] !== false && minutosTotales > 0) {
    contadores.push({ valor: horasDe(minutosTotales).replace(' h', ''), etiqueta: 'horas jugadas' });
  }
  if (bloque.config['mostrarNivel'] !== false && nivel) {
    contadores.push({ valor: numero(nivel), etiqueta: 'nivel de Steam' });
  }

  if (contadores.length === 0) return null;

  const estado = datos.resumen ? estadoTexto(datos.resumen.estado) : null;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">{titulo}</h2>
        {estado && (
          <span className="inline-flex items-center gap-1.5 text-xs" style={{ opacity: 0.7 }}>
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: estado.enLinea ? 'var(--p-acento)' : 'currentColor',
                opacity: estado.enLinea ? 1 : 0.4,
              }}
              aria-hidden="true"
            />
            {estado.texto} en Steam
          </span>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-2">
        {contadores.map((contador) => (
          <div
            key={contador.etiqueta}
            className="p-4 text-center"
            style={{
              backgroundColor: 'var(--p-tarjeta)',
              border: '1px solid var(--p-borde)',
              borderRadius: 'var(--p-radio)',
            }}
          >
            <dd className="text-2xl font-black tabular-nums" style={{ color: 'var(--p-acento)' }}>
              {contador.valor}
            </dd>
            <dt className="mt-0.5 text-xs" style={{ opacity: 0.65 }}>
              {contador.etiqueta}
            </dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
