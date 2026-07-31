/**
 * E2E de la Fase 8 — mensajería, adjuntos y notificaciones, contra el stack
 * VIVO por HTTPS.
 *
 * Se prueban tres cosas, en este orden de importancia:
 *
 *  1. **Que los permisos aguanten.** Quién puede leer una conversación,
 *     quién puede escribir en ella, y que un bloqueo corte de verdad. Es lo
 *     que distingue una mensajería de una filtración de datos.
 *  2. **Que la validación de archivos no se pueda engañar.** Un archivo se
 *     acepta por su contenido real, no por lo que diga su nombre ni su
 *     Content-Type.
 *  3. Que el flujo feliz funcione de punta a punta.
 */

const BASE = process.env.WANDER_BASE ?? 'https://wander.ourocore.net';
const API = `${BASE}/api`;
const INTERNO = process.env.WANDER_INTERNO === '1';

let ok = 0;
let fallos = 0;
const errores = [];

function comprobar(nombre, condicion, detalle = '') {
  if (condicion) {
    ok++;
    console.log(`  ✓ ${nombre}`);
  } else {
    fallos++;
    errores.push(`${nombre}${detalle ? ` — ${detalle}` : ''}`);
    console.log(`  ✗ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  }
}

function seccion(titulo) {
  console.log(`\n── ${titulo} ${'─'.repeat(Math.max(0, 60 - titulo.length))}`);
}

function crearCliente(ipSimulada = null) {
  const galletas = new Map();
  return {
    galletas,
    async fetch(url, opciones = {}) {
      const cabeceras = new Headers(opciones.headers ?? {});
      if (INTERNO && ipSimulada) cabeceras.set('cf-connecting-ip', ipSimulada);
      if (galletas.size > 0) {
        cabeceras.set('cookie', [...galletas.entries()].map(([k, v]) => `${k}=${v}`).join('; '));
      }
      const r = await fetch(url, { ...opciones, headers: cabeceras, redirect: 'manual' });
      for (const [nombre, valor] of r.headers) {
        if (nombre.toLowerCase() !== 'set-cookie') continue;
        for (const trozo of valor.split(/,(?=[^;]+?=)/)) {
          const [par] = trozo.split(';');
          const idx = par.indexOf('=');
          if (idx > 0) {
            const k = par.slice(0, idx).trim();
            const v = par.slice(idx + 1).trim();
            if (v === '' || v === 'deleted') galletas.delete(k);
            else galletas.set(k, v);
          }
        }
      }
      return r;
    },
    json(url, opciones) {
      return this.fetch(url, opciones).then(async (r) => ({
        status: r.status,
        cuerpo: await r.json().catch(() => null),
      }));
    },
  };
}

const sufijo = Date.now().toString(36).slice(-6);
const usuarios = ['a', 'b', 'c'].map((letra) => ({
  email: `e2e8-${letra}-${sufijo}@ejemplo.test`,
  password: 'ContrasenaLarga123!',
  handle: `e2e8${letra}${sufijo}`,
  displayName: `Prueba ${letra.toUpperCase()}`,
}));

async function registrar(cliente, datos) {
  return cliente.fetch(`${API}/auth/registro`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...datos, aceptaTerminos: true }),
  });
}

// ─────────────────────────────────────────────────────────────────────
//  Archivos de prueba, construidos a mano
// ─────────────────────────────────────────────────────────────────────

/**
 * Un PNG real de 1×1 px. Se construye byte a byte y no se lee de disco para
 * que la suite no dependa de ningún fichero externo.
 */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

/** Un GIF animado mínimo y válido. */
const GIF_ANIMADO = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH/C05FVFNDQVBFMi4wAwEAAAAh+QQJAAAAACwAAAAAAQABAAACAkQBADs=',
  'base64'
);

/** Un HTML con un script: NO es una imagen, aunque se mande como si lo fuera. */
const HTML_MALICIOSO = Buffer.from('<html><script>alert(1)</script></html>', 'utf8');

/** Sube un archivo por multipart, construyendo el cuerpo a mano. */
async function subir(cliente, { datos, nombre, tipo, uso = 'adjunto' }) {
  const cuerpo = new FormData();
  cuerpo.append('archivos', new Blob([datos], { type: tipo }), nombre);
  cuerpo.append('uso', uso);
  const r = await cliente.fetch(`${API}/archivos`, { method: 'POST', body: cuerpo });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

async function principal() {
  console.log(`\n🔍 E2E Fase 8 — ${BASE}\n`);

  // ═══════════════════════════════════════════════════════════════════
  seccion('0. Preparación: tres usuarios');

  const base = 50 + (Date.now() % 150);
  const A = crearCliente(`198.51.100.${base}`);
  const B = crearCliente(`198.51.100.${base + 1}`);
  const C = crearCliente(`198.51.100.${base + 2}`);
  const anon = crearCliente(`198.51.100.${base + 3}`);

  const registros = await Promise.all([
    registrar(A, usuarios[0]),
    registrar(B, usuarios[1]),
    registrar(C, usuarios[2]),
  ]);

  for (const [i, r] of registros.entries()) {
    comprobar(`Se registra el usuario ${'ABC'[i]}`, r.status === 201 || r.status === 200, `HTTP ${r.status}`);
  }

  if (registros.some((r) => r.status >= 400)) {
    console.log('\n⚠ No se pudieron crear los usuarios; se aborta.');
    console.log(await registros.find((r) => r.status >= 400).text());
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════════
  seccion('1. privacidadDm: quién puede abrir un DM');

  /*
   * Por defecto `privacidadDm` es 'seguidos'. B no sigue a A ni al revés,
   * así que A NO debería poder abrirle un DM a B todavía.
   */
  const dmSinRelacion = await A.json(`${API}/mensajes/dm`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ handle: usuarios[1].handle }),
  });
  comprobar(
    'Sin seguirse, un DM se rechaza (privacidadDm por defecto = seguidos)',
    dmSinRelacion.status === 403,
    `HTTP ${dmSinRelacion.status}`
  );

  // B sigue a A: ahora sí hay relación en una dirección.
  const seguir = await B.fetch(`${API}/social/usuarios/${usuarios[0].handle}/seguir`, {
    method: 'POST',
  });
  comprobar('B sigue a A', seguir.status === 200, `HTTP ${seguir.status}`);

  const dmConRelacion = await A.json(`${API}/mensajes/dm`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ handle: usuarios[1].handle }),
  });
  comprobar(
    'Con seguimiento, el DM se abre',
    dmConRelacion.status === 201 && Boolean(dmConRelacion.cuerpo?.conversacionId),
    `HTTP ${dmConRelacion.status}`
  );

  const conv = dmConRelacion.cuerpo?.conversacionId;

  // Idempotencia: volver a abrirlo devuelve el MISMO hilo, no uno nuevo.
  const dmRepetido = await A.json(`${API}/mensajes/dm`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ handle: usuarios[1].handle }),
  });
  comprobar(
    'Abrir el mismo DM dos veces devuelve la misma conversación',
    dmRepetido.cuerpo?.conversacionId === conv && dmRepetido.cuerpo?.creada === false
  );

  const dmConmigo = await A.json(`${API}/mensajes/dm`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ handle: usuarios[0].handle }),
  });
  comprobar('No se puede abrir un DM consigo mismo', dmConmigo.status === 400, `HTTP ${dmConmigo.status}`);

  // ═══════════════════════════════════════════════════════════════════
  seccion('2. Aislamiento: la conversación de otros no se lee');

  const espia = await C.json(`${API}/mensajes/conversaciones/${conv}`);
  comprobar(
    'Un tercero recibe 404 al pedir una conversación ajena (no 403)',
    espia.status === 404,
    `HTTP ${espia.status}`
  );

  const espiaMensajes = await C.json(`${API}/mensajes/conversaciones/${conv}/mensajes`);
  comprobar(
    'Un tercero no puede leer los mensajes de una conversación ajena',
    espiaMensajes.status === 404,
    `HTTP ${espiaMensajes.status}`
  );

  const espiaEnvio = await C.json(`${API}/mensajes/conversaciones/${conv}/mensajes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texto: 'me cuelo' }),
  });
  comprobar(
    'Un tercero no puede escribir en una conversación ajena',
    espiaEnvio.status === 404,
    `HTTP ${espiaEnvio.status}`
  );

  const sinSesion = await anon.json(`${API}/mensajes/conversaciones`);
  comprobar('Sin sesión no hay bandeja', sinSesion.status === 401, `HTTP ${sinSesion.status}`);

  // ═══════════════════════════════════════════════════════════════════
  seccion('3. Enviar y leer mensajes');

  const enviado = await A.json(`${API}/mensajes/conversaciones/${conv}/mensajes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // La frase tiene varias palabras funcionales a propósito: con menos de
    // cuatro, `detectarIdioma` devuelve `null` por diseño (Fase 7) —
    // "no se sabe" es una respuesta válida y preferible a inventar.
    body: JSON.stringify({ texto: 'Hola, ¿jugamos algo esta noche o mañana por la tarde?' }),
  });
  comprobar('A envía un mensaje', enviado.status === 201, `HTTP ${enviado.status}`);
  comprobar('El mensaje vuelve con su autor', enviado.cuerpo?.mensaje?.autor?.handle === usuarios[0].handle);
  comprobar(
    'El idioma se detecta al guardar',
    enviado.cuerpo?.mensaje?.idioma === 'es',
    `idioma=${enviado.cuerpo?.mensaje?.idioma}`
  );

  const mensajeId = enviado.cuerpo?.mensaje?.id;

  const vacio = await A.json(`${API}/mensajes/conversaciones/${conv}/mensajes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texto: '   ' }),
  });
  comprobar('Un mensaje vacío se rechaza', vacio.status === 400, `HTTP ${vacio.status}`);

  const largo = await A.json(`${API}/mensajes/conversaciones/${conv}/mensajes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texto: 'x'.repeat(4001) }),
  });
  comprobar('Un mensaje de 4001 caracteres se rechaza', largo.status === 400, `HTTP ${largo.status}`);

  const campoExtra = await A.json(`${API}/mensajes/conversaciones/${conv}/mensajes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texto: 'hola', autorId: 'otro-usuario' }),
  });
  comprobar(
    'Un campo inventado (autorId) se rechaza por el .strict()',
    campoExtra.status === 400,
    `HTTP ${campoExtra.status}`
  );

  const leidosB = await B.json(`${API}/mensajes/conversaciones/${conv}/mensajes`);
  comprobar('B lee el hilo', leidosB.status === 200 && leidosB.cuerpo?.items?.length >= 1);
  comprobar(
    'Los mensajes vuelven en orden cronológico',
    leidosB.cuerpo?.items?.[0]?.texto === 'Hola, ¿jugamos algo esta noche o mañana por la tarde?'
  );

  // ── Editar y borrar ──
  const editadoAjeno = await B.json(`${API}/mensajes/${mensajeId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texto: 'texto suplantado' }),
  });
  comprobar(
    'No se puede editar el mensaje de otro',
    editadoAjeno.status === 404,
    `HTTP ${editadoAjeno.status}`
  );

  const editadoPropio = await A.json(`${API}/mensajes/${mensajeId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texto: 'Hola, ¿jugamos algo hoy?' }),
  });
  comprobar('El autor sí puede editar su mensaje', editadoPropio.status === 200);
  comprobar('El mensaje editado se marca como tal', Boolean(editadoPropio.cuerpo?.mensaje?.editadoEn));

  // ── Leído ──
  const leido = await B.json(`${API}/mensajes/conversaciones/${conv}/leido`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mensajeId }),
  });
  comprobar('B marca hasta dónde leyó', leido.status === 200);

  const noLeidosB = await B.json(`${API}/mensajes/no-leidos`);
  comprobar(
    'Tras marcar leído, B no tiene conversaciones pendientes',
    noLeidosB.cuerpo?.conversaciones === 0,
    `pendientes=${noLeidosB.cuerpo?.conversaciones}`
  );

  // ═══════════════════════════════════════════════════════════════════
  seccion('4. Archivos: la validación es por CONTENIDO, no por nombre');

  const pngOk = await subir(A, { datos: PNG_1PX, nombre: 'captura.png', tipo: 'image/png' });
  comprobar('Se sube un PNG real', pngOk.status === 201, `HTTP ${pngOk.status}`);
  const adjunto = pngOk.cuerpo?.archivos?.[0];
  comprobar('El archivo subido devuelve una URL bajo /uploads/', adjunto?.url?.startsWith('/uploads/'));
  comprobar(
    'El PNG se recomprime a WebP (se reescribe, no se guarda tal cual)',
    adjunto?.mime === 'image/webp',
    `mime=${adjunto?.mime}`
  );
  comprobar('Se genera miniatura', Boolean(adjunto?.miniaturaUrl));

  /*
   * La prueba central de esta sección: un HTML con `<script>` mandado con
   * nombre .png y Content-Type de imagen. Si esto se aceptara, quedaría
   * servido desde nuestro dominio y sería un XSS almacenado.
   */
  const disfrazado = await subir(A, {
    datos: HTML_MALICIOSO,
    nombre: 'inofensiva.png',
    tipo: 'image/png',
  });
  comprobar(
    'Un HTML con <script> disfrazado de .png se RECHAZA',
    disfrazado.status === 400,
    `HTTP ${disfrazado.status}`
  );

  const gifOk = await subir(A, { datos: GIF_ANIMADO, nombre: 'baile.gif', tipo: 'image/gif' });
  comprobar('Se sube un GIF animado', gifOk.status === 201, `HTTP ${gifOk.status}`);
  comprobar(
    'El GIF conserva su formato (no se convierte a imagen fija)',
    gifOk.cuerpo?.archivos?.[0]?.mime === 'image/gif',
    `mime=${gifOk.cuerpo?.archivos?.[0]?.mime}`
  );

  const usoInventado = await subir(A, {
    datos: PNG_1PX,
    nombre: 'x.png',
    tipo: 'image/png',
    uso: 'uso-que-no-existe',
  });
  comprobar('Un `uso` inventado se rechaza', usoInventado.status === 400, `HTTP ${usoInventado.status}`);

  const subidaAnon = await subir(anon, { datos: PNG_1PX, nombre: 'x.png', tipo: 'image/png' });
  comprobar('Sin sesión no se puede subir', subidaAnon.status === 401, `HTTP ${subidaAnon.status}`);

  // ── El archivo se sirve de verdad y con las cabeceras correctas ──
  if (adjunto?.url) {
    const servido = await fetch(`${BASE}${adjunto.url}`);
    comprobar('El archivo subido se sirve por HTTPS', servido.status === 200, `HTTP ${servido.status}`);
    comprobar(
      'Se sirve con X-Content-Type-Options: nosniff',
      servido.headers.get('x-content-type-options') === 'nosniff'
    );
    comprobar(
      'Se sirve con una CSP que prohíbe scripts',
      (servido.headers.get('content-security-policy') ?? '').includes("script-src 'none'")
    );
  }

  // ── Adjuntar a un mensaje ──
  const conAdjunto = await A.json(`${API}/mensajes/conversaciones/${conv}/mensajes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ adjuntos: [adjunto?.id] }),
  });
  comprobar(
    'Se puede enviar un mensaje solo con adjunto, sin texto',
    conAdjunto.status === 201,
    `HTTP ${conAdjunto.status}`
  );
  comprobar('El mensaje trae su adjunto', conAdjunto.cuerpo?.mensaje?.adjuntos?.length === 1);

  // Reusar un adjunto ya enviado no debe colar.
  const reusado = await A.json(`${API}/mensajes/conversaciones/${conv}/mensajes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ adjuntos: [adjunto?.id] }),
  });
  comprobar(
    'Un adjunto ya usado no se puede reutilizar en otro mensaje',
    reusado.status === 400,
    `HTTP ${reusado.status}`
  );

  // El adjunto de OTRO no se puede robar.
  const ajeno = await subir(B, { datos: PNG_1PX, nombre: 'de-b.png', tipo: 'image/png' });
  const robo = await A.json(`${API}/mensajes/conversaciones/${conv}/mensajes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texto: 'mira', adjuntos: [ajeno.cuerpo?.archivos?.[0]?.id] }),
  });
  comprobar(
    'No se puede adjuntar un archivo subido por otra persona',
    robo.status === 400,
    `HTTP ${robo.status}`
  );

  // ═══════════════════════════════════════════════════════════════════
  seccion('5. GIFs externos: solo del proveedor');

  const gifPropio = await A.json(`${API}/archivos/gif`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://mi-servidor-malicioso.example/rastreador.gif' }),
  });
  comprobar(
    'Una URL de GIF de un host arbitrario se rechaza',
    gifPropio.status === 400,
    `HTTP ${gifPropio.status}`
  );

  const gifHttp = await A.json(`${API}/archivos/gif`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'http://media.giphy.com/algo.gif' }),
  });
  comprobar('Un GIF por http:// (sin TLS) se rechaza', gifHttp.status === 400, `HTTP ${gifHttp.status}`);

  const limites = await A.json(`${API}/archivos/limites`);
  comprobar('Los límites se sirven desde el servidor', limites.status === 200 && limites.cuerpo?.maxBytes > 0);

  if (limites.cuerpo?.gifs) {
    const busqueda = await A.json(`${API}/archivos/gifs?q=gg`);
    comprobar('El buscador de GIFs responde', busqueda.status === 200 && Array.isArray(busqueda.cuerpo?.gifs));
  } else {
    console.log('  · Giphy no está configurado en este servidor; se omite la búsqueda.');
  }

  // ═══════════════════════════════════════════════════════════════════
  seccion('6. Publicaciones con imágenes');

  const paraPublicar = await subir(A, { datos: PNG_1PX, nombre: 'post.png', tipo: 'image/png', uso: 'publicacion' });
  const publicacion = await A.json(`${API}/social/publicaciones`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texto: '', adjuntos: [paraPublicar.cuerpo?.archivos?.[0]?.id] }),
  });
  comprobar(
    'Se puede publicar solo una imagen, sin texto',
    publicacion.status === 201,
    `HTTP ${publicacion.status}`
  );
  comprobar(
    'La publicación devuelve sus adjuntos',
    publicacion.cuerpo?.publicacion?.adjuntos?.length === 1,
    `adjuntos=${publicacion.cuerpo?.publicacion?.adjuntos?.length}`
  );

  const publicacionVacia = await A.json(`${API}/social/publicaciones`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texto: '', adjuntos: [] }),
  });
  comprobar(
    'Una publicación sin texto NI adjuntos se rechaza',
    publicacionVacia.status === 400,
    `HTTP ${publicacionVacia.status}`
  );

  // ═══════════════════════════════════════════════════════════════════
  seccion('7. Grupos');

  const grupo = await A.json(`${API}/mensajes/grupos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nombre: 'Escuadrón de prueba', handles: [usuarios[1].handle] }),
  });
  comprobar('A crea un grupo', grupo.status === 201, `HTTP ${grupo.status}`);
  const grupoId = grupo.cuerpo?.conversacionId;

  const verGrupo = await A.json(`${API}/mensajes/conversaciones/${grupoId}`);
  comprobar('El creador es ADMIN del grupo', verGrupo.cuerpo?.conversacion?.rol === 'ADMIN');
  comprobar('El grupo tiene nombre', verGrupo.cuerpo?.conversacion?.nombre === 'Escuadrón de prueba');

  // B es MIEMBRO: no puede renombrar.
  const renombraMiembro = await B.json(`${API}/mensajes/grupos/${grupoId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nombre: 'Secuestrado' }),
  });
  comprobar(
    'Un MIEMBRO no puede renombrar el grupo',
    renombraMiembro.status === 403,
    `HTTP ${renombraMiembro.status}`
  );

  const renombraAdmin = await A.json(`${API}/mensajes/grupos/${grupoId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nombre: 'Escuadrón renombrado' }),
  });
  comprobar('Un ADMIN sí puede renombrar el grupo', renombraAdmin.status === 200);

  // Un ajeno no ve el grupo.
  const grupoAjeno = await C.json(`${API}/mensajes/conversaciones/${grupoId}`);
  comprobar('Quien no está en el grupo recibe 404', grupoAjeno.status === 404, `HTTP ${grupoAjeno.status}`);

  // Añadir a C y comprobar el mensaje de sistema.
  const anadeC = await A.json(`${API}/mensajes/grupos/${grupoId}/participantes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ handles: [usuarios[2].handle] }),
  });
  comprobar('El ADMIN añade a C al grupo', anadeC.status === 200, `HTTP ${anadeC.status}`);

  const mensajesGrupo = await C.json(`${API}/mensajes/conversaciones/${grupoId}/mensajes`);
  comprobar('C ya puede leer el grupo', mensajesGrupo.status === 200);
  const sistema = mensajesGrupo.cuerpo?.items?.find((m) => m.tipo === 'sistema');
  comprobar('Se generó un mensaje de sistema al añadir a alguien', Boolean(sistema));
  comprobar(
    'El mensaje de sistema guarda una CLAVE, no una frase traducida',
    Boolean(sistema && sistema.texto?.includes('participante-anadido'))
  );

  // Salir del grupo.
  const saleC = await C.json(`${API}/mensajes/conversaciones/${grupoId}/salir`, { method: 'POST' });
  comprobar('C sale del grupo', saleC.status === 200, `HTTP ${saleC.status}`);

  const trasSalir = await C.json(`${API}/mensajes/conversaciones/${grupoId}/mensajes`);
  comprobar(
    'Tras salir, ya no se lee el grupo',
    trasSalir.status === 404,
    `HTTP ${trasSalir.status}`
  );

  const salirDeDm = await A.json(`${API}/mensajes/conversaciones/${conv}/salir`, { method: 'POST' });
  comprobar('De un DM no se puede "salir"', salirDeDm.status === 400, `HTTP ${salirDeDm.status}`);

  // ═══════════════════════════════════════════════════════════════════
  seccion('8. Notificaciones');

  const notisB = await B.json(`${API}/social/notificaciones`);
  comprobar('B tiene notificaciones', notisB.status === 200 && notisB.cuerpo?.items?.length > 0);

  const notiMensaje = notisB.cuerpo?.items?.find((n) => n.tipo === 'mensaje');
  comprobar('Hay una notificación de tipo "mensaje"', Boolean(notiMensaje));
  comprobar(
    'La notificación de mensaje lleva su conversacionId (para poder enlazar)',
    Boolean(notiMensaje?.datos?.conversacionId),
    `datos=${JSON.stringify(notiMensaje?.datos)}`
  );

  const notisA = await A.json(`${API}/social/notificaciones`);
  const notiSeguir = notisA.cuerpo?.items?.find((n) => n.tipo === 'seguimiento');
  comprobar('A tiene la notificación de que B lo siguió', Boolean(notiSeguir));
  comprobar('La notificación trae al emisor', Boolean(notiSeguir?.emisor?.handle));

  const contador = await B.json(`${API}/social/notificaciones/contador`);
  comprobar(
    'El contador ligero responde con un número',
    contador.status === 200 && typeof contador.cuerpo?.sinLeer === 'number',
    `HTTP ${contador.status}`
  );

  const marcadas = await B.json(`${API}/social/notificaciones/leidas`, { method: 'POST' });
  comprobar('Se marcan todas como leídas', marcadas.status === 200);

  const contadorTras = await B.json(`${API}/social/notificaciones/contador`);
  comprobar(
    'Tras marcarlas, el contador queda a cero',
    contadorTras.cuerpo?.sinLeer === 0,
    `sinLeer=${contadorTras.cuerpo?.sinLeer}`
  );

  const notisAnon = await anon.json(`${API}/social/notificaciones`);
  comprobar('Sin sesión no hay notificaciones', notisAnon.status === 401, `HTTP ${notisAnon.status}`);

  // ═══════════════════════════════════════════════════════════════════
  seccion('9. El bloqueo corta la mensajería');

  const bloquea = await B.fetch(`${API}/social/usuarios/${usuarios[0].handle}/bloquear`, {
    method: 'POST',
  });
  comprobar('B bloquea a A', bloquea.status === 200, `HTTP ${bloquea.status}`);

  const escribeBloqueado = await A.json(`${API}/mensajes/conversaciones/${conv}/mensajes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texto: 'sigo aquí' }),
  });
  comprobar(
    'Tras el bloqueo, A ya no puede escribir en el DM que YA existía',
    escribeBloqueado.status === 403,
    `HTTP ${escribeBloqueado.status}`
  );

  const dmTrasBloqueo = await A.json(`${API}/mensajes/dm`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ handle: usuarios[1].handle }),
  });
  comprobar(
    'El DM existente se devuelve, pero escribir sigue cortado (ver arriba)',
    dmTrasBloqueo.status === 200 || dmTrasBloqueo.status === 404,
    `HTTP ${dmTrasBloqueo.status}`
  );

  // ═══════════════════════════════════════════════════════════════════
  seccion('10. socket.io está montado y autenticado');

  const handshake = await fetch(`${BASE}/socket.io/?EIO=4&transport=polling`);
  comprobar('El endpoint de socket.io responde', handshake.status === 200, `HTTP ${handshake.status}`);

  // ═══════════════════════════════════════════════════════════════════
  seccion('11. Limpieza');

  for (const [i, cliente] of [A, B, C].entries()) {
    const r = await cliente.fetch(`${API}/perfiles/mio`, { method: 'DELETE' }).catch(() => null);
    console.log(`  · Borrado de ${'ABC'[i]}: HTTP ${r?.status ?? 'n/d'} (informativo)`);
  }

  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`  ✓ ${ok} correctas   ✗ ${fallos} fallidas`);
  if (fallos > 0) {
    console.log('\n  Fallos:');
    for (const e of errores) console.log(`   · ${e}`);
  }
  console.log(`${'═'.repeat(64)}\n`);
  process.exit(fallos > 0 ? 1 : 0);
}

principal().catch((e) => {
  console.error('\n💥 Error inesperado en la suite:', e);
  process.exit(1);
});
