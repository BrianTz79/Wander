import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Eye, EyeOff, Pencil, Share2 } from 'lucide-react';

import { api } from '../lib/api';
import { idDeScope, type RespuestaPerfilPublico } from '../lib/perfil';
import { CssDePerfil } from '../components/CssDePerfil';
import { ReproductorPerfil } from '../components/ReproductorPerfil';
import {
  columnaDe,
  necesitaDiscord,
  necesitaSteam,
  RenderBloque,
} from '../components/bloques/registro';
import { CONSULTA_ESCRITORIO, useMediaQuery } from '../lib/media';
import { SocialDePerfil } from '../components/social/SocialDePerfil';
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
  const { t } = useTranslation();
  const { handle } = useParams<{ handle: string }>();
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' });
  const [copiado, setCopiado] = useState(false);
  // Va aquí arriba, antes de cualquier `return` temprano: los hooks no
  // pueden ir después de una salida condicional.
  const anchoDeEscritorio = useMediaQuery(CONSULTA_ESCRITORIO);

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

  // Título de pestaña con el nombre del perfil. Al salir lo restaura App,
  // que lo repone en cada cambio de ruta y de idioma.
  useEffect(() => {
    if (estado.fase === 'listo') {
      document.title = t('perfilPublico.tituloPestana', {
        nombre: estado.datos.usuario.displayName,
        handle: estado.datos.usuario.handle,
      });
    }
  }, [estado, t]);

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
        <span className="sr-only">{t('perfilPublico.cargando')}</span>
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

  // El reparto conserva el orden relativo que la persona eligió dentro de
  // cada columna: `filter` no reordena.
  const laterales = bloques.filter((b) => columnaDe(b.tipo) === 'lateral');
  const principales = bloques.filter((b) => columnaDe(b.tipo) !== 'lateral');

  /*
   * Dos columnas solo si hay algo en las DOS. Un perfil recién hecho tiene
   * únicamente el Hero (lateral), y un perfil de puro texto no tiene nada
   * lateral: en cualquiera de los dos casos la rejilla dejaría media
   * pantalla en blanco al lado de una sola tarjeta. Con una columna se ve
   * bien en los dos.
   */
  const dosColumnas = anchoDeEscritorio && laterales.length > 0 && principales.length > 0;

  return (
    <ProveedorSteam handle={usuario.handle} activo={necesitaSteam(bloques)}>
    <ProveedorDiscord handle={usuario.handle} activo={necesitaDiscord(bloques)}>
    <div
      id={idDeScope(perfil.id)}
      className="perfil-raiz min-h-[calc(100vh-4rem)]"
    >
      {/* El CSS del usuario, ya sanitizado y prefijado con el id de este
          mismo contenedor. Va DENTRO de él para que se vaya del documento
          al salir del perfil, sin dejar reglas sueltas afectando al resto
          de la app. */}
      <CssDePerfil perfilId={perfil.id} tema={perfil.tema} css={perfil.cssPropio} />

      {/* Música de fondo (Fase 11). Va DENTRO del contenedor del perfil
          para heredar sus variables `--p-*` y verse con el tema de quien
          lo hizo; que se desmonte al salir es justo lo que se quiere: la
          música no debe seguir sonando en otra pantalla. */}
      <ReproductorPerfil audio={perfil} />

      {/* Aviso solo para el dueño de un perfil sin publicar. */}
      {esPropio && !perfil.publicado && (
        <div
          className="flex flex-wrap items-center justify-center gap-3 px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--p-tarjeta)', borderBottom: '1px solid var(--p-borde)' }}
        >
          <EyeOff className="h-4 w-4" style={{ color: 'var(--p-acento)' }} aria-hidden="true" />
          <span>{t('perfilPublico.sinPublicar')}</span>
          <Link to="/editor" className="font-semibold underline" style={{ color: 'var(--p-acento)' }}>
            {t('perfilPublico.publicarDesdeEditor')}
          </Link>
        </div>
      )}

      {/*
        Dos columnas a partir de `lg`, una sola por debajo.

        En teléfono se pinta `bloques` tal cual, en el orden que la persona
        eligió en el editor: es la lista de siempre y no hay ancho que
        repartir. A partir de `lg` esa misma lista se separa en lateral y
        principal (ver `columnaDe`), y la lateral se queda fija con
        `sticky` mientras la principal hace scroll.

        Las dos listas se pintan a la vez y se esconde una con `lg:hidden` /
        `hidden lg:block`… no: eso montaría cada bloque DOS veces y los que
        piden datos (Steam, Discord) harían el trabajo doble. Se decide en
        JS con una media query y se pinta una sola.
      */}
      <div className="perfil-cuerpo mx-auto w-full max-w-6xl px-4 pb-20">
        {bloques.length === 0 && (
          <p className="py-24 text-center text-sm" style={{ opacity: 0.6 }}>
            {t('perfilPublico.sinContenido')}
          </p>
        )}

        {dosColumnas ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[20rem_1fr] lg:items-start">
            {/* ── Columna lateral: quién es y dónde encontrarla ── */}
            <aside className="perfil-lateral flex flex-col gap-6 lg:sticky lg:top-24">
              {laterales.map((bloque) => (
                <RenderBloque key={bloque.id} bloque={bloque} usuario={usuario} />
              ))}
            </aside>

            {/* ── Columna principal: lo que tiene volumen ── */}
            <div className="perfil-principal flex min-w-0 flex-col gap-6">
              {principales.map((bloque) => (
                <RenderBloque key={bloque.id} bloque={bloque} usuario={usuario} />
              ))}
              <SocialDePerfil handle={usuario.handle} />
            </div>
          </div>
        ) : (
          /* Teléfono (y el respaldo si no hay `matchMedia`): una columna,
             el orden del editor, tal como estaba antes. */
          <div className="mx-auto flex max-w-2xl flex-col gap-6">
            {bloques.map((bloque) => (
              <RenderBloque key={bloque.id} bloque={bloque} usuario={usuario} />
            ))}
            <SocialDePerfil handle={usuario.handle} />
          </div>
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
                {t('perfilPublico.enlaceCopiado')}
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" style={{ color: 'var(--p-acento)' }} aria-hidden="true" />
                {t('perfilPublico.compartir')}
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
              {t('perfilPublico.editarMiPerfil')}
            </Link>
          )}

          <span className="inline-flex items-center gap-1.5" style={{ opacity: 0.6 }}>
            <Eye className="h-4 w-4" aria-hidden="true" />
            {t('perfilPublico.vistas', { count: perfil.vistas })}
          </span>
        </div>
      </div>
    </div>
    </ProveedorDiscord>
    </ProveedorSteam>
  );
}
