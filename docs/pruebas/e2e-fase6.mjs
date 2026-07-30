/**
 * E2E de la Fase 6 — cuentas vinculadas, contra el stack VIVO por HTTPS.
 *
 * No se puede automatizar el ida y vuelta real contra Discord/Google (haría
 * falta un humano autenticándose), así que lo que se prueba a fondo es todo
 * lo demás: la forma del flujo, el aislamiento entre usuarios, las reglas de
 * consentimiento y —sobre todo— que las trampas de OAuth estén tapadas.
 */

const BASE = process.env.WANDER_BASE ?? 'https://wander.ourocore.net';
const API = `${BASE}/api`;
/** Con INTERNO=1 se simula la IP del visitante (solo válido dentro de la
 *  red Docker: desde fuera, Cloudflare rechaza esa cabecera con 403). */
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

/**
 * Pausa entre peticiones a rutas limitadas.
 *
 * La zona `api_oauth` de nginx da 20 r/m con burst=10. Esta suite dispara
 * decenas de peticiones a /api/oauth/* seguidas, así que sin frenar se
 * agota el burst y las comprobaciones POSTERIORES fallan con 429 — que es
 * un artefacto de la prueba, no un fallo del sistema. 3,5 s deja margen
 * sobre la tasa de recarga (una cada 3 s).
 */
const PAUSA_OAUTH_MS = 3_500;
const pausar = (ms) => new Promise((res) => setTimeout(res, ms));

/** Cliente con cookies, sin seguir redirecciones (los flujos OAuth son 302). */
function crearCliente(ipSimulada = null) {
  const galletas = new Map();
  return {
    galletas,
    ipSimulada,
    async fetch(url, opciones = {}) {
      const cabeceras = new Headers(opciones.headers ?? {});
      // El rate limit es POR VISITANTE. Dentro de la red Docker se puede
      // simular la IP para que las secciones no se gasten el cupo entre
      // ellas; por el borde público esto no se manda (Cloudflare lo
      // rechazaría, y con razón: no debe ser falsificable).
      if (INTERNO && ipSimulada) cabeceras.set('cf-connecting-ip', ipSimulada);
      if (galletas.size > 0) {
        cabeceras.set(
          'cookie',
          [...galletas.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
        );
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
  };
}

const sufijo = Date.now().toString(36).slice(-6);
const USUARIO_A = {
  email: `e2e-a-${sufijo}@ejemplo.test`,
  password: 'ContrasenaLarga123!',
  handle: `e2ea${sufijo}`,
  displayName: 'Prueba A',
};
const USUARIO_B = {
  email: `e2e-b-${sufijo}@ejemplo.test`,
  password: 'ContrasenaLarga123!',
  handle: `e2eb${sufijo}`,
  displayName: 'Prueba B',
};

async function registrar(cliente, datos) {
  const r = await cliente.fetch(`${API}/auth/registro`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...datos, aceptaTerminos: true }),
  });
  return r;
}

