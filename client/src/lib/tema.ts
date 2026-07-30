import { useCallback, useEffect, useState } from 'react';

/**
 * Tema claro/oscuro de la INTERFAZ de Wander (no de los perfiles, que
 * traen el suyo).
 *
 * Estrategia por clase `.dark` en <html>, con el oscuro como estado por
 * defecto (§7 del sistema de diseño). El script que evita el FOUC corre en
 * index.html antes del primer render; este hook solo lee y alterna.
 */

export type Tema = 'light' | 'dark';

const CLAVE = 'wander-tema';

function temaActual(): Tema {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function useTema() {
  const [tema, setTema] = useState<Tema>(temaActual);

  const aplicar = useCallback((nuevo: Tema) => {
    document.documentElement.classList.toggle('dark', nuevo === 'dark');
    localStorage.setItem(CLAVE, nuevo);
    setTema(nuevo);
  }, []);

  const alternar = useCallback(() => {
    aplicar(temaActual() === 'dark' ? 'light' : 'dark');
  }, [aplicar]);

  // Sincroniza si el tema cambia en otra pestaña.
  useEffect(() => {
    function alCambiarStorage(evento: StorageEvent) {
      if (evento.key === CLAVE && (evento.newValue === 'dark' || evento.newValue === 'light')) {
        document.documentElement.classList.toggle('dark', evento.newValue === 'dark');
        setTema(evento.newValue);
      }
    }
    window.addEventListener('storage', alCambiarStorage);
    return () => window.removeEventListener('storage', alCambiarStorage);
  }, []);

  return { tema, alternar, aplicar };
}
