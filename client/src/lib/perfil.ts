import type { CSSProperties } from 'react';

/**
 * Tipos y utilidades del perfil público y del editor.
 *
 * IMPORTANTE: los perfiles NO usan los tokens de la interfaz de Wander
 * (zinc). Cada perfil emite sus propias variables `--p-*` a partir de su
 * tema, y los componentes de bloque solo consumen esas variables. Así la
 * personalización del usuario no puede tocar el resto de la app.
 */

// ── Tipos que espeja el backend (schemas/perfil.schema.ts) ───────────

export type FuentePerfil = 'inter' | 'system' | 'mono' | 'serif';

export interface TemaPerfil {
  colorFondo?: string;
  colorTexto?: string;
  colorAcento?: string;
  colorTarjeta?: string;
  colorBorde?: string;
  fuente?: FuentePerfil;
  radio?: number;
}

export type TipoBloque =
  | 'hero'
  | 'texto'
  | 'enlaces'
  | 'steam-actividad'
  | 'estadisticas'
  | 'favoritos'
  | 'discord-estado'
  | 'spotify';

export interface Bloque {
  id: string;
  tipo: TipoBloque;
  orden: number;
  visible: boolean;
  config: Record<string, unknown>;
}

export interface UsuarioPerfil {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  ubicacion?: string | null;
  miembroDesde?: string;
}

export interface PerfilPropio {
  id: string;
  plantilla: string;
  tema: TemaPerfil;
  publicado: boolean;
  vistas: number;
  /** CSS ya sanitizado por el servidor: es lo que se aplica de verdad. */
  cssPropio: string | null;
  /** Lo que el usuario escribió, para volver a llenar el editor. */
  cssOriginal: string | null;
  bloques: Bloque[];
}

export interface RespuestaPerfilPublico {
  usuario: UsuarioPerfil;
  perfil: {
    id: string;
    plantilla: string;
    tema: TemaPerfil;
    publicado: boolean;
    vistas: number;
    cssPropio: string | null;
  };
  bloques: Bloque[];
  esPropio: boolean;
}

/**
 * Id del contenedor que le da scope al CSS del usuario.
 *
 * Tiene que coincidir EXACTAMENTE con el prefijo que pone
 * `server/src/services/sanitizar.service.ts` al guardar. Si los dos lados
 * dejaran de estar de acuerdo, el CSS no fallaría con un error: dejaría de
 * aplicarse sin más, que es mucho peor de encontrar.
 */
export function idDeScope(perfilId: string): string {
  return `perfil-${perfilId}`;
}

// ── Tema por defecto (plantilla "base-oscuro") ───────────────────────

export const TEMA_BASE: Required<TemaPerfil> = {
  colorFondo: '#09090b',
  colorTexto: '#fafafa',
  colorAcento: '#60a5fa',
  colorTarjeta: '#18181b',
  colorBorde: '#27272a',
  fuente: 'inter',
  radio: 16,
};

const FUENTES: Record<FuentePerfil, string> = {
  inter: "'Inter', ui-sans-serif, system-ui, sans-serif",
  system: 'system-ui, -apple-system, sans-serif',
  mono: "ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, monospace",
  serif: "Georgia, 'Times New Roman', serif",
};

/** Nombres legibles para el selector de tipografía del editor. */
export const FUENTES_ETIQUETAS: Record<FuentePerfil, string> = {
  inter: 'Inter (la de Wander)',
  system: 'La del sistema',
  mono: 'Monoespaciada',
  serif: 'Serif clásica',
};

/** Completa un tema parcial con los valores de la plantilla base. */
export function temaCompleto(tema: TemaPerfil | undefined | null): Required<TemaPerfil> {
  return { ...TEMA_BASE, ...(tema ?? {}) };
}

/**
 * Convierte el tema en variables CSS para el contenedor del perfil.
 * Los valores ya vienen validados por el backend (hex estricto, enum de
 * fuentes, radio numérico), así que inyectarlos como style es seguro.
 *
 * Solo se emiten VARIABLES, nunca `backgroundColor`/`color`/`fontFamily`
 * directamente. La diferencia importa desde la Fase 9: un estilo en línea
 * gana a cualquier regla de una hoja de estilos, así que si el fondo se
 * pusiera aquí, el `body { background: … }` de quien escribe su CSS propio
 * no haría nada — y esa es de las primeras cosas que alguien intenta.
 * Poniéndolo en `.perfil-raiz` (una clase, en `index.css`), el CSS del
 * usuario tiene la misma especificidad y puede ganarle.
 */
export function varsDeTema(tema: TemaPerfil | undefined | null): CSSProperties {
  const t = temaCompleto(tema);
  return {
    '--p-fondo': t.colorFondo,
    '--p-texto': t.colorTexto,
    '--p-acento': t.colorAcento,
    '--p-tarjeta': t.colorTarjeta,
    '--p-borde': t.colorBorde,
    '--p-radio': `${t.radio}px`,
    '--p-fuente': FUENTES[t.fuente],
  } as CSSProperties;
}

/** Color de texto atenuado: el color del tema con opacidad, sin pedirle
 *  al usuario que configure veinte tonos. */
export const TEXTO_SUAVE: CSSProperties = { color: 'var(--p-texto)', opacity: 0.65 };