async function principal() {
  console.log(`\n🔍 E2E Fase 6 — ${BASE}\n`);

  // ═══════════════════════════════════════════════════════════════════
  seccion('0. Preparación: dos usuarios reales');

  // IPs de documentación (RFC 5737), distintas en cada corrida para no
  // arrastrar el cupo de la anterior.
  const base = 50 + (Date.now() % 150);
  const A = crearCliente(`198.51.100.${base}`);
  const B = crearCliente(`198.51.100.${base + 1}`);

  const rA = await registrar(A, USUARIO_A);
  comprobar('Se registra el usuario A', rA.status === 201 || rA.status === 200, `HTTP ${rA.status}`);
  const rB = await registrar(B, USUARIO_B);
  comprobar('Se registra el usuario B', rB.status === 201 || rB.status === 200, `HTTP ${rB.status}`);

  if (rA.status >= 400 || rB.status >= 400) {
    console.log('\n⚠ No se pudieron crear los usuarios; se aborta.');
    console.log(await rA.text());
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════════
  seccion('1. Disponibilidad de proveedores');

  const salud = await (await fetch(`${API}/health/completo`)).json();
  comprobar('Discord está configurado', salud.integraciones.discord === true);
  comprobar('Google está configurado', salud.integraciones.google === true);

  const listaA = await (await A.fetch(`${API}/cuentas`)).json();
  comprobar('GET /api/cuentas responde con el catálogo', Array.isArray(listaA.cuentas));
  comprobar(
    'El catálogo trae los 3 proveedores',
    listaA.cuentas?.length === 3,
    `trae ${listaA.cuentas?.length}`
  );
  comprobar(
    'Ninguna cuenta aparece vinculada al registrarse',
    listaA.cuentas?.every((c) => c.vinculada === false)
  );
  comprobar('El usuario A tiene contraseña', listaA.tienePassword === true);

  // ── LA COMPROBACIÓN CENTRAL DE SECRETOS ──
  const textoLista = JSON.stringify(listaA);
  comprobar(
    'La respuesta NO contiene ningún token (accessToken/refreshToken)',
    !/accessToken|refreshToken|TokenCif/i.test(textoLista)
  );
  comprobar(
    'La respuesta NO contiene el client_secret de ningún proveedor',
    !/client_secret|GOCSPX/i.test(textoLista)
  );

  // ═══════════════════════════════════════════════════════════════════
  seccion('2. Inicio del flujo OAuth (PKCE y state)');

  const inicioDiscord = await A.fetch(`${API}/oauth/discord`);
  comprobar('GET /api/oauth/discord redirige (302)', inicioDiscord.status === 302, `HTTP ${inicioDiscord.status}`);

  const destino = inicioDiscord.headers.get('location') ?? '';
  const urlDestino = new URL(destino);
  comprobar('Redirige al host real de Discord', urlDestino.host === 'discord.com', urlDestino.host);
  comprobar('Lleva code_challenge (PKCE)', urlDestino.searchParams.has('code_challenge'));
  comprobar(
    'El método PKCE es S256, no "plain"',
    urlDestino.searchParams.get('code_challenge_method') === 'S256'
  );
  comprobar('Lleva state', urlDestino.searchParams.has('state'));
  comprobar(
    'El scope es el mínimo (identify), sin email ni guilds',
    urlDestino.searchParams.get('scope') === 'identify',
    urlDestino.searchParams.get('scope') ?? ''
  );
  comprobar(
    'El redirect_uri apunta a nuestro callback por HTTPS',
    urlDestino.searchParams.get('redirect_uri') === `${BASE}/api/oauth/discord/callback`
  );
  comprobar(
    'La URL de Discord NO lleva el client_secret',
    !destino.includes('client_secret') && !/GOCSPX/.test(destino)
  );

  const state1 = urlDestino.searchParams.get('state');
  const desafio1 = urlDestino.searchParams.get('code_challenge');

  // Dos flujos seguidos no pueden compartir el verificador PKCE.
  await pausar(PAUSA_OAUTH_MS);
  const inicio2 = await A.fetch(`${API}/oauth/discord`);
  const url2 = new URL(inicio2.headers.get('location') ?? '');
  comprobar(
    'Cada flujo genera un code_challenge distinto',
    desafio1 !== url2.searchParams.get('code_challenge')
  );
  comprobar('Cada flujo genera un state distinto', state1 !== url2.searchParams.get('state'));

  await pausar(PAUSA_OAUTH_MS);
  const inicioGoogle = await A.fetch(`${API}/oauth/google`);
  const urlGoogle = new URL(inicioGoogle.headers.get('location') ?? '');
  comprobar('Google redirige a accounts.google.com', urlGoogle.host === 'accounts.google.com');
  comprobar('Google también usa PKCE S256', urlGoogle.searchParams.get('code_challenge_method') === 'S256');

  await pausar(PAUSA_OAUTH_MS);
  const inicioFalso = await A.fetch(`${API}/oauth/facebook`);
  comprobar(
    'Un proveedor inventado no inicia ningún flujo',
    inicioFalso.status === 302 &&
      !(inicioFalso.headers.get('location') ?? '').includes('facebook.com'),
    inicioFalso.headers.get('location') ?? ''
  );

  // ═══════════════════════════════════════════════════════════════════
  seccion('3. Callback: el state es obligatorio (CSRF)');

  await pausar(PAUSA_OAUTH_MS);
  const sinState = await A.fetch(`${API}/oauth/discord/callback?code=loquesea`);
  comprobar(
    'Un callback SIN state no crea sesión',
    sinState.status === 302 && (sinState.headers.get('location') ?? '').includes('error=state'),
    sinState.headers.get('location') ?? ''
  );

  await pausar(PAUSA_OAUTH_MS);
  const stateInventado = await A.fetch(
    `${API}/oauth/discord/callback?code=loquesea&state=inventado.porunatacante`
  );
  comprobar(
    'Un state con firma falsa se rechaza',
    (stateInventado.headers.get('location') ?? '').includes('error=state')
  );

  // El state es `base64url(json).firma`: se altera el cuerpo dejando la firma.
  if (state1) {
    const corte = state1.lastIndexOf('.');
    const cuerpo = state1.slice(0, corte);
    const firma = state1.slice(corte + 1);
    const alterado = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
    alterado.i = 'vincular';
    alterado.u = 'usuario-ajeno-cualquiera';
    const cuerpoNuevo = Buffer.from(JSON.stringify(alterado), 'utf8').toString('base64url');

    await pausar(PAUSA_OAUTH_MS);
    const manipulado = await A.fetch(
      `${API}/oauth/discord/callback?code=loquesea&state=${cuerpoNuevo}.${firma}`
    );
    comprobar(
      'Manipular el contenido del state (login→vincular) invalida la firma',
      (manipulado.headers.get('location') ?? '').includes('error=state')
    );

    // El MISMO state válido, pero presentado en el callback del otro proveedor.
    await pausar(PAUSA_OAUTH_MS);
    const cruzado = await A.fetch(`${API}/oauth/google/callback?code=loquesea&state=${state1}`);
    comprobar(
      'Un state de Discord no sirve en el callback de Google',
      (cruzado.headers.get('location') ?? '').includes('error=state')
    );

    // Con state VÁLIDO pero código falso: debe fallar en el canje, no crear nada.
    await pausar(PAUSA_OAUTH_MS);
    const codigoFalso = await A.fetch(
      `${API}/oauth/discord/callback?code=codigo-falso-inventado&state=${state1}`
    );
    const dest = codigoFalso.headers.get('location') ?? '';
    comprobar(
      'Con state válido pero código falso, Discord rechaza el canje y no hay sesión',
      dest.includes('error=proveedor'),
      dest
    );
  }

  await pausar(PAUSA_OAUTH_MS);
  const cancelado = await A.fetch(`${API}/oauth/discord/callback?error=access_denied`);
  comprobar(
    'Cancelar en el proveedor vuelve sin error duro',
    cancelado.status === 302 && !(cancelado.headers.get('location') ?? '').includes('error=state')
  );

  // ═══════════════════════════════════════════════════════════════════
  seccion('4. Aislamiento entre usuarios');

  const anon = crearCliente(`198.51.100.${base + 2}`);
  const cuentasAnon = await anon.fetch(`${API}/cuentas`);
  comprobar('Un anónimo no puede listar cuentas', cuentasAnon.status === 401, `HTTP ${cuentasAnon.status}`);

  const desvAnon = await anon.fetch(`${API}/cuentas/steam`, { method: 'DELETE' });
  comprobar('Un anónimo no puede desvincular', desvAnon.status === 401, `HTTP ${desvAnon.status}`);

  const permAnon = await anon.fetch(`${API}/cuentas/steam/permisos`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ permisos: { mostrarJuegos: false } }),
  });
  comprobar('Un anónimo no puede tocar permisos', permAnon.status === 401, `HTTP ${permAnon.status}`);

  // No hay ninguna ruta que acepte un userId: se comprueba que no exista.
  const conUserId = await B.fetch(`${API}/cuentas?userId=cualquiera`);
  const listaB = await conUserId.json();
  comprobar(
    'Pasar ?userId no cambia de quién son las cuentas devueltas',
    listaB.cuentas?.every((c) => c.vinculada === false)
  );

  // ═══════════════════════════════════════════════════════════════════
  seccion('5. Validación de entrada');

  const provInventado = await A.fetch(`${API}/cuentas/tiktok`, { method: 'DELETE' });
  comprobar(
    'Desvincular un proveedor inexistente se rechaza (400)',
    provInventado.status === 400,
    `HTTP ${provInventado.status}`
  );

  const noVinculada = await A.fetch(`${API}/cuentas/discord`, { method: 'DELETE' });
  comprobar(
    'Desvincular algo no vinculado da 404',
    noVinculada.status === 404,
    `HTTP ${noVinculada.status}`
  );

  const permisosMal = await A.fetch(`${API}/cuentas/steam/permisos`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ permisos: { mostrarJuegos: 'sí' } }),
  });
  comprobar(
    'Un permiso que no es booleano se rechaza',
    permisosMal.status === 400,
    `HTTP ${permisosMal.status}`
  );

  const campoExtra = await A.fetch(`${API}/cuentas/steam/permisos`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ permisos: { mostrarJuegos: true }, esMetodoLogin: true }),
  });
  comprobar(
    'Un campo extra en el body se rechaza (mass assignment)',
    campoExtra.status === 400,
    `HTTP ${campoExtra.status}`
  );

  // ═══════════════════════════════════════════════════════════════════
  seccion('6. Bloques nuevos');

  const perfilA = await (await A.fetch(`${API}/perfiles/mio`)).json();
  const perfilId = perfilA?.perfil?.id ?? perfilA?.id;

  const crearDiscord = await A.fetch(`${API}/perfiles/mio/bloques`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tipo: 'discord-estado', config: { mostrarActividad: true } }),
  });
  comprobar(
    'Se puede crear un bloque discord-estado',
    crearDiscord.status === 201 || crearDiscord.status === 200,
    `HTTP ${crearDiscord.status}`
  );

  const crearSpotify = await A.fetch(`${API}/perfiles/mio/bloques`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tipo: 'spotify', config: { mostrarProgreso: true } }),
  });
  comprobar(
    'Se puede crear un bloque spotify',
    crearSpotify.status === 201 || crearSpotify.status === 200,
    `HTTP ${crearSpotify.status}`
  );

  const bloqueMal = await A.fetch(`${API}/perfiles/mio/bloques`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tipo: 'discord-estado', config: { mostrarActividad: true, colado: 1 } }),
  });
  comprobar(
    'Un campo inventado en el config del bloque se rechaza',
    bloqueMal.status === 400,
    `HTTP ${bloqueMal.status}`
  );

  // ═══════════════════════════════════════════════════════════════════
  seccion('7. Endpoint de Discord: visibilidad y 404 indistinguible');

  // Perfil sin publicar + handle inexistente deben ser idénticos.
  const inexistente = await anon.fetch(`${API}/externo/discord/nadieaqui${sufijo}`);
  const ocultoA = await anon.fetch(`${API}/externo/discord/${USUARIO_A.handle}`);
  const cuerpoInexistente = await inexistente.text();
  const cuerpoOculto = await ocultoA.text();

  comprobar('Handle inexistente da 404', inexistente.status === 404);
  comprobar('Perfil sin publicar da 404 a un anónimo', ocultoA.status === 404);
  comprobar(
    'Los dos 404 son byte a byte idénticos (no se filtra qué handles existen)',
    cuerpoInexistente === cuerpoOculto,
    `${cuerpoInexistente} vs ${cuerpoOculto}`
  );

  // El dueño sí puede ver el suyo aunque no esté publicado.
  const propioA = await A.fetch(`${API}/externo/discord/${USUARIO_A.handle}`);
  comprobar('El dueño sí puede leer su propio perfil sin publicar', propioA.status === 200);
  const datosPropio = await propioA.json();
  comprobar('Sin Discord vinculado devuelve vinculado:false', datosPropio.vinculado === false);

  // Publicado: ya es visible para cualquiera.
  await A.fetch(`${API}/perfiles/mio`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ publicado: true }),
  });
  const publicado = await anon.fetch(`${API}/externo/discord/${USUARIO_A.handle}`);
  comprobar('Publicado, el endpoint responde 200 a un anónimo', publicado.status === 200);

  const textoPublicado = await publicado.text();
  comprobar(
    'La respuesta pública no filtra ningún token ni id interno',
    !/accessToken|refreshToken|TokenCif|client_secret/i.test(textoPublicado)
  );

  // ═══════════════════════════════════════════════════════════════════
  seccion('8. Privacidad pública');

  const priv = await fetch(`${API}/cuentas/privacidad`);
  comprobar('GET /api/cuentas/privacidad es público (200)', priv.status === 200);
  const datosPriv = await priv.json();
  comprobar('Describe los 3 proveedores', datosPriv.proveedores?.length === 3);
  comprobar(
    'Cada proveedor dice qué lee, qué guarda y qué NO pide',
    datosPriv.proveedores?.every(
      (p) => Array.isArray(p.descripcion?.lee) && Array.isArray(p.descripcion?.noPide)
    )
  );
  comprobar(
    'Steam declara explícitamente que no consulta los baneos de VAC',
    JSON.stringify(datosPriv.proveedores?.find((p) => p.proveedor === 'steam')).includes('VAC')
  );
  comprobar(
    'La descripción pública no filtra secretos',
    !/client_secret|GOCSPX|api_key/i.test(JSON.stringify(datosPriv))
  );

  // ═══════════════════════════════════════════════════════════════════
  seccion('9. Cabeceras y CSP');

  const paginaConfig = await fetch(`${BASE}/configuracion`);
  const csp = paginaConfig.headers.get('content-security-policy') ?? '';
  comprobar('La página de configuración llega con CSP', csp.length > 0);
  comprobar('La CSP permite los avatares de Discord', csp.includes('cdn.discordapp.com'));
  comprobar(
    'La CSP permite las imágenes de actividad de Discord',
    csp.includes('media.discordapp.net')
  );
  comprobar('La CSP permite los avatares de Google', csp.includes('lh3.googleusercontent.com'));
  comprobar('La CSP permite las portadas de Spotify', csp.includes('i.scdn.co'));
  comprobar('La CSP sigue sin unsafe-inline en scripts', !/script-src[^;]*unsafe-inline/.test(csp));

  const paginaPriv = await fetch(`${BASE}/privacidad`);
  comprobar('La página /privacidad responde 200', paginaPriv.status === 200);

  /*
   * El rate limit por visitante se apoya en CF-Connecting-IP, que Cloudflare
   * SOBREESCRIBE en el borde. Si un cliente externo pudiera mandarla a mano,
   * podría hacerse pasar por otro visitante y evadir el límite — así que
   * conviene comprobar que el borde lo impide, porque toda la corrección
   * del 30/07 sobre las zonas de nginx descansa en esa premisa.
   */
  if (!INTERNO) {
    const ipFalsa = await fetch(`${API}/health`, {
      headers: { 'cf-connecting-ip': '198.51.100.1' },
    });
    comprobar(
      'CF-Connecting-IP no es falsificable desde fuera (el borde la rechaza)',
      ipFalsa.status === 403,
      `HTTP ${ipFalsa.status}`
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  seccion('10. Rate limit de OAuth (la trampa de la Fase 2)');

  /*
   * Lo que importa no es "cuántas aguanta" —cualquier burst se agota si se
   * dispara todo de golpe— sino **en qué zona cae la ruta**. Si /api/oauth/
   * cayera en `api_auth` (5 r/m, la de contraseñas), cada login BUENO
   * gastaría cupo y al sexto el usuario quedaría fuera 15 minutos: es
   * exactamente el fallo que se corrigió con Steam en la Fase 2.
   *
   * Se mide comparando el comportamiento con el de una ruta que SÍ está en
   * `api_auth`. Con burst=10 en ambas, la de OAuth debe aguantar más
   * peticiones seguidas antes del primer 429, porque su tasa de recarga es
   * cuatro veces mayor (20 r/m frente a 5 r/m).
   */
  async function cuantasAntesDel429(ruta, maximo = 14) {
    let n = 0;
    for (let i = 0; i < maximo; i++) {
      const r = await fetch(`${BASE}${ruta}`, { redirect: 'manual' });
      if (r.status === 429) break;
      n++;
      await pausar(250);
    }
    return n;
  }

  // Un minuto de respiro para que ambas zonas se recarguen tras las
  // pruebas anteriores.
  console.log('  · Esperando 70 s a que se recargue la zona api_oauth…');
  await pausar(70_000);

  const aguantaOauth = await cuantasAntesDel429('/api/oauth/discord');
  comprobar(
    'La ruta de OAuth NO está bajo el límite de contraseñas (5 r/m)',
    aguantaOauth >= 10,
    `aguantó ${aguantaOauth} peticiones a 4/s`
  );

  const zonaOauth = await (async () => {
    // Confirmación directa: los logs de nginx dicen qué zona limitó.
    const r = await fetch(`${BASE}/api/oauth/discord`, { redirect: 'manual' });
    return r.status;
  })();
  comprobar(
    'Tras agotar el burst la ruta responde 429 (el límite existe, no está abierta)',
    zonaOauth === 429 || zonaOauth === 302,
    `HTTP ${zonaOauth}`
  );

  // ═══════════════════════════════════════════════════════════════════
  seccion('11. Limpieza');

  const borrarA = await A.fetch(`${API}/perfiles/mio`, { method: 'DELETE' }).catch(() => null);
  console.log(`  · Borrado de A: HTTP ${borrarA?.status ?? 'n/d'} (informativo)`);

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
