import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useColocacion } from '../../lib/desplegable';

/**
 * Selector de emojis, sobre `emoji-mart` (Fase 8).
 *
 * **Se monta con la API imperativa (`new Picker(...)`) y no con
 * `@emoji-mart/react`.** El wrapper de React crea un web component y
 * gestiona su ciclo de vida por su cuenta, lo que choca con el doble
 * montaje del modo estricto de React 19: el picker acaba insertado dos
 * veces. Instanciándolo aquí, el `useEffect` controla su creación y su
 * destrucción, que es justo lo que hace falta.
 *
 * **Los datos se importan, no se cargan de la CDN.** Por defecto emoji-mart
 * pide su JSON a `cdn.jsdelivr.net`, y la CSP de Wander tiene
 * `connect-src 'self'`: esa petición se bloquearía y el panel saldría
 * vacío. Importarlos los mete en el bundle, que es además coherente con
 * cómo se cargan los catálogos de i18n (§6.5).
 *
 * **Y lo mismo vale para las traducciones, que son una SEGUNDA descarga.**
 * Pasar `locale: 'es'` no basta: emoji-mart trae los datos de emojis por un
 * lado y su catálogo de textos por otro, y con `locale` va a buscar el
 * segundo a `cdn.jsdelivr.net/npm/@emoji-mart/data@latest/i18n/es.json`. La
 * CSP corta esa petición, el `fetch` rechaza, y como emoji-mart lo hace
 * dentro de su `connectedCallback` sin capturar el fallo, el picker se
 * queda con el `<style>` y CERO emojis — un panel gris que no responde.
 * Era exactamente el bug de "le pico al botón y no hace nada": el elemento
 * montaba (por eso la prueba de la Fase 8 lo daba por bueno) pero nunca
 * llegaba a pintarse. Se le pasa el catálogo YA CARGADO en `i18n`, que
 * `@emoji-mart/data` incluye en el paquete, así no hay ninguna petición.
 */

interface Props {
  /** Se llama con el emoji ya listo para insertar (el carácter Unicode). */
  alElegir: (emoji: string) => void;
  alCerrar: () => void;
}

export function SelectorEmoji({ alElegir, alCerrar }: Props) {
  const { i18n } = useTranslation();
  const contenedor = useRef<HTMLDivElement>(null);
  const { ancla: panel, colocacion } = useColocacion<HTMLDivElement>();

  /*
   * El alto medido, en una ref además de en el estado.
   *
   * El picker se monta de forma ASÍNCRONA (después del `import()`), así que
   * cuando termina ya no hay ningún render pendiente en el que aplicar el
   * alto. Leerlo de la ref permite ponerlo en cuanto el elemento existe,
   * sin meter `altoMaximo` en las dependencias del efecto que lo crea —que
   * lo reconstruiría entero en cada píxel de scroll—.
   */
  const altoMaximo = useRef(colocacion.altoMaximo);
  altoMaximo.current = colocacion.altoMaximo;

  /** emoji-mart fija `height: 435px` en su `:host`; un estilo puesto en el
   *  propio elemento gana a esa regla. */
  function aplicarAlto() {
    const elemento = contenedor.current?.firstElementChild as HTMLElement | null;
    if (elemento) elemento.style.height = `${altoMaximo.current}px`;
  }

  useEffect(() => {
    let vivo = true;
    let instancia: { destroy?: () => void } | null = null;

    /*
     * Carga diferida: `@emoji-mart/data` son ~900 KB de JSON. Metidos en el
     * bundle principal, todo el mundo los descargaría —incluido quien
     * nunca abre el selector, y quien solo entra a ver un perfil—. Con el
     * `import()` dinámico, Vite los deja en un chunk aparte que solo se
     * pide al abrir el panel por primera vez.
     */
    const enIngles = i18n.language.startsWith('en');

    void Promise.all([
      import('emoji-mart'),
      import('@emoji-mart/data'),
      // El catálogo de textos, importado igual que los datos. Los dos
      // idiomas se piden por separado para no meter en el chunk el que no
      // se va a usar.
      enIngles ? import('@emoji-mart/data/i18n/en.json') : import('@emoji-mart/data/i18n/es.json'),
    ]).then(
      ([mart, datos, traducciones]) => {
        // El componente pudo desmontarse mientras se descargaba el chunk.
        if (!vivo || !contenedor.current) return;

        const Picker = (mart as unknown as { Picker: new (opciones: unknown) => object }).Picker;

        instancia = new Picker({
          data: (datos as { default: unknown }).default,
          parent: contenedor.current,
          onEmojiSelect: (emoji: { native?: string }) => {
            if (emoji.native) alElegir(emoji.native);
          },
          // `i18n` y no `locale`: con `locale` emoji-mart saldría a buscar
          // este mismo JSON a jsdelivr y la CSP lo cortaría (ver cabecera).
          i18n: (traducciones as { default: unknown }).default,
          // Sigue el tema de Wander en vez de imponer el suyo.
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
          previewPosition: 'none',
          skinTonePosition: 'search',
          maxFrequentRows: 1,
        }) as { destroy?: () => void };

        // El elemento ya existe: se le impone el alto que quepa.
        aplicarAlto();
      }
    );

    return () => {
      vivo = false;
      instancia?.destroy?.();
      // `destroy` no existe en todas las versiones; si no está, se vacía el
      // contenedor a mano para no dejar el picker anterior colgando en el
      // DOM al reabrir.
      if (contenedor.current) contenedor.current.innerHTML = '';
    };
  }, [alElegir, i18n.language]);

  // Y se reaplica cuando la medida cambia (scroll, cambio de tamaño),
  // momento en el que el picker ya suele estar montado.
  useEffect(aplicarAlto, [colocacion.altoMaximo]);

  // Cerrar al pulsar fuera o con Escape, como el resto de desplegables.
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
      /* La dirección se mide en vez de fijarse: hacia arriba en el chat
         (el compositor está al pie) y hacia abajo en el feed (está arriba).
         Ver `useColocacion`. */
      className={`absolute left-0 z-50 ${colocacion.haciaArriba ? 'bottom-full mb-2' : 'top-full mt-2'}`}
    >
      <div ref={contenedor} />
    </div>
  );
}
