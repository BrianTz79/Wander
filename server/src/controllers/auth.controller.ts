import type { Request, Response } from 'express';
import argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { hashIp } from '../config/cripto';
import { logger } from '../config/logger';
import { errores } from '../middlewares/errores.middleware';
import {
  COOKIE_REFRESH,
  cerrarSesion,
  cerrarTodasLasSesiones,
  crearSesion,
  rotarSesion,
} from '../services/sesion.service';
import { HANDLES_RESERVADOS } from '../schemas/auth.schema';
import type { LoginInput, RegistroInput } from '../schemas/auth.schema';
import { PLANTILLA_POR_DEFECTO } from '../schemas/plantillas';

/**
 * Autenticación con correo y contraseña.
 *
 * Decisiones de seguridad que se toman aquí y por qué:
 *
 *  1. argon2id en vez de bcrypt. Es el ganador del Password Hashing
 *     Competition y el recomendado por OWASP: resistente a GPU y a
 *     ataques de canal lateral. bcrypt además trunca en 72 bytes, lo que
 *     hace que contraseñas largas distintas colisionen.
 *
 *  2. Respuestas indistinguibles. "Correo no registrado" y "contraseña
 *     incorrecta" devuelven EXACTAMENTE el mismo error. Si no, cualquiera
 *     puede averiguar qué correos tienen cuenta aquí — información que se
 *     usa para phishing dirigido y para cruzar bases filtradas.
 *
 *  3. Tiempo constante. Si el correo no existe, igual se hace un hash
 *     falso. Sin esto, un login inexistente responde en 2 ms y uno real en
 *     150 ms, y esa diferencia enumera usuarios igual de bien que el
 *     mensaje de error.
 *
 *  4. Bloqueo por intentos fallidos, con retroceso exponencial y ligado a
 *     la cuenta (no solo a la IP, que se rota fácil).
 */

// Parámetros de argon2id. 19 MiB y 2 iteraciones es la línea base que
// recomienda OWASP: ~50-100 ms por hash en hardware normal, suficiente
// para frenar el cracking masivo sin volver el login lento.
const OPCIONES_ARGON2: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

/**
 * Hash de referencia para el camino "usuario no existe". Se calcula una
 * vez al arrancar; verificar contra él cuesta lo mismo que verificar
 * contra un hash real, igualando los tiempos de respuesta.
 */
let hashSenuelo: string | null = null;
async function obtenerSenuelo(): Promise<string> {
  // `raw: false` explícito para quedarnos con el overload que devuelve
  // string (con `raw: true` argon2 devolvería un Buffer).
  hashSenuelo ??= await argon2.hash('contrasena-senuelo-que-nunca-coincide', {
    ...OPCIONES_ARGON2,
    raw: false,
  });
  return hashSenuelo;
}

/** Hashea una contraseña devolviendo siempre el digest en formato string. */
async function hashearPassword(password: string): Promise<string> {
  return argon2.hash(password, { ...OPCIONES_ARGON2, raw: false });
}

/** Ventanas de bloqueo por número de intentos fallidos consecutivos. */
function esperaPorIntentos(intentos: number): number {
  if (intentos < 5) return 0;
  if (intentos < 8) return 1 * 60_000; // 1 min
  if (intentos < 12) return 5 * 60_000; // 5 min
  if (intentos < 20) return 30 * 60_000; // 30 min
  return 2 * 60 * 60_000; // 2 h
}

function metaPeticion(req: Request) {
  const cf = req.headers['cf-connecting-ip'];
  const ip = typeof cf === 'string' && cf ? cf : req.ip;
  return {
    userAgent: req.headers['user-agent'],
    ip,
  };
}

async function auditar(
  accion: string,
  req: Request,
  userId?: string | null,
  detalle: Record<string, unknown> = {}
): Promise<void> {
  const { userAgent, ip } = metaPeticion(req);
  await prisma.auditLog
    .create({
      data: {
        userId: userId ?? null,
        accion,
        detalle: detalle as Prisma.InputJsonValue,
        ipHash: hashIp(ip),
        userAgent: userAgent?.slice(0, 300) ?? null,
      },
    })
    .catch((error) => {
      // Un fallo de auditoría no debe tumbar el login, pero sí registrarse.
      logger.error({ error, accion }, 'No se pudo escribir el registro de auditoría');
    });
}

/** Datos del usuario que sí se pueden mandar al cliente. */
function usuarioPublico(u: {
  id: string;
  handle: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  rol: string;
  emailVerified: boolean;
}) {
  return {
    id: u.id,
    handle: u.handle,
    displayName: u.displayName,
    email: u.email,
    avatarUrl: u.avatarUrl,
    rol: u.rol,
    emailVerified: u.emailVerified,
  };
}

