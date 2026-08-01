import { Router } from 'express';

import * as ctrl from '../controllers/moderacion.controller';
import { asyncHandler } from '../middlewares/errores.middleware';
import { requiereAdmin, requiereAuth, requiereMod } from '../middlewares/auth.middleware';
import { validarBody, validarQuery } from '../middlewares/validar.middleware';
import { limiteEscritura } from '../middlewares/rateLimit.middleware';
import {
  cambiarRolSchema,
  crearReporteSchema,
  levantarSuspensionSchema,
  listarReportesSchema,
  ocultarSchema,
  resolverReporteSchema,
  suspenderSchema,
} from '../schemas/moderacion.schema';

/**
 * Rutas de moderación (Fase 10).
 *
 * La primera es de cualquiera con sesión —reportar es un derecho del
 * usuario, no un privilegio— y el resto exigen `requiereMod`. El cambio de
 * rol es el único que pide ADMIN: repartir permisos no es moderar.
 *
 * `requiereMod` va SIEMPRE después de `requiereAuth`, porque lee
 * `req.usuario` y sin sesión no habría nada que comprobar (respondería 401
 * igual, pero por el camino equivocado).
 */

const router = Router();

// ── Reportar (cualquier usuario con sesión) ──────────────────────────
// Con límite de escritura: sin él, reportar en bucle es la forma barata de
// ahogar la cola de revisión.
router.post(
  '/reportes',
  requiereAuth,
  limiteEscritura,
  validarBody(crearReporteSchema),
  asyncHandler(ctrl.crearReporte)
);

// ── Revisar (MOD/ADMIN) ──────────────────────────────────────────────
router.get(
  '/resumen',
  requiereAuth,
  requiereMod,
  asyncHandler(ctrl.resumen)
);

router.get(
  '/reportes',
  requiereAuth,
  requiereMod,
  validarQuery(listarReportesSchema),
  asyncHandler(ctrl.listarReportes)
);

router.patch(
  '/reportes/:id',
  requiereAuth,
  requiereMod,
  validarBody(resolverReporteSchema),
  asyncHandler(ctrl.resolverReporte)
);

// ── Acciones (MOD/ADMIN) ─────────────────────────────────────────────
router.post(
  '/suspender',
  requiereAuth,
  requiereMod,
  validarBody(suspenderSchema),
  asyncHandler(ctrl.suspender)
);

router.post(
  '/levantar',
  requiereAuth,
  requiereMod,
  validarBody(levantarSuspensionSchema),
  asyncHandler(ctrl.levantarSuspension)
);

router.post(
  '/ocultar',
  requiereAuth,
  requiereMod,
  validarBody(ocultarSchema),
  asyncHandler(ctrl.ocultar)
);

// ── Roles (solo ADMIN) ───────────────────────────────────────────────
router.post(
  '/rol',
  requiereAuth,
  requiereAdmin,
  validarBody(cambiarRolSchema),
  asyncHandler(ctrl.cambiarRol)
);

export default router;
