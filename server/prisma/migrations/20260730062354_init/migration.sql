-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "handle" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "bannerUrl" TEXT,
    "bio" TEXT,
    "ubicacion" TEXT,
    "fechaNacimiento" TIMESTAMP(3),
    "rol" TEXT NOT NULL DEFAULT 'USER',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "suspendido" BOOLEAN NOT NULL DEFAULT false,
    "suspendidoHasta" TIMESTAMP(3),
    "motivoSuspension" TEXT,
    "perfilPublico" BOOLEAN NOT NULL DEFAULT true,
    "privacidadDm" TEXT NOT NULL DEFAULT 'seguidos',
    "mostrarUbicacion" BOOLEAN NOT NULL DEFAULT false,
    "mostrarEnBusqueda" BOOLEAN NOT NULL DEFAULT true,
    "permitirIndexado" BOOLEAN NOT NULL DEFAULT true,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "ultimoAccesoEn" TIMESTAMP(3),
    "ultimaIpHash" TEXT,
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sesion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "revocadaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoUsoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuentaVinculada" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "usuarioRemoto" TEXT,
    "avatarRemoto" TEXT,
    "esMetodoLogin" BOOLEAN NOT NULL DEFAULT false,
    "accessTokenCif" TEXT,
    "refreshTokenCif" TEXT,
    "expiraEn" TIMESTAMP(3),
    "scopes" TEXT,
    "permisos" JSONB NOT NULL DEFAULT '{}',
    "sincronizadoEn" TIMESTAMP(3),
    "requiereReconexion" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuentaVinculada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Perfil" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plantilla" TEXT NOT NULL DEFAULT 'base-oscuro',
    "tema" JSONB NOT NULL DEFAULT '{}',
    "cssPropio" TEXT,
    "cssOriginal" TEXT,
    "audioUrl" TEXT,
    "audioTitulo" TEXT,
    "audioArtista" TEXT,
    "audioVolumen" INTEGER NOT NULL DEFAULT 30,
    "audioAutoplay" BOOLEAN NOT NULL DEFAULT true,
    "audioLoop" BOOLEAN NOT NULL DEFAULT true,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "vistas" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Perfil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bloque" (
    "id" TEXT NOT NULL,
    "perfilId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bloque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CacheExterno" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "obtenidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "ultimoError" TEXT,
    "intentosFallo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CacheExterno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seguimiento" (
    "seguidorId" TEXT NOT NULL,
    "seguidoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Seguimiento_pkey" PRIMARY KEY ("seguidorId","seguidoId")
);

