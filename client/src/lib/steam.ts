import i18n from '../i18n';

/**
 * Datos de Steam en el cliente (Fase 5).
 *
 * Espeja las formas que devuelve `server/src/services/steam.service.ts`.
 * Nótese lo que NO está aquí: `vacBanned`. No es que se omita al pintar —
 * el backend nunca lo manda ni lo guarda (decisión de §2 de PROYECTO.md).
 */

export interface ResumenSteam {
  steamId: string;
  nombre: string | null;
  avatar: string | null;
  urlPerfil: string | null;
  estado: number;
  publico: boolean;
  paisCodigo: string | null;
  miembroDesde: number | null;
}

export interface JuegoSteam {
  appid: number;
  nombre: string;
  minutosTotales: number;
  minutosDosSemanas: number;
  portada: string | null;
  icono: string | null;
  ultimaVez: number | null;
}

export interface EstadisticasSteam {
  totalJuegos: number;
  minutosTotales: number;
  nivel: number | null;
}

export interface DatosSteam {
  resumen: ResumenSteam | null;
  recientes: JuegoSteam[];
  estadisticas: EstadisticasSteam | null;
  masJugados: JuegoSteam[];
  actualizadoEn: string | null;
  hayDatosViejos: boolean;
}

export interface RespuestaSteam {
  vinculado: boolean;
  datos: DatosSteam | null;
}

// ── Formato ──────────────────────────────────────────────────────────

/*
 * Estas funciones no son componentes, así que usan la instancia de i18next
 * directamente en vez del hook. El idioma sale de `i18n.language`, que es
 * también lo que hace que `Intl` agrupe los miles como toca: 56,312 en
 * inglés pero 56.312 en español de España — el separador NO es cosmético,
 * cambia de significado según quién lea.
 */

/**
 * Minutos → texto de horas. Steam da minutos; nadie quiere leer "7117
 * minutos".
 *
 * Por debajo de una hora se dicen los minutos: "0 h" en un juego que
 * acabas de estrenar parece un error del sitio.
 */
export function horasDe(minutos: number): string {
  if (!Number.isFinite(minutos) || minutos <= 0) return i18n.t('steam.sinJugar');
  if (minutos < 60) return i18n.t('steam.minutos', { minutos: Math.round(minutos) });

  const horas = minutos / 60;
  // Con menos de 10 h, un decimal informa ("3.5 h"); con 300 h no aporta.
  const texto =
    horas < 10
      ? horas.toLocaleString(i18n.language, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })
      : numero(horas);
  return i18n.t('steam.horas', { horas: texto });
}

/** Números grandes con separador de miles: "942" y "56,312". */
export function numero(valor: number): string {
  return Number.isFinite(valor) ? Math.round(valor).toLocaleString(i18n.language) : '0';
}

/** Estados de persona de Steam. 0 es desconectado; el resto son matices
 *  de "está ahí" que no vale la pena distinguir en un perfil. */
export function estadoTexto(estado: number): { texto: string; enLinea: boolean } {
  switch (estado) {
    case 0:
      return { texto: i18n.t('steam.desconectado'), enLinea: false };
    case 2:
      return { texto: i18n.t('steam.ocupado'), enLinea: true };
    case 3:
      return { texto: i18n.t('steam.ausente'), enLinea: true };
    case 4:
      return { texto: i18n.t('steam.durmiendo'), enLinea: false };
    default:
      return { texto: i18n.t('steam.enLinea'), enLinea: true };
  }
}

/**
 * "hace 5 minutos" a partir de un ISO. Para el aviso de frescura.
 *
 * Con `Intl.RelativeTimeFormat` en vez de plantillas propias: cada idioma
 * arma esta frase a su manera ("hace 3 días" / "3 days ago"), y el orden
 * de las palabras no es algo que se pueda parchear con interpolación.
 */
export function haceCuanto(iso: string | null): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';

  const relativo = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' });

  const minutos = Math.floor(ms / 60_000);
  if (minutos < 2) return relativo.format(0, 'minute');
  if (minutos < 60) return relativo.format(-minutos, 'minute');

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return relativo.format(-horas, 'hour');

  return relativo.format(-Math.floor(horas / 24), 'day');
}
