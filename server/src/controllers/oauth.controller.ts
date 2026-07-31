import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { hashIp } from '../config/cripto';
import { crearSesion } from '../services/sesion.service';
import { generarHandleLibre } from '../services/handle.service';
import { PLANTILLA_POR_DEFECTO } from '../schemas/plantillas';
import { permisosPorDefecto } from '../schemas/cuentas.schema';
import {
  canjearCodigo,
  crearState,
  esProveedor,
  generarPkce,
  identidadDe,
  leerState,
  nombreProveedor,
  proveedorConfigurado,
  tokensParaGuardar,
  urlAutorizacion,
  type IdentidadRemota,
  type Proveedor,
} from '../services/oauth.service';

/**
 * OAuth 2.0 para Discord y Google (Fase 6).
 *
 * Una misma pareja de rutas cubre DOS flujos, y la diferencia entre ellos
 * es toda la fase:
 *
 *  · **Entrar** (sin sesión) → crea o recupera una cuenta de Wander.
 *  · **Vincular** (con sesión) → añade el proveedor a la cuenta actual
 *    para traer datos, sin tocar quién eres.
 *
 * La intención se decide al SALIR y viaja firmada dentro del `state`. No se
 * deduce al volver mirando si hay cookie de sesión: eso haría que abrir el
 * enlace de "vincular" con la sesión caducada te creara una cuenta nueva en
 * silencio.
 *
 * Como en Steam, son GET con redirección porque quien las recorre es el
 * navegador, no `fetch()`. Terminan siempre en una página del sitio con un
 * parámetro que la UI traduce a un mensaje.
 */

/** A dónde vuelve el usuario según cómo acabó la cosa. Centralizado para
 *  que ningún camino se invente un parámetro que la UI no sabe leer. */
function volver(res: Response, destino: string, clave: string, valor: string): void {
  const url = new URL(destino, 'https://wander.local');
  url.searchParams.set(clave, valor);
  res.redirect(`${url.pathname}${url.search}`);
}

// ─────────────────────────────────────────────────────────────────────
//  GET /api/oauth/:proveedor          → salir hacia el proveedor
// ─────────────────────────────────────────────────────────────────────
export async function iniciar(req: Request, res: Response): Promise<void> {
  // `req.params` puede tipar como array; se normaliza a string antes de
  // comprobarlo contra el catálogo cerrado de proveedores.
  const proveedorBruto = String(req.params['proveedor'] ?? '');
  if (!esProveedor(proveedorBruto)) {
    volver(res, '/login', 'error', 'proveedor');
    return;
  }
  const proveedor: Proveedor = proveedorBruto;

  // Sin credenciales configuradas no se sale a ningún sitio: mejor un
  // mensaje claro que una redirección a una pantalla de error del
  // proveedor que el usuario no sabe interpretar.
  if (!proveedorConfigurado(proveedor)) {
    logger.warn({ proveedor }, 'Intento de OAuth con el proveedor sin configurar');
    volver(res, '/configuracion', 'error', 'no-configurado');
    return;
  }

  // ¿Entrar o vincular? Lo decide la sesión AHORA, no el callback después.
  const intencion = req.usuario ? 'vincular' : 'login';

  const { verificador, desafio } = generarPkce();
  const state = crearState({
    i: intencion,
    p: proveedor,
    v: verificador,
    ...(req.usuario ? { u: req.usuario.id } : {}),
  });

  res.redirect(urlAutorizacion(proveedor, desafio, state));
}

