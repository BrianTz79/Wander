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

/**
 * En qué columna cae el bloque cuando hay espacio horizontal (≥ lg).
 *
 * - `lateral`: la columna estrecha y fija de la izquierda. Es para lo que
 *   identifica a la persona y se lee de un vistazo (quién es, dónde
 *   encontrarla, qué está haciendo ahora).
 * - `principal`: la columna ancha de la derecha, que hace scroll. Es para
 *   lo que tiene volumen: rejillas de juegos, listas largas, el muro.
 *
 * Por debajo de `lg` esto se ignora: todo vuelve a una sola columna en el
 * orden que el usuario puso en el editor, que es la vista de teléfono.
 */
export type ColumnaBloque = 'lateral' | 'principal';

interface DefinicionBloque {
  /** Prefijo de las claves `bloques.<clave>Nombre` y `<clave>Descripcion`.
   *  Se guarda la clave y no el texto para que el menú de "añadir bloque"
   *  cambie de idioma sin recargar. */
  clave: string;
  Icono: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;
  configInicial: Record<string, unknown>;
  Componente: ComponentType<PropsBloque>;
  /** El bloque necesita datos de Steam. Sirve para no pedirlos en perfiles
   *  que no tienen ningún bloque de Steam. */
  requiereSteam?: boolean;
  /** Igual para la presencia de Discord (Fase 6). */
  requiereDiscord?: boolean;
  /** Dónde cae en escritorio. Hoy lo decide Wander por tipo; el día que se
   *  quiera dejar elegir al usuario, este es el valor por defecto y solo
   *  hay que añadir el campo `columna` al bloque en la base. */
  columna: ColumnaBloque;
}

export const REGISTRO_BLOQUES: Record<TipoBloque, DefinicionBloque> = {
  hero: {
    clave: 'hero',
    Icono: User,
    configInicial: {},
    Componente: BloqueHero,
    columna: 'lateral',
  },
  texto: {
    clave: 'texto',
    Icono: Type,
    configInicial: { titulo: '', contenido: '' },
    Componente: BloqueTexto,
    columna: 'principal',
  },
  enlaces: {
    clave: 'enlaces',
    Icono: Link2,
    configInicial: { titulo: '', enlaces: [] },
    Componente: BloqueEnlaces,
    columna: 'lateral',
  },
  'steam-actividad': {
    clave: 'steamActividad',
    Icono: Gamepad2,
    configInicial: { titulo: '', limite: 6, mostrarHorasTotales: true },
    Componente: BloqueSteamActividad,
    requiereSteam: true,
    columna: 'principal',
  },
  estadisticas: {
    clave: 'estadisticas',
    Icono: BarChart3,
    configInicial: {
      titulo: '',
      mostrarNivel: true,
      mostrarTotalJuegos: true,
      mostrarHoras: true,
    },
    Componente: BloqueEstadisticas,
    requiereSteam: true,
    columna: 'principal',
  },
  favoritos: {
    clave: 'favoritos',
    Icono: Star,
    configInicial: { titulo: '', appids: [] },
    Componente: BloqueFavoritos,
    requiereSteam: true,
    columna: 'principal',
  },
  'discord-estado': {
    clave: 'discordEstado',
    Icono: MessageCircle,
    configInicial: { titulo: '', mostrarActividad: true, mostrarAvatar: true },
    Componente: BloqueDiscordEstado,
    requiereDiscord: true,
    columna: 'lateral',
  },
  spotify: {
    clave: 'spotify',
    Icono: Music,
    configInicial: { titulo: '', mostrarProgreso: true },
    Componente: BloqueSpotify,
    requiereDiscord: true,
    columna: 'lateral',
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

/** En qué columna va este bloque (con respaldo para tipos desconocidos). */
export function columnaDe(tipo: TipoBloque): ColumnaBloque {
  return REGISTRO_BLOQUES[tipo]?.columna ?? 'principal';
}

/**
 * Pinta un bloque según su tipo; los tipos desconocidos (de una versión
 * futura) se omiten en silencio en vez de romper el perfil entero.
 *
 * El envoltorio lleva `.wander-bloque` y `.wander-bloque-<tipo>`, que son
 * el CONTRATO PÚBLICO para el CSS propio (Fase 9). Existen por eso: los
 * bloques por dentro están pintados con utilidades de Tailwind, que son de
 * la herramienta y cambian entre versiones, así que agarrarse a ellas sería
 * escribir un CSS que se rompe solo. Estas dos clases, en cambio, se
 * mantienen: si alguna vez hay que renombrarlas, es un cambio con aviso.
 */
export function RenderBloque({ bloque, usuario }: PropsBloque) {
  const def = REGISTRO_BLOQUES[bloque.tipo];
  if (!def) return null;
  const { Componente } = def;
  return (
    <div className={`wander-bloque wander-bloque-${bloque.tipo}`} data-bloque={bloque.tipo}>
      <Componente bloque={bloque} usuario={usuario} />
    </div>
  );
}
