import { prisma } from '../config/prisma';
import { HANDLES_RESERVADOS } from '../schemas/auth.schema';

/**
 * Generación de handles para quien entra por OAuth.
 *
 * Quien se registra con correo elige su handle en el formulario. Quien
 * entra con Steam no elige nada: Steam solo da un SteamID64 y, con suerte,
 * un nombre de perfil que puede ser cualquier cosa ("✪ xX_Sniper_Xx 💀",
 * emoji incluidos, o directamente vacío). Hay que fabricar un handle
 * válido, único y que no imite a nadie.
 */

const MIN = 3;
const MAX = 24;

/**
 * Convierte un nombre arbitrario en un candidato a handle.
 * Devuelve `null` si no queda nada aprovechable — pasa a menudo con
 * nombres enteramente en cirílico, CJK o emoji.
 */
export function normalizarAHandle(nombre: string): string | null {
  const base = nombre
    .normalize('NFKD')
    // Quita diacríticos: "Mizllét" → "Mizllet". NFKD los separa en un
    // carácter propio del rango U+0300–U+036F, que es lo que se borra aquí.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Todo lo que no sea alfanumérico ASCII pasa a guion.
    .replace(/[^a-z0-9]+/g, '-')
    // Colapsa e iguala los separadores al formato del schema.
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX)
    // El recorte puede haber dejado un guion al final.
    .replace(/-+$/g, '');

  if (base.length < MIN) return null;
  // El schema exige empezar por letra o número; el replace ya lo garantiza
  // salvo que la cadena empezara por dígito, que sí es válido.
  return base;
}

/** Sufijo aleatorio corto y sin ambigüedad visual (sin 0/o/1/l). */
function sufijo(longitud = 4): string {
  const alfabeto = 'abcdefghjkmnpqrstuvwxyz23456789';
  let salida = '';
  for (let i = 0; i < longitud; i++) {
    salida += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  }
  return salida;
}

/** ¿Está libre? Comprueba las dos fuentes: la lista del código, la tabla
 *  de reservados (que permite añadir sin redeploy) y los usuarios reales. */
async function estaLibre(handle: string): Promise<boolean> {
  if (HANDLES_RESERVADOS.has(handle)) return false;

  const [usuario, reservado] = await Promise.all([
    prisma.user.findUnique({ where: { handle }, select: { id: true } }),
    prisma.handleReservado.findUnique({ where: { handle }, select: { handle: true } }),
  ]);
  return !usuario && !reservado;
}

/**
 * Devuelve un handle libre partiendo de un nombre sugerido.
 *
 * Estrategia: probar el nombre limpio; si está ocupado, añadir sufijos
 * aleatorios. No se usa un contador incremental (`mizllet-2`, `mizllet-3`)
 * a propósito: eso deja adivinar cuántas cuentas parecidas hay y facilita
 * suplantar por proximidad.
 *
 * El resultado sigue pasando por el unique de la DB al crear el usuario:
 * esto reduce las colisiones, no las garantiza contra una carrera.
 */
export async function generarHandleLibre(sugerido: string | null): Promise<string> {
  const base = (sugerido && normalizarAHandle(sugerido)) || 'jugador';

  if (await estaLibre(base)) return base;

  for (let intento = 0; intento < 8; intento++) {
    // Se recorta la base para que quepa el sufijo dentro del máximo.
    const recorte = base.slice(0, MAX - 5).replace(/-+$/g, '');
    const candidato = `${recorte}-${sufijo()}`;
    if (await estaLibre(candidato)) return candidato;
  }

  // Último recurso: sufijo más largo. La probabilidad de llegar aquí y
  // volver a chocar es despreciable.
  return `jugador-${sufijo(8)}`;
}
