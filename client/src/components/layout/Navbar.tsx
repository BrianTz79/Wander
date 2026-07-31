import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  Compass,
  LogOut,
  Menu,
  Moon,
  Pencil,
  Settings,
  Sun,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../../store/authStore';
import { useTema } from '../../lib/tema';

/**
 * Navbar de la aplicación (§5.9 del sistema de diseño).
 * Altura fija h-16, sticky, con blur de fondo. El estado activo se marca
 * solo por color — sin subrayado animado.
 *
 * Las acciones de cuenta (editor, configuración, cerrar sesión) viven en un
 * menú desplegable bajo el avatar. Antes estaban sueltas —o directamente no
 * estaban—: `/editor` y `/configuracion` no se enlazaban desde ningún sitio
 * fijo, así que a configuración solo se llegaba por un aviso condicional
 * dentro del editor y no había forma de volver. Un menú de cuenta es además
 * donde la gente ya busca "ajustes" por convención.
 */
export function Navbar() {
  const { usuario, logout } = useAuth();
  const { tema, alternar } = useTema();
  const navegar = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [menuCuenta, setMenuCuenta] = useState(false);
  const refCuenta = useRef<HTMLDivElement>(null);

  async function cerrarSesion() {
    await logout();
    setAbierto(false);
    setMenuCuenta(false);
    navegar('/');
  }

  // Cerrar el menú al pulsar fuera o con Escape. Sin esto queda abierto
  // tapando contenido, que es la queja clásica de los desplegables.
  useEffect(() => {
    if (!menuCuenta) return;

    const alPulsarFuera = (e: MouseEvent) => {
      if (refCuenta.current && !refCuenta.current.contains(e.target as Node)) {
        setMenuCuenta(false);
      }
    };
    const alPulsarTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuCuenta(false);
    };

    document.addEventListener('mousedown', alPulsarFuera);
    document.addEventListener('keydown', alPulsarTecla);
    return () => {
      document.removeEventListener('mousedown', alPulsarFuera);
      document.removeEventListener('keydown', alPulsarTecla);
    };
  }, [menuCuenta]);

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
              /* El icono suelto de Mensajes que había aquí se quitó: ya está
                 como enlace de texto en el centro, y dos accesos a lo mismo
                 en la misma barra solo reparten la atención. */
              <div className="relative hidden md:block" ref={refCuenta}>
                <button
                  type="button"
                  onClick={() => setMenuCuenta((v) => !v)}
                  className="btn-fantasma gap-2"
                  aria-expanded={menuCuenta}
                  aria-haspopup="menu"
                  aria-label="Menú de cuenta"
                >
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
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${menuCuenta ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>

                {menuCuenta && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl
                               border border-zinc-200 bg-white shadow-lg
                               dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                        {usuario.displayName}
                      </p>
                      <p className="truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">
                        /u/{usuario.handle}
                      </p>
                    </div>

                    <div className="py-1">
                      <OpcionMenu
                        to={`/u/${usuario.handle}`}
                        Icono={User}
                        etiqueta="Ver mi perfil"
                        alElegir={() => setMenuCuenta(false)}
                      />
                      <OpcionMenu
                        to="/editor"
                        Icono={Pencil}
                        etiqueta="Editar perfil"
                        alElegir={() => setMenuCuenta(false)}
                      />
                      <OpcionMenu
                        to="/configuracion"
                        Icono={Settings}
                        etiqueta="Configuración"
                        alElegir={() => setMenuCuenta(false)}
                      />
                    </div>

                    <div className="border-t border-zinc-200 py-1 dark:border-zinc-800">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={cerrarSesion}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm
                                   text-zinc-700 transition-colors hover:bg-zinc-100
                                   dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        <LogOut className="h-4 w-4" aria-hidden="true" />
                        Cerrar sesión
                      </button>
                    </div>
                  </div>
                )}
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
                {/* Separador: arriba está la navegación del sitio, aquí abajo
                    las acciones sobre tu propia cuenta. */}
                <hr className="my-2 border-zinc-200 dark:border-zinc-800" />
                <Link
                  to={`/u/${usuario.handle}`}
                  onClick={() => setAbierto(false)}
                  className="btn-fantasma justify-start gap-3"
                >
                  <User className="h-4 w-4" aria-hidden="true" />
                  Mi perfil
                </Link>
                <Link
                  to="/editor"
                  onClick={() => setAbierto(false)}
                  className="btn-fantasma justify-start gap-3"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Editar perfil
                </Link>
                <Link
                  to="/configuracion"
                  onClick={() => setAbierto(false)}
                  className="btn-fantasma justify-start gap-3"
                >
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  Configuración
                </Link>
                <button
                  type="button"
                  onClick={cerrarSesion}
                  className="btn-fantasma justify-start gap-3"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
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

/** Una fila del menú de cuenta. Existe para no repetir cuatro veces las
 *  mismas clases y el mismo `role`. */
function OpcionMenu({
  to,
  Icono,
  etiqueta,
  alElegir,
}: {
  to: string;
  Icono: typeof User;
  etiqueta: string;
  alElegir: () => void;
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={alElegir}
      className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 transition-colors
                 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      <Icono className="h-4 w-4" aria-hidden="true" />
      {etiqueta}
    </Link>
  );
}
