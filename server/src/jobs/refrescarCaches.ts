import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { datosSteamDe, esSteamIdValido } from '../services/steam.service';

/**
 * Refresco en segundo plano de las cachés externas (Fase 5).
 *
 * Sin esto, el primer visitante de un perfil cuya caché acaba de vencer
 * paga la espera de las llamadas a Steam. El job va por delante y refresca
 * lo que está a punto de caducar, así que en la práctica casi siempre se
 * sirve dato fresco sin que nadie espere.
 *
 * Tres decisiones que lo mantienen barato:
 *
 *  · **Solo perfiles publicados.** Refrescar cuentas que nadie puede ver
 *    gastaría cuota de la API para nada.
 *  · **Un lote pequeño por vuelta.** Con muchos usuarios, un job que
 *    intente refrescarlos todos de golpe es un pico de tráfico contra
 *    Steam y un candidato a que nos limiten.
 *  · **En serie, no en paralelo.** Cada usuario son ya 4 llamadas; hacer
 *    veinte usuarios a la vez serían 80 peticiones simultáneas.
 */

/** Cuántos usuarios refrescar por vuelta. */
const TAMANO_LOTE = 20;

/** Cada cuánto corre. Más corto que el TTL más corto (15 min) para que
 *  llegue antes de que el dato caduque de verdad. */
export const INTERVALO_REFRESCO_MS = 10 * 60_000;

/** Margen: se refresca lo que caduca dentro de este rato, no solo lo ya
 *  caducado. Es lo que evita que el visitante pille el hueco. */
const MARGEN_MS = 5 * 60_000;

export async function refrescarCachesSteam(): Promise<number> {
  const limite = new Date(Date.now() + MARGEN_MS);

  /*
   * Se buscan las CUENTAS (no las filas de caché) para que un usuario
   * recién vinculado —que todavía no tiene ninguna fila— también entre en
   * el primer barrido.
   */
  const candidatos = await prisma.cuentaVinculada.findMany({
    where: {
      proveedor: 'steam',
      user: {
        perfilPublico: true,
        suspendido: false,
        perfil: { publicado: true },
      },
      OR: [
        { sincronizadoEn: null },
        { user: { cachesExternos: { some: { proveedor: 'steam', expiraEn: { lte: limite } } } } },
        { user: { cachesExternos: { none: { proveedor: 'steam' } } } },
      ],
    },
    select: { userId: true, proveedorId: true },
    // Los menos sincronizados primero: así ningún perfil se queda atrás
    // por estar siempre al final de la lista.
    orderBy: { sincronizadoEn: { sort: 'asc', nulls: 'first' } },
    take: TAMANO_LOTE,
  });

  let refrescados = 0;

  for (const { userId, proveedorId } of candidatos) {
    if (!esSteamIdValido(proveedorId)) continue;

    try {
      // Sin `forzar`: lo que siga fresco no se repide. El job adelanta
      // trabajo, no lo duplica.
      await datosSteamDe(userId, proveedorId);
      await prisma.cuentaVinculada
        .update({
          where: { userId_proveedor: { userId, proveedor: 'steam' } },
          data: { sincronizadoEn: new Date() },
        })
        .catch(() => undefined);
      refrescados += 1;
    } catch (error) {
      // `datosSteamDe` ya absorbe los fallos de red; llegar aquí es raro.
      // Se registra y se sigue con el siguiente: un usuario problemático
      // no puede parar el lote entero.
      logger.warn({ error, userId }, 'Fallo al refrescar la caché de Steam de un usuario');
    }
  }

  return refrescados;
}
