import { Router } from 'express';

import * as ctrl from '../controllers/mensajes.controller';
import { asyncHandler } from '../middlewares/errores.middleware';
import { requiereAuth } from '../middlewares/auth.middleware';
import { validarBody, validarParams, validarQuery } from '../middlewares/validar.middleware';
import { limiteEscritura, limiteMensajes } from '../middlewares/rateLimit.middleware';
import {
  abrirDmSchema,
  anadirParticipantesSchema,
  bandejaSchema,
  crearGrupoSchema,
  editarGrupoSchema,
  editarMensajeSchema,
  enviarMensajeSchema,
  idParamSchema,
  marcarLeidoSchema,
  paginaMensajesSchema,
  participanteParamSchema,
  silenciarSchema,
} from '../schemas/mensajes.schema';

/**
 * Rutas de mensajería (Fase 8).
 *
 * **Todas exigen sesión, sin excepción.** A diferencia de la capa social,
 * aquí no hay nada público: no existe la lectura anónima de una
 * conversación privada, ni siquiera para ver si existe.
 *
 * `limiteMensajes` (60/min) va en el envío, que es la acción repetitiva de
 * un chat; el resto usa `limiteEscritura` (30/min), porque crear grupos o
 * añadir gente no es algo que se haga en ráfagas.
 */

const router = Router();

// ── Bandeja ──────────────────────────────────────────────────────────
// Antes de /conversaciones/:id, para que "no-leidos" no se lea como un id.
router.get('/no-leidos', requiereAuth, asyncHandler(ctrl.noLeidos));

router.get(
  '/conversaciones',
  requiereAuth,
  validarQuery(bandejaSchema),
  asyncHandler(ctrl.bandeja)
);

// ── Abrir conversaciones ─────────────────────────────────────────────
router.post(
  '/dm',
  requiereAuth,
  limiteEscritura,
  validarBody(abrirDmSchema),
  asyncHandler(ctrl.abrirDm)
);

router.post(
  '/grupos',
  requiereAuth,
  limiteEscritura,
  validarBody(crearGrupoSchema),
  asyncHandler(ctrl.crearGrupo)
);

// ── Grupos ───────────────────────────────────────────────────────────
// Van antes que /conversaciones/:id porque comparten prefijo de forma.
router.patch(
  '/grupos/:id',
  requiereAuth,
  limiteEscritura,
  validarParams(idParamSchema),
  validarBody(editarGrupoSchema),
  asyncHandler(ctrl.editarGrupo)
);

router.post(
  '/grupos/:id/participantes',
  requiereAuth,
  limiteEscritura,
  validarParams(idParamSchema),
  validarBody(anadirParticipantesSchema),
  asyncHandler(ctrl.anadirParticipantes)
);

router.delete(
  '/grupos/:id/participantes/:handle',
  requiereAuth,
  limiteEscritura,
  validarParams(participanteParamSchema),
  asyncHandler(ctrl.quitarParticipante)
);

// ── Una conversación ─────────────────────────────────────────────────
router.get(
  '/conversaciones/:id',
  requiereAuth,
  validarParams(idParamSchema),
  asyncHandler(ctrl.verConversacion)
);

router.get(
  '/conversaciones/:id/mensajes',
  requiereAuth,
  validarParams(idParamSchema),
  validarQuery(paginaMensajesSchema),
  asyncHandler(ctrl.mensajes)
);

router.post(
  '/conversaciones/:id/mensajes',
  requiereAuth,
  limiteMensajes,
  validarParams(idParamSchema),
  validarBody(enviarMensajeSchema),
  asyncHandler(ctrl.enviar)
);

router.post(
  '/conversaciones/:id/leido',
  requiereAuth,
  limiteMensajes,
  validarParams(idParamSchema),
  validarBody(marcarLeidoSchema),
  asyncHandler(ctrl.marcarLeido)
);

router.post(
  '/conversaciones/:id/silenciar',
  requiereAuth,
  limiteEscritura,
  validarParams(idParamSchema),
  validarBody(silenciarSchema),
  asyncHandler(ctrl.silenciar)
);

router.post(
  '/conversaciones/:id/aceptar',
  requiereAuth,
  limiteEscritura,
  validarParams(idParamSchema),
  asyncHandler(ctrl.aceptarSolicitud)
);

router.post(
  '/conversaciones/:id/salir',
  requiereAuth,
  limiteEscritura,
  validarParams(idParamSchema),
  asyncHandler(ctrl.salir)
);

// ── Un mensaje ───────────────────────────────────────────────────────
router.patch(
  '/:id',
  requiereAuth,
  limiteMensajes,
  validarParams(idParamSchema),
  validarBody(editarMensajeSchema),
  asyncHandler(ctrl.editar)
);

router.delete(
  '/:id',
  requiereAuth,
  limiteMensajes,
  validarParams(idParamSchema),
  asyncHandler(ctrl.borrar)
);

export default router;
