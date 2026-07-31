import { useTranslation } from 'react-i18next';
import type { Bloque } from '../../lib/perfil';
import { useSteam } from '../../lib/steamContexto';
import { estadoTexto, numero } from '../../lib/steam';
import { EsqueletoSteam } from './steamComunes';

/**
 * Estadísticas de Steam: contadores grandes (juegos, horas, nivel).
 *
 * Nota de GEO (§13): los contadores llevan su etiqueta en prosa al lado,
 * no solo el número. "942 juegos en la biblioteca" se puede citar; un "942"
 * suelto en una rejilla, no.
 */
export function BloqueEstadisticas({ bloque }: { bloque: Bloque }) {
  const { t } = useTranslation();
  const { datos, cargando, vinculado } = useSteam();

  const titulo =
    typeof bloque.config['titulo'] === 'string' && bloque.config['titulo'].trim() !== ''
      ? bloque.config['titulo']
      : t('bloques.tituloEnNumeros');

  if (cargando) return <EsqueletoSteam titulo={titulo} filas={1} />;
  if (!vinculado || !datos?.estadisticas) return null;

  const { totalJuegos, minutosTotales, nivel } = datos.estadisticas;

  // Cada contador es opcional: quien no quiera enseñar sus horas puede
  // apagarlas sin perder el bloque entero.
  const contadores: Array<{ valor: string; etiqueta: string }> = [];

  if (bloque.config['mostrarTotalJuegos'] !== false && totalJuegos > 0) {
    // El plural lo decide `Intl.PluralRules` vía i18next, no un ternario:
    // no todos los idiomas parten en uno/muchos por el mismo sitio.
    contadores.push({
      valor: numero(totalJuegos),
      etiqueta: t('steam.juegos', { count: totalJuegos }),
    });
  }
  if (bloque.config['mostrarHoras'] !== false && minutosTotales > 0) {
    // El número va sin la unidad porque la etiqueta de abajo ya la dice.
    contadores.push({
      valor: numero(minutosTotales / 60),
      etiqueta: t('steam.horasJugadas'),
    });
  }
  if (bloque.config['mostrarNivel'] !== false && nivel) {
    contadores.push({ valor: numero(nivel), etiqueta: t('steam.nivel') });
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
            {t('bloques.enSteam', { estado: estado.texto })}
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
