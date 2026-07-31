import { Router } from 'express';

import * as ctrl from '../controllers/social.controller';
import { asyncHandler } from '../middlewares/errores.middleware';
import { authOpcional, requiereAuth } from '../middlewares/auth.middleware';
import { validarBody, validarParams, validarQuery } from '../middlewares/validar.middleware';
import { limiteBusqueda, limiteEscritura } from '../middlewares/rateLimit.middleware';
import {
  buscarSchema,
  crearComentarioSchema,
  crearPublicacionSchema,
  editarPublicacionSchema,
  handleParamSchema,
  idParamSchema,
  paginacionSchema,
  reaccionSchema,
} from '../schemas/social.schema';

/**
 * Rutas sociales (Fase 7).
 *
 * `authOpcional` en las de lectura y `requiereAuth` en las de escritura.
 * La distinción importa: un visitante sin cuenta puede leer un perfil y sus
 * comentarios, pero al estar identificado la respuesta además filtra a la
 * gente bloqueada y marca lo que ya tiene reaccionado.
 */

const router = Router();

// ── Feed ─────────────────────────────────────────────────────────────
// Requiere sesión: un feed es "la gente a la que sigo", que no existe sin
// cuenta. Lo público es /explorar.
router.get(
  '/feed',
  requiereAuth,
  validarQuery(paginacionSchema),
  asyncHandler(ctrl.feed)
);

// ── Explorar ─────────────────────────────────────────────────────────
router.get(
  '/explorar',
  authOpcional,
  limiteBusqueda,
  validarQuery(buscarSchema),
  asyncHandler(ctrl.explorar)
);

// ── Notificaciones ───────────────────────────────────────────────────
// Antes de /:id para que "leidas" no se lea como el id de nada.
router.post('/notificaciones/leidas', requiereAuth, asyncHandler(ctrl.marcarLeidas));
// Contador ligero para el punto de la campana: se pide en cada carga, así
// que no puede costar lo que cuesta traer la lista entera.
router.get('/notificaciones/contador', requiereAuth, asyncHandler(ctrl.contadorNotificaciones));
router.get(
  '/notificaciones',
  requiereAuth,
  validarQuery(paginacionSchema),
  asyncHandler(ctrl.notificaciones)
);

// ── Publicaciones ────────────────────────────────────────────────────
router.post(
  '/publicaciones',
  requiereAuth,
  limiteEscritura,
  validarBody(crearPublicacionSchema),
  asyncHandler(ctrl.crearPublicacion)
);

router.get(
  '/publicaciones/:id',
  authOpcional,
  validarParams(idParamSchema),
  asyncHandler(ctrl.verPublicacion)
);

router.patch(
  '/publicaciones/:id',
  requiereAuth,
  limiteEscritura,
  validarParams(idParamSchema),
  validarBody(editarPublicacionSchema),
  asyncHandler(ctrl.editarPublicacion)
);

router.delete(
  '/publicaciones/:id',
  requiereAuth,
  limiteEscritura,
  validarParams(idParamSchema),
  asyncHandler(ctrl.borrarPublicacion)
);

router.get(
  '/publicaciones/:id/comentarios',
  authOpcional,
  validarParams(idParamSchema),
  validarQuery(paginacionSchema),
  asyncHandler(ctrl.comentariosDe)
);

router.post(
  '/publicaciones/:id/comentarios',
  requiereAuth,
  limiteEscritura,
  validarParams(idParamSchema),
  validarBody(crearComentarioSchema),
  asyncHandler(ctrl.comentarPublicacion)
);

router.put(
  '/publicaciones/:id/reaccion',
  requiereAuth,
  limiteEscritura,
  validarParams(idParamSchema),
  validarBody(reaccionSchema),
  asyncHandler(ctrl.reaccionar)
);

// ── Comentarios ──────────────────────────────────────────────────────
router.delete(
  '/comentarios/:id',
  requiereAuth,
  limiteEscritura,
  validarParams(idParamSchema),
  asyncHandler(ctrl.borrarComentario)
);

// ── Usuarios: relación, seguir, bloquear, muro ───────────────────────
router.get(
  '/usuarios/:handle/relacion',
  authOpcional,
  validarParams(handleParamSchema),
  asyncHandler(ctrl.relacion)
);

router.post(
  '/usuarios/:handle/seguir',
  requiereAuth,
  limiteEscritura,
  validarParams(handleParamSchema),
  asyncHandler(ctrl.seguir)
);

router.delete(
  '/usuarios/:handle/seguir',
  requiereAuth,
  limiteEscritura,
  validarParams(handleParamSchema),
  asyncHandler(ctrl.dejarDeSeguir)
);

router.post(
  '/usuarios/:handle/bloquear',
  requiereAuth,
  limiteEscritura,
  validarParams(handleParamSchema),
  asyncHandler(ctrl.bloquear)
);

router.delete(
  '/usuarios/:handle/bloquear',
  requiereAuth,
  limiteEscritura,
  validarParams(handleParamSchema),
  asyncHandler(ctrl.desbloquear)
);

router.get(
  '/usuarios/:handle/seguidores',
  authOpcional,
  validarParams(handleParamSchema),
  validarQuery(paginacionSchema),
  asyncHandler(ctrl.seguidoresDe)
);

router.get(
  '/usuarios/:handle/siguiendo',
  authOpcional,
  validarParams(handleParamSchema),
  validarQuery(paginacionSchema),
  asyncHandler(ctrl.siguiendoDe)
);

router.get(
  '/usuarios/:handle/publicaciones',
  authOpcional,
  validarParams(handleParamSchema),
  validarQuery(paginacionSchema),
  asyncHandler(ctrl.publicacionesDe)
);

router.get(
  '/usuarios/:handle/comentarios',
  authOpcional,
  validarParams(handleParamSchema),
  validarQuery(paginacionSchema),
  asyncHandler(ctrl.comentariosDePerfil)
);

router.post(
  '/usuarios/:handle/comentarios',
  requiereAuth,
  limiteEscritura,
  validarParams(handleParamSchema),
  validarBody(crearComentarioSchema),
  asyncHandler(ctrl.comentarPerfil)
);

export default router;
