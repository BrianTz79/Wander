import { Router } from 'express';

import * as ctrl from '../controllers/archivos.controller';
import { asyncHandler } from '../middlewares/errores.middleware';
import { requiereAuth } from '../middlewares/auth.middleware';
import { validarBody, validarParams, validarQuery } from '../middlewares/validar.middleware';
import { limiteBusqueda, limiteSubidas } from '../middlewares/rateLimit.middleware';
import { subida } from '../middlewares/subida.middleware';
import {
  buscarGifsSchema,
  gifExternoSchema,
  idParamSchema,
  subirSchema,
} from '../schemas/archivos.schema';
import { MAX_ADJUNTOS } from '../services/archivos.service';

/**
 * Rutas de archivos (Fase 8).
 *
 * Todas exigen sesión, incluido el buscador de GIFs: es una llamada a una
 * API externa con nuestra clave, así que dejarla abierta sería regalar
 * nuestra cuota a cualquiera que encuentre la URL.
 */

const router = Router();

// ── Límites ──────────────────────────────────────────────────────────
// Antes que /:id, para que "limites" no se interprete como un id.
router.get('/limites', requiereAuth, asyncHandler(ctrl.limites));

// ── GIFs ─────────────────────────────────────────────────────────────
router.get(
  '/gifs',
  requiereAuth,
  limiteBusqueda,
  validarQuery(buscarGifsSchema),
  asyncHandler(ctrl.gifs)
);

router.post(
  '/gif',
  requiereAuth,
  limiteSubidas,
  validarBody(gifExternoSchema),
  asyncHandler(ctrl.gifExterno)
);

// ── Subida ───────────────────────────────────────────────────────────
/*
 * El orden de los middlewares no es casual: `subida.array` va ANTES de
 * `validarBody` porque hasta que multer no parsea el multipart, `req.body`
 * está vacío y el schema rechazaría la petición por un campo `uso` que sí
 * venía. `limiteSubidas` va antes de ambos: rechazar por límite de tasa
 * debe costar lo mínimo, y desde luego no procesar 8 MB de multipart.
 */
router.post(
  '/',
  requiereAuth,
  limiteSubidas,
  subida.array('archivos', MAX_ADJUNTOS),
  validarBody(subirSchema),
  asyncHandler(ctrl.subir)
);

router.delete(
  '/:id',
  requiereAuth,
  limiteSubidas,
  validarParams(idParamSchema),
  asyncHandler(ctrl.borrar)
);

export default router;
