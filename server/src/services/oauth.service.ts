import crypto from 'node:crypto';
import { env } from '../config/env';
import { cifrar, comparacionSegura } from '../config/cripto';

/**
 * OAuth 2.0 con PKCE para Discord y Google (Fase 6).
 *
 * A diferencia de Steam (OpenID 2.0, §5), aquí sí hay un estándar moderno,
 * y las trampas son otras. Tres decisiones sostienen este archivo:
 *
 *  1. **PKCE en los dos proveedores**, aunque seamos un cliente
 *     confidencial que podría usar solo el `client_secret`. PKCE ata el
 *     callback a quien inició el flujo: sin él, un código robado del
 *     historial del navegador, de un log de proxy o del `Referer` es
 *     canjeable por cualquiera que tenga nuestro secreto.
 *
 *  2. **El `state` no se guarda en una tabla ni en memoria**: es un token
 *     firmado con HMAC que lleva dentro lo que necesitamos al volver
 *     (intención, usuario, verificador PKCE, caducidad). Una tabla de
 *     estados exigiría limpieza periódica y un viaje a la DB por callback;
 *     un HMAC se verifica sin tocar nada. La cookie de sesión no sirve para
 *     esto: el flujo de LOGIN empieza sin sesión.
 *
 *  3. **Nada de lo que devuelve el proveedor se cree sin comprobar.** El
 *     `state` se verifica en tiempo constante, el `iss` de Google se
 *     compara con el esperado, y los avatares solo se aceptan desde los
 *     hosts que la CSP permite.
 */

// ─────────────────────────────────────────────────────────────────────
//  Catálogo de proveedores
// ─────────────────────────────────────────────────────────────────────

export type Proveedor = 'discord' | 'google';

export const PROVEEDORES: readonly Proveedor[] = ['discord', 'google'] as const;

export function esProveedor(valor: string): valor is Proveedor {
  return (PROVEEDORES as readonly string[]).includes(valor);
}

interface DefinicionProveedor {
  nombre: string;
  autorizacion: string;
  token: string;
  /** Scopes mínimos. Pedir de más obliga a justificarlo en /privacidad y
   *  asusta en la pantalla de consentimiento sin darnos nada. */
  scopes: string;
  clientId: () => string | undefined;
  clientSecret: () => string | undefined;
}

const DEFINICIONES: Record<Proveedor, DefinicionProveedor> = {
  discord: {
    nombre: 'Discord',
    autorizacion: 'https://discord.com/oauth2/authorize',
    token: 'https://discord.com/api/oauth2/token',
    // `identify` da id, nombre y avatar. NO se pide `email`: para vincular
    // no hace falta, y para entrar tampoco (el handle se genera).
    scopes: 'identify',
    clientId: () => env.DISCORD_CLIENT_ID,
    clientSecret: () => env.DISCORD_CLIENT_SECRET,
  },
  google: {
    nombre: 'Google',
    autorizacion: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    scopes: 'openid profile email',
    clientId: () => env.GOOGLE_CLIENT_ID,
    clientSecret: () => env.GOOGLE_CLIENT_SECRET,
  },
};

/** Nombre presentable, para mensajes de error y para la UI. */
export function nombreProveedor(proveedor: Proveedor): string {
  return DEFINICIONES[proveedor].nombre;
}

/** Si faltan las credenciales, el proveedor no se ofrece. `env.ts` ya las
 *  trata como opcionales: la app arranca sin ellas y desactiva la función
 *  en vez de romperse al arrancar. */
export function proveedorConfigurado(proveedor: Proveedor): boolean {
  const def = DEFINICIONES[proveedor];
  return Boolean(def.clientId() && def.clientSecret());
}

/** El callback se deriva de PUBLIC_URL para que coincida exactamente con
 *  lo registrado en el portal del proveedor. Discord y Google exigen
 *  coincidencia literal: una barra de más y el flujo falla. */
export function urlCallback(proveedor: Proveedor): string {
  return new URL(`/api/oauth/${proveedor}/callback`, env.PUBLIC_URL).toString();
}

// ─────────────────────────────────────────────────────────────────────
//  PKCE
// ─────────────────────────────────────────────────────────────────────

export interface ParPkce {
  verificador: string;
  desafio: string;
}

/**
 * Par PKCE (RFC 7636) con S256. El verificador es el secreto que se guarda
 * dentro del `state`; el desafío es su SHA-256, que es lo único que viaja
 * al proveedor. Quien intercepte el desafío no puede derivar el
 * verificador, así que no puede canjear el código.
 */
