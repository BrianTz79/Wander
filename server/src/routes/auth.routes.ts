import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller';
import * as steam from '../controllers/steamAuth.controller';
import { asyncHandler } from '../middlewares/errores.middleware';
import { authOpcional, requiereAuth } from '../middlewares/auth.middleware';
import { validarBody } from '../middlewares/validar.middleware';
import {
  limiteAuth,
  limiteBusqueda,
  limiteEscritura,
  limiteOAuth,
  limiteRegistro,
} from '../middlewares/rateLimit.middleware';
import {
  cambiarPasswordSchema,
  loginSchema,
  preferenciasSchema,
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

// Preferencias de interfaz (Fase 6.5). Es una escritura pequeña y propia
// del usuario, pero se dispara al pulsar un botón, así que lleva el límite
// de escritura general para que no se pueda usar en bucle.
router.patch(
  '/preferencias',
  requiereAuth,
  limiteEscritura,
  validarBody(preferenciasSchema),
  asyncHandler(ctrl.preferencias)
);

router.get('/handle-disponible', limiteBusqueda, asyncHandler(ctrl.handleDisponible));

/**
 * Steam OpenID 2.0. Son GET y con redirección porque quien los recorre es
 * el navegador volviendo de Steam, no fetch() — de ahí que no lleven
 * validación de body ni devuelvan JSON.
 *
 * El callback lleva `limiteAuth` igual que el login: es una ruta anónima
 * que dispara una petición saliente a Steam por cada visita, así que sin
 * límite es un amplificador gratuito para quien quiera abusar de ella.
 *
 * `authOpcional` y no `requiereAuth`, igual que en las rutas de OAuth: la
 * MISMA ruta sirve para entrar (sin sesión) y para vincular (con sesión).
 * El controlador decide la intención al salir y la firma dentro del
 * `state`. Sin este middleware, `iniciarSteam` no vería nunca la sesión y
 * todo flujo sería un "entrar" — que es el bug de las cuentas duplicadas.
 */
router.get('/steam', limiteOAuth, authOpcional, steam.iniciarSteam);
router.get('/steam/callback', limiteOAuth, asyncHandler(steam.callbackSteam));

export default router;