// ─────────────────────────────────────────────────────────────────────
//  POST /api/auth/registro
// ─────────────────────────────────────────────────────────────────────
export async function registro(req: Request, res: Response): Promise<void> {
  const { email, password, handle, displayName } = req.body as RegistroInput;

  // Doble comprobación de reservados: el schema ya filtra la lista fija,
  // esto cubre los que se añadan en la tabla sin redeploy.
  const reservado =
    HANDLES_RESERVADOS.has(handle) ||
    (await prisma.handleReservado.findUnique({ where: { handle } })) !== null;
  if (reservado) throw errores.conflicto('Ese nombre de usuario está reservado.');

  const passwordHash = await hashearPassword(password);

  // El unique de Prisma es la garantía real contra la carrera de dos
  // registros simultáneos con el mismo handle; el catch lo traduce.
  const usuario = await prisma.user
    .create({
      data: {
        email,
        passwordHash,
        handle,
        displayName,
        // El perfil se crea junto a la cuenta: así el editor nunca tiene
        // que manejar el caso "usuario sin perfil".
        perfil: {
          create: {
            plantilla: PLANTILLA_POR_DEFECTO,
            tema: {},
            bloques: {
              create: [
                { tipo: 'hero', orden: 0, config: {} },
                { tipo: 'enlaces', orden: 1, config: { enlaces: [] } },
              ],
            },
          },
        },
      },
      select: {
        id: true,
        handle: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        rol: true,
        emailVerified: true,
        tokenVersion: true,
      },
    })
    .catch((error: unknown) => {
      throw error; // el manejador central traduce P2002 a 409
    });

  await crearSesion(res, usuario, metaPeticion(req));
  await auditar('registro', req, usuario.id, { metodo: 'password' });

  logger.info({ userId: usuario.id, handle }, 'Cuenta creada');
  res.status(201).json({ usuario: usuarioPublico(usuario) });
}

// ─────────────────────────────────────────────────────────────────────
//  POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as LoginInput;

  // UN SOLO mensaje para todos los fallos de credenciales. No se cambia
  // ni se le añaden detalles: es lo que evita la enumeración de correos.
  const credencialesInvalidas = errores.invalido('Correo o contraseña incorrectos.');

  const usuario = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      handle: true,
      displayName: true,
      email: true,
      avatarUrl: true,
      rol: true,
      emailVerified: true,
      passwordHash: true,
      tokenVersion: true,
      intentosFallidos: true,
      bloqueadoHasta: true,
      suspendido: true,
      suspendidoHasta: true,
    },
  });

  // Camino "no existe": se gasta el mismo tiempo que una verificación real.
  if (!usuario || !usuario.passwordHash) {
    await argon2.verify(await obtenerSenuelo(), password).catch(() => false);
    await auditar('login-fallido', req, null, { motivo: 'usuario-inexistente' });
    throw credencialesInvalidas;
  }

  // Bloqueo temporal por intentos fallidos. Se responde 429 con el tiempo
  // restante: aquí sí se informa, porque a estas alturas el atacante ya
  // sabe que la cuenta existe y quien está bloqueado necesita saberlo.
  if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
    const segundos = Math.ceil((usuario.bloqueadoHasta.getTime() - Date.now()) / 1000);
    await auditar('login-fallido', req, usuario.id, { motivo: 'bloqueado' });
    throw errores.demasiadas(
      `Demasiados intentos fallidos. Vuelve a intentar en ${Math.ceil(segundos / 60)} minuto(s).`
    );
  }

  const coincide = await argon2.verify(usuario.passwordHash, password).catch(() => false);

  if (!coincide) {
    const intentos = usuario.intentosFallidos + 1;
    const espera = esperaPorIntentos(intentos);
    await prisma.user.update({
      where: { id: usuario.id },
      data: {
        intentosFallidos: intentos,
        bloqueadoHasta: espera > 0 ? new Date(Date.now() + espera) : null,
      },
    });
    await auditar('login-fallido', req, usuario.id, { motivo: 'password', intentos });
    throw credencialesInvalidas;
  }

  // Cuenta suspendida por moderación.
  if (usuario.suspendido && (!usuario.suspendidoHasta || usuario.suspendidoHasta > new Date())) {
    await auditar('login-fallido', req, usuario.id, { motivo: 'suspendido' });
    throw errores.sinPermiso(
      'Esta cuenta está suspendida. Si crees que es un error, escríbenos.'
    );
  }

  const { userAgent, ip } = metaPeticion(req);

  await prisma.user.update({
    where: { id: usuario.id },
    data: {
      intentosFallidos: 0,
      bloqueadoHasta: null,
      ultimoAccesoEn: new Date(),
      ultimaIpHash: hashIp(ip),
    },
  });

  await crearSesion(res, usuario, { userAgent, ip });
  await auditar('login', req, usuario.id, { metodo: 'password' });

  res.json({ usuario: usuarioPublico(usuario) });
}

