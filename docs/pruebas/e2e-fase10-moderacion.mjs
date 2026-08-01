/**
 * Verificación de la moderación (Fase 10) contra el stack vivo.
 *
 * El modelo `Reporte` existía desde la migración inicial pero no lo tocaba
 * ninguna ruta: no había forma de reportar ni de revisar. Esta suite
 * comprueba las dos mitades y, sobre todo, **los límites de poder**: que un
 * moderador no pueda actuar hacia arriba ni sobre sí mismo, y que quien no
 * modera no vea nada.
 *
 * ── Cómo correrla ──────────────────────────────────────────────────
 *
 *   node docs/pruebas/e2e-fase10-moderacion.mjs
 *
 * Crea sus propias cuentas (`@ejemplo.test`) y las asciende a MOD/ADMIN por
 * SQL, porque el primer administrador de una instancia no se puede crear
 * desde la aplicación — el endpoint de roles ya exige ser ADMIN. Es el
 * arranque en frío clásico y por eso se hace aquí a mano.
 *
 * Va por API y no por navegador a propósito: lo que se está verificando son
 * reglas de autorización del servidor, y el navegador solo añadiría el
 * riesgo de agotar el límite de inicios de sesión sin medir nada más.
 *
 * **Ojo con los límites de tasa**: son 5 registros por hora POR IP. Esta
 * suite crea 3 cuentas. Los contadores viven en memoria:
 * `docker compose restart backend` los pone a cero.
 *
 * Al terminar limpia sus propias cuentas; si aborta a mitad:
 *   DELETE FROM "User" WHERE email LIKE '%@ejemplo.test';
 */

const BASE = process.env.WANDER_BASE ?? 'https://wander.ourocore.net';

let ok = 0;
let fallos = 0;
const errores = [];

