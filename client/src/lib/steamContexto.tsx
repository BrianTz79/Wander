import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import type { DatosSteam, RespuestaSteam } from './steam';

/**
 * Datos de Steam compartidos por todos los bloques de un perfil.
 *
 * Va por contexto y no por props porque tres bloques distintos
 * (actividad, estadísticas, favoritos) necesitan lo mismo, y un perfil
 * puede tener los tres. Con props, cada uno pediría los datos por su
 * cuenta: tres peticiones idénticas para pintar una sola página.
 *
 * Se pide **aparte del perfil** a propósito: el perfil se pinta enseguida
 * desde la DB y los bloques de Steam rellenan cuando llegan. Así una
 * llamada externa lenta nunca retrasa lo que ya tenemos.
 */

interface EstadoSteam {
  datos: DatosSteam | null;
  cargando: boolean;
  /** `false` cuando el usuario no tiene Steam vinculado: los bloques se
   *  ocultan en vez de mostrar un error que el visitante no puede
   *  arreglar. */
  vinculado: boolean;
}

const ContextoSteam = createContext<EstadoSteam>({
  datos: null,
  cargando: false,
  vinculado: false,
});

export function useSteam(): EstadoSteam {
  return useContext(ContextoSteam);
}

/**
 * Carga los datos de Steam de un handle.
 *
 * `handle` a `null` (o un perfil sin bloques de Steam) evita la petición:
 * no tiene sentido gastarla en un perfil que no va a pintar nada de Steam.
 */
export function ProveedorSteam({
  handle,
  activo = true,
  children,
}: {
  handle: string | null | undefined;
  activo?: boolean;
  children: ReactNode;
}) {
  const [estado, setEstado] = useState<EstadoSteam>({
    datos: null,
    cargando: Boolean(handle && activo),
    vinculado: false,
  });

  useEffect(() => {
    if (!handle || !activo) {
      setEstado({ datos: null, cargando: false, vinculado: false });
      return;
    }

    let cancelado = false;
    setEstado((previo) => ({ ...previo, cargando: true }));

    api
      .get<RespuestaSteam>(`/externo/steam/${encodeURIComponent(handle)}`)
      .then(({ data }) => {
        if (cancelado) return;
        setEstado({ datos: data.datos, cargando: false, vinculado: data.vinculado });
      })
      .catch(() => {
        // Un fallo aquí no rompe el perfil: los bloques de Steam
        // simplemente no se pintan. El resto del perfil ya está en
        // pantalla.
        if (!cancelado) setEstado({ datos: null, cargando: false, vinculado: false });
      });

    return () => {
      cancelado = true;
    };
  }, [handle, activo]);

  return <ContextoSteam.Provider value={estado}>{children}</ContextoSteam.Provider>;
}