// ─────────────────────────────────────────────────────────────────────
//  GET /api/oauth/:proveedor/callback → vuelta del proveedor
// ─────────────────────────────────────────────────────────────────────
export async function callback(req: Request, res: Response): Promise<void> {
  // `req.params` puede tipar como array; se normaliza a string antes de
  // comprobarlo contra el catálogo cerrado de proveedores.
  const proveedorBruto = String(req.params['proveedor'] ?? '');
  if (!esProveedor(proveedorBruto)) {
    volver(res, '/login', 'error', 'proveedor');
    return;
  }
  const proveedor: Proveedor = proveedorBruto;

  // El usuario pulsó "cancelar" en la pantalla del proveedor. No es un
  // error: es una vuelta legítima.
  if (typeof req.query['error'] === 'string') {
    const contenido = leerState(req.query['state'], proveedor);
    const destino = contenido?.i === 'vincular' ? '/configuracion' : '/login';
    volver(res, destino, proveedor, 'cancelado');
    return;
  }

  /*
   * El `state` es la única defensa contra CSRF en este flujo y, además, lo
   * que trae el verificador PKCE. Si no valida —firma mala, caducado, o de
   * otro proveedor— se corta aquí sin salir a la red.
   */
  const contenido = leerState(req.query['state'], proveedor);
  if (!contenido) {
    logger.warn({ proveedor, ip: req.ip }, 'Callback de OAuth con state inválido');
    volver(res, '/login', 'error', 'state');
    return;
  }

  const destinoFallo = contenido.i === 'vincular' ? '/configuracion' : '/login';

  const codigo = req.query['code'];
  if (typeof codigo !== 'string' || codigo === '') {
    volver(res, destinoFallo, 'error', 'sin-codigo');
    return;
  }

  /*
   * `v` es opcional en el tipo porque el state también lo usa Steam, que no
   * hace PKCE. Aquí, en un callback de OAuth, su ausencia es imposible
   * —`leerState` la rechaza para estos proveedores— pero se comprueba en
   * vez de forzar el tipo: un canje sin verificador es justo lo que PKCE
   * existe para impedir.
   */
  if (typeof contenido.v !== 'string') {
    logger.warn({ proveedor }, 'State de OAuth sin verificador PKCE');
    volver(res, destinoFallo, 'error', 'state');
    return;
  }

  // ── Canje del código e identidad ──
  let identidad: IdentidadRemota;
  let tokens;
  try {
    tokens = await canjearCodigo(proveedor, codigo, contenido.v);
    identidad = await identidadDe(proveedor, tokens);
  } catch (error) {
    // Nunca se registra el cuerpo de la respuesta: puede llevar el
    // client_secret en un eco de la petición.
    logger.warn(
      { proveedor, error: error instanceof Error ? error.message : 'desconocido' },
      'Fallo al canjear el código de OAuth'
    );
    volver(res, destinoFallo, 'error', 'proveedor');
    return;
  }

  if (contenido.i === 'vincular') {
    await vincular(req, res, proveedor, identidad, tokens, contenido.u!);
    return;
  }
  await entrar(req, res, proveedor, identidad, tokens);
}

