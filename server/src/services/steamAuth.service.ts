import { env } from '../config/env';

/**
 * Login con Steam mediante OpenID 2.0.
 *
 * Steam no ofrece OAuth 2.0: sigue con OpenID 2.0, que está obsoleto como
 * estándar pero no tiene fecha de retiro anunciada. El flujo es simple —
 * redirigir a Steam y volver con parámetros en la query — y por eso mismo
 * es fácil de implementar MAL. Lo único que Steam nos da es el SteamID64;
 * no hay correo, ni nombre garantizado.
 *
 * La regla de oro: **los parámetros que vuelven en la URL no valen nada
 * por sí solos.** Cualquiera puede escribir a mano
 * `/api/auth/steam/callback?openid.claimed_id=…/76561198079804890` y
 * hacerse pasar por otro. Por eso el paso `check_authentication` no es
 * opcional: se le devuelven a Steam los parámetros TAL CUAL llegaron y es
 * Steam quien confirma que la firma es suya. Sin esa llamada, esto sería
 * un login "escribe el ID que quieras ser".
 */

const STEAM_OPENID = 'https://steamcommunity.com/openid/login';
const IDENTIFICADOR_OPENID = 'http://specs.openid.net/auth/2.0/identifier_select';

/**
 * De dónde cuelga el callback. Se deriva de PUBLIC_URL para que en
 * producción apunte al dominio real y no a localhost.
 *
 * El `state` se cuelga aquí, del `return_to`, porque OpenID 2.0 no tiene
 * un parámetro propio para él como sí tiene OAuth: Steam devuelve al
 * usuario a esta URL tal cual, con la query que lleve incluida.
 */
function urlCallback(state?: string): string {
  const url = new URL('/api/auth/steam/callback', env.PUBLIC_URL);
  if (state) url.searchParams.set('state', state);
  return url.toString();
}

/**
 * URL a la que se manda al usuario para que se autentique en Steam.
 * `return_to` tiene que caer dentro de `realm` o Steam rechaza la
 * petición.
 *
 * El `state` va dentro del `return_to`, y eso importa más de lo que
 * parece: `openid.return_to` es uno de los campos que cubre la firma de
 * Steam, y `verificarRespuestaSteam` comprueba además que el `return_to`
 * firmado coincida con la URL por la que llegó la petición. Así el state
 * queda atado a la firma sin necesidad de un campo propio.
 */
export function urlAutenticacionSteam(state: string): string {
  const parametros = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': urlCallback(state),
    'openid.realm': new URL(env.PUBLIC_URL).origin,
    'openid.identity': IDENTIFICADOR_OPENID,
    'openid.claimed_id': IDENTIFICADOR_OPENID,
  });
  return `${STEAM_OPENID}?${parametros.toString()}`;
}

/** Un SteamID64 es un entero de 17 dígitos que empieza por 7656119. */
const RE_CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(7656119\d{10})$/;

/**
 * Verifica la respuesta de Steam y devuelve el SteamID64, o `null` si la
 * respuesta no es auténtica.
 *
 * Pasos, todos necesarios:
 *  1. Que el modo sea `id_res` (y no `cancel`, que es el usuario dando
 *     marcha atrás).
 *  2. Que el `claimed_id` tenga exactamente la forma de una URL de Steam.
 *     Así el ID que acabamos usando sale de un patrón estricto y no de un
 *     `split('/')` sobre texto arbitrario.
 *  3. `check_authentication` contra Steam: se reenvían los MISMOS
 *     parámetros con `openid.mode` cambiado a `check_authentication`, y
 *     Steam responde `is_valid:true` solo si la firma es suya.
 */
export async function verificarRespuestaSteam(
  query: Record<string, unknown>
): Promise<string | null> {
  if (query['openid.mode'] !== 'id_res') return null;

  const claimedId = query['openid.claimed_id'];
  if (typeof claimedId !== 'string') return null;

  const coincidencia = RE_CLAIMED_ID.exec(claimedId);
  if (!coincidencia) return null;
  const steamId = coincidencia[1]!;

  /*
   * El `state` de la query tiene que ser el MISMO que viaja dentro del
   * `openid.return_to` firmado.
   *
   * Sin esta comprobación el state sería decorativo: va fuera de los
   * campos `openid.*`, así que cambiarlo en la URL no rompe la firma de
   * Steam. Alguien podría tomar una respuesta legítima de Steam y
   * pegarle el state de otro flujo —por ejemplo, el "vincular" de la
   * víctima— y colar su propio SteamID en la cuenta ajena. Comparar
   * ambos valores es lo que ata la intención a la respuesta firmada.
   */
  const returnTo = query['openid.return_to'];
  if (typeof returnTo !== 'string') return null;

  let stateFirmado: string | null;
  try {
    stateFirmado = new URL(returnTo).searchParams.get('state');
  } catch {
    return null;
  }

  const stateRecibido = typeof query['state'] === 'string' ? query['state'] : null;
  if (stateFirmado !== stateRecibido) return null;

  // Se reenvía TODO lo que empieza por `openid.` sin reinterpretarlo: la
  // firma cubre esos campos y cualquier "limpieza" por nuestra parte la
  // invalidaría.
  const parametros = new URLSearchParams();
  for (const [clave, valor] of Object.entries(query)) {
    if (clave.startsWith('openid.') && typeof valor === 'string') {
      parametros.set(clave, valor);
    }
  }
  parametros.set('openid.mode', 'check_authentication');

  // Timeout explícito: sin él, un Steam colgado deja la petición del
  // usuario esperando indefinidamente.
  const cancelar = AbortSignal.timeout(10_000);

  let texto: string;
  try {
    const respuesta = await fetch(STEAM_OPENID, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: parametros.toString(),
      signal: cancelar,
    });
    if (!respuesta.ok) return null;
    texto = await respuesta.text();
  } catch {
    // Steam caído o lento: se trata como "no verificado". Nunca se deja
    // pasar un login sin confirmación.
    return null;
  }

  // La respuesta es texto plano tipo `ns:…\nis_valid:true\n`.
  const valido = texto
    .split('\n')
    .some((linea) => linea.trim().toLowerCase() === 'is_valid:true');

  return valido ? steamId : null;
}

/**
 * Datos públicos del jugador para rellenar el perfil al crearlo.
 *
 * Es un extra: si no hay API key o Steam falla, se devuelve `null` y el
 * registro sigue con valores por defecto. Un login NUNCA debe romperse
 * porque el avatar no se pudo leer.
 */
export interface ResumenSteam {
  nombre: string | null;
  avatar: string | null;
}

export async function resumenJugador(steamId: string): Promise<ResumenSteam | null> {
  if (!env.STEAM_API_KEY) return null;

  const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/');
  url.searchParams.set('key', env.STEAM_API_KEY);
  url.searchParams.set('steamids', steamId);

  try {
    const respuesta = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!respuesta.ok) return null;

    const datos = (await respuesta.json()) as {
      response?: { players?: Array<{ personaname?: string; avatarfull?: string }> };
    };
    const jugador = datos.response?.players?.[0];
    if (!jugador) return null;

    return {
      nombre: typeof jugador.personaname === 'string' ? jugador.personaname : null,
      // Solo se acepta el avatar si viene del CDN de Steam: es una URL que
      // acabará en un <img> de todos los visitantes del perfil.
      avatar:
        typeof jugador.avatarfull === 'string' && /^https:\/\/[a-z0-9.-]+\.steamstatic\.com\//.test(jugador.avatarfull)
          ? jugador.avatarfull
          : null,
    };
  } catch {
    return null;
  }
}
