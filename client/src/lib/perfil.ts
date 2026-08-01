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
  | 'spotify'
  | 'setup'
  | 'galeria';

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

/**
 * Música de fondo del perfil (Fase 11).
 *
 * `audioVolumen` es el volumen INICIAL que propone el dueño; el visitante
 * lo cambia y su preferencia manda (§7). `audioAutoplay` es solo una
 * intención: si el navegador bloquea la reproducción automática, se enseña
 * un botón en vez de pelearse con él.
 */
export interface AudioPerfil {
  audioUrl: string | null;
  audioTitulo: string | null;
  audioArtista: string | null;
  audioVolumen: number;
  audioAutoplay: boolean;
  audioLoop: boolean;
}

export interface PerfilPropio extends AudioPerfil {
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
  perfil: AudioPerfil & {
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
 * El tema del perfil como una REGLA CSS, no como estilo en línea.
 *
 * Esto es una decisión de la Fase 9 y tiene dos capas de motivo:
 *
 *  1. Ni el fondo ni el color ni la tipografía se ponen aquí como
 *     propiedades: van en la clase `.perfil-raiz` de `global.css`. Un
 *     estilo en línea gana a cualquier hoja de estilos, así que ponerlos
 *     aquí dejaría el `body { background: … }` del usuario sin efecto para
 *     siempre.
 *  2. Las **variables tampoco pueden ir en línea**. Una propiedad
 *     personalizada declarada en el atributo `style` gana a cualquier
 *     regla, incluida `#perfil-<id> { --p-acento: … }`. Como el CSS del
 *     usuario se prefija justo con ese selector, redefinir una variable
 *     —que es la forma más limpia de recolorear el perfil entero y lo que
 *     hacen todos los presets— no funcionaba nunca.
 *
 * Emitiéndolas como una regla con el mismo selector, el CSS del usuario
 * queda DESPUÉS en el mismo `<style>` y gana por orden de aparición, que
 * es lo que cualquiera espera al escribir CSS.
 *
 * Los valores ya vienen validados por el backend (hex estricto, enum de
 * fuentes, radio numérico). Aun así se escapa `}` y `<` antes de meterlos
 * en un `<style>`: son datos que acaban en una hoja de estilos, y la
 * validación de hoy no tiene por qué seguir siendo la de mañana.
 */
export function reglaDeTema(perfilId: string, tema: TemaPerfil | undefined | null): string {
  const t = temaCompleto(tema);
  const limpio = (valor: string) => valor.replace(/[<>{}\\]/g, '');

  return `#${idDeScope(perfilId)}{
--p-fondo:${limpio(t.colorFondo)};
--p-texto:${limpio(t.colorTexto)};
--p-acento:${limpio(t.colorAcento)};
--p-tarjeta:${limpio(t.colorTarjeta)};
--p-borde:${limpio(t.colorBorde)};
--p-radio:${Number(t.radio) || 0}px;
--p-fuente:${limpio(FUENTES[t.fuente] ?? FUENTES.inter)};
}`;
}

/** Color de texto atenuado: el color del tema con opacidad, sin pedirle
 *  al usuario que configure veinte tonos. */
export const TEXTO_SUAVE: CSSProperties = { color: 'var(--p-texto)', opacity: 0.65 };
