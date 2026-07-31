import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

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
 */

interface Props {
  /** Se llama con el emoji ya listo para insertar (el carácter Unicode). */
  alElegir: (emoji: string) => void;
  alCerrar: () => void;
}

export function SelectorEmoji({ alElegir, alCerrar }: Props) {
  const { i18n } = useTranslation();
  const contenedor = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

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
    void Promise.all([import('emoji-mart'), import('@emoji-mart/data')]).then(
      ([mart, datos]) => {
        // El componente pudo desmontarse mientras se descargaba el chunk.
        if (!vivo || !contenedor.current) return;

        const Picker = (mart as unknown as { Picker: new (opciones: unknown) => object }).Picker;

        instancia = new Picker({
          data: (datos as { default: unknown }).default,
          parent: contenedor.current,
          onEmojiSelect: (emoji: { native?: string }) => {
            if (emoji.native) alElegir(emoji.native);
          },
          // emoji-mart trae sus propias traducciones por idioma; se le pasa
          // el de la interfaz para que las categorías y el buscador salgan
          // en el idioma correcto.
          locale: i18n.language.startsWith('en') ? 'en' : 'es',
          // Sigue el tema de Wander en vez de imponer el suyo.
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
          previewPosition: 'none',
          skinTonePosition: 'search',
          maxFrequentRows: 1,
        }) as { destroy?: () => void };
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
      /* `bottom-full` lo abre hacia ARRIBA: el compositor vive al pie de la
         pantalla en el chat, y hacia abajo el panel quedaría fuera. */
      className="absolute bottom-full left-0 z-50 mb-2"
    >
      <div ref={contenedor} />
    </div>
  );
}