// ─────────────────────────────────────────────────────────────────────
//  Flujo A: entrar
// ─────────────────────────────────────────────────────────────────────
async function entrar(
  req: Request,
  res: Response,
  proveedor: Proveedor,
  identidad: IdentidadRemota,
  tokens: Awaited<ReturnType<typeof canjearCodigo>>
): Promise<void> {
  // El @@unique([proveedor, proveedorId]) garantiza que una cuenta remota
  // pertenece como mucho a un usuario. Si existe, se entra a ESA.
  const vinculo = await prisma.cuentaVinculada.findUnique({
    where: { proveedor_proveedorId: { proveedor, proveedorId: identidad.id } },
    select: {
      user: {
        select: {
          id: true,
          handle: true,
          rol: true,
          tokenVersion: true,
          suspendido: true,
          suspendidoHasta: true,
        },
      },
    },
  });

  if (vinculo) {
    const u = vinculo.user;

    const suspendidoActivo =
      u.suspendido && (!u.suspendidoHasta || u.suspendidoHasta > new Date());
    if (suspendidoActivo) {
      volver(res, '/login', 'error', 'suspendido');
      return;
    }

    // Si el vínculo se había creado solo para traer datos, el primer login
    // por esta vía lo asciende a método de acceso. Es el mismo ascenso que
    // hace Steam (§ steamAuth.controller).
    const guardables = tokensParaGuardar(proveedor, tokens);
    await prisma.cuentaVinculada.update({
      where: { proveedor_proveedorId: { proveedor, proveedorId: identidad.id } },
      data: {
        esMetodoLogin: true,
        usuarioRemoto: identidad.nombre,
        avatarRemoto: identidad.avatar,
        requiereReconexion: false,
        ...guardables,
      },
    });

    await crearSesion(res, u, { userAgent: req.get('user-agent'), ip: req.ip });
    await prisma.user.update({ where: { id: u.id }, data: { ultimoAccesoEn: new Date() } });
    await auditar(u.id, 'login', { proveedor }, req);

    logger.info({ userId: u.id, proveedor }, 'Login por OAuth (cuenta existente)');
    res.redirect('/editor');
    return;
  }

  /*
   * ── Cuenta nueva, y aquí la decisión importante ──
   *
   * Google nos da un correo verificado, y es tentador buscar si ese correo
   * ya tiene cuenta y unir las dos automáticamente. NO se hace, a
   * propósito: si alguien registró `victima@gmail.com` con contraseña, y
   * más tarde ese correo cae en manos de otra persona (o el atacante
   * consigue un Google con ese correo), el auto-vínculo le regalaría la
   * cuenta entera sin saber la contraseña.
   *
   * La regla es: **vincular exige demostrar que controlas la cuenta de
   * Wander**, es decir, hacerlo desde /configuracion con sesión iniciada.
   * Así que si el correo ya existe, se manda al login con un mensaje que
   * explica exactamente qué hacer.
   */
  if (identidad.email && identidad.emailVerificado) {
    const existente = await prisma.user.findUnique({
      where: { email: identidad.email.toLowerCase() },
      select: { id: true },
    });
    if (existente) {
      logger.info({ proveedor }, 'OAuth con un correo ya registrado: se pide vincular desde ajustes');
      volver(res, '/login', 'error', 'correo-en-uso');
      return;
    }
  }

  const handle = await generarHandleLibre(identidad.nombre);
  const displayName = (identidad.nombre ?? '').trim().slice(0, 40) || handle;
  const guardables = tokensParaGuardar(proveedor, tokens);

  try {
    const usuario = await prisma.user.create({
      data: {
        // Solo se acepta el correo si el proveedor lo da por verificado.
        // Un correo sin verificar es una afirmación, no un hecho.
        email: identidad.emailVerificado && identidad.email ? identidad.email.toLowerCase() : null,
        emailVerified: Boolean(identidad.emailVerificado && identidad.email),
        handle,
        displayName,
        avatarUrl: identidad.avatar,
        cuentas: {
          create: {
            proveedor,
            proveedorId: identidad.id,
            usuarioRemoto: identidad.nombre,
            avatarRemoto: identidad.avatar,
            esMetodoLogin: true,
            permisos: permisosPorDefecto(proveedor),
            ...guardables,
          },
        },
        perfil: {
          create: {
            plantilla: PLANTILLA_POR_DEFECTO,
            tema: {},
            bloques: {
              create: [
                { tipo: 'hero', orden: 0, config: {} },
                { tipo: 'enlaces', orden: 1, config: { enlaces: [] } },
              ],
            },
          },
        },
      },
      select: { id: true, handle: true, rol: true, tokenVersion: true },
    });

    await crearSesion(res, usuario, { userAgent: req.get('user-agent'), ip: req.ip });
    await auditar(usuario.id, 'login', { proveedor, cuentaNueva: true }, req);

    logger.info({ userId: usuario.id, proveedor, handle }, 'Cuenta creada por OAuth');
    res.redirect(`/editor?bienvenida=${proveedor}`);
  } catch (error) {
    // Carrera improbable: dos callbacks simultáneos, o el handle generado
    // ocupado entre la comprobación y el insert.
    logger.error({ error, proveedor }, 'Fallo al crear cuenta por OAuth');
    volver(res, '/login', 'error', 'creacion');
  }
}

