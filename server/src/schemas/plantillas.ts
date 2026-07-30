import type { z } from 'zod';
import type { temaSchema } from './perfil.schema';

/**
 * Catálogo de plantillas (Fase 4).
 *
 * Una plantilla es un preset: un tema completo con nombre. NO vive en una
 * tabla a propósito — cambia solo cuando se despliega código, así que una
 * tabla añadiría una migración y un join para datos que ya son constantes.
 * El servidor necesita la lista igualmente para validar el nombre que
 * manda el cliente, y el cliente la necesita para pintar el selector; el
 * espejo del cliente está en `client/src/lib/plantillas.ts`.
 *
 * Regla: aplicar una plantilla PISA el tema, nunca los bloques. Elegir un
 * aspecto no debe borrarle a nadie el contenido que escribió.
 */

export type Tema = z.infer<typeof temaSchema>;

export interface Plantilla {
  /** Identificador estable: es lo que se guarda en `Perfil.plantilla`. */
  id: string;
  nombre: string;
  descripcion: string;
  tema: Required<Tema>;
}

export const PLANTILLAS: readonly Plantilla[] = [
  {
    id: 'base-oscuro',
    nombre: 'Base oscura',
    descripcion: 'Fondo casi negro y acento azul. El punto de partida por defecto.',
    tema: {
      colorFondo: '#09090b',
      colorTexto: '#fafafa',
      colorAcento: '#60a5fa',
      colorTarjeta: '#18181b',
      colorBorde: '#27272a',
      fuente: 'inter',
      radio: 16,
    },
  },
  {
    id: 'minimal-claro',
    nombre: 'Minimal claro',
    descripcion: 'Blanco, mucho aire y contraste alto. Se lee bien en cualquier pantalla.',
    tema: {
      colorFondo: '#ffffff',
      colorTexto: '#18181b',
      colorAcento: '#2563eb',
      colorTarjeta: '#f4f4f5',
      colorBorde: '#e4e4e7',
      fuente: 'inter',
      radio: 12,
    },
  },
  {
    id: 'cyber-violeta',
    nombre: 'Cyber violeta',
    descripcion: 'Morados saturados sobre negro azulado. Esquinas muy redondeadas.',
    tema: {
      colorFondo: '#0b0714',
      colorTexto: '#f5f3ff',
      colorAcento: '#a855f7',
      colorTarjeta: '#1a1030',
      colorBorde: '#3b2a63',
      fuente: 'inter',
      radio: 24,
    },
  },
  {
    id: 'retro-crt',
    nombre: 'Retro CRT',
    descripcion: 'Verde fósforo sobre negro y tipografía monoespaciada. Esquinas rectas.',
    tema: {
      colorFondo: '#04120a',
      colorTexto: '#c8f7d4',
      colorAcento: '#22c55e',
      colorTarjeta: '#0a2415',
      colorBorde: '#166534',
      fuente: 'mono',
      radio: 0,
    },
  },
  {
    id: 'shooter-angular',
    nombre: 'Shooter angular',
    descripcion: 'Grises fríos, naranja de aviso y cero curvas. Aire táctico.',
    tema: {
      colorFondo: '#101214',
      colorTexto: '#e7e9ea',
      colorAcento: '#f97316',
      colorTarjeta: '#1b1f23',
      colorBorde: '#333a40',
      fuente: 'system',
      radio: 2,
    },
  },
] as const;

/** Id de la plantilla con la que nace toda cuenta nueva. */
export const PLANTILLA_POR_DEFECTO = 'base-oscuro';

/**
 * Marca de "ya no es ninguna plantilla": se escribe en `Perfil.plantilla`
 * en cuanto el usuario toca un color a mano. No está en `PLANTILLAS` (no
 * es elegible) y por eso tampoco pasa el enum del schema: solo lo pone el
 * servidor. Sirve para que el selector no siga señalando un preset del que
 * el tema ya se alejó.
 */
export const PLANTILLA_PERSONALIZADA = 'personalizada';

const PLANTILLAS_POR_ID = new Map(PLANTILLAS.map((p) => [p.id, p]));

export const IDS_PLANTILLA = PLANTILLAS.map((p) => p.id) as [string, ...string[]];

/** Devuelve la plantilla, o `undefined` si el id no está en el catálogo.
 *  El controlador convierte ese `undefined` en un 400: nunca se guarda un
 *  nombre de plantilla que no exista. */
export function buscarPlantilla(id: string): Plantilla | undefined {
  return PLANTILLAS_POR_ID.get(id);
}
