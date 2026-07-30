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

/**
 * Minutos → texto de horas. Steam da minutos; nadie quiere leer "7117
 * minutos".
 *
 * Por debajo de una hora se dicen los minutos: "0 h" en un juego que
 * acabas de estrenar parece un error del sitio.
 */
export function horasDe(minutos: number): string {
  if (!Number.isFinite(minutos) || minutos <= 0) return 'Sin jugar';
  if (minutos < 60) return `${Math.round(minutos)} min`;

  const horas = minutos / 60;
  // Con menos de 10 h, un decimal informa ("3.5 h"); con 300 h no aporta.
  const texto = horas < 10 ? horas.toFixed(1) : Math.round(horas).toLocaleString('es-MX');
  return `${texto} h`;
}

/** Números grandes con separador de miles: "942" y "56,312". */
export function numero(valor: number): string {
  return Number.isFinite(valor) ? Math.round(valor).toLocaleString('es-MX') : '0';
}

/** Estados de persona de Steam. 0 es desconectado; el resto son matices
 *  de "está ahí" que no vale la pena distinguir en un perfil. */
export function estadoTexto(estado: number): { texto: string; enLinea: boolean } {
  switch (estado) {
    case 0:
      return { texto: 'Desconectado', enLinea: false };
    case 2:
      return { texto: 'Ocupado', enLinea: true };
    case 3:
      return { texto: 'Ausente', enLinea: true };
    case 4:
      return { texto: 'Durmiendo', enLinea: false };
    default:
      return { texto: 'En línea', enLinea: true };
  }
}

/** "hace 5 minutos" a partir de un ISO. Para el aviso de frescura. */
export function haceCuanto(iso: string | null): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';

  const minutos = Math.floor(ms / 60_000);
  if (minutos < 2) return 'hace un momento';
  if (minutos < 60) return `hace ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;

  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
}