// ─────────────────────────────────────────────────────────────────────
//  POST /api/auth/refresh
// ─────────────────────────────────────────────────────────────────────
export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[COOKIE_REFRESH] as string | undefined;
  if (!token) throw errores.noAutenticado('No hay sesión que renovar.');

  const usuario = await rotarSesion(res, token, metaPeticion(req));
  if (!usuario) {
    // Limpia las cookies para que el cliente no siga reintentando con un
    // token muerto.
    await cerrarSesion(res, token);
    throw errores.noAutenticado('La sesión expiró. Inicia sesión de nuevo.');
  }

  const completo = await prisma.user.findUnique({
    where: { id: usuario.id },
    select: {
      id: true,
      handle: true,
      displayName: true,
      email: true,
      avatarUrl: true,
      rol: true,
      emailVerified: true,
    },
  });
  if (!completo) throw errores.noAutenticado();

  res.json({ usuario: usuarioPublico(completo) });
}

// ─────────────────────────────────────────────────────────────────────
//  POST /api/auth/logout
// ─────────────────────────────────────────────────────────────────────
export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[COOKIE_REFRESH] as string | undefined;
  await cerrarSesion(res, token);
  if (req.usuario) await auditar('logout', req, req.usuario.id);
  res.status(204).end();
}

// ─────────────────────────────────────────────────────────────────────
//  POST /api/auth/logout-todo
// ─────────────────────────────────────────────────────────────────────
export async function logoutTodo(req: Request, res: Response): Promise<void> {
  if (!req.usuario) throw errores.noAutenticado();
  await cerrarTodasLasSesiones(req.usuario.id);
  await cerrarSesion(res, req.cookies?.[COOKIE_REFRESH]);
  await auditar('logout-todo', req, req.usuario.id);
  res.status(204).end();
}

// ─────────────────────────────────────────────────────────────────────
//  GET /api/auth/yo
// ─────────────────────────────────────────────────────────────────────
export async function yo(req: Request, res: Response): Promise<void> {
  if (!req.usuario) {
    res.json({ usuario: null });
    return;
  }
  const usuario = await prisma.user.findUnique({
    where: { id: req.usuario.id },
    select: {
      id: true,
      handle: true,
      displayName: true,
      email: true,
      avatarUrl: true,
      rol: true,
      emailVerified: true,
    },
  });
  res.json({ usuario: usuario ? usuarioPublico(usuario) : null });
}

// ─────────────────────────────────────────────────────────────────────
//  POST /api/auth/cambiar-password
// ─────────────────────────────────────────────────────────────────────
export async function cambiarPassword(req: Request, res: Response): Promise<void> {
  if (!req.usuario) throw errores.noAutenticado();
  const { passwordActual, passwordNueva } = req.body as {
    passwordActual: string;
    passwordNueva: string;
  };

  const usuario = await prisma.user.findUnique({
    where: { id: req.usuario.id },
    select: { id: true, passwordHash: true },
  });
  if (!usuario?.passwordHash) {
    throw errores.invalido(
      'Esta cuenta no tiene contraseña. Configurá una desde los ajustes de seguridad.'
    );
  }

  const ok = await argon2.verify(usuario.passwordHash, passwordActual).catch(() => false);
  if (!ok) throw errores.invalido('La contraseña actual no es correcta.');

  const nuevoHash = await hashearPassword(passwordNueva);
  await prisma.user.update({
    where: { id: usuario.id },
    data: { passwordHash: nuevoHash },
  });

  // Un cambio de contraseña cierra todas las demás sesiones: si alguien
  // tenía acceso robado, lo pierde aquí.
  await cerrarTodasLasSesiones(usuario.id);
  await cerrarSesion(res, req.cookies?.[COOKIE_REFRESH]);
  await auditar('cambio-password', req, usuario.id);

  res.json({
    mensaje: 'Contraseña actualizada. Se cerraron todas las sesiones; vuelve a iniciar sesión.',
  });
}

// ─────────────────────────────────────────────────────────────────────
//  GET /api/auth/handle-disponible?handle=…
// ─────────────────────────────────────────────────────────────────────
/**
 * Comprobación de disponibilidad para el formulario de registro.
 *
 * Nota: esto sí revela si un handle existe, pero los handles son públicos
 * por diseño (son la URL del perfil), así que no hay nada que proteger.
 * Los correos son otra cosa y NO tienen un endpoint equivalente.
 */
export async function handleDisponible(req: Request, res: Response): Promise<void> {
  const handle = String(req.query['handle'] ?? '')
    .trim()
    .toLowerCase();

  if (handle.length < 3 || handle.length > 24) {
    res.json({ disponible: false, motivo: 'Debe tener entre 3 y 24 caracteres.' });
    return;
  }
  if (!/^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/.test(handle)) {
    res.json({ disponible: false, motivo: 'Solo letras, números, guion y guion bajo.' });
    return;
  }
  if (HANDLES_RESERVADOS.has(handle)) {
    res.json({ disponible: false, motivo: 'Está reservado.' });
    return;
  }

  const [existe, reservadoDb] = await Promise.all([
    prisma.user.findUnique({ where: { handle }, select: { id: true } }),
    prisma.handleReservado.findUnique({ where: { handle } }),
  ]);

  if (reservadoDb) {
    res.json({ disponible: false, motivo: 'Está reservado.' });
    return;
  }
  res.json({
    disponible: !existe,
    ...(existe ? { motivo: 'Ya está en uso.' } : {}),
  });
}