export function generarPkce(): ParPkce {
  const verificador = crypto.randomBytes(32).toString('base64url');
  const desafio = crypto.createHash('sha256').update(verificador).digest('base64url');
  return { verificador, desafio };
}

// ─────────────────────────────────────────────────────────────────────
//  State firmado
// ─────────────────────────────────────────────────────────────────────

/** Qué venía a hacer el usuario. El callback es la misma URL para ambos
 *  casos, así que la intención tiene que viajar dentro del state — y
 *  firmada, porque si el cliente pudiera cambiarla a voluntad, un flujo de
 *  "vincular" podría convertirse en uno de "entrar". */
export type Intencion = 'login' | 'vincular';

interface ContenidoState {
  /** Intención. */
  i: Intencion;
  /** userId, solo en `vincular`. Fija a QUIÉN se vincula la cuenta desde
   *  antes de salir a Discord: al volver no se depende de la sesión. */
  u?: string;
  /** Verificador PKCE. */
  v: string;
  /** Proveedor: impide reusar un state de Discord en el callback de Google. */
  p: Proveedor;
  /** Caducidad (epoch ms). Un state eterno es un flujo replayable. */
  e: number;
  /** Aleatorio, para que dos flujos idénticos no produzcan el mismo state. */
  n: string;
}

/** Diez minutos: de sobra para autenticarse, poco para que un state
 *  filtrado siga sirviendo. */
const VIDA_STATE_MS = 10 * 60_000;

/** El state se firma con una clave derivada de JWT_SECRET, no con
 *  JWT_SECRET directamente: así un fallo en este dominio no compromete la
 *  firma de los tokens de sesión. */
const CLAVE_STATE = crypto.createHmac('sha256', env.JWT_SECRET).update('oauth-state-v1').digest();

function firmar(cuerpo: string): string {
  return crypto.createHmac('sha256', CLAVE_STATE).update(cuerpo).digest('base64url');
}

/** Construye el `state`: `base64url(json).firma`. */
export function crearState(datos: Omit<ContenidoState, 'e' | 'n'>): string {
  const contenido: ContenidoState = {
    ...datos,
    e: Date.now() + VIDA_STATE_MS,
    n: crypto.randomBytes(8).toString('base64url'),
  };
  const cuerpo = Buffer.from(JSON.stringify(contenido), 'utf8').toString('base64url');
  return `${cuerpo}.${firmar(cuerpo)}`;
}

/**
 * Verifica y decodifica un `state`. Devuelve `null` ante cualquier
 * problema — firma mala, caducado, o del proveedor equivocado — sin
 * distinguir cuál, porque quien manda un state inválido no merece pistas.
 */
export function leerState(state: unknown, proveedorEsperado: Proveedor): ContenidoState | null {
  if (typeof state !== 'string' || state.length > 2048) return null;

  const separador = state.lastIndexOf('.');
  if (separador <= 0) return null;

  const cuerpo = state.slice(0, separador);
  const firma = state.slice(separador + 1);

  // Tiempo constante: comparar firmas con === filtra, byte a byte, cuánto
  // de la firma se acertó.
  if (!comparacionSegura(firma, firmar(cuerpo))) return null;

  let contenido: ContenidoState;
  try {
    contenido = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8')) as ContenidoState;
  } catch {
    return null;
  }

  if (typeof contenido.e !== 'number' || contenido.e < Date.now()) return null;
  if (contenido.p !== proveedorEsperado) return null;
  if (contenido.i !== 'login' && contenido.i !== 'vincular') return null;
  if (typeof contenido.v !== 'string' || contenido.v.length < 16) return null;
  if (contenido.i === 'vincular' && typeof contenido.u !== 'string') return null;

  return contenido;
}

// ─────────────────────────────────────────────────────────────────────
//  Paso 1: a dónde mandamos al usuario
// ─────────────────────────────────────────────────────────────────────

export function urlAutorizacion(proveedor: Proveedor, desafio: string, state: string): string {
  const def = DEFINICIONES[proveedor];
  const url = new URL(def.autorizacion);

  url.searchParams.set('client_id', def.clientId()!);
  url.searchParams.set('redirect_uri', urlCallback(proveedor));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', def.scopes);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', desafio);
  url.searchParams.set('code_challenge_method', 'S256');

  if (proveedor === 'google') {
    // `select_account` evita el caso confuso de que Google entre solo con
    // la única sesión abierta cuando el usuario quería otra cuenta.
    url.searchParams.set('prompt', 'select_account');
  }

  return url.toString();
}

