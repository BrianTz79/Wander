import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Send } from 'lucide-react';

import { social, type Publicacion } from '../../lib/social';
import type { Adjunto } from '../../lib/archivos';
import { mensajeError } from '../../lib/api';
import { useAuth } from '../../store/authStore';
import { Avatar } from './Avatar';
import { BarraCompositor } from './Compositor';

/** Debe coincidir con MAX_TEXTO_PUBLICACION del backend. */
const MAX = 1000;

interface Props {
  /** La publicación recién creada, para insertarla arriba del feed sin
   *  volver a pedirlo todo. */
  alPublicar: (publicacion: Publicacion) => void;
}

/**
 * Caja de redacción del feed.
 *
 * El contador de caracteres solo aparece cerca del límite. Un contador
 * siempre visible convierte cada publicación en un ejercicio de
 * presupuesto; lo que hace falta es un aviso cuando de verdad importa.
 */
export function Redactor({ alPublicar }: Props) {
  const { t } = useTranslation();
  const usuario = useAuth((e) => e.usuario);
  const [texto, setTexto] = useState('');
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const areaTexto = useRef<HTMLTextAreaElement>(null);

  /**
   * Inserta un emoji donde esté el cursor, no al final.
   *
   * Añadirlo siempre al final es lo fácil, pero rompe la expectativa de
   * quien vuelve a mitad de una frase para poner una cara: el emoji
   * aparecería lejos de donde estaba mirando.
   */
  const insertarTexto = useCallback((fragmento: string) => {
    const area = areaTexto.current;

    setTexto((actual) => {
      if (!area) return actual + fragmento;

      const inicio = area.selectionStart ?? actual.length;
      const fin = area.selectionEnd ?? actual.length;
      const nuevo = actual.slice(0, inicio) + fragmento + actual.slice(fin);

      // El cursor se recoloca tras el emoji en el siguiente fotograma:
      // hacerlo ahora no serviría porque React todavía no ha repintado.
      requestAnimationFrame(() => {
        area.focus();
        const pos = inicio + fragmento.length;
        area.setSelectionRange(pos, pos);
      });

      return nuevo;
    });
  }, []);

  if (!usuario) return null;

  const restantes = MAX - texto.length;
  const cerca = restantes <= 100;
  // Con adjuntos se puede publicar sin texto: una captura sin comentario es
  // una publicación normal.
  const puedeEnviar = Boolean(texto.trim()) || adjuntos.length > 0;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!puedeEnviar || enviando) return;

    setEnviando(true);
    setError('');
    try {
      const publicacion = await social.publicar({
        texto: texto.trim(),
        adjuntos: adjuntos.map((a) => a.id),
      });
      setTexto('');
      setAdjuntos([]);
      alPublicar(publicacion);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="tarjeta">
      <div className="flex gap-3">
        <Avatar
          usuario={{
            id: usuario.id,
            handle: usuario.handle,
            displayName: usuario.displayName,
            avatarUrl: usuario.avatarUrl,
          }}
          enlazar={false}
        />

        <div className="min-w-0 flex-1">
          <label htmlFor="redactor" className="sr-only">
            {t('social.queJuegas')}
          </label>
          <textarea
            id="redactor"
            ref={areaTexto}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={MAX}
            rows={3}
            placeholder={t('social.queJuegas')}
            className="w-full resize-none border-0 bg-transparent p-0 text-zinc-900 outline-none
                       placeholder:text-zinc-400 dark:text-white dark:placeholder:text-zinc-500"
          />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <BarraCompositor
              adjuntos={adjuntos}
              alCambiarAdjuntos={setAdjuntos}
              alInsertarTexto={insertarTexto}
              uso="publicacion"
              deshabilitado={enviando}
            />

            <div className="ml-auto flex items-center gap-3">
            {cerca && (
              <span
                className={`text-sm tabular-nums ${
                  restantes < 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'
                }`}
                // `polite` y no `assertive`: el contador cambia con cada
                // tecla, y anunciarlo de forma agresiva interrumpiría al
                // lector de pantalla en cada pulsación.
                aria-live="polite"
              >
                {restantes}
              </span>
            )}

              <button
                type="submit"
                disabled={!puedeEnviar || enviando}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-900
                           px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800
                           disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {enviando ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
                {t('social.publicar')}
              </button>
            </div>
          </div>

          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </div>
    </form>
  );
}
