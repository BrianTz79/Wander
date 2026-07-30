import { Router } from 'express';
import * as ctrl from '../controllers/cuentas.controller';
import { asyncHandler } from '../middlewares/errores.middleware';
import { requiereAuth } from '../middlewares/auth.middleware';
import { validarBody, validarParams } from '../middlewares/validar.middleware';
import { limiteEscritura } from '../middlewares/rateLimit.middleware';
import { permisosSchema, proveedorParamSchema } from '../schemas/cuentas.schema';

const router = Router();

/**
 * Cuentas vinculadas (Fase 6). A diferencia de /api/oauth, esto sí es una
 * API JSON normal que consume la página de configuración.
 *
 * Todas las rutas de escritura exigen sesión y actúan sobre `req.usuario`:
 * no hay ninguna que acepte un userId del cliente.
 */

// Pública a propósito: /privacidad debe poder leerse antes de registrarse,
// que es cuando alguien decide si confía en el sitio.
router.get('/privacidad', ctrl.descripcionPrivacidad);

router.get('/', requiereAuth, asyncHandler(ctrl.listar));

router.patch(
  '/:proveedor/permisos',
  requiereAuth,
  limiteEscritura,
  validarParams(proveedorParamSchema),
  validarBody(permisosSchema),
  asyncHandler(ctrl.actualizarPermisos)
);

router.delete(
  '/:proveedor',
  requiereAuth,
  limiteEscritura,
  validarParams(proveedorParamSchema),
  asyncHandler(ctrl.desvincular)
);

export default router;
