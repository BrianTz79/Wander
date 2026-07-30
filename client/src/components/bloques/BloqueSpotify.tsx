import { useEffect, useState } from 'react';
import { Music } from 'lucide-react';
import type { Bloque } from '../../lib/perfil';
import { useDiscord } from '../../lib/discordContexto';
import { duracion } from '../../lib/discord';
import { EsqueletoSteam } from './steamComunes';

/**
 * Lo que suena ahora en Spotify (Fase 6), vía la presencia de Discord.
 *
 * No usa la API de Spotify: llega dentro de la presencia de Lanyard, así
 * que no hace falta un OAuth más ni guardar tokens de Spotify. Menos
 * secretos que custodiar para el mismo resultado.
 *
 * El bloque **desaparece cuando no suena nada**. Es deliberado: un bloque
 * "Spotify" permanentemente vacío es peor que no tenerlo, porque ocupa
 * sitio en el perfil para decir que no hay nada.
 */
export function BloqueSpotify({ bloque }: { bloque: Bloque }) {
  const { datos, cargando, vinculado } = useDiscord();

  const titulo =
    typeof bloque.config['titulo'] === 'string' && bloque.config['titulo'].trim() !== ''
      ? bloque.config['titulo']
      : 'Sonando ahora';

  const mostrarProgreso = bloque.config['mostrarProgreso'] !== false;

  if (cargando) return <EsqueletoSteam titulo={titulo} filas={1} />;
  if (!vinculado) return null;

  const spotify = datos?.presencia?.spotify;
  if (!spotify) return null;

  return (
    <section>
      <h2 className="mb-3 text-xl font-bold">{titulo}</h2>

      <div
        className="flex items-center gap-4 p-4"
        style={{
          backgroundColor: 'var(--p-tarjeta)',
          border: '1px solid var(--p-borde)',
          borderRadius: 'var(--p-radio)',
        }}
      >
        <Portada url={spotify.portada} />

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{spotify.cancion}</p>
          <p className="truncate text-sm" style={{ opacity: 0.7 }}>
            {spotify.artista}
          </p>
          {spotify.album && (
            <p className="truncate text-xs" style={{ opacity: 0.5 }}>
              {spotify.album}
            </p>
          )}

          {mostrarProgreso && spotify.inicio && spotify.fin && (
            <Progreso inicio={spotify.inicio} fin={spotify.fin} />
          )}
        </div>
      </div>
    </section>
  );
}

function Portada({ url }: { url: string | null }) {
  const [fallo, setFallo] = useState(false);

  if (!url || fallo) {
    return (
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center"
        style={{ backgroundColor: 'var(--p-fondo)', borderRadius: 'calc(var(--p-radio) * 0.4)' }}
        aria-hidden="true"
      >
        <Music className="h-6 w-6" style={{ opacity: 0.4 }} />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFallo(true)}
      className="h-16 w-16 shrink-0 object-cover"
      style={{ borderRadius: 'calc(var(--p-radio) * 0.4)' }}
    />
  );
}

/**
 * Barra de progreso de la canción.
 *
 * Avanza en el cliente cada segundo en vez de esperar al refresco de la
 * presencia: con un TTL de un minuto, una barra que solo se moviera al
 * llegar datos nuevos daría saltos de un minuto y parecería congelada.
 */
function Progreso({ inicio, fin }: { inicio: number; fin: number }) {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const total = fin - inicio;
  if (total <= 0) return null;

  // Se acota a [0, total]: si la canción acabó y aún no ha llegado el
  // refresco, la barra se queda llena en vez de pasarse del contenedor.
  const transcurrido = Math.min(Math.max(ahora - inicio, 0), total);
  const porcentaje = (transcurrido / total) * 100;

  return (
    <div className="mt-2">
      <div
        className="h-1 w-full overflow-hidden"
        style={{ backgroundColor: 'var(--p-borde)', borderRadius: '999px' }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(porcentaje)}
        aria-label="Progreso de la canción"
      >
        <div
          className="h-full"
          style={{
            width: `${porcentaje}%`,
            backgroundColor: 'var(--p-acento)',
            borderRadius: '999px',
          }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[0.7rem]" style={{ opacity: 0.55 }}>
        <span>{duracion(transcurrido)}</span>
        <span>{duracion(total)}</span>
      </div>
    </div>
  );
}
