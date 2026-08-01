import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { RutaProtegida } from './components/RutaProtegida';
import { useAuth } from './store/authStore';
import { useSincronizarIdiomaDeCuenta } from './lib/idioma';

import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegistroPage } from './pages/RegistroPage';
import { PerfilPublicoPage } from './pages/PerfilPublicoPage';
import { EditorPerfilPage } from './pages/EditorPerfilPage';
import { EditorCssPage } from './pages/EditorCssPage';
import { NoEncontradaPage } from './pages/NoEncontradaPage';
import { FeedPage } from './pages/FeedPage';
import { ExplorarPage } from './pages/ExplorarPage';
import { ConfiguracionPage } from './pages/ConfiguracionPage';
import { PrivacidadPage } from './pages/PrivacidadPage';
import { TerminosPage } from './pages/TerminosPage';
import { MensajesPage } from './pages/MensajesPage';
import { NotificacionesPage } from './pages/NotificacionesPage';
import { PublicacionPage } from './pages/PublicacionPage';
import { AdminPage } from './pages/AdminPage';

/**
 * Raíz de la aplicación: comprobación de sesión, layout y rutas.
 *
 * Desde la Fase 8 **ya no queda ninguna ruta en construcción**: /mensajes
 * era la última que apuntaba a `EnConstruccionPage`, y con ella todos los
 * enlaces de la Navbar y del Footer llevan a una pantalla real.
 */
export function App() {
  const { t } = useTranslation();
  const comprobarSesion = useAuth((e) => e.comprobarSesion);
  const cargando = useAuth((e) => e.cargando);
  const { pathname } = useLocation();

  // Aplica el idioma guardado en la cuenta cuando llega la sesión, salvo
  // que ya haya una elección hecha en este navegador (§ lib/idioma.ts).
  useSincronizarIdiomaDeCuenta();

  // Una sola vez al montar: pregunta al backend si la cookie de sesión
  // sigue siendo válida y rellena el store.
  useEffect(() => {
    void comprobarSesion();
  }, [comprobarSesion]);

  // Al cambiar de ruta, volver arriba. Sin esto, navegar desde el pie de
  // una página larga deja la siguiente a media altura.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  /*
   * Título de la pestaña. El perfil público pone el suyo (con el nombre de
   * quien lo tiene) y al desmontarse restaura este, así que se vuelve a
   * aplicar aquí en cada cambio de ruta y de idioma.
   */
  useEffect(() => {
    document.title = t('landing.tituloPestana');
  }, [t, pathname]);

  // Hasta que se resuelve la primera comprobación no se pinta nada de la
  // app: si no, se vería la navbar de invitado un instante antes de
  // cambiar a la de sesión iniciada.
  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status">
        <span className="sr-only">{t('comun.cargando')}</span>
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900
                     dark:border-zinc-700 dark:border-t-white"
          aria-hidden="true"
        />
      </div>
    );
  }

  return (
    <>
      <a href="#contenido" className="salto-contenido">
        {t('comun.saltarContenido')}
      </a>

      <Navbar />

      <main id="contenido" className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage />} />

          {/* Solo para invitados: quien ya tiene sesión no necesita el
              formulario y se lo manda a su perfil. */}
          <Route
            path="/login"
            element={
              <RutaProtegida soloInvitados>
                <LoginPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/registro"
            element={
              <RutaProtegida soloInvitados>
                <RegistroPage />
              </RutaProtegida>
            }
          />

          {/* Explorar es público a propósito: es la puerta de entrada para
              quien llega sin cuenta y quiere ver qué hay aquí. */}
          <Route path="/explorar" element={<ExplorarPage />} />
          <Route path="/u/:handle" element={<PerfilPublicoPage />} />
          {/* Pública como /explorar: si alguien comparte el enlace de una
              publicación, quien lo abra sin cuenta debe poder leerla. */}
          <Route path="/publicacion/:id" element={<PublicacionPage />} />
          <Route path="/privacidad" element={<PrivacidadPage />} />
          <Route path="/terminos" element={<TerminosPage />} />

          <Route
            path="/feed"
            element={
              <RutaProtegida>
                <FeedPage />
              </RutaProtegida>
            }
          />
          {/* La conversación abierta vive en la URL y no en el estado: así
              el enlace se puede compartir, el botón de atrás funciona, y una
              notificación de mensaje lleva directa a su hilo. */}
          <Route
            path="/mensajes"
            element={
              <RutaProtegida>
                <MensajesPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/mensajes/:id"
            element={
              <RutaProtegida>
                <MensajesPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/notificaciones"
            element={
              <RutaProtegida>
                <NotificacionesPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/editor"
            element={
              <RutaProtegida>
                <EditorPerfilPage />
              </RutaProtegida>
            }
          />
          {/* Edición avanzada (CSS propio). Va en su propia ruta y no como
              un panel del editor: quien entra aquí ya sabe a qué viene, y
              el editor de bloques se queda limpio para todos los demás. */}
          <Route
            path="/editor/css"
            element={
              <RutaProtegida>
                <EditorCssPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/configuracion"
            element={
              <RutaProtegida>
                <ConfiguracionPage />
              </RutaProtegida>
            }
          />

          {/* Panel de moderación (Fase 10). `roles` pinta el 404 a quien no
              modera; la autorización real la hace el backend por endpoint. */}
          <Route
            path="/admin"
            element={
              <RutaProtegida roles={['MOD', 'ADMIN']}>
                <AdminPage />
              </RutaProtegida>
            }
          />

          {/* Alias cómodo: /me lleva al perfil propio. */}
          <Route path="/me" element={<RedirigirAMiPerfil />} />

          <Route path="*" element={<NoEncontradaPage />} />
        </Routes>
      </main>

      <Footer />
    </>
  );
}

/** `/me` → `/u/<handle propio>`, o al login si no hay sesión. */
function RedirigirAMiPerfil() {
  const usuario = useAuth((e) => e.usuario);
  return <Navigate to={usuario ? `/u/${usuario.handle}` : '/login'} replace />;
}
