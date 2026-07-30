import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Eye, EyeOff, Pencil, Share2 } from 'lucide-react';

import { api } from '../lib/api';
import { varsDeTema, type RespuestaPerfilPublico } from '../lib/perfil';
import { necesitaDiscord, necesitaSteam, RenderBloque } from '../components/bloques/registro';
import { ProveedorSteam } from '../lib/steamContexto';
import { ProveedorDiscord } from '../lib/discordContexto';
import { NoEncontradaPage } from './NoEncontradaPage';

type Estado =
  | { fase: 'cargando' }
  | { fase: 'no-existe' }
  | { fase: 'listo'; datos: RespuestaPerfilPublico };

/**
 * Perfil público: /u/:handle.
 *
 * Renderiza los bloques del usuario con SU tema, no con el de Wander.
 * El dueño ve su perfil aunque esté sin publicar (con un aviso); para
 * cualquier otra persona un perfil no publicado es un 404.
 */
export function PerfilPublicoPage() {
  const { handle } = useParams<{ handle: string }>();
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' });
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setEstado({ fase: 'cargando' });

    api
      .get<RespuestaPerfilPublico>(`/perfiles/${encodeURIComponent(handle ?? '')}`)
      .then(({ data }) => {
        if (!cancelado) setEstado({ fase: 'listo', datos: data });
      })
      .catch(() => {
        if (!cancelado) setEstado({ fase: 'no-existe' });
      });

    return () => {
      cancelado = true;
    };
  }, [handle]);

  // Título de pestaña con el nombre del perfil.
  useEffect(() => {
    if (estado.fase === 'listo') {
      document.title = `${estado.datos.usuario.displayName} (@${estado.datos.usuario.handle}) — Wander`;
    }
    return () => {
      document.title = 'Wander — tu identidad como jugador';
    };
  }, [estado]);

  async function compartir() {
    const url = window.location.href;
    try {
      // El API nativo de compartir donde exista (móvil); portapapeles como
      // alternativa universal.
      if (navigator.share) {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* usuario canceló el diálogo: no es un error */
    }
  }

  if (estado.fase === 'cargando') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status">
        <span className="sr-only">Cargando perfil…</span>
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900
                     dark:border-zinc-700 dark:border-t-white"
          aria-hidden="true"
        />
      </div>
    );
  }

  if (estado.fase === 'no-existe') return <NoEncontradaPage />;

  const { usuario, perfil, bloques, esPropio } = estado.datos;

  return (
    <ProveedorSteam handle={usuario.handle} activo={necesitaSteam(bloques)}>
    <ProveedorDiscord handle={usuario.handle} activo={necesitaDiscord(bloques)}>
    <div style={varsDeTema(perfil.tema)} className="min-h-[calc(100vh-4rem)]">
      {/* Aviso solo para el dueño de un perfil sin publicar. */}
      {esPropio && !perfil.publicado && (
        <div
          className="flex flex-wrap items-center justify-center gap-3 px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--p-tarjeta)', borderBottom: '1px solid var(--p-borde)' }}
        >
          <EyeOff className="h-4 w-4" style={{ color: 'var(--p-acento)' }} aria-hidden="true" />
          <span>Este perfil todavía no está publicado: solo tú puedes verlo.</span>
          <Link to="/editor" className="font-semibold underline" style={{ color: 'var(--p-acento)' }}>
            Publicar desde el editor
          </Link>
        </div>
      )}

      <div className="mx-auto max-w-2xl px-4 pb-20">
        {bloques.map((bloque) => (
          <div key={bloque.id} className="mt-6 first:mt-0">
            <RenderBloque bloque={bloque} usuario={usuario} />
          </div>
        ))}

        {bloques.length === 0 && (
          <p className="py-24 text-center text-sm" style={{ opacity: 0.6 }}>
            Este perfil todavía no tiene contenido.
          </p>
        )}

        {/* Pie del perfil: compartir, vistas y (para el dueño) editar. */}
        <div
          className="mt-10 flex flex-wrap items-center justify-center gap-4 border-t pt-6 text-sm"
          style={{ borderColor: 'var(--p-borde)' }}
        >
          <button
            type="button"
            onClick={compartir}
            className="inline-flex items-center gap-2 px-4 py-2 font-semibold transition-transform hover:scale-105"
            style={{
              backgroundColor: 'var(--p-tarjeta)',
              border: '1px solid var(--p-borde)',
              borderRadius: 'var(--p-radio)',
            }}
          >
            {copiado ? (
              <>
                <Check className="h-4 w-4" style={{ color: 'var(--p-acento)' }} aria-hidden="true" />
                Enlace copiado
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" style={{ color: 'var(--p-acento)' }} aria-hidden="true" />
                Compartir
              </>
            )}
          </button>

          {esPropio && (
            <Link
              to="/editor"
              className="inline-flex items-center gap-2 px-4 py-2 font-semibold transition-transform hover:scale-105"
              style={{
                backgroundColor: 'var(--p-tarjeta)',
                border: '1px solid var(--p-borde)',
                borderRadius: 'var(--p-radio)',
              }}
            >
              <Pencil className="h-4 w-4" style={{ color: 'var(--p-acento)' }} aria-hidden="true" />
              Editar mi perfil
            </Link>
          )}

          <span className="inline-flex items-center gap-1.5" style={{ opacity: 0.6 }}>
            <Eye className="h-4 w-4" aria-hidden="true" />
            {perfil.vistas} {perfil.vistas === 1 ? 'vista' : 'vistas'}
          </span>
        </div>
      </div>
    </div>
    </ProveedorDiscord>
    </ProveedorSteam>
  );
}
