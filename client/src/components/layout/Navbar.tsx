import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Compass, LogOut, Menu, MessageSquare, Moon, Sun, User, X } from 'lucide-react';
import { useAuth } from '../../store/authStore';
import { useTema } from '../../lib/tema';

/**
 * Navbar de la aplicación (§5.9 del sistema de diseño).
 * Altura fija h-16, sticky, con blur de fondo. El estado activo se marca
 * solo por color — sin subrayado animado.
 */
export function Navbar() {
  const { usuario, logout } = useAuth();
  const { tema, alternar } = useTema();
  const navegar = useNavigate();
  const [abierto, setAbierto] = useState(false);

  async function cerrarSesion() {
    await logout();
    setAbierto(false);
    navegar('/');
  }

  const claseEnlace = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'text-zinc-900 dark:text-white text-sm font-medium transition-colors'
      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-sm font-medium transition-colors';

  return (
    <nav
      className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md
                 transition-colors supports-backdrop-filter:bg-white/60
                 dark:border-zinc-800/40 dark:bg-zinc-950/80
                 dark:supports-backdrop-filter:bg-zinc-950/60"
    >
      <div className="contenedor-app">
        <div className="flex h-16 items-center justify-between">
          {/* Marca */}
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
            <Compass className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span className="text-lg text-zinc-900 dark:text-white">Wander</span>
          </Link>

          {/* Enlaces de escritorio */}
          <div className="hidden items-center gap-8 md:flex">
            <NavLink to="/explorar" className={claseEnlace}>
              Explorar
            </NavLink>
            {usuario && (
              <>
                <NavLink to="/feed" className={claseEnlace}>
                  Actividad
                </NavLink>
                <NavLink to="/mensajes" className={claseEnlace}>
                  Mensajes
                </NavLink>
              </>
            )}
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={alternar}
              className="btn-fantasma h-10 w-10 px-0"
              aria-label={tema === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro'}
            >
              {tema === 'dark' ? (
                <Sun className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Moon className="h-5 w-5" aria-hidden="true" />
              )}
            </button>

            {usuario ? (
              <div className="hidden items-center gap-2 md:flex">
                <Link to="/mensajes" className="btn-fantasma h-10 w-10 px-0" aria-label="Mensajes">
                  <MessageSquare className="h-5 w-5" aria-hidden="true" />
                </Link>
                <Link to={`/u/${usuario.handle}`} className="btn-fantasma gap-2">
                  {usuario.avatarUrl ? (
                    <img
                      src={usuario.avatarUrl}
                      alt=""
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-5 w-5" aria-hidden="true" />
                  )}
                  <span className="max-w-24 truncate">{usuario.displayName}</span>
                </Link>
                <button
                  type="button"
                  onClick={cerrarSesion}
                  className="btn-fantasma h-10 w-10 px-0"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="hidden items-center gap-2 md:flex">
                <Link
                  to="/login"
                  className="btn-fantasma"
                >
                  Iniciar sesión
                </Link>
                <Link
                  to="/registro"
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900
                             px-5 text-sm font-semibold text-white transition-all
                             hover:scale-105 hover:bg-zinc-800 active:scale-95
                             dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  Crear perfil
                </Link>
              </div>
            )}

            {/* Menú móvil */}
            <button
              type="button"
              onClick={() => setAbierto((v) => !v)}
              className="btn-fantasma h-10 w-10 px-0 md:hidden"
              aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={abierto}
            >
              {abierto ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Panel móvil */}
      {abierto && (
        <div className="border-t border-zinc-200 bg-white md:hidden dark:border-zinc-800 dark:bg-zinc-950">
          <div className="contenedor-app flex flex-col gap-1 py-4">
            <Link to="/explorar" onClick={() => setAbierto(false)} className="btn-fantasma justify-start">
              Explorar
            </Link>
            {usuario ? (
              <>
                <Link to="/feed" onClick={() => setAbierto(false)} className="btn-fantasma justify-start">
                  Actividad
                </Link>
                <Link to="/mensajes" onClick={() => setAbierto(false)} className="btn-fantasma justify-start">
                  Mensajes
                </Link>
                <Link
                  to={`/u/${usuario.handle}`}
                  onClick={() => setAbierto(false)}
                  className="btn-fantasma justify-start"
                >
                  Mi perfil
                </Link>
                <button type="button" onClick={cerrarSesion} className="btn-fantasma justify-start">
                  Cerrar sesión
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setAbierto(false)} className="btn-fantasma justify-start">
                  Iniciar sesión
                </Link>
                <Link to="/registro" onClick={() => setAbierto(false)} className="btn-primario mt-2 h-11">
                  Crear perfil
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