// ─────────────────────────────────────────────────────────────────────
//  Flujo B: vincular a la cuenta ya iniciada
// ─────────────────────────────────────────────────────────────────────
async function vincular(
  req: Request,
  res: Response,
  proveedor: Proveedor,
  identidad: IdentidadRemota,
  tokens: Awaited<ReturnType<typeof canjearCodigo>>,
  userId: string
): Promise<void> {
  /*
   * El userId sale del `state` firmado, no de la cookie: el usuario pudo
   * cerrar sesión (o cambiar de cuenta en otra pestaña) mientras estaba en
   * Discord. Vincular a quien inició el flujo es lo correcto, pero hay que
   * confirmar que esa cuenta sigue existiendo.
   */
  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!usuario) {
    volver(res, '/login', 'error', 'sesion');
    return;
  }

  // ¿Esta cuenta remota ya está en Wander?
  const existente = await prisma.cuentaVinculada.findUnique({
    where: { proveedor_proveedorId: { proveedor, proveedorId: identidad.id } },
    select: { userId: true },
  });

  if (existente && existente.userId !== userId) {
    /*
     * Pertenece a OTRO usuario. No se roba ni se mueve: el
     * @@unique([proveedor, proveedorId]) existe justo para que una cuenta
     * remota identifique a una sola persona. Si se permitiera moverla, un
     * atacante con acceso temporal a un Discord podría desvincularlo de su
     * dueño y quedárselo.
     */
    logger.warn({ userId, proveedor }, 'Intento de vincular una cuenta remota ya usada por otro usuario');
    volver(res, '/configuracion', 'error', 'ya-vinculada');
    return;
  }

  const guardables = tokensParaGuardar(proveedor, tokens);

  await prisma.cuentaVinculada.upsert({
    where: { userId_proveedor: { userId, proveedor } },
    create: {
      userId,
      proveedor,
      proveedorId: identidad.id,
      usuarioRemoto: identidad.nombre,
      avatarRemoto: identidad.avatar,
      // Vincular NO convierte el proveedor en método de acceso: son dos
      // cosas distintas (§5 de PROYECTO.md). Se asciende solo cuando
      // alguien entra de verdad por esa vía.
      esMetodoLogin: false,
      permisos: permisosPorDefecto(proveedor),
      ...guardables,
    },
    update: {
      // Reconectar tras revocar: se refrescan los tokens y se limpia el
      // aviso, sin tocar los permisos que el usuario ya eligió.
      proveedorId: identidad.id,
      usuarioRemoto: identidad.nombre,
      avatarRemoto: identidad.avatar,
      requiereReconexion: false,
      ...guardables,
    },
  });

  /*
   * ── Adoptar el correo, si la cuenta no tenía ninguno ──
   *
   * Quien se registró con Steam no tiene correo ni contraseña: Steam no da
   * el primero y no hace falta el segundo. Si esa persona vincula Google,
   * darle el correo verificado le devuelve una vía de recuperación, y sin
   * él quedaría con Steam como único acceso para siempre.
   *
   * Solo se hace cuando el usuario NO tenía correo: sobrescribir uno ya
   * existente cambiaría en silencio la dirección de recuperación de la
   * cuenta, que es justo la clase de movimiento que un secuestro
   * necesita. Y solo si el proveedor lo da por verificado — un correo sin
   * verificar es una afirmación, no un hecho (§ `entrar`).
   */
  if (!usuario.email && identidad.email && identidad.emailVerificado) {
    const correo = identidad.email.toLowerCase();
    // El `email` es @unique: si ya es de otra cuenta, no se toca nada. El
    // vínculo en sí ya quedó hecho arriba, que es lo que se pidió; el
    // correo es un extra que no debe hacer fracasar la vinculación.
    const ocupado = await prisma.user.findUnique({ where: { email: correo }, select: { id: true } });
    if (!ocupado) {
      await prisma.user
        .update({ where: { id: userId }, data: { email: correo, emailVerified: true } })
        .catch((error) => {
          // Carrera: alguien registró ese correo entre la consulta y el
          // update. El vínculo es válido igualmente, así que no se rompe.
          logger.warn({ error, userId, proveedor }, 'No se pudo adoptar el correo al vincular');
        });
    } else if (ocupado.id !== userId) {
      logger.info({ userId, proveedor }, 'El correo del proveedor ya es de otra cuenta: no se adopta');
    }
  }

  await auditar(userId, 'vinculacion', { proveedor }, req);
  logger.info({ userId, proveedor }, 'Cuenta vinculada');
  volver(res, '/configuracion', 'vinculado', proveedor);
}

// ─────────────────────────────────────────────────────────────────────
//  Auditoría
// ─────────────────────────────────────────────────────────────────────
/** Registra un evento sensible. Las IPs van hasheadas (§ schema AuditLog):
 *  sirve para investigar un incidente sin ser un registro de ubicación. */
async function auditar(
  userId: string,
  accion: string,
  detalle: Record<string, unknown>,
  req: Request
): Promise<void> {
  await prisma.auditLog
    .create({
      data: {
        userId,
        accion,
        detalle: detalle as never,
        ipHash: hashIp(req.ip),
        userAgent: req.get('user-agent')?.slice(0, 300) ?? null,
      },
    })
    .catch((error) => {
      // Un fallo al auditar no puede tumbar un login que ya es válido.
      logger.error({ error, accion }, 'No se pudo escribir el registro de auditoría');
    });
}

export { auditar };
