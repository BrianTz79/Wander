import type { ComponentType } from 'react';
import { BarChart3, Gamepad2, Link2, MessageCircle, Music, Star, Type, User } from 'lucide-react';
import type { Bloque, TipoBloque, UsuarioPerfil } from '../../lib/perfil';
import { BloqueHero } from './BloqueHero';
import { BloqueTexto } from './BloqueTexto';
import { BloqueEnlaces } from './BloqueEnlaces';
import { BloqueSteamActividad } from './BloqueSteamActividad';
import { BloqueEstadisticas } from './BloqueEstadisticas';
import { BloqueFavoritos } from './BloqueFavoritos';
import { BloqueDiscordEstado } from './BloqueDiscordEstado';
import { BloqueSpotify } from './BloqueSpotify';

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
  /** El bloque necesita datos de Steam. Sirve para no pedirlos en perfiles
   *  que no tienen ningún bloque de Steam. */
  requiereSteam?: boolean;
  /** Igual para la presencia de Discord (Fase 6). */
  requiereDiscord?: boolean;
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
  'steam-actividad': {
    nombre: 'Actividad de Steam',
    descripcion: 'Lo que has jugado estas dos semanas. Se actualiza solo.',
    Icono: Gamepad2,
    configInicial: { titulo: '', limite: 6, mostrarHorasTotales: true },
    Componente: BloqueSteamActividad,
    requiereSteam: true,
  },
  estadisticas: {
    nombre: 'Estadísticas',
    descripcion: 'Tus juegos, horas y nivel de Steam en números.',
    Icono: BarChart3,
    configInicial: {
      titulo: '',
      mostrarNivel: true,
      mostrarTotalJuegos: true,
      mostrarHoras: true,
    },
    Componente: BloqueEstadisticas,
    requiereSteam: true,
  },
  favoritos: {
    nombre: 'Juegos favoritos',
    descripcion: 'Los juegos que quieres destacar, con su carátula.',
    Icono: Star,
    configInicial: { titulo: '', appids: [] },
    Componente: BloqueFavoritos,
    requiereSteam: true,
  },
  'discord-estado': {
    nombre: 'Estado de Discord',
    descripcion: 'Si estás en línea y a qué juegas, en vivo.',
    Icono: MessageCircle,
    configInicial: { titulo: '', mostrarActividad: true, mostrarAvatar: true },
    Componente: BloqueDiscordEstado,
    requiereDiscord: true,
  },
  spotify: {
    nombre: 'Spotify',
    descripcion: 'La canción que suena ahora mismo. Se oculta si no escuchas nada.',
    Icono: Music,
    configInicial: { titulo: '', mostrarProgreso: true },
    Componente: BloqueSpotify,
    requiereDiscord: true,
  },
};

/** ¿Alguno de estos bloques necesita datos de Steam? Si no, el perfil se
 *  ahorra la petición al endpoint externo. */
export function necesitaSteam(bloques: Array<{ tipo: TipoBloque; visible?: boolean }>): boolean {
  return bloques.some((b) => REGISTRO_BLOQUES[b.tipo]?.requiereSteam);
}

/** Lo mismo para la presencia de Discord. */
export function necesitaDiscord(bloques: Array<{ tipo: TipoBloque; visible?: boolean }>): boolean {
  return bloques.some((b) => REGISTRO_BLOQUES[b.tipo]?.requiereDiscord);
}

/** Pinta un bloque según su tipo; los tipos desconocidos (de una versión
 *  futura) se omiten en silencio en vez de romper el perfil entero. */
export function RenderBloque({ bloque, usuario }: PropsBloque) {
  const def = REGISTRO_BLOQUES[bloque.tipo];
  if (!def) return null;
  const { Componente } = def;
  return <Componente bloque={bloque} usuario={usuario} />;
}
