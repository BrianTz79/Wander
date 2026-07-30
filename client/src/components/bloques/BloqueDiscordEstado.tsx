import { useState } from 'react';
import type { Bloque } from '../../lib/perfil';
import { useDiscord } from '../../lib/discordContexto';
import {
  COLORES_ESTADO,
  desdeHace,
  estadoDiscordTexto,
  verboActividad,
  type ActividadDiscord,
} from '../../lib/discord';
import { EsqueletoSteam, SinDatosSteam } from './steamComunes';

/**
 * Estado de Discord en vivo (Fase 6).
 *
 * Es el bloque más "vivo" del perfil: se refresca solo mientras la pestaña
 * esté abierta. Junto al de Steam completa la promesa de §1 — el perfil se
 * mantiene solo, sin que su dueño escriba nada.
 */
export function BloqueDiscordEstado({ bloque }: { bloque: Bloque }) {
  const { datos, cargando, vinculado } = useDiscord();

  const titulo =
    typeof bloque.config['titulo'] === 'string' && bloque.config['titulo'].trim() !== ''
      ? bloque.config['titulo']
      : 'Discord';

  const mostrarActividad = bloque.config['mostrarActividad'] !== false;
  const mostrarAvatar = bloque.config['mostrarAvatar'] !== false;

  if (cargando) return <EsqueletoSteam titulo={titulo} filas={1} />;
  if (!vinculado) return null;

  const presencia = datos?.presencia;

  // Sin presencia: o no consintió mostrarla, o no está en el servidor de
  // Lanyard. En ambos casos el bloque se oculta en vez de explicarle al
  // visitante una configuración que no es suya.
  if (!presencia) return null;

  if (!presencia.monitorizado) {
    /*
     * Lanyard no conoce a este usuario. Solo se le dice al DUEÑO qué hacer
     * —y eso ocurre en /configuracion, no aquí—: a un visitante cualquiera
     * "este usuario no se ha unido a un servidor de Discord" no le importa
     * y parece un error del sitio.
     */
    return null;
  }

  const color = COLORES_ESTADO[presencia.estado] ?? COLORES_ESTADO['offline']!;
  const actividades = mostrarActividad ? presencia.actividades : [];

  return (
    <section>
      <h2 className="mb-3 text-xl font-bold">{titulo}</h2>

      <div
        className="p-4"
        style={{
          backgroundColor: 'var(--p-tarjeta)',
          border: '1px solid var(--p-borde)',
          borderRadius: 'var(--p-radio)',
        }}
      >
        <div className="flex items-center gap-3">
          {mostrarAvatar && presencia.avatar && (
            <div className="relative shrink-0">
              <img
                src={presencia.avatar}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-12 w-12 rounded-full object-cover"
              />
              {/* El punto de estado va sobre el avatar, como en Discord:
                  es donde la gente ya lo busca. */}
              <span
                className="absolute -bottom-0.5 -right-0.5 block h-4 w-4 rounded-full"
                style={{ backgroundColor: color, border: '2px solid var(--p-tarjeta)' }}
                aria-hidden="true"
              />
            </div>
          )}

          <div className="min-w-0 flex-1">
            {presencia.nombre && (
              <p className="truncate font-semibold">{presencia.nombre}</p>
            )}
            <p className="flex items-center gap-1.5 text-sm" style={{ opacity: 0.7 }}>
              {!mostrarAvatar && (
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
              )}
              {estadoDiscordTexto(presencia.estado)}
            </p>
          </div>
        </div>

        {actividades.length > 0 && (
          <ul className="mt-4 space-y-2 border-t pt-3" style={{ borderColor: 'var(--p-borde)' }}>
            {actividades.map((actividad, i) => (
              <FilaActividad key={`${actividad.nombre}-${i}`} actividad={actividad} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function FilaActividad({ actividad }: { actividad: ActividadDiscord }) {
  const [falloImagen, setFalloImagen] = useState(false);
  const tiempo = desdeHace(actividad.desde);

  return (
    <li className="flex items-start gap-3">
      {actividad.imagenGrande && !falloImagen && (
        <img
          src={actividad.imagenGrande}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFalloImagen(true)}
          className="h-11 w-11 shrink-0 object-cover"
          style={{ borderRadius: 'calc(var(--p-radio) * 0.4)' }}
        />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          <span style={{ opacity: 0.6 }}>{verboActividad(actividad.tipo)} </span>
          <span className="font-semibold">{actividad.nombre}</span>
        </p>
        {actividad.detalles && (
          <p className="truncate text-xs" style={{ opacity: 0.6 }}>
            {actividad.detalles}
          </p>
        )}
        {actividad.estado && (
          <p className="truncate text-xs" style={{ opacity: 0.6 }}>
            {actividad.estado}
          </p>
        )}
        {tiempo && (
          <p className="truncate text-xs" style={{ color: 'var(--p-acento)' }}>
            {tiempo}
          </p>
        )}
      </div>
    </li>
  );
}

/** Se exporta el aviso para reusarlo desde el editor, donde el dueño SÍ
 *  necesita saber que le falta unirse al servidor de Lanyard. */
export function AvisoLanyard({ titulo }: { titulo: string }) {
  return (
    <SinDatosSteam
      titulo={titulo}
      mensaje="Para mostrar tu estado en vivo tienes que unirte al servidor de Lanyard: discord.gg/UrXF2cfJ7F"
    />
  );
}
