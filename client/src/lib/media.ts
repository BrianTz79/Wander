import { useEffect, useState } from 'react';

/**
 * ¿Se cumple esta media query ahora mismo?
 *
 * Existe porque hay decisiones de maquetación que NO se pueden tomar con
 * clases de Tailwind. Pintar las dos versiones y esconder una con
 * `lg:hidden` es lo normal y funciona para cosas estáticas, pero aquí
 * montaría cada bloque dos veces, y los bloques de Steam y Discord piden
 * datos al montarse: serían dos peticiones por bloque, siempre, para tirar
 * la mitad. Decidiéndolo en JS se pinta una sola.
 *
 * Se usa `useState` con inicializador perezoso para acertar ya en el
 * primer render (nada de pintar teléfono y saltar a escritorio), y el
 * respaldo cuando no hay `matchMedia` es `false` — o sea, la vista de una
 * columna, que funciona en cualquier ancho.
 */
export function useMediaQuery(consulta: string): boolean {
  const [coincide, setCoincide] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(consulta).matches
      : false
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const lista = window.matchMedia(consulta);
    const alCambiar = (evento: MediaQueryListEvent) => setCoincide(evento.matches);

    // Se sincroniza al vuelo por si la consulta cambió entre el render y
    // este efecto (o si el ancho cambió mientras tanto).
    setCoincide(lista.matches);
    lista.addEventListener('change', alCambiar);
    return () => lista.removeEventListener('change', alCambiar);
  }, [consulta]);

  return coincide;
}

/** El punto donde el perfil pasa a dos columnas. Es el `lg` de Tailwind:
 *  si se cambia aquí, hay que cambiar también las clases `lg:` del perfil. */
export const CONSULTA_ESCRITORIO = '(min-width: 1024px)';
