import i18n from '../i18n';

/**
 * Presencia de Discord en el cliente (Fase 6).
 *
 * Espeja las formas de `server/src/services/lanyard.service.ts`. Igual que
 * con Steam, lo que llega ya viene recortado por el consentimiento del
 * usuario: si alguien no consintió mostrar su presencia, el dato no está
 * en la respuesta HTTP, no es que se oculte al pintar.
 */

export interface ActividadDiscord {
  nombre: string;
  tipo: number;
  detalles: string | null;
  estado: string | null;
  imagenGrande: string | null;
  desde: number | null;
}

export interface CancionSpotify {
  cancion: string;
  artista: string;
  album: string | null;
  portada: string | null;
  inicio: number | null;
  fin: number | null;
}

export interface PresenciaDiscord {
  estado: string;
  nombre: string | null;
  avatar: string | null;
  actividades: ActividadDiscord[];
  spotify: CancionSpotify | null;
  monitorizado: boolean;
}

export interface DatosDiscord {
  presencia: PresenciaDiscord | null;
  actualizadoEn: string | null;
  hayDatosViejos: boolean;
}

export interface RespuestaDiscord {
  vinculado: boolean;
  datos: DatosDiscord | null;
}

// ── Formato ──────────────────────────────────────────────────────────

/** Los cuatro estados de Discord, con el color con el que la gente ya los
 *  reconoce. Se usan tal cual (no del tema del perfil) porque son un
 *  código de color establecido: un "en línea" que no sea verde confunde. */
export const COLORES_ESTADO: Record<string, string> = {
  online: '#23a55a',
  idle: '#f0b232',
  dnd: '#f23f43',
  offline: '#80848e',
};

export function estadoDiscordTexto(estado: string): string {
  switch (estado) {
    case 'online':
      return i18n.t('discord.enLinea');
    case 'idle':
      return i18n.t('discord.ausente');
    case 'dnd':
      return i18n.t('discord.noMolestar');
    default:
      return i18n.t('discord.desconectado');
  }
}

/**
 * El verbo de una actividad según su tipo. Discord distingue "jugando a",
 * "escuchando" y "viendo", y usar el verbo correcto es la diferencia entre
 * un bloque que parece de Discord y uno que parece una imitación.
 */
export function verboActividad(tipo: number): string {
  switch (tipo) {
    case 1:
      return i18n.t('discord.transmitiendo');
    case 2:
      return i18n.t('discord.escuchando');
    case 3:
      return i18n.t('discord.viendo');
    case 5:
      return i18n.t('discord.compitiendoEn');
    default:
      return i18n.t('discord.jugandoA');
  }
}

/** "1:23" a partir de milisegundos. Para el progreso de Spotify. */
export function duracion(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';
  const total = Math.floor(ms / 1000);
  const minutos = Math.floor(total / 60);
  const segundos = total % 60;
  return `${minutos}:${String(segundos).padStart(2, '0')}`;
}

/** Cuánto lleva con una actividad abierta: "llevas 2 h 15 min". */
export function desdeHace(inicio: number | null): string {
  if (!inicio) return '';
  const ms = Date.now() - inicio;
  if (!Number.isFinite(ms) || ms < 0) return '';

  const minutos = Math.floor(ms / 60_000);
  if (minutos < 1) return i18n.t('discord.acabaDeEmpezar');
  if (minutos < 60) return i18n.t('discord.llevaMinutos', { minutos });

  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0
    ? i18n.t('discord.llevaHoras', { horas })
    : i18n.t('discord.llevaHorasMinutos', { horas, minutos: resto });
}
