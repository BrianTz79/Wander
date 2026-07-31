import { Link } from 'react-router-dom';

import type { AutorResumen } from '../../lib/social';

interface Props {
  usuario: AutorResumen;
  /** Tamaño en píxeles. 40 por defecto (el de una publicación). */
  tamano?: number;
  /** Si es `false`, no envuelve en un enlace al perfil. */
  enlazar?: boolean;
}

/**
 * Avatar redondo con respaldo a la inicial del nombre.
 *
 * El respaldo importa más de lo que parece: la mayoría de las cuentas
 * nuevas no tienen avatar hasta que vinculan Steam o Discord, así que un
 * `<img>` roto sería el estado NORMAL de la plataforma en sus primeros
 * días, no la excepción.
 */
export function Avatar({ usuario, tamano = 40, enlazar = true }: Props) {
  const inicial = (usuario.displayName || usuario.handle).charAt(0).toUpperCase();

  const contenido = usuario.avatarUrl ? (
    <img
      src={usuario.avatarUrl}
      alt=""
      width={tamano}
      height={tamano}
      loading="lazy"
      className="rounded-full object-cover"
      style={{ width: tamano, height: tamano }}
    />
  ) : (
    <span
      className="flex select-none items-center justify-center rounded-full bg-zinc-200 font-semibold
                 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
      style={{ width: tamano, height: tamano, fontSize: tamano * 0.4 }}
      aria-hidden="true"
    >
      {inicial}
    </span>
  );

  if (!enlazar) return contenido;

  return (
    <Link
      to={`/u/${usuario.handle}`}
      // El nombre va en el texto del enlace para los lectores de pantalla:
      // el `alt=""` de la imagen es deliberado (sería redundante leerlo dos
      // veces), así que sin esto el enlace no tendría nombre accesible.
      aria-label={usuario.displayName}
      className="shrink-0 transition-opacity hover:opacity-80"
    >
      {contenido}
    </Link>
  );
}
