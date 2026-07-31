import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, Loader2, Search, Users } from 'lucide-react';

import { social, type Publicacion, type UsuarioExplorar } from '../lib/social';
import { mensajeError } from '../lib/api';
import { Avatar } from '../components/social/Avatar';
import { TarjetaPublicacion } from '../components/social/TarjetaPublicacion';

/**
 * `/explorar` — descubrir gente y publicaciones.
 *
 * Sin búsqueda muestra los perfiles más vistos: es el escaparate de quien
 * acaba de llegar y todavía no sigue a nadie. Con búsqueda añade las
 * publicaciones que coinciden.
 *
 * El término de búsqueda vive en la URL (`?q=`), no solo en el estado de
 * React. Así una búsqueda se puede compartir y el botón de atrás del
 * navegador hace lo que la gente espera.
 */
export function ExplorarPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();

  const q = params.get('q') ?? '';
  const juego = params.get('juego');

  // Lo que se escribe en la caja, separado de lo que se ha buscado: sin
  // esta separación cada tecla dispararía una petición.
  const [texto, setTexto] = useState(q);
  const [usuarios, setUsuarios] = useState<UsuarioExplorar[]>([]);
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // La caja se resincroniza si la URL cambia por fuera (atrás/adelante del
  // navegador, o un enlace a `?juego=`).
  useEffect(() => setTexto(q), [q]);

  const buscar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const datos = await social.explorar({
        ...(q ? { q } : {}),
        ...(juego ? { juegoAppid: Number(juego) } : {}),
      });
      setUsuarios(datos.usuarios);
      setPublicaciones(datos.publicaciones);
    } catch (e) {
      setError(mensajeError(e));
      setUsuarios([]);
      setPublicaciones([]);
    } finally {
      setCargando(false);
    }
  }, [q, juego]);

  useEffect(() => {
    void buscar();
  }, [buscar]);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const limpio = texto.trim();
    // `replace: true` para que escribir tres búsquedas seguidas no deje
    // tres entradas en el historial que hay que atravesar hacia atrás.
    setParams(limpio ? { q: limpio } : {}, { replace: true });
  }

  const hayFiltro = Boolean(q || juego);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
        {t('social.tituloExplorar')}
      </h1>
      <p className="mb-6 text-zinc-600 dark:text-zinc-400">{t('social.subtituloExplorar')}</p>

      <form onSubmit={enviar} className="mb-8 flex gap-2">
        <label htmlFor="buscar" className="sr-only">
          {t('social.buscarPlaceholder')}
        </label>
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            aria-hidden="true"
          />
          <input
            id="buscar"
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={40}
            placeholder={t('social.buscarPlaceholder')}
            className="campo pl-9"
          />
        </div>
        <button type="submit" className="btn-primario shrink-0">
          {t('social.buscar')}
        </button>
      </form>

      {juego && (
        <p className="mb-6 flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          {t('social.filtrandoPorJuego', { appid: juego })}
          <Link to="/explorar" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
            {t('social.quitarFiltro')}
          </Link>
        </p>
      )}

      {cargando && (
        <div className="flex justify-center py-12" role="status">
          <span className="sr-only">{t('comun.cargando')}</span>
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" aria-hidden="true" />
        </div>
      )}

      {error && <p className="py-12 text-center text-red-600 dark:text-red-400">{error}</p>}

      {!cargando && !error && (
        <div className="space-y-10">
          {/* ── Gente ── */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {hayFiltro ? t('social.perfilesQueCoinciden') : t('social.perfilesDestacados')}
            </h2>

            {usuarios.length === 0 ? (
              <p className="text-zinc-500 dark:text-zinc-400">{t('social.sinPerfiles')}</p>
            ) : (
              <ul className="space-y-3">
                {usuarios.map((u) => (
                  <li key={u.id}>
                    <Link
                      to={`/u/${u.handle}`}
                      className="tarjeta-interactiva flex items-center gap-3 p-4"
                    >
                      <Avatar usuario={u} tamano={44} enlazar={false} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-zinc-900 dark:text-white">
                          {u.displayName}
                        </p>
                        <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                          @{u.handle}
                        </p>
                        {u.bio && (
                          <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                            {u.bio}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 space-y-1 text-right text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="flex items-center justify-end gap-1">
                          <Users className="h-3.5 w-3.5" aria-hidden="true" />
                          {u.seguidores}
                        </span>
                        <span className="flex items-center justify-end gap-1">
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          {u.vistas}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Publicaciones: solo con filtro (§ controlador) ── */}
          {hayFiltro && (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {t('social.publicacionesQueCoinciden')}
              </h2>

              {publicaciones.length === 0 ? (
                <p className="text-zinc-500 dark:text-zinc-400">{t('social.sinPublicaciones')}</p>
              ) : (
                <div className="space-y-4">
                  {publicaciones.map((p) => (
                    <TarjetaPublicacion
                      key={p.id}
                      publicacion={p}
                      alCambiar={(nueva) =>
                        setPublicaciones((lista) =>
                          lista.map((x) => (x.id === nueva.id ? nueva : x))
                        )
                      }
                      alBorrar={(id) =>
                        setPublicaciones((lista) => lista.filter((x) => x.id !== id))
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
