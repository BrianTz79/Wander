import { z } from 'zod';
import { PROVEEDORES } from '../services/oauth.service';

/**
 * Cuentas vinculadas y consentimiento granular (Fase 6).
 *
 * La promesa de §1 es "cada vinculación dice exactamente qué se lee y qué
 * se guarda, con permisos granulares". Para que eso sea verdad y no un
 * texto de marketing, los permisos tienen que ser un conjunto CERRADO que
 * el servidor conoce: si `permisos` fuese JSON libre, la pantalla de
 * consentimiento prometería una cosa y la DB guardaría otra.
 */

/** Todos los proveedores que pueden aparecer en `CuentaVinculada`, no solo
 *  los que tienen OAuth propio. Steam entra aquí porque se desvincula por
 *  la misma ruta. */
export const PROVEEDORES_VINCULABLES = ['steam', ...PROVEEDORES] as const;
export type ProveedorVinculable = (typeof PROVEEDORES_VINCULABLES)[number];

export function esProveedorVinculable(valor: string): valor is ProveedorVinculable {
  return (PROVEEDORES_VINCULABLES as readonly string[]).includes(valor);
}

export const proveedorParamSchema = z.object({
  proveedor: z.enum(PROVEEDORES_VINCULABLES, {
    error: `Proveedor desconocido. Válidos: ${PROVEEDORES_VINCULABLES.join(', ')}.`,
  }),
});

// ─────────────────────────────────────────────────────────────────────
//  Permisos por proveedor
// ─────────────────────────────────────────────────────────────────────

/**
 * Qué puede consentir el usuario en cada proveedor.
 *
 * Cada clave se corresponde con algo que de verdad se muestra o se guarda.
 * No se listan permisos decorativos: un switch que no cambia nada es peor
 * que no tenerlo, porque enseña a la gente a no confiar en los switches.
 */
export const PERMISOS_POR_PROVEEDOR = {
  steam: {
    mostrarJuegos: {
      etiqueta: 'Mostrar mis juegos y horas',
      detalle: 'Tu biblioteca destacada y las horas jugadas aparecen en tu perfil.',
      pordefecto: true,
    },
    mostrarActividad: {
      etiqueta: 'Mostrar mi actividad reciente',
      detalle: 'Lo que jugaste en las últimas dos semanas.',
      pordefecto: true,
    },
    mostrarEstado: {
      etiqueta: 'Mostrar si estoy en línea',
      detalle: 'Tu estado de conexión en Steam, tal como lo muestra Steam.',
      pordefecto: false,
    },
  },
  discord: {
    mostrarPerfil: {
      etiqueta: 'Mostrar mi cuenta de Discord',
      detalle: 'Tu nombre y avatar de Discord en tu perfil.',
      pordefecto: true,
    },
    mostrarPresencia: {
      etiqueta: 'Mostrar mi estado en vivo',
      detalle:
        'Si estás en línea y qué estás jugando, en tiempo real. Requiere estar en el servidor de Lanyard.',
      pordefecto: false,
    },
    mostrarSpotify: {
      etiqueta: 'Mostrar qué escucho en Spotify',
      detalle: 'La canción que suena ahora mismo, vía Discord.',
      pordefecto: false,
    },
  },
  google: {
    // Google se usa solo para entrar. No hay nada suyo que mostrar, y
    // decirlo explícitamente es más honesto que una lista vacía sin
    // explicación.
  },
} as const satisfies Record<ProveedorVinculable, Record<string, unknown>>;

export type ClavePermiso<P extends ProveedorVinculable> = keyof (typeof PERMISOS_POR_PROVEEDOR)[P];

/** Valores por defecto de un proveedor, para cuando se crea el vínculo. */
export function permisosPorDefecto(proveedor: ProveedorVinculable): Record<string, boolean> {
  const definicion = PERMISOS_POR_PROVEEDOR[proveedor] as Record<
    string,
    { pordefecto: boolean }
  >;
  return Object.fromEntries(
    Object.entries(definicion).map(([clave, def]) => [clave, def.pordefecto])
  );
}