function comprobar(nombre, cond, detalle = '') {
  if (cond) {
    ok++;
    console.log(`  ✓ ${nombre}`);
  } else {
    fallos++;
    errores.push(`${nombre}${detalle ? ` — ${detalle}` : ''}`);
    console.log(`  ✗ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  }
}

const SUF = Math.random().toString(36).slice(2, 7);

/** Cliente mínimo que recuerda las cookies de una cuenta. */
function crearCliente() {
  let cookies = '';
  return {
    get cookies() {
      return cookies;
    },
    async pedir(metodo, ruta, cuerpo) {
      const res = await fetch(`${BASE}/api${ruta}`, {
        method: metodo,
        headers: {
          'Content-Type': 'application/json',
          ...(cookies ? { Cookie: cookies } : {}),
        },
        ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
      });

      // Las cookies de sesión llegan en el registro y el login.
      const nuevas = res.headers.getSetCookie?.() ?? [];
      if (nuevas.length > 0) {
        const pares = nuevas.map((c) => c.split(';')[0]);
        cookies = [...cookies.split('; ').filter(Boolean), ...pares].join('; ');
      }

      let datos = null;
      try {
        datos = await res.json();
      } catch {
        /* respuestas sin cuerpo */
      }
      return { estado: res.status, datos };
    },
  };
}

async function registrar(handle) {
  const cli = crearCliente();
  const r = await cli.pedir('POST', '/auth/registro', {
    email: `${handle}@ejemplo.test`,
    password: 'Prueba-Fase10-2026',
    handle,
    displayName: handle,
    aceptaTerminos: true,
  });
  if (r.estado !== 201 && r.estado !== 200) {
    throw new Error(`No se pudo registrar ${handle}: ${r.estado} ${JSON.stringify(r.datos)}`);
  }
  return cli;
}

console.log(`\nModeración (Fase 10) — ${BASE}\n`);

const hAdmin = `modadmin${SUF}`;
const hMod = `modmod${SUF}`;
const hUser = `moduser${SUF}`;

const admin = await registrar(hAdmin);
const mod = await registrar(hMod);
const user = await registrar(hUser);
console.log(`  · cuentas: @${hAdmin} (ADMIN), @${hMod} (MOD), @${hUser} (USER)\n`);

/*
 * Ascender por SQL. El primer ADMIN no puede salir de la aplicación
 * —`/moderacion/rol` ya exige serlo—, así que este es el arranque en frío.
 */
const { execSync } = await import('node:child_process');
function sql(consulta) {
  return execSync(
    `docker compose exec -T db psql -U wander -d wander -t -A -c ${JSON.stringify(consulta)}`,
    { cwd: new URL('../..', import.meta.url).pathname, encoding: 'utf8' }
  ).trim();
}
sql(`UPDATE "User" SET rol='ADMIN' WHERE handle='${hAdmin}';`);
sql(`UPDATE "User" SET rol='MOD' WHERE handle='${hMod}';`);

// Los roles se leen de la base en cada petición (`resolverUsuario`), así
// que las sesiones ya abiertas los recogen sin volver a entrar.

console.log('── Permisos de acceso al panel ──');
{
  const r = await user.pedir('GET', '/moderacion/resumen');
  comprobar('un USER no puede ver el resumen', r.estado === 403, `dio ${r.estado}`);

  const r2 = await mod.pedir('GET', '/moderacion/resumen');
  comprobar('un MOD sí puede', r2.estado === 200, `dio ${r2.estado}`);

  const r3 = await crearCliente().pedir('GET', '/moderacion/resumen');
  comprobar('sin sesión responde 401', r3.estado === 401, `dio ${r3.estado}`);

  const r4 = await mod.pedir('POST', '/moderacion/rol', { handle: hUser, rol: 'MOD' });
  comprobar('un MOD no puede repartir roles', r4.estado === 403, `dio ${r4.estado}`);
}

console.log('\n── Reportar ──');
let reporteId = null;
{
  const r = await user.pedir('POST', '/moderacion/reportes', {
    tipoObjeto: 'perfil',
    objetoId: hMod,
    motivo: 'spam',
    detalle: 'Reporte de prueba de la suite.',
  });
  comprobar('un usuario puede reportar un perfil por handle', r.estado === 201, `dio ${r.estado}`);

  const r2 = await user.pedir('POST', '/moderacion/reportes', {
    tipoObjeto: 'perfil',
    objetoId: hUser,
    motivo: 'spam',
  });
  comprobar('no se puede reportar a uno mismo', r2.estado === 400, `dio ${r2.estado}`);

  const r3 = await user.pedir('POST', '/moderacion/reportes', {
    tipoObjeto: 'publicacion',
    objetoId: 'noexistenada',
    motivo: 'spam',
  });
  comprobar('reportar algo inexistente da 404', r3.estado === 404, `dio ${r3.estado}`);

  const r4 = await user.pedir('POST', '/moderacion/reportes', {
    tipoObjeto: 'inventado',
    objetoId: 'x',
    motivo: 'spam',
  });
  comprobar('un tipo de objeto desconocido se rechaza', r4.estado === 400, `dio ${r4.estado}`);

  const r5 = await user.pedir('POST', '/moderacion/reportes', {
    tipoObjeto: 'perfil',
    objetoId: hMod,
    motivo: 'inventado',
  });
  comprobar('un motivo fuera del enum se rechaza', r5.estado === 400, `dio ${r5.estado}`);

  // Duplicado: responde 201 igual (no delata que ya existía) pero no crea
  // una segunda fila.
  await user.pedir('POST', '/moderacion/reportes', {
    tipoObjeto: 'perfil',
    objetoId: hMod,
    motivo: 'spam',
  });
  const cuantos = sql(
    `SELECT count(*) FROM "Reporte" r JOIN "User" u ON u.id=r."reportadorId" WHERE u.handle='${hUser}' AND r.estado='PENDIENTE';`
  );
  comprobar('el duplicado no crea un segundo reporte', cuantos === '1', `hay ${cuantos}`);

  const lista = await mod.pedir('GET', '/moderacion/reportes?estado=PENDIENTE');
  const mio = lista.datos?.reportes?.find((x) => x.contexto?.handle === hMod);
  reporteId = mio?.id ?? null;
  comprobar('el moderador ve el reporte en la cola', Boolean(mio), 'no apareció');
  comprobar(
    'el reporte trae el contenido reportado resuelto',
    mio?.contexto?.handle === hMod,
    `contexto: ${JSON.stringify(mio?.contexto)}`
  );
}

console.log('\n── Límites de poder ──');
{
  const r = await mod.pedir('POST', '/moderacion/suspender', {
    handle: hAdmin,
    motivo: 'intento de moderar hacia arriba',
  });
  comprobar('un MOD no puede suspender a un ADMIN', r.estado === 404, `dio ${r.estado}`);

  const r2 = await mod.pedir('POST', '/moderacion/suspender', {
    handle: hMod,
    motivo: 'a sí mismo',
  });
  comprobar('nadie se suspende a sí mismo', r2.estado === 400, `dio ${r2.estado}`);

  const r3 = await admin.pedir('POST', '/moderacion/rol', { handle: hAdmin, rol: 'USER' });
  comprobar('nadie se cambia el rol a sí mismo', r3.estado === 400, `dio ${r3.estado}`);
}

console.log('\n── Suspensión ──');
{
  const r = await mod.pedir('POST', '/moderacion/suspender', {
    handle: hUser,
    motivo: 'prueba de la suite',
    dias: 3,
  });
  comprobar('un MOD suspende a un USER', r.estado === 200, `dio ${r.estado}`);

  const fila = sql(`SELECT suspendido FROM "User" WHERE handle='${hUser}';`);
  comprobar('queda marcada como suspendida en la base', fila === 't', `valor: ${fila}`);

  const sesiones = sql(
    `SELECT count(*) FROM "Sesion" s JOIN "User" u ON u.id=s."userId" WHERE u.handle='${hUser}';`
  );
  comprobar('se le cierran todas las sesiones', sesiones === '0', `quedan ${sesiones}`);

  // El perfil de una cuenta suspendida no se distingue de uno inexistente.
  const publico = await fetch(`${BASE}/api/perfiles/${hUser}`);
  comprobar('su perfil responde 404 al público', publico.status === 404, `dio ${publico.status}`);

  const auditoria = sql(
    `SELECT count(*) FROM "AuditLog" WHERE accion='suspension' AND detalle->>'objetivoHandle'='${hUser}';`
  );
  comprobar('la suspensión queda en el registro de auditoría', auditoria === '1', `hay ${auditoria}`);

  const r2 = await mod.pedir('POST', '/moderacion/levantar', { handle: hUser });
  comprobar('se puede levantar la suspensión', r2.estado === 200, `dio ${r2.estado}`);
  const fila2 = sql(`SELECT suspendido FROM "User" WHERE handle='${hUser}';`);
  comprobar('vuelve a estar activa', fila2 === 'f', `valor: ${fila2}`);
}

console.log('\n── Resolver un reporte ──');
if (reporteId) {
  const r = await mod.pedir('PATCH', `/moderacion/reportes/${reporteId}`, {
    estado: 'REVISADO',
    accion: 'ninguna',
    resolucion: 'Revisado por la suite.',
  });
  comprobar('el moderador resuelve el reporte', r.estado === 200, `dio ${r.estado}`);

  const estado = sql(`SELECT estado FROM "Reporte" WHERE id='${reporteId}';`);
  comprobar('queda como REVISADO', estado === 'REVISADO', `valor: ${estado}`);

  const r2 = await mod.pedir('PATCH', `/moderacion/reportes/${reporteId}`, {
    estado: 'DESCARTADO',
  });
  comprobar('no se puede resolver dos veces', r2.estado === 409, `dio ${r2.estado}`);
} else {
  comprobar('el moderador resuelve el reporte', false, 'no se obtuvo el id del reporte');
}

console.log('\n── Roles (solo ADMIN) ──');
{
  const r = await admin.pedir('POST', '/moderacion/rol', { handle: hUser, rol: 'MOD' });
  comprobar('un ADMIN sí puede ascender a MOD', r.estado === 200, `dio ${r.estado}`);
  const rol = sql(`SELECT rol FROM "User" WHERE handle='${hUser}';`);
  comprobar('el rol quedó guardado', rol === 'MOD', `valor: ${rol}`);

  // Con el ascenso hay dos ADMIN en la instancia si contamos alguno real;
  // se comprueba la regla del último administrador sobre esta cuenta.
  const admins = Number(sql(`SELECT count(*) FROM "User" WHERE rol='ADMIN';`));
  if (admins === 1) {
    const r2 = await admin.pedir('POST', '/moderacion/rol', { handle: hAdmin, rol: 'USER' });
    comprobar('no se puede quitar el último ADMIN', r2.estado === 400, `dio ${r2.estado}`);
  } else {
    console.log(`  · omitida la regla del último ADMIN (hay ${admins} en la instancia)`);
  }
}

// ── Limpieza ─────────────────────────────────────────────────────────
sql(`DELETE FROM "User" WHERE handle IN ('${hAdmin}','${hMod}','${hUser}');`);
console.log('\n  · cuentas de prueba borradas');

console.log(`\n${'─'.repeat(50)}`);
console.log(`  ${ok} correctas · ${fallos} fallidas`);
if (fallos > 0) {
  console.log('\nFallos:');
  for (const e of errores) console.log(`  · ${e}`);
}
process.exit(fallos > 0 ? 1 : 0);
