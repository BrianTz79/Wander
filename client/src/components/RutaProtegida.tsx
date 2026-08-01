import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../store/authStore';
import { NoEncontradaPage } from '../pages/NoEncontradaPage';

interface Props {
  children: ReactNode;
  /** Invierte la regla: la ruta es para quien NO tiene sesión (login, registro). */
  soloInvitados?: boolean;
  /**
   * Roles que pueden ver la ruta (Fase 10, para `/admin`).
   *
   * Quien no lo tenga recibe el 404 de la aplicación, no un "no tienes
   * permiso": el panel de moderación no se anuncia a quien no modera. El
   * backend hace lo mismo con `requiereMod`, que es donde está la
   * autorización de verdad.
   */
  roles?: string[];
}

/**
 * Guarda de rutas.
 *
 * Aviso importante: esto es comodidad de interfaz, NO seguridad. Cualquiera
 * puede saltárselo desde las herramientas del navegador. La autorización
 * real la hace el backend en cada endpoint (`requiereAuth`); aquí solo se
 * evita mostrar pantallas que igualmente fallarían.
 *
 * No hace falta contemplar el estado de carga: `App` no monta las rutas
 * hasta que `comprobarSesion` termina, así que `usuario` ya es definitivo.
 */
export function RutaProtegida({ children, soloInvitados = false, roles }: Props) {
  const usuario = useAuth((e) => e.usuario);
  const ubicacion = useLocation();

  if (soloInvitados) {
    if (usuario) {
      // Si llegó al login por haber sido expulsado de otra página, se le
      // devuelve allí después de entrar; si no, a su perfil.
      const destino = (ubicacion.state as { desde?: string } | null)?.desde;
      return <Navigate to={destino ?? `/u/${usuario.handle}`} replace />;
    }
    return <>{children}</>;
  }

  if (!usuario) {
    // Se recuerda de dónde venía para volver ahí tras iniciar sesión.
    return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;
  }

  // Sin el rol: se pinta el 404 en el sitio, sin redirigir. Ver la nota en
  // `roles`. Redirigir a otra URL delataría que la ruta existe y que el
  // acceso se denegó; así es indistinguible de una dirección inventada.
  if (roles && !roles.includes(usuario.rol)) {
    return <NoEncontradaPage />;
  }

  return <>{children}</>;
}
