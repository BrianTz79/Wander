import { useTranslation } from 'react-i18next';
import type { Bloque } from '../../lib/perfil';
import { useSteam } from '../../lib/steamContexto';
import { horasDe, type JuegoSteam } from '../../lib/steam';
import { EsqueletoSteam, PortadaJuego, SinDatosSteam } from './steamComunes';

/**
 * Juegos favoritos: los que el usuario elige destacar.
 *
 * El config solo guarda **appids**. El nombre, la carátula y las horas se
 * resuelven aquí contra la caché de Steam. Es lo que hace que el bloque no
 * envejezca: si mañana juegas 40 horas más, el número sube solo, sin que
 * nadie edite nada.
 */
export function BloqueFavoritos({ bloque }: { bloque: Bloque }) {
  const { t } = useTranslation();
  const { datos, cargando, vinculado } = useSteam();

  const titulo =
    typeof bloque.config['titulo'] === 'string' && bloque.config['titulo'].trim() !== ''
      ? bloque.config['titulo']
      : t('bloques.tituloFavoritos');

  const appids = Array.isArray(bloque.config['appids'])
    ? (bloque.config['appids'] as unknown[]).filter((a): a is number => typeof a === 'number')
    : [];

  if (cargando) return <EsqueletoSteam titulo={titulo} filas={2} />;
  if (!vinculado) return null;

  if (appids.length === 0) {
    return (
      <SinDatosSteam titulo={titulo} mensaje={t('bloques.sinDestacados')} />
    );
  }

  // Se busca cada appid en lo que tengamos cacheado (biblioteca + recientes).
  const catalogo = new Map<number, JuegoSteam>();
  for (const juego of [...(datos?.masJugados ?? []), ...(datos?.recientes ?? [])]) {
    if (!catalogo.has(juego.appid)) catalogo.set(juego.appid, juego);
  }

  /*
   * Un appid que no está en la caché se pinta igual, con la carátula y sin
   * horas. Puede ser un juego fuera del top de más jugados, o de un perfil
   * privado. Ocultarlo sería peor: el usuario lo eligió a propósito y
   * vería desaparecer su elección sin explicación.
   */
  const juegos: JuegoSteam[] = appids.map(
    (appid) =>
      catalogo.get(appid) ?? {
        appid,
        nombre: t('bloques.juegoDesconocido', { appid }),
        minutosTotales: 0,
        minutosDosSemanas: 0,
        portada: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`,
        icono: null,
        ultimaVez: null,
      }
  );

  return (
    <section>
      <h2 className="mb-3 text-xl font-bold">{titulo}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {juegos.map((juego) => (
          <li
            key={juego.appid}
            className="overflow-hidden"
            style={{
              backgroundColor: 'var(--p-tarjeta)',
              border: '1px solid var(--p-borde)',
              borderRadius: 'var(--p-radio)',
            }}
          >
            {/* La carátula de Steam es 460×215 (≈ 2.15:1). */}
            <PortadaJuego juego={juego} className="aspect-[460/215] w-full" />
            <div className="flex items-center justify-between gap-2 p-3">
              <span className="min-w-0 truncate text-sm font-semibold">{juego.nombre}</span>
              {juego.minutosTotales > 0 && (
                <span
                  className="shrink-0 whitespace-nowrap text-xs font-bold"
                  style={{ color: 'var(--p-acento)' }}
                >
                  {horasDe(juego.minutosTotales)}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
