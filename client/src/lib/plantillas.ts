import type { TemaPerfil } from './perfil';

/**
 * Catálogo de plantillas — espejo de `server/src/schemas/plantillas.ts`.
 *
 * El cliente lo usa para pintar el selector y las miniaturas; el servidor
 * tiene la copia autoritativa y es quien escribe el tema al aplicar una.
 * Si las dos listas se desincronizan, manda el servidor: el editor recarga
 * el tema que devuelve el PATCH, no el de esta constante.
 *
 * Aquí solo están el `id` y los colores. El nombre y la descripción que se
 * enseñan viven en los catálogos de i18n bajo `plantillas.<id>Nombre` y
 * `plantillas.<id>Descripcion` (Fase 6.5): son texto de interfaz, y este
 * módulo se evalúa una vez al importarlo, así que un texto puesto aquí se
 * quedaría congelado en el idioma que hubiera al arrancar.
 */

export interface Plantilla {
  id: string;
  tema: Required<TemaPerfil>;
}

export const PLANTILLAS: readonly Plantilla[] = [
  {
    id: 'base-oscuro',
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
];

/** La plantilla con la que nace toda cuenta nueva y a la que vuelve el
 *  botón "Restaurar" del panel de tema. */
export const PLANTILLA_POR_DEFECTO = 'base-oscuro';

/** Lo que el servidor escribe cuando el tema se edita a mano. */
export const PLANTILLA_PERSONALIZADA = 'personalizada';

export function buscarPlantilla(id: string): Plantilla | undefined {
  return PLANTILLAS.find((p) => p.id === id);
}
