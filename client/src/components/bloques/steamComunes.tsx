import { useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import type { JuegoSteam } from '../../lib/steam';

/**
 * Piezas compartidas por los tres bloques de Steam.
 *
 * Todo lo de aquí se pinta con las variables `--p-*` del tema del usuario,
 * nunca con los tokens de la interfaz de Wander: estos componentes viven
 * dentro del perfil, y el perfil es del usuario.
 */

/**
 * Carátula de un juego, con recambio si la imagen no carga.
 *
 * El recambio no es decorativo: Steam no tiene `header.jpg` para todos los
 * appids (juegos retirados, sobre todo), y sin él la fila queda con el
 * icono roto del navegador. `onError` lo cubre pase lo que pase — incluido
 * que la CSP bloquee el host.
 */
export function PortadaJuego({
  juego,
  className = '',
}: {
  juego: JuegoSteam;
  className?: string;
}) {
  const [fallo, setFallo] = useState(false);
  const fuente = !fallo ? (juego.portada ?? juego.icono) : null;

  const estilo = {
    borderRadius: `calc(var(--p-radio) * 0.5)`,
    backgroundColor: 'var(--p-fondo)',
  };

  if (!fuente) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={estilo}
        aria-hidden="true"
      >
        <Gamepad2 className="h-5 w-5" style={{ opacity: 0.4 }} />
      </div>
    );
  }

  return (
    <img
      src={fuente}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFallo(true)}
      className={`object-cover ${className}`}
      style={estilo}
    />
  );
}

/** Marco común: el título y el contenedor con el tema del perfil. */
function Marco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-bold">{titulo}</h2>
      <div
        className="p-4 text-sm"
        style={{
          backgroundColor: 'var(--p-tarjeta)',
          border: '1px solid var(--p-borde)',
          borderRadius: 'var(--p-radio)',
          opacity: 0.75,
        }}
      >
        {children}
      </div>
    </section>
  );
}

/** Estado de carga. Existe para que el perfil no dé un salto de layout
 *  cuando lleguen los datos: ocupa aproximadamente el mismo alto. */
export function EsqueletoSteam({ titulo, filas = 3 }: { titulo: string; filas?: number }) {
  return (
    <section aria-busy="true">
      <h2 className="mb-3 text-xl font-bold">{titulo}</h2>
      <ul className="space-y-2">
        {Array.from({ length: filas }, (_, i) => (
          <li
            key={i}
            className="h-16 animate-pulse"
            style={{
              backgroundColor: 'var(--p-tarjeta)',
              border: '1px solid var(--p-borde)',
              borderRadius: 'var(--p-radio)',
              opacity: 0.5,
            }}
          />
        ))}
      </ul>
      <span className="sr-only">Cargando datos de Steam…</span>
    </section>
  );
}

/** Cuando hay bloque pero no hay nada que enseñar. */
export function SinDatosSteam({ titulo, mensaje }: { titulo: string; mensaje: string }) {
  return <Marco titulo={titulo}>{mensaje}</Marco>;
}