/**
 * Normaliza los permisos guardados: descarta claves que ya no existen y
 * rellena las que falten con su valor por defecto.
 *
 * Hace falta porque `permisos` es una columna JSON que sobrevive a los
 * despliegues: si en una versión futura se añade un permiso, los vínculos
 * antiguos no lo tienen, y leerlo daría `undefined` (que en un `if` se
 * comporta como "denegado" por casualidad, no por decisión). Aquí la
 * decisión es explícita.
 */
export function normalizarPermisos(
  proveedor: ProveedorVinculable,
  guardados: unknown
): Record<string, boolean> {
  const base = permisosPorDefecto(proveedor);
  if (typeof guardados !== 'object' || guardados === null) return base;

  const entrada = guardados as Record<string, unknown>;
  const salida: Record<string, boolean> = {};
  for (const clave of Object.keys(base)) {
    salida[clave] = typeof entrada[clave] === 'boolean' ? entrada[clave] : base[clave]!;
  }
  return salida;
}

/**
 * Body de `PATCH /api/cuentas/:proveedor/permisos`.
 *
 * Se acepta un objeto de booleanos y el controlador lo cruza con las
 * claves válidas del proveedor: así una clave inventada se descarta en vez
 * de acabar guardada en el JSON. `.strict()` no sirve aquí porque las
 * claves dependen del proveedor, que va en la ruta.
 */
export const permisosSchema = z
  .object({
    permisos: z.record(z.string().max(40), z.boolean()),
  })
  .strict();

export type PermisosInput = z.infer<typeof permisosSchema>;

/** Cruza lo que manda el cliente con lo que el proveedor admite de verdad. */
export function fusionarPermisos(
  proveedor: ProveedorVinculable,
  actuales: unknown,
  entrantes: Record<string, boolean>
): Record<string, boolean> {
  const normalizados = normalizarPermisos(proveedor, actuales);
  for (const [clave, valor] of Object.entries(entrantes)) {
    // Solo se acepta lo que existe en el catálogo del proveedor.
    if (clave in normalizados) normalizados[clave] = valor;
  }
  return normalizados;
}

// ─────────────────────────────────────────────────────────────────────
//  Descripción de la vinculación (para la pantalla de consentimiento)
// ─────────────────────────────────────────────────────────────────────

/**
 * Qué se lee y qué se guarda, en lenguaje llano. Vive en el servidor y se
 * sirve por API para que la pantalla previa y `/privacidad` no puedan
 * contradecirse: hay una sola fuente.
 */
export const DESCRIPCION_VINCULACION: Record<
  ProveedorVinculable,
  { lee: string[]; guarda: string[]; noPide: string[] }
> = {
  steam: {
    lee: [
      'Tu SteamID y tu nombre público de Steam',
      'Tu avatar, nivel y fecha de alta',
      'Tu biblioteca de juegos y las horas jugadas',
      'Lo que jugaste en las últimas dos semanas',
    ],
    guarda: [
      'Tu SteamID, para saber a quién pedirle los datos',
      'Una copia de tus juegos destacados y tus horas, que se refresca sola',
    ],
    noPide: [
      'Tu contraseña de Steam: Wander nunca la ve',
      'Tu correo, tu método de pago ni tu inventario',
      'Tu estado de baneos de VAC: no se consulta ni se guarda',
    ],
  },
  discord: {
    lee: ['Tu ID de Discord', 'Tu nombre y tu avatar'],
    guarda: [
      'Tu ID de Discord, para identificar la cuenta vinculada',
      'Tu nombre y avatar, para mostrarlos en tu perfil',
    ],
    noPide: [
      'Tus mensajes: el permiso ni siquiera se solicita',
      'La lista de servidores en los que estás',
      'Tu correo de Discord',
    ],
  },
  google: {
    lee: ['Tu nombre, tu correo y tu foto de perfil'],
    guarda: [
      'Tu identificador de Google, para reconocerte al entrar',
      'Tu correo, si aún no tenías uno en la cuenta',
    ],
    noPide: [
      'Tu contraseña de Google',
      'Tu Gmail, tu Drive, tus contactos ni tu calendario',
      'Ningún token de acceso: se descarta en cuanto sabemos quién eres',
    ],
  },
};
