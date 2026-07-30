import { Router } from 'express';
import * as ctrl from '../controllers/perfiles.controller';
import { asyncHandler } from '../middlewares/errores.middleware';
import { authOpcional, requiereAuth } from '../middlewares/auth.middleware';
import { validarBody, validarParams } from '../middlewares/validar.middleware';
import { limiteEscritura } from '../middlewares/rateLimit.middleware';
import {
  actualizarBloqueSchema,
  actualizarPerfilSchema,
  crearBloqueSchema,
  handleParamSchema,
  reordenarBloquesSchema,
} from '../schemas/perfil.schema';

const router = Router();

// ── Perfil propio (requiere sesión) ──────────────────────────────────
// Todas las rutas de escritura parten de la sesión, nunca de un id que
// mande el cliente: no hay forma de tocar el perfil de otra persona.

router.get('/mio', requiereAuth, asyncHandler(ctrl.miPerfil));

router.patch(
  '/mio',
  requiereAuth,
  limiteEscritura,
  validarBody(actualizarPerfilSchema),
  asyncHandler(ctrl.actualizarPerfil)
);

router.post(
  '/mio/bloques',
  requiereAuth,
  limiteEscritura,
  validarBody(crearBloqueSchema),
  asyncHandler(ctrl.crearBloque)
);

// El reorden va ANTES de /mio/bloques/:id — si no, Express interpretaría
// "orden" como un id de bloque.
router.put(
  '/mio/bloques/orden',
  requiereAuth,
  limiteEscritura,
  validarBody(reordenarBloquesSchema),
  asyncHandler(ctrl.reordenarBloques)
);

router.patch(
  '/mio/bloques/:id',
  requiereAuth,
  limiteEscritura,
  validarBody(actualizarBloqueSchema),
  asyncHandler(ctrl.actualizarBloque)
);

router.delete(
  '/mio/bloques/:id',
  requiereAuth,
  limiteEscritura,
  asyncHandler(ctrl.borrarBloque)
);

// ── Perfil público ───────────────────────────────────────────────────
// `authOpcional` porque el dueño sí puede ver su propio perfil aunque esté
// sin publicar; para el resto es un 404.
router.get(
  '/:handle',
  authOpcional,
  validarParams(handleParamSchema),
  asyncHandler(ctrl.perfilPublico)
);

export default router;
