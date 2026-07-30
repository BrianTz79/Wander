import { Router } from 'express';
import * as ctrl from '../controllers/externo.controller';
import { asyncHandler } from '../middlewares/errores.middleware';
import { authOpcional, requiereAuth } from '../middlewares/auth.middleware';
import { validarParams } from '../middlewares/validar.middleware';
import { limiteExterno } from '../middlewares/rateLimit.middleware';
import { handleParamSchema } from '../schemas/perfil.schema';

const router = Router();

/**
 * Datos de proveedores externos (Fase 5).
 *
 * La lectura pública no lleva `limiteExterno`: sirve de la caché de
 * Postgres, no de Steam, así que es tan barata como cargar el perfil y le
 * basta el `limiteGeneral` de la app. El que sí lo lleva es
 * `/sincronizar`, que es el único que puede provocar tráfico saliente a
 * Steam a voluntad del usuario.
 */

// El orden importa: "sincronizar" iría capturado por `/:handle` si fuese
// después, y acabaría buscando un usuario con ese nombre.
router.post(
  '/steam/sincronizar',
  requiereAuth,
  limiteExterno,
  asyncHandler(ctrl.sincronizarSteam)
);

router.get(
  '/steam/:handle',
  authOpcional,
  validarParams(handleParamSchema),
  asyncHandler(ctrl.steamDeHandle)
);

/**
 * Presencia de Discord (Fase 6). Igual que la de Steam: sirve de la caché
 * de Postgres, así que le basta el `limiteGeneral`. Su TTL es corto (1 min)
 * porque el valor del bloque está en que sea "en vivo", pero sigue siendo
 * la caché quien habla con Lanyard, no el render.
 */
router.get(
  '/discord/:handle',
  authOpcional,
  validarParams(handleParamSchema),
  asyncHandler(ctrl.discordDeHandle)
);

export default router;