// ─────────────────────────────────────────────────────────────────────
//  Paso 2: canjear el código por tokens
// ─────────────────────────────────────────────────────────────────────

export interface TokensOAuth {
  accessToken: string;
  refreshToken: string | null;
  expiraEn: Date | null;
  scopes: string | null;
  /** Solo Google: JWT con la identidad ya firmada. */
  idToken: string | null;
}

class ErrorOAuth extends Error {}

const TIMEOUT_MS = 10_000;

/**
 * Canjea el `code` por tokens. El `client_secret` va en el cuerpo (ambos
 * proveedores lo aceptan así) junto al `code_verifier`, que es lo que
 * demuestra que quien canjea es quien inició.
 */
export async function canjearCodigo(
  proveedor: Proveedor,
  codigo: string,
  verificador: string
): Promise<TokensOAuth> {
  const def = DEFINICIONES[proveedor];

  const cuerpo = new URLSearchParams({
    client_id: def.clientId()!,
    client_secret: def.clientSecret()!,
    grant_type: 'authorization_code',
    code: codigo,
    redirect_uri: urlCallback(proveedor),
    code_verifier: verificador,
  });

  const respuesta = await fetch(def.token, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: cuerpo.toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!respuesta.ok) {
    // El cuerpo del error puede contener el client_secret en un eco de la
    // petición: se registra el código, nunca el cuerpo.
    throw new ErrorOAuth(`${def.nombre} rechazó el canje del código (${respuesta.status}).`);
  }

  const datos = (await respuesta.json()) as Record<string, unknown>;

  const accessToken = datos['access_token'];
  if (typeof accessToken !== 'string' || accessToken === '') {
    throw new ErrorOAuth(`${def.nombre} no devolvió un access token.`);
  }

  const expiraEnS = typeof datos['expires_in'] === 'number' ? datos['expires_in'] : null;

  return {
    accessToken,
    refreshToken: typeof datos['refresh_token'] === 'string' ? datos['refresh_token'] : null,
    expiraEn: expiraEnS ? new Date(Date.now() + expiraEnS * 1000) : null,
    scopes: typeof datos['scope'] === 'string' ? datos['scope'] : null,
    idToken: typeof datos['id_token'] === 'string' ? datos['id_token'] : null,
  };
}

// ─────────────────────────────────────────────────────────────────────
//  Paso 3: quién es el usuario
// ─────────────────────────────────────────────────────────────────────

export interface IdentidadRemota {
  /** ID estable en el proveedor. Es la identidad: el nombre puede cambiar. */
  id: string;
  nombre: string | null;
  avatar: string | null;
  /** Solo Google, y solo si está verificado. Nunca se usa para unir
   *  cuentas automáticamente (ver el comentario en el controlador). */
  email: string | null;
  emailVerificado: boolean;
}

/** Hosts de avatar permitidos, alineados con `img-src` de nginx.conf. Si
 *  se acepta aquí un host que la CSP no lista, la imagen se bloquea en el
 *  navegador y el único rastro está en la consola del visitante. */
const RE_AVATAR: Record<Proveedor, RegExp> = {
  discord: /^https:\/\/cdn\.discordapp\.com\//,
  google: /^https:\/\/lh\d\.googleusercontent\.com\//,
};

function avatarSeguro(proveedor: Proveedor, url: unknown): string | null {
  return typeof url === 'string' && RE_AVATAR[proveedor].test(url) ? url : null;
}

const texto = (valor: unknown, max: number): string | null =>
  typeof valor === 'string' && valor.trim() !== '' ? valor.trim().slice(0, max) : null;

/**
 * Identidad en Discord. Se pide a `/users/@me` con el access token: el
 * endpoint es la fuente autoritativa y evita confiar en nada que viniera
 * en la URL del callback.
 */
async function identidadDiscord(accessToken: string): Promise<IdentidadRemota> {
  const respuesta = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!respuesta.ok) throw new ErrorOAuth(`Discord respondió ${respuesta.status} al pedir el perfil.`);

  const u = (await respuesta.json()) as Record<string, unknown>;
  const id = texto(u['id'], 32);
  // Un snowflake es un entero decimal. Se valida antes de usarlo como
  // identidad y antes de construir la URL del avatar.
  if (!id || !/^\d{5,25}$/.test(id)) throw new ErrorOAuth('Discord devolvió un id inesperado.');

  // El avatar se construye a partir de campos validados, no se toma una
  // URL que mande el proveedor.
  const hash = u['avatar'];
  const avatar =
    typeof hash === 'string' && /^[a-f0-9_]{1,64}$/i.test(hash)
      ? `https://cdn.discordapp.com/avatars/${id}/${hash}.png?size=256`
      : null;

  return {
    id,
    // `global_name` es el nombre para mostrar actual; `username` es el
    // handle. Se prefiere el primero y se cae al segundo.
    nombre: texto(u['global_name'], 60) ?? texto(u['username'], 60),
    avatar: avatarSeguro('discord', avatar),
    email: null,
    emailVerificado: false,
  };
}

