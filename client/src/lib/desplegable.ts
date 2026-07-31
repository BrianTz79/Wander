import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Decide si un panel flotante se abre hacia arriba o hacia abajo, y cuánto
 * puede medir de alto (Fase 10).
 *
 * Los selectores de emojis y de GIFs se abrían siempre hacia ARRIBA
 * (`bottom-full`). Eso es lo correcto en el chat, donde el compositor vive
 * al pie de la pantalla, pero en el feed el redactor está arriba del todo:
 * el panel se salía por encima de la ventana y la barra de búsqueda de los
 * GIFs quedaba fuera de la pantalla, así que no había forma de buscar nada.
 *
 * En vez de fijar una dirección, se mide: se abre hacia el lado donde quepa
 * mejor y se le da como tope el espacio que hay de verdad, para que el
 * panel siempre quepa entero en la ventana.
 *
 * Se usa `useLayoutEffect` y no `useEffect` porque la medición tiene que
 * ocurrir ANTES de que el navegador pinte: con `useEffect` el panel se vería
 * un fotograma en la posición equivocada y daría un salto visible.
 */

/** Alto ideal del panel. Si no cabe, se recorta al hueco disponible. */
const ALTO_DESEADO = 435;
/** Aire para no pegar el panel al borde de la ventana. */
const MARGEN = 16;

export interface Colocacion {
  /** `true` si el panel debe abrirse hacia arriba. */
  haciaArriba: boolean;
  /** Alto máximo en píxeles que cabe en esa dirección. */
  altoMaximo: number;
}

export function useColocacion<T extends HTMLElement>(): {
  ancla: React.RefObject<T | null>;
  colocacion: Colocacion;
} {
  const ancla = useRef<T>(null);
  const [colocacion, setColocacion] = useState<Colocacion>({
    haciaArriba: true,
    altoMaximo: ALTO_DESEADO,
  });

  useLayoutEffect(() => {
    function medir() {
      const nodo = ancla.current;
      if (!nodo) return;

      /*
       * Se mide el CONTENEDOR del botón, no el panel.
       *
       * El panel es `position: absolute`, así que su propia caja ya está
       * desplazada por la colocación que se decidió antes: medirlo a él
       * sería preguntarle al resultado por la respuesta, y el cálculo se
       * quedaría corto justo por el alto del panel. El `offsetParent` es el
       * `div.relative` que envuelve al botón, que es el punto fijo que de
       * verdad marca desde dónde se abre.
       */
      const referencia = (nodo.offsetParent as HTMLElement | null) ?? nodo;
      const caja = referencia.getBoundingClientRect();
      const arriba = caja.top - MARGEN;
      const abajo = window.innerHeight - caja.bottom - MARGEN;

      /*
       * Se prefiere ARRIBA mientras quepa el panel entero: es la dirección
       * natural para una barra de herramientas que está debajo del texto
       * que se escribe. Solo se baja cuando arriba no cabe y abajo hay más
       * sitio, y entonces el alto se limita a lo que de verdad hay.
       */
      const cabeArriba = arriba >= ALTO_DESEADO;
      const haciaArriba = cabeArriba || arriba >= abajo;
      const hueco = haciaArriba ? arriba : abajo;

      setColocacion({
        haciaArriba,
        // Nunca menos de 200 px: por debajo de eso el panel no es usable y
        // es preferible que desborde un poco y se pueda hacer scroll.
        altoMaximo: Math.max(200, Math.min(ALTO_DESEADO, hueco)),
      });
    }

    medir();

    // Al cambiar el tamaño de la ventana o al hacer scroll, el hueco cambia.
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, []);

  return { ancla, colocacion };
}
