import type { Bloque } from '../../lib/perfil';
import { useSteam } from '../../lib/steamContexto';
import { horasDe, type JuegoSteam } from '../../lib/steam';
import { EsqueletoSteam, PortadaJuego, SinDatosSteam } from './steamComunes';

/**
 * Actividad de Steam: lo jugado en las últimas dos semanas.
 *
 * Es el bloque que justifica la promesa de §1 — "los datos se traen
 * solos". El usuario no escribe nada: juega, y su perfil se actualiza.
 */
export function BloqueSteamActividad({ bloque }: { bloque: Bloque }) {
  const { datos, cargando, vinculado } = useSteam();

  const titulo =
    typeof bloque.config['titulo'] === 'string' && bloque.config['titulo'].trim() !== ''
      ? bloque.config['titulo']
      : 'Jugando últimamente';

  const limite = typeof bloque.config['limite'] === 'number' ? bloque.config['limite'] : 6;
  const mostrarTotales = bloque.config['mostrarHorasTotales'] !== false;

  if (cargando) return <EsqueletoSteam titulo={titulo} filas={3} />;
  if (!vinculado) return null;

  const juegos = (datos?.recientes ?? []).slice(0, limite);

  if (juegos.length === 0) {
    // Un perfil de Steam privado no devuelve actividad. Decirlo es más
    // útil que dejar un hueco: el visitante entiende que no es un fallo
    // del sitio, y el dueño sabe qué tiene que cambiar.
    return (
      <SinDatosSteam
        titulo={titulo}
        mensaje={
          datos?.resumen && !datos.resumen.publico
            ? 'Este perfil de Steam es privado, así que su actividad no se puede mostrar.'
            : 'Sin partidas en las últimas dos semanas.'
        }
      />
    );
  }

  return (
    <section>
      <h2 className="mb-3 text-xl font-bold">{titulo}</h2>
      <ul className="space-y-2">
        {juegos.map((juego) => (
          <FilaJuego key={juego.appid} juego={juego} mostrarTotales={mostrarTotales} />
        ))}
      </ul>
    </section>
  );
}

function FilaJuego({ juego, mostrarTotales }: { juego: JuegoSteam; mostrarTotales: boolean }) {
  return (
    <li
      className="flex items-center gap-3 p-2"
      style={{
        backgroundColor: 'var(--p-tarjeta)',
        border: '1px solid var(--p-borde)',
        borderRadius: 'var(--p-radio)',
      }}
    >
      <PortadaJuego juego={juego} className="h-12 w-[6.5rem] shrink-0" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{juego.nombre}</p>
        {mostrarTotales && juego.minutosTotales > 0 && (
          <p className="truncate text-xs" style={{ opacity: 0.6 }}>
            {horasDe(juego.minutosTotales)} en total
          </p>
        )}
      </div>

      <span
        className="shrink-0 whitespace-nowrap px-2.5 py-1 text-xs font-bold"
        style={{
          color: 'var(--p-acento)',
          border: '1px solid var(--p-borde)',
          borderRadius: 'var(--p-radio)',
        }}
        title="Tiempo jugado en las últimas 2 semanas"
      >
        {horasDe(juego.minutosDosSemanas)}
      </span>
    </li>
  );
}
