import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import type { DatosDiscord, RespuestaDiscord } from './discord';

/**
 * Presencia de Discord compartida por los bloques del perfil (Fase 6).
 *
 * Mismo patrón que `steamContexto`: dos bloques distintos (estado y
 * Spotify) leen la misma respuesta, así que con props cada uno pediría lo
 * suyo y serían dos peticiones para pintar una página.
 *
 * Diferencia con Steam: esto **se refresca solo**. La gracia de un bloque
 * de presencia es que esté en vivo, así que se repite la petición mientras
 * la pestaña esté visible. El TTL del servidor (1 min) es quien de verdad
 * protege a Lanyard: aunque aquí se pidiera más a menudo, la mayoría de
 * las respuestas saldrían de la caché de Postgres.
 */

const INTERVALO_REFRESCO_MS = 60_000;

interface EstadoDiscord {
  datos: DatosDiscord | null;
  cargando: boolean;
  vinculado: boolean;
}

const ContextoDiscord = createContext<EstadoDiscord>({
  datos: null,
  cargando: false,
  vinculado: false,
});

export function useDiscord(): EstadoDiscord {
  return useContext(ContextoDiscord);
}

export function ProveedorDiscord({
  handle,
  activo = true,
  children,
}: {
  handle: string | null | undefined;
  activo?: boolean;
  children: ReactNode;
}) {
  const [estado, setEstado] = useState<EstadoDiscord>({
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

    const pedir = () => {
      api
        .get<RespuestaDiscord>(`/externo/discord/${encodeURIComponent(handle)}`)
        .then(({ data }) => {
          if (cancelado) return;
          setEstado({ datos: data.datos, cargando: false, vinculado: data.vinculado });
        })
        .catch(() => {
          // Un fallo no rompe el perfil: el bloque se oculta y el resto de
          // la página sigue en pantalla.
          if (!cancelado) setEstado({ datos: null, cargando: false, vinculado: false });
        });
    };

    pedir();

    /*
     * Solo se refresca con la pestaña visible. Sin esta comprobación, una
     * pestaña olvidada en segundo plano seguiría pidiendo presencia cada
     * minuto durante días, para nadie.
     */
    const intervalo = setInterval(() => {
      if (document.visibilityState === 'visible') pedir();
    }, INTERVALO_REFRESCO_MS);

    // Al volver a la pestaña, refrescar de inmediato: si estuvo oculta una
    // hora, lo que se muestra está muy desactualizado.
    const alVolver = () => {
      if (document.visibilityState === 'visible') pedir();
    };
    document.addEventListener('visibilitychange', alVolver);

    return () => {
      cancelado = true;
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [handle, activo]);

  return <ContextoDiscord.Provider value={estado}>{children}</ContextoDiscord.Provider>;
}
