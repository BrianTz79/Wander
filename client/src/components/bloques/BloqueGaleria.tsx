import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Bloque } from '../../lib/perfil';

interface Imagen {
  url: string;
  alt: string;
}

/** Extrae las imágenes del config, con la misma defensa en profundidad que
 *  el resto de bloques: solo rutas de `/uploads/`, nunca una URL externa.
 *  El backend ya lo valida al guardar; repetirlo aquí evita que un config
 *  viejo o manipulado convierta el perfil en un rastreador de visitantes. */
function imagenesDe(bloque: Bloque): Imagen[] {
  const crudas = bloque.config['imagenes'];
  if (!Array.isArray(crudas)) return [];
  return crudas
    .filter(
      (im): im is Imagen =>
        typeof im === 'object' &&
        im !== null &&
        typeof (im as Imagen).url === 'string' &&
        (im as Imagen).url.startsWith('/uploads/') &&
        !(im as Imagen).url.includes('..')
    )
    .map((im) => ({ url: im.url, alt: typeof im.alt === 'string' ? im.alt : '' }));
}

/**
 * Bloque de galería: capturas y fotos del setup, con visor a pantalla
 * completa.
 *
 * El visor va en un portal al `<body>` y NO dentro del contenedor del
 * perfil. Es a propósito: ese contenedor es el que lleva el scope del CSS
 * propio (Fase 9), así que un visor dentro quedaría a merced de cualquier
 * `position`, `overflow` o `z-index` que el dueño del perfil haya escrito
 * —incluido, sin mala intención, uno que lo deje irrecuperable—. Fuera del
 * scope, el visor es de Wander y se comporta igual en todos los perfiles.
 */
export function BloqueGaleria({ bloque }: { bloque: Bloque }) {
  const { t } = useTranslation();
  const imagenes = imagenesDe(bloque);
  const titulo = typeof bloque.config['titulo'] === 'string' ? bloque.config['titulo'] : '';
  const columnas = typeof bloque.config['columnas'] === 'number' ? bloque.config['columnas'] : 3;

  /** Índice abierto en el visor, o `null` si está cerrado. */
  const [abierta, setAbierta] = useState<number | null>(null);

  const cerrar = useCallback(() => setAbierta(null), []);
  const mover = useCallback(
    (paso: number) =>
      setAbierta((i) => (i === null ? null : (i + paso + imagenes.length) % imagenes.length)),
    [imagenes.length]
  );

  // Escape cierra y las flechas navegan, como en cualquier visor. Sin las
  // flechas, quien abre la primera imagen tiene que cerrar y volver a
  // pulsar para ver la segunda.
  useEffect(() => {
    if (abierta === null) return;
    const alPulsarTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
      else if (e.key === 'ArrowRight') mover(1);
      else if (e.key === 'ArrowLeft') mover(-1);
    };
    document.addEventListener('keydown', alPulsarTecla);
    return () => document.removeEventListener('keydown', alPulsarTecla);
  }, [abierta, cerrar, mover]);

  if (imagenes.length === 0) return null;

  const actual = abierta === null ? null : imagenes[abierta];

  return (
    <section>
      {titulo && <h2 className="mb-3 text-xl font-bold">{titulo}</h2>}

      <ul
        className="galeria-rejilla grid gap-2"
        /*
         * Las columnas de escritorio salen del config, así que no pueden
         * ser una clase de Tailwind: `grid-cols-${n}` no existe hasta que
         * alguien lo escribe literal, y el compilador solo ve lo literal.
         * Viajan como variable; la clase `.galeria-rejilla` de `global.css`
         * es la que decide cuándo hacerle caso (en móvil siempre son 2).
         */
        style={{ '--galeria-cols': columnas } as CSSProperties}
      >
        {imagenes.map((imagen, i) => (
          <li key={`${imagen.url}-${i}`}>
            <button
              type="button"
              onClick={() => setAbierta(i)}
              className="block w-full cursor-zoom-in overflow-hidden transition-transform hover:scale-[1.02]"
              style={{ borderRadius: 'var(--p-radio)', border: '1px solid var(--p-borde)' }}
            >
              <img
                src={imagen.url}
                alt={imagen.alt}
                loading="lazy"
                // `aspect-square` + `object-cover` para que una mezcla de
                // capturas apaisadas y verticales siga siendo una rejilla y
                // no una escalera. El recorte solo afecta a la miniatura:
                // el visor enseña la imagen entera.
                className="aspect-square w-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>

      {actual &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={cerrar}
            role="dialog"
            aria-modal="true"
            aria-label={t('bloques.galeriaVisor')}
          >
            <img
              src={actual.url}
              alt={actual.alt}
              // El clic en la imagen no cierra: cerrar al pulsar el fondo
              // es lo esperado, cerrar al pulsar lo que estás mirando no.
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full object-contain"
            />

            <button
              type="button"
              onClick={cerrar}
              className="absolute top-4 right-4 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
              aria-label={t('comun.cerrar')}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            {imagenes.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    mover(-1);
                  }}
                  className="absolute left-2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 sm:left-4"
                  aria-label={t('bloques.galeriaAnterior')}
                >
                  <ChevronLeft className="h-6 w-6" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    mover(1);
                  }}
                  className="absolute right-2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 sm:right-4"
                  aria-label={t('bloques.galeriaSiguiente')}
                >
                  <ChevronRight className="h-6 w-6" aria-hidden="true" />
                </button>
                <p className="absolute bottom-4 text-sm text-white/70">
                  {(abierta ?? 0) + 1} / {imagenes.length}
                </p>
              </>
            )}
          </div>,
          document.body
        )}
    </section>
  );
}
