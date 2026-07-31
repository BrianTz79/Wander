import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';

import { api } from '../lib/api';
import type { Publicacion } from '../lib/social';
import { TarjetaPublicacion } from '../components/social/TarjetaPublicacion';

/**
 * Una publicación sola, con sus comentarios abiertos (Fase 8).
 *
 * Existe porque las notificaciones necesitan un sitio al que llevar. Una
 * notificación de "te comentaron" que solo pudiera abrir el feed obligaría
 * a buscar la publicación entre todas las demás, y si ya bajó del feed
 * sería directamente imposible encontrarla.
 *
 * Es pública a propósito, igual que `/explorar`: si alguien comparte el
 * enlace de una publicación, quien lo abra sin cuenta debe poder leerla.
 */
export function PublicacionPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  const [publicacion, setPublicacion] = useState<Publicacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;

    setCargando(true);
    setError(false);

    api
      .get<{ publicacion: Publicacion }>(`/social/publicaciones/${id}`)
      .then((r) => setPublicacion(r.data.publicacion))
      .catch(() => setError(true))
      .finally(() => setCargando(false));
  }, [id]);

  /*
   * Salta al comentario del hash (`#c-<id>`) una vez pintado.
   *
   * El navegador no lo hace solo: cuando carga la página el comentario
   * todavía no existe en el DOM —llega con la publicación—, así que su
   * salto automático no encuentra nada a lo que ir.
   */
  useEffect(() => {
    if (!publicacion || !window.location.hash) return;

    const objetivo = document.getElementById(window.location.hash.slice(1));
    // Un fotograma de margen para que el hilo de comentarios termine de
    // montarse.
    const temporizador = setTimeout(() => {
      objetivo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);

    return () => clearTimeout(temporizador);
  }, [publicacion]);

  useEffect(() => {
    document.title = `${t('social.publicacion')} · Wander`;
  }, [t]);

  if (cargando) {
    return (
      <div className="contenedor-app flex justify-center py-16" role="status">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" aria-hidden="true" />
        <span className="sr-only">{t('comun.cargando')}</span>
      </div>
    );
  }

  if (error || !publicacion) {
    return (
      <div className="contenedor-app py-16 text-center">
        <p className="text-zinc-500 dark:text-zinc-400">{t('social.publicacionNoExiste')}</p>
      </div>
    );
  }

  return (
    <div className="contenedor-app max-w-2xl py-6">
      <TarjetaPublicacion
        publicacion={publicacion}
        alCambiar={setPublicacion}
        comentariosAbiertos
      />
    </div>
  );
}
