import { Router } from 'express';
import * as ctrl from '../controllers/oauth.controller';
import { asyncHandler } from '../middlewares/errores.middleware';
import { authOpcional } from '../middlewares/auth.middleware';
import { limiteOAuth } from '../middlewares/rateLimit.middleware';

const router = Router();

/**
 * OAuth 2.0 de Discord y Google (Fase 6).
 *
 * Son GET con redirección, como las de Steam: quien las recorre es el
 * navegador, no `fetch()`. De ahí que no lleven validación de body ni
 * devuelvan JSON.
 *
 * `authOpcional` y no `requiereAuth`: la MISMA ruta sirve para entrar (sin
 * sesión) y para vincular (con sesión). El controlador decide la intención
 * al salir y la firma dentro del `state`.
 *
 * `limiteOAuth` y no `limiteAuth`, por lo aprendido con Steam: un login
 * correcto responde 302 y `skipSuccessfulRequests` solo perdona los 2xx,
 * así que con el límite de contraseñas los inicios de sesión BUENOS
 * gastarían cupo y dejarían al usuario fuera 15 minutos.
 */
router.get('/:proveedor', limiteOAuth, authOpcional, asyncHandler(ctrl.iniciar));
router.get('/:proveedor/callback', limiteOAuth, asyncHandler(ctrl.callback));

export default router;
