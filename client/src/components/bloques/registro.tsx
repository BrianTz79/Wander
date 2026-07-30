import type { ComponentType } from 'react';
import { Link2, Type, User } from 'lucide-react';
import type { Bloque, TipoBloque, UsuarioPerfil } from '../../lib/perfil';
import { BloqueHero } from './BloqueHero';
import { BloqueTexto } from './BloqueTexto';
import { BloqueEnlaces } from './BloqueEnlaces';

/**
 * Registro de tipos de bloque. Un solo lugar que conocen el editor (para
 * el menú "añadir bloque") y el renderizador (para pintar cada tipo).
 *
 * Añadir un bloque nuevo = una entrada aquí + su schema en el backend.
 */

export interface PropsBloque {
  bloque: Bloque;
  usuario: UsuarioPerfil;
}

interface DefinicionBloque {
  nombre: string;
  descripcion: string;
  Icono: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;
  configInicial: Record<string, unknown>;
  Componente: ComponentType<PropsBloque>;
}

export const REGISTRO_BLOQUES: Record<TipoBloque, DefinicionBloque> = {
  hero: {
    nombre: 'Presentación',
    descripcion: 'Tu avatar, nombre, frase y bio.',
    Icono: User,
    configInicial: {},
    Componente: BloqueHero,
  },
  texto: {
    nombre: 'Texto',
    descripcion: 'Un bloque de texto libre con título opcional.',
    Icono: Type,
    configInicial: { titulo: '', contenido: '' },
    Componente: BloqueTexto,
  },
  enlaces: {
    nombre: 'Enlaces',
    descripcion: 'Botones a tus perfiles y redes.',
    Icono: Link2,
    configInicial: { titulo: '', enlaces: [] },
    Componente: BloqueEnlaces,
  },
};

/** Pinta un bloque según su tipo; los tipos desconocidos (de una versión
 *  futura) se omiten en silencio en vez de romper el perfil entero. */
export function RenderBloque({ bloque, usuario }: PropsBloque) {
  const def = REGISTRO_BLOQUES[bloque.tipo];
  if (!def) return null;
  const { Componente } = def;
  return <Componente bloque={bloque} usuario={usuario} />;
}
