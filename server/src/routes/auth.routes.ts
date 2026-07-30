import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller';
import { asyncHandler } from '../middlewares/errores.middleware';
import { authOpcional, requiereAuth } from '../middlewares/auth.middleware';
import { validarBody } from '../middlewares/validar.middleware';
import { limiteAuth, limiteBusqueda, limiteRegistro } from '../middlewares/rateLimit.middleware';
import {
  cambiarPasswordSchema,
  loginSchema,
  registroSchema,
} from '../schemas/auth.schema';

const router = Router();

router.post(
  '/registro',
  limiteRegistro,
  validarBody(registroSchema),
  asyncHandler(ctrl.registro)
);

router.post('/login', limiteAuth, validarBody(loginSchema), asyncHandler(ctrl.login));

// El refresh lleva su propio límite: sin él, un bucle de refresh es un DoS
// barato (cada llamada hace escrituras en la DB).
router.post('/refresh', limiteAuth, asyncHandler(ctrl.refresh));

router.post('/logout', authOpcional, asyncHandler(ctrl.logout));
router.post('/logout-todo', requiereAuth, asyncHandler(ctrl.logoutTodo));

router.get('/yo', authOpcional, asyncHandler(ctrl.yo));

router.post(
  '/cambiar-password',
  requiereAuth,
  limiteAuth,
  validarBody(cambiarPasswordSchema),
  asyncHandler(ctrl.cambiarPassword)
);

router.get('/handle-disponible', limiteBusqueda, asyncHandler(ctrl.handleDisponible));

export default router;
