import { useTranslation } from 'react-i18next';
import { FileDown } from 'lucide-react';

import { esAudio, esImagen, esVideo, tamanoLegible, type Adjunto } from '../../lib/archivos';

/**
 * Pinta los adjuntos de una publicación o un mensaje (Fase 8).
 *
 * Compartido entre el feed y el chat: son el mismo tipo de contenido y
 * deben verse igual en los dos sitios.
 */

interface Props {
  adjuntos: Adjunto[];
  /** En el chat las burbujas son estrechas; en el feed hay más sitio. */
  compacto?: boolean;
}

export function Adjuntos({ adjuntos, compacto = false }: Props) {
  const { t, i18n } = useTranslation();

  if (adjuntos.length === 0) return null;

  const imagenes = adjuntos.filter((a) => esImagen(a.mime));
  const otros = adjuntos.filter((a) => !esImagen(a.mime));

  return (
    <div className="mt-2 flex flex-col gap-2">
      {imagenes.length > 0 && (
        <div
          /* Una sola imagen va a ancho completo; varias, en cuadrícula de
             dos. Es lo que hace que una captura suelta se vea bien y cuatro
             no ocupen media pantalla cada una. */
          className={imagenes.length === 1 ? '' : 'grid grid-cols-2 gap-1.5'}
        >
          {imagenes.map((a) => (
            <a
              key={a.id}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700"
            >
              <img
                /* La miniatura en la lista y el original al abrir: un chat
                   con seis GIFs a tamaño completo cargando a la vez es lo
                   que hace que el móvil vaya a tirones. */
                src={a.miniaturaUrl ?? a.url}
                alt=""
                loading="lazy"
                /* `width`/`height` reservan el hueco antes de que cargue.
                   Sin ellos la lista da el salto clásico al aparecer cada
                   imagen, y en un chat eso mueve el mensaje que estabas
                   leyendo. */
                width={a.ancho ?? undefined}
                height={a.alto ?? undefined}
                className={`w-full object-cover ${
                  imagenes.length === 1
                    ? compacto
                      ? 'max-h-64'
                      : 'max-h-96'
                    : 'aspect-square'
                }`}
              />
            </a>
          ))}
        </div>
      )}

      {otros.map((a) =>
        esVideo(a.mime) ? (
          <video
            key={a.id}
            src={a.url}
            controls
            preload="metadata"
            className={`w-full rounded-lg border border-zinc-200 dark:border-zinc-700 ${
              compacto ? 'max-h-64' : 'max-h-96'
            }`}
          />
        ) : esAudio(a.mime) ? (
          <audio key={a.id} src={a.url} controls preload="metadata" className="w-full" />
        ) : (
          <a
            key={a.id}
            href={a.url}
            /* `download` fuerza la descarga en vez de intentar abrirlo en
               una pestaña. nginx además lo sirve con
               `Content-Disposition: attachment`, así que un archivo subido
               no se puede renderizar como documento. */
            download
            className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2
                       text-sm transition-colors hover:bg-zinc-50
                       dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <FileDown className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{t('compositor.archivo')}</span>
            <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
              {tamanoLegible(a.bytes, i18n.language)}
            </span>
          </a>
        )
      )}
    </div>
  );
}
