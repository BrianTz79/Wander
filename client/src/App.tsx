import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { RutaProtegida } from './components/RutaProtegida';
import { useAuth } from './store/authStore';

import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegistroPage } from './pages/RegistroPage';
import { PerfilPublicoPage } from './pages/PerfilPublicoPage';
import { EditorPerfilPage } from './pages/EditorPerfilPage';
import { NoEncontradaPage } from './pages/NoEncontradaPage';
import { EnConstruccionPage } from './pages/EnConstruccionPage';
import { ConfiguracionPage } from './pages/ConfiguracionPage';
import { PrivacidadPage } from './pages/PrivacidadPage';

/**
 * Raíz de la aplicación: comprobación de sesión, layout y rutas.
 *
 * Las rutas que todavía no tienen pantalla propia apuntan a
 * `EnConstruccionPage` en vez de omitirse. Es deliberado: la Navbar y el
 * Footer ya enlazan a /explorar, /feed, /mensajes y /privacidad, y un
 * enlace a una ruta inexistente caería en el 404 y parecería un bug.
 */
export function App() {
  const comprobarSesion = useAuth((e) => e.comprobarSesion);
  const cargando = useAuth((e) => e.cargando);
  const { pathname } = useLocation();

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

  // Hasta que se resuelve la primera comprobación no se pinta nada de la
  // app: si no, se vería la navbar de invitado un instante antes de
  // cambiar a la de sesión iniciada.
  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status">
        <span className="sr-only">Cargando…</span>
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
        Saltar al contenido
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

          <Route path="/explorar" element={<EnConstruccionPage titulo="Explorar" fase="Fase 7" />} />
          <Route path="/u/:handle" element={<PerfilPublicoPage />} />
          <Route path="/privacidad" element={<PrivacidadPage />} />
          <Route path="/terminos" element={<EnConstruccionPage titulo="Términos" fase="Fase 10" />} />

          <Route
            path="/feed"
            element={
              <RutaProtegida>
                <EnConstruccionPage titulo="Actividad" fase="Fase 7" />
              </RutaProtegida>
            }
          />
          <Route
            path="/mensajes"
            element={
              <RutaProtegida>
                <EnConstruccionPage titulo="Mensajes" fase="Fase 8" />
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
          <Route
            path="/configuracion"
            element={
              <RutaProtegida>
                <ConfiguracionPage />
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