/**
 * Identidad en Google a partir del `id_token`.
 *
 * El id_token es un JWT firmado por Google. No verificamos su firma con
 * las claves públicas de Google porque **no hace falta**: no llegó por el
 * navegador, sino en la respuesta de un POST TLS directo al endpoint de
 * tokens de Google, autenticado con nuestro client_secret. Ese canal ya
 * garantiza origen e integridad. Verificar la firma protegería contra un
 * atacante que ya controlara la conexión TLS con Google, en cuyo caso
 * todo lo demás también está perdido.
 *
 * Lo que sí se comprueba es el `aud` (que el token sea para NOSOTROS) y el
 * `iss`: un id_token válido pero emitido para otra aplicación no debe
 * servir para entrar aquí.
 */
function identidadGoogle(idToken: string): IdentidadRemota {
  const partes = idToken.split('.');
  if (partes.length !== 3) throw new ErrorOAuth('El id_token de Google no tiene forma de JWT.');

  let carga: Record<string, unknown>;
  try {
    carga = JSON.parse(Buffer.from(partes[1]!, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    throw new ErrorOAuth('No se pudo leer el id_token de Google.');
  }

  const iss = carga['iss'];
  if (iss !== 'https://accounts.google.com' && iss !== 'accounts.google.com') {
    throw new ErrorOAuth('El id_token no lo emitió Google.');
  }

  // El `aud` tiene que ser nuestro client_id. Sin esta comprobación, un
  // id_token conseguido para otra app de Google serviría aquí.
  if (carga['aud'] !== env.GOOGLE_CLIENT_ID) {
    throw new ErrorOAuth('El id_token de Google no es para esta aplicación.');
  }

  const exp = carga['exp'];
  if (typeof exp !== 'number' || exp * 1000 < Date.now()) {
    throw new ErrorOAuth('El id_token de Google está caducado.');
  }

  const id = texto(carga['sub'], 64);
  if (!id) throw new ErrorOAuth('Google no devolvió un identificador.');

  return {
    id,
    nombre: texto(carga['name'], 60) ?? texto(carga['given_name'], 60),
    avatar: avatarSeguro('google', carga['picture']),
    email: texto(carga['email'], 254),
    emailVerificado: carga['email_verified'] === true,
  };
}

/** Identidad del usuario en el proveedor, tras canjear el código. */
export async function identidadDe(
  proveedor: Proveedor,
  tokens: TokensOAuth
): Promise<IdentidadRemota> {
  if (proveedor === 'discord') return identidadDiscord(tokens.accessToken);

  if (!tokens.idToken) throw new ErrorOAuth('Google no devolvió el id_token.');
  return identidadGoogle(tokens.idToken);
}

// ─────────────────────────────────────────────────────────────────────
//  Guardado de tokens
// ─────────────────────────────────────────────────────────────────────

/**
 * Prepara los tokens para guardarlos en `CuentaVinculada`, cifrados con
 * AES-256-GCM. Nunca se guardan en claro y no hay ninguna ruta que los
 * devuelva al cliente.
 *
 * Para Google, además, **no se guarda nada**: solo usamos su OAuth para
 * saber quién es, no para leer sus datos después. Guardar un token que no
 * vamos a usar es superficie de ataque a cambio de nada.
 */
export function tokensParaGuardar(
  proveedor: Proveedor,
  tokens: TokensOAuth
): { accessTokenCif: string | null; refreshTokenCif: string | null; expiraEn: Date | null; scopes: string | null } {
  if (proveedor === 'google') {
    return { accessTokenCif: null, refreshTokenCif: null, expiraEn: null, scopes: tokens.scopes };
  }

  return {
    accessTokenCif: cifrar(tokens.accessToken),
    refreshTokenCif: tokens.refreshToken ? cifrar(tokens.refreshToken) : null,
    expiraEn: tokens.expiraEn,
    scopes: tokens.scopes,
  };
}
