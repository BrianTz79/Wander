import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit';
import type { Request } from 'express';
import { env } from '../config/env';

/**
 * Límites de tasa. Segunda capa: nginx ya limita antes del proxy, pero
 * esta capa conoce al usuario y puede limitar por cuenta, no solo por IP.
 *
 * Detrás del túnel de Cloudflare todas las peticiones llegan desde la IP
 * del contenedor, así que la IP real viene en `CF-Connecting-IP`. Sin esta
 * función, un solo límite se aplicaría a todos los visitantes juntos.
 */
function claveCliente(req: Request): string {
  // Si hay sesión, limitar por usuario es más justo y más difícil de
  // evadir que por IP (una IP puede ser un campus entero).
  if (req.usuario?.id) return `u:${req.usuario.id}`;

  // `ipKeyGenerator` agrupa las IPv6 por su prefijo /64, y es
  // imprescindible: a un cliente IPv6 se le suele asignar un /64 entero
  // (miles de millones de direcciones), así que limitar por dirección
  // exacta equivale a no limitar — basta rotar dentro del propio prefijo.
  // Las IPv4 pasan tal cual.
  //
  // Se llama directamente en cada rama, sin envolverlo en un ayudante:
  // express-rate-limit valida esto inspeccionando el TEXTO de la función,
  // y con una indirección no reconoce la llamada y avisa en cada arranque.
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.length > 0) return `ip:${ipKeyGenerator(cf)}`;

  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    // El primero de la lista es el cliente original.
    const primera = xff.split(',')[0]?.trim();
    if (primera) return `ip:${ipKeyGenerator(primera)}`;
  }

  return `ip:${ipKeyGenerator(req.ip ?? 'desconocida')}`;
}

const comun: Partial<Options> = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: claveCliente,
  // En desarrollo los límites estorban al probar; se relajan pero no se
  // desactivan, para que se note si algo los está tocando de más.
  skip: () => env.esDesarrollo,
  message: { error: 'Demasiadas peticiones. Espera un momento antes de volver a intentar.' },
};

/** Límite general de la API. */
export const limiteGeneral = rateLimit({
  ...comun,
  windowMs: 60_000,
  limit: 120,
});

/**
 * Login y registro: agresivo a propósito. 8 intentos por 15 minutos frena
 * el fuerza-bruta sin molestar a quien se equivoca de contraseña un par
 * de veces.
 */
export const limiteAuth = rateLimit({
  ...comun,
  windowMs: 15 * 60_000,
  limit: 8,
  // No contar los logins exitosos: quien entra bien no gasta cupo.
  skipSuccessfulRequests: true,
  message: {
    error: 'Demasiados intentos de inicio de sesión. Vuelve a intentar en unos minutos.',
  },
});

/** Registro de cuentas: evita creación masiva. */
export const limiteRegistro = rateLimit({
  ...comun,
  windowMs: 60 * 60_000,
  limit: 5,
  message: { error: 'Demasiadas cuentas creadas desde aquí. Inténtalo más tarde.' },
});

/** Subidas de archivos: caras en CPU (sharp) y en disco. */
export const limiteSubidas = rateLimit({
  ...comun,
  windowMs: 60 * 60_000,
  limit: 60,
  message: { error: 'Alcanzaste el límite de subidas por hora.' },
});

/** Escrituras normales (publicar, comentar, editar perfil). */
export const limiteEscritura = rateLimit({
  ...comun,
  windowMs: 60_000,
  limit: 30,
});

/** Mensajes: generoso, pero corta el spam automatizado. */
export const limiteMensajes = rateLimit({
  ...comun,
  windowMs: 60_000,
  limit: 60,
});

/**
 * Endpoints que consultan APIs externas (Steam, Lanyard). Protege nuestra
 * cuota con el proveedor, no solo el servidor.
 */
export const limiteExterno = rateLimit({
  ...comun,
  windowMs: 60_000,
  limit: 20,
  message: { error: 'Demasiadas sincronizaciones. Los datos se refrescan cada pocos minutos.' },
});

/** Búsquedas: consultas potencialmente caras en la DB. */
export const limiteBusqueda = rateLimit({
  ...comun,
  windowMs: 60_000,
  limit: 40,
});
