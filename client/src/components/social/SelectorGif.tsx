import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { archivos, type Gif } from '../../lib/archivos';

/**
 * Buscador de GIFs (Fase 8).
 *
 * Pide a `/api/archivos/gifs`, que es un proxy de Giphy en nuestro
 * servidor. El navegador nunca habla con Giphy: así la clave no viaja en el
 * bundle y la CSP puede seguir con `connect-src 'self'`. Las imágenes sí
 * vienen de su CDN, que está en `img-src`.
 */

interface Props {
  alElegir: (gif: Gif) => void;
  alCerrar: () => void;
}

export function SelectorGif({ alElegir, alCerrar }: Props) {
  const { t } = useTranslation();
  const [termino, setTermino] = useState('');
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [cargando, setCargando] = useState(true);
  const panel = useRef<HTMLDivElement>(null);
  const peticion = useRef(0);

  /*
   * Búsqueda con rebote de 350 ms. Sin él, escribir "gato" son cuatro
   * peticiones a Giphy —una por letra— de las que solo importa la última:
   * gasta cuota ajena y hace parpadear la cuadrícula.
   *
   * El contador de petición descarta las respuestas que llegan tarde: sin
   * eso, la búsqueda de "ga" puede volver DESPUÉS de la de "gato" y pisarla
   * con resultados viejos.
   */
  useEffect(() => {
    const mia = ++peticion.current;
    setCargando(true);

    const temporizador = setTimeout(() => {
      archivos
        .buscarGifs(termino)
        .then((resultados) => {
          if (peticion.current !== mia) return;
          setGifs(resultados);
        })
        .catch(() => {
          if (peticion.current !== mia) return;
          setGifs([]);
        })
        .finally(() => {
          if (peticion.current === mia) setCargando(false);
        });
    }, 350);

    return () => clearTimeout(temporizador);
  }, [termino]);

  useEffect(() => {
    const alPulsarFuera = (e: MouseEvent) => {
      if (panel.current && !panel.current.contains(e.target as Node)) alCerrar();
    };
    const alPulsarTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar();
    };

    document.addEventListener('mousedown', alPulsarFuera);
    document.addEventListener('keydown', alPulsarTecla);
    return () => {
      document.removeEventListener('mousedown', alPulsarFuera);
      document.removeEventListener('keydown', alPulsarTecla);
    };
  }, [alCerrar]);

  return (
    <div
      ref={panel}
      className="absolute bottom-full left-0 z-50 mb-2 w-80 rounded-xl border border-zinc-200
                 bg-white p-3 shadow-lg sm:w-96 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <input
        type="search"
        value={termino}
        onChange={(e) => setTermino(e.target.value)}
        placeholder={t('compositor.buscarGifs')}
        aria-label={t('compositor.buscarGifs')}
        autoFocus
        maxLength={60}
        className="mb-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm
                   text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none
                   dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
      />

      <div className="max-h-72 overflow-y-auto overscroll-contain">
        {cargando && (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {t('comun.cargando')}
          </p>
        )}

        {!cargando && gifs.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {t('compositor.sinGifs')}
          </p>
        )}

        {/* Dos columnas con las imágenes a ancho completo: los GIFs tienen
            proporciones muy distintas entre sí, y una cuadrícula de celdas
            cuadradas los recortaría todos. */}
        <div className="grid grid-cols-2 gap-2">
          {gifs.map((gif) => (
            <button
              key={gif.id}
              type="button"
              onClick={() => alElegir(gif)}
              className="overflow-hidden rounded-lg border border-transparent transition-colors
                         hover:border-blue-500 focus:border-blue-500 focus:outline-none"
            >
              <img
                src={gif.vistaPrevia}
                alt={gif.titulo}
                loading="lazy"
                className="w-full object-cover"
              />
            </button>
          ))}
        </div>
      </div>

      {/* Giphy exige atribución visible al usar su API. */}
      <p className="mt-2 text-center text-[10px] text-zinc-400 dark:text-zinc-500">
        {t('compositor.viaGiphy')}
      </p>
    </div>
  );
}