-- CreateTable
CREATE TABLE "Publicacion" (
    "id" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "juegoAppid" INTEGER,
    "juegoNombre" TEXT,
    "editadoEn" TIMESTAMP(3),
    "borradoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Publicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comentario" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "perfilUserId" TEXT,
    "publicacionId" TEXT,
    "respondeAId" TEXT,
    "editadoEn" TIMESTAMP(3),
    "borradoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comentario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reaccion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'like',
    "perfilUserId" TEXT,
    "publicacionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reaccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActividadFeed" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActividadFeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bloqueo" (
    "bloqueadorId" TEXT NOT NULL,
    "bloqueadoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bloqueo_pkey" PRIMARY KEY ("bloqueadorId","bloqueadoId")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL,
    "destinatarioId" TEXT NOT NULL,
    "emisorId" TEXT,
    "tipo" TEXT NOT NULL,
    "datos" JSONB NOT NULL DEFAULT '{}',
    "leidaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversacion" (
    "id" TEXT NOT NULL,
    "esGrupo" BOOLEAN NOT NULL DEFAULT false,
    "nombre" TEXT,
    "iconoUrl" TEXT,
    "creadorId" TEXT,
    "ultimoMsgEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoMsgTexto" TEXT,
    "esSolicitud" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participante" (
    "id" TEXT NOT NULL,
    "conversacionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'MIEMBRO',
    "leidoHastaId" TEXT,
    "silenciado" BOOLEAN NOT NULL DEFAULT false,
    "salioEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Participante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensaje" (
    "id" TEXT NOT NULL,
    "conversacionId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "texto" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'texto',
    "editadoEn" TIMESTAMP(3),
    "borradoEn" TIMESTAMP(3),
    "respondeAId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mensaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Archivo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "miniaturaUrl" TEXT,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "ancho" INTEGER,
    "alto" INTEGER,
    "duracion" DOUBLE PRECISION,
    "externo" BOOLEAN NOT NULL DEFAULT false,
    "hashSha256" TEXT,
    "mensajeId" TEXT,
    "publicacionId" TEXT,
    "uso" TEXT NOT NULL DEFAULT 'adjunto',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Archivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reporte" (
    "id" TEXT NOT NULL,
    "reportadorId" TEXT NOT NULL,
    "tipoObjeto" TEXT NOT NULL,
    "objetoId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "detalle" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "revisadoPor" TEXT,
    "revisadoEn" TIMESTAMP(3),
    "resolucion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "accion" TEXT NOT NULL,
    "detalle" JSONB NOT NULL DEFAULT '{}',
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandleReservado" (
    "handle" TEXT NOT NULL,
    "motivo" TEXT,

    CONSTRAINT "HandleReservado_pkey" PRIMARY KEY ("handle")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE INDEX "User_handle_idx" ON "User"("handle");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_mostrarEnBusqueda_perfilPublico_idx" ON "User"("mostrarEnBusqueda", "perfilPublico");

-- CreateIndex
CREATE UNIQUE INDEX "Sesion_tokenHash_key" ON "Sesion"("tokenHash");

-- CreateIndex
CREATE INDEX "Sesion_userId_revocadaEn_idx" ON "Sesion"("userId", "revocadaEn");

-- CreateIndex
CREATE INDEX "Sesion_expiraEn_idx" ON "Sesion"("expiraEn");

-- CreateIndex
CREATE INDEX "CuentaVinculada_userId_idx" ON "CuentaVinculada"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CuentaVinculada_proveedor_proveedorId_key" ON "CuentaVinculada"("proveedor", "proveedorId");

-- CreateIndex
CREATE UNIQUE INDEX "CuentaVinculada_userId_proveedor_key" ON "CuentaVinculada"("userId", "proveedor");

-- CreateIndex
CREATE UNIQUE INDEX "Perfil_userId_key" ON "Perfil"("userId");

-- CreateIndex
CREATE INDEX "Perfil_publicado_vistas_idx" ON "Perfil"("publicado", "vistas");

-- CreateIndex
CREATE INDEX "Bloque_perfilId_orden_idx" ON "Bloque"("perfilId", "orden");

-- CreateIndex
CREATE INDEX "CacheExterno_expiraEn_idx" ON "CacheExterno"("expiraEn");

-- CreateIndex
CREATE UNIQUE INDEX "CacheExterno_userId_proveedor_clave_key" ON "CacheExterno"("userId", "proveedor", "clave");

-- CreateIndex
CREATE INDEX "Seguimiento_seguidoId_createdAt_idx" ON "Seguimiento"("seguidoId", "createdAt");

-- CreateIndex
CREATE INDEX "Seguimiento_seguidorId_createdAt_idx" ON "Seguimiento"("seguidorId", "createdAt");

-- CreateIndex
CREATE INDEX "Publicacion_autorId_createdAt_idx" ON "Publicacion"("autorId", "createdAt");

-- CreateIndex
CREATE INDEX "Publicacion_createdAt_idx" ON "Publicacion"("createdAt");

-- CreateIndex
CREATE INDEX "Publicacion_juegoAppid_idx" ON "Publicacion"("juegoAppid");

-- CreateIndex
CREATE INDEX "Comentario_perfilUserId_createdAt_idx" ON "Comentario"("perfilUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Comentario_publicacionId_createdAt_idx" ON "Comentario"("publicacionId", "createdAt");

-- CreateIndex
CREATE INDEX "Comentario_autorId_idx" ON "Comentario"("autorId");

-- CreateIndex
CREATE INDEX "Reaccion_publicacionId_idx" ON "Reaccion"("publicacionId");

-- CreateIndex
CREATE INDEX "Reaccion_perfilUserId_idx" ON "Reaccion"("perfilUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Reaccion_userId_perfilUserId_tipo_key" ON "Reaccion"("userId", "perfilUserId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "Reaccion_userId_publicacionId_tipo_key" ON "Reaccion"("userId", "publicacionId", "tipo");

-- CreateIndex
CREATE INDEX "ActividadFeed_userId_createdAt_idx" ON "ActividadFeed"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ActividadFeed_createdAt_idx" ON "ActividadFeed"("createdAt");

-- CreateIndex
CREATE INDEX "Bloqueo_bloqueadoId_idx" ON "Bloqueo"("bloqueadoId");

-- CreateIndex
CREATE INDEX "Notificacion_destinatarioId_leidaEn_createdAt_idx" ON "Notificacion"("destinatarioId", "leidaEn", "createdAt");

-- CreateIndex
CREATE INDEX "Conversacion_ultimoMsgEn_idx" ON "Conversacion"("ultimoMsgEn");

-- CreateIndex
CREATE INDEX "Participante_userId_salioEn_idx" ON "Participante"("userId", "salioEn");

-- CreateIndex
CREATE UNIQUE INDEX "Participante_conversacionId_userId_key" ON "Participante"("conversacionId", "userId");

-- CreateIndex
CREATE INDEX "Mensaje_conversacionId_createdAt_idx" ON "Mensaje"("conversacionId", "createdAt");

-- CreateIndex
CREATE INDEX "Mensaje_autorId_idx" ON "Mensaje"("autorId");

-- CreateIndex
CREATE INDEX "Archivo_userId_createdAt_idx" ON "Archivo"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Archivo_mensajeId_idx" ON "Archivo"("mensajeId");

-- CreateIndex
CREATE INDEX "Archivo_publicacionId_idx" ON "Archivo"("publicacionId");

-- CreateIndex
CREATE INDEX "Archivo_hashSha256_idx" ON "Archivo"("hashSha256");

-- CreateIndex
CREATE INDEX "Reporte_estado_createdAt_idx" ON "Reporte"("estado", "createdAt");

-- CreateIndex
CREATE INDEX "Reporte_tipoObjeto_objetoId_idx" ON "Reporte"("tipoObjeto", "objetoId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_accion_createdAt_idx" ON "AuditLog"("accion", "createdAt");

-- AddForeignKey
ALTER TABLE "Sesion" ADD CONSTRAINT "Sesion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaVinculada" ADD CONSTRAINT "CuentaVinculada_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Perfil" ADD CONSTRAINT "Perfil_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bloque" ADD CONSTRAINT "Bloque_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "Perfil"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CacheExterno" ADD CONSTRAINT "CacheExterno_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seguimiento" ADD CONSTRAINT "Seguimiento_seguidorId_fkey" FOREIGN KEY ("seguidorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seguimiento" ADD CONSTRAINT "Seguimiento_seguidoId_fkey" FOREIGN KEY ("seguidoId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publicacion" ADD CONSTRAINT "Publicacion_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comentario" ADD CONSTRAINT "Comentario_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comentario" ADD CONSTRAINT "Comentario_publicacionId_fkey" FOREIGN KEY ("publicacionId") REFERENCES "Publicacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaccion" ADD CONSTRAINT "Reaccion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaccion" ADD CONSTRAINT "Reaccion_publicacionId_fkey" FOREIGN KEY ("publicacionId") REFERENCES "Publicacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActividadFeed" ADD CONSTRAINT "ActividadFeed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bloqueo" ADD CONSTRAINT "Bloqueo_bloqueadorId_fkey" FOREIGN KEY ("bloqueadorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bloqueo" ADD CONSTRAINT "Bloqueo_bloqueadoId_fkey" FOREIGN KEY ("bloqueadoId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_emisorId_fkey" FOREIGN KEY ("emisorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participante" ADD CONSTRAINT "Participante_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participante" ADD CONSTRAINT "Participante_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensaje" ADD CONSTRAINT "Mensaje_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensaje" ADD CONSTRAINT "Mensaje_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Archivo" ADD CONSTRAINT "Archivo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Archivo" ADD CONSTRAINT "Archivo_mensajeId_fkey" FOREIGN KEY ("mensajeId") REFERENCES "Mensaje"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Archivo" ADD CONSTRAINT "Archivo_publicacionId_fkey" FOREIGN KEY ("publicacionId") REFERENCES "Publicacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_reportadorId_fkey" FOREIGN KEY ("reportadorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
