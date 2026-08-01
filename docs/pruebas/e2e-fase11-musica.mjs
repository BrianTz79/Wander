/**
 * Verificación de la música de fondo del perfil (Fase 11) contra el stack
 * vivo.
 *
 * Comprueba las dos mitades: que se pueda subir y configurar, y —lo que
 * más importa— **que las reglas de §7 se cumplan de verdad**: el ajuste de
 * cuenta gana, el audio ajeno no se puede robar por URL, y un archivo que
 * no es audio no cuela por mucho que se llame `.mp3`.
 *
 * ── Cómo correrla ──────────────────────────────────────────────────
 *
 *   node docs/pruebas/e2e-fase11-musica.mjs
 *
 * Crea sus propias cuentas (`@ejemplo.test`) y las borra al terminar.
 * Genera el audio de prueba en memoria: un WAV mínimo pero válido, para
 * que los magic bytes del backend lo reconozcan de verdad. No hace falta
 * ningún archivo en disco.
 *
 * **Ojo con los límites de tasa**: 5 registros por hora por IP. Si aborta
 * a mitad: `docker compose restart backend` y
 * `DELETE FROM "User" WHERE email LIKE '%@ejemplo.test';`
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

/**
 * WAV de un segundo de silencio, construido a mano.
 *
 * Tiene que ser un WAV REAL: el backend detecta el tipo por magic bytes
 * (`RIFF....WAVE`), no por la extensión ni por el `Content-Type` que mande
 * el cliente. Un buffer de ceros con nombre `.wav` se rechazaría, que es
 * justo lo que se comprueba más abajo.
 */
function wavDePrueba(segundos = 1) {
  const tasa = 8000;
  const muestras = tasa * segundos;
  const buf = Buffer.alloc(44 + muestras * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + muestras * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // tamaño del bloque fmt
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(tasa, 24);
  buf.writeUInt32LE(tasa * 2, 28); // bytes por segundo
  buf.writeUInt16LE(2, 32); // alineación
  buf.writeUInt16LE(16, 34); // bits por muestra
  buf.write('data', 36);
  buf.writeUInt32LE(muestras * 2, 40);
  return buf;
}

function crearCliente() {
  let cookies = '';
  return {
    async pedir(metodo, ruta, cuerpo) {
      const res = await fetch(`${BASE}/api${ruta}`, {
        method: metodo,
        headers: {
          'Content-Type': 'application/json',
          ...(cookies ? { Cookie: cookies } : {}),
        },
        ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
      });
      const nuevas = res.headers.getSetCookie?.() ?? [];
      if (nuevas.length > 0) {
        const mapa = new Map(cookies.split('; ').filter(Boolean).map((c) => [c.split('=')[0], c]));
        for (const c of nuevas.map((x) => x.split(';')[0])) mapa.set(c.split('=')[0], c);
        cookies = [...mapa.values()].join('; ');
      }
      let datos = null;
      try {
        datos = await res.json();
      } catch {
        /* sin cuerpo */
      }
      return { estado: res.status, datos };
    },
    /** Sube un archivo. `FormData` pone él solo el boundary. */
    async subir(buffer, nombre, tipo, uso) {
      const cuerpo = new FormData();
      cuerpo.append('archivos', new Blob([buffer], { type: tipo }), nombre);
      cuerpo.append('uso', uso);
      const res = await fetch(`${BASE}/api/archivos`, {
        method: 'POST',
        headers: { ...(cookies ? { Cookie: cookies } : {}) },
        body: cuerpo,
      });
      let datos = null;
      try {
        datos = await res.json();
      } catch {
        /* sin cuerpo */
      }
      return { estado: res.status, datos };
    },
  };
}

async function registrar(handle) {
  const cli = crearCliente();
  const r = await cli.pedir('POST', '/auth/registro', {
    email: `${handle}@ejemplo.test`,
    password: 'Prueba-Fase11-2026',
    handle,
    displayName: handle,
    aceptaTerminos: true,
  });
  if (r.estado !== 201) {
    throw new Error(`No se pudo registrar ${handle}: ${r.estado} ${JSON.stringify(r.datos)}`);
  }
  return cli;
}

console.log(`\nMúsica de fondo (Fase 11) — ${BASE}\n`);

const hA = `musa${SUF}`;
const hB = `musb${SUF}`;
const A = await registrar(hA);
const B = await registrar(hB);
console.log(`  · cuentas: @${hA}, @${hB}\n`);

const { execSync } = await import('node:child_process');
function sql(consulta) {
  return execSync(
    `docker compose exec -T db psql -U wander -d wander -t -A -c ${JSON.stringify(consulta)}`,
    { cwd: new URL('../..', import.meta.url).pathname, encoding: 'utf8' }
  ).trim();
}

console.log('── Subida del audio ──');
let audioUrl = null;
{
  const r = await A.subir(wavDePrueba(), 'cancion.wav', 'audio/wav', 'audio-perfil');
  audioUrl = r.datos?.archivos?.[0]?.url ?? null;
  comprobar('se puede subir un audio como `audio-perfil`', r.estado === 201 && Boolean(audioUrl), `dio ${r.estado}`);

  // Un PNG con nombre de canción: los magic bytes mandan.
  const png = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300010000050001',
    'hex'
  );
  const r2 = await A.subir(png, 'trampa.mp3', 'audio/mpeg', 'audio-perfil');
  comprobar(
    'una imagen renombrada a .mp3 se rechaza',
    r2.estado === 400,
    `dio ${r2.estado}`
  );

  // Un buffer de basura no es ningún tipo conocido.
  const r3 = await A.subir(Buffer.alloc(2048), 'ruido.wav', 'audio/wav', 'audio-perfil');
  comprobar('un archivo de tipo indeterminable se rechaza', r3.estado === 400, `dio ${r3.estado}`);
}

console.log('\n── Guardar en el perfil ──');
{
  const r = await A.pedir('PATCH', '/perfiles/mio', {
    audioUrl,
    audioTitulo: 'Tema de prueba',
    audioArtista: 'Suite F11',
    audioVolumen: 45,
    audioAutoplay: true,
    audioLoop: false,
  });
  comprobar('se guarda la música con su ficha', r.estado === 200, `dio ${r.estado}`);
  comprobar('el volumen inicial queda guardado', r.datos?.perfil?.audioVolumen === 45, `valor: ${r.datos?.perfil?.audioVolumen}`);
  comprobar('el loop desactivado queda guardado', r.datos?.perfil?.audioLoop === false, `valor: ${r.datos?.perfil?.audioLoop}`);

  const r2 = await A.pedir('PATCH', '/perfiles/mio', { audioVolumen: 150 });
  comprobar('un volumen fuera de 0-100 se rechaza', r2.estado === 400, `dio ${r2.estado}`);

  const r3 = await A.pedir('PATCH', '/perfiles/mio', { audioUrl: 'https://evil.example/x.mp3' });
  comprobar('una URL externa se rechaza', r3.estado === 400, `dio ${r3.estado}`);

  const r4 = await A.pedir('PATCH', '/perfiles/mio', { audioUrl: '/uploads/../../etc/passwd' });
  comprobar('un path traversal se rechaza', r4.estado === 400, `dio ${r4.estado}`);
}

console.log('\n── El audio de otro no se puede robar ──');
{
  // B conoce la URL del archivo de A (son públicas por diseño) e intenta
  // ponérsela de música. El schema la acepta —es una ruta de /uploads/—,
  // así que lo único que lo impide es la comprobación de propiedad.
  const r = await B.pedir('PATCH', '/perfiles/mio', { audioUrl });
  comprobar('no se puede usar el audio de otra cuenta', r.estado === 400, `dio ${r.estado}`);
}

console.log('\n── El perfil público entrega la música ──');
{
  await A.pedir('PATCH', '/perfiles/mio', { publicado: true });
  const res = await fetch(`${BASE}/api/perfiles/${hA}`);
  const datos = await res.json();
  comprobar('el perfil público trae audioUrl', datos?.perfil?.audioUrl === audioUrl, `valor: ${datos?.perfil?.audioUrl}`);
  comprobar('trae el título y el artista', datos?.perfil?.audioTitulo === 'Tema de prueba', `valor: ${datos?.perfil?.audioTitulo}`);

  // El archivo tiene que servirse de verdad, no solo figurar en el JSON.
  const audio = await fetch(`${BASE}${audioUrl}`);
  comprobar('el archivo se sirve por HTTP', audio.status === 200, `dio ${audio.status}`);
  comprobar(
    'se sirve con Content-Type de audio',
    (audio.headers.get('content-type') ?? '').startsWith('audio/'),
    `dio ${audio.headers.get('content-type')}`
  );
}

console.log('\n── Ajuste global de la cuenta ──');
{
  const r = await B.pedir('PATCH', '/auth/preferencias', { reproducirMusica: false });
  comprobar('se puede apagar la música globalmente', r.estado === 200, `dio ${r.estado}`);
  comprobar('la respuesta refleja el valor', r.datos?.reproducirMusica === false, `valor: ${r.datos?.reproducirMusica}`);

  const yo = await B.pedir('GET', '/auth/yo');
  comprobar(
    '/auth/yo lo devuelve para que el cliente lo aplique',
    yo.datos?.usuario?.reproducirMusica === false,
    `valor: ${yo.datos?.usuario?.reproducirMusica}`
  );

  const enBase = sql(`SELECT "reproducirMusica" FROM "User" WHERE handle='${hB}';`);
  comprobar('queda guardado en la cuenta, no en el navegador', enBase === 'f', `valor: ${enBase}`);

  const r2 = await B.pedir('PATCH', '/auth/preferencias', { reproducirMusica: 'si' });
  comprobar('un valor que no es booleano se rechaza', r2.estado === 400, `dio ${r2.estado}`);
}

console.log('\n── Quitar la música ──');
{
  const r = await A.pedir('PATCH', '/perfiles/mio', { audioUrl: null });
  comprobar('se puede quitar', r.estado === 200 && r.datos?.perfil?.audioUrl === null, `dio ${r.estado}`);
  // Quitar la canción limpia también su ficha: un título sin música es un
  // resto que confunde en el editor.
  comprobar('se limpia también el título', r.datos?.perfil?.audioTitulo === null, `valor: ${r.datos?.perfil?.audioTitulo}`);
}

sql(`DELETE FROM "User" WHERE handle IN ('${hA}','${hB}');`);
console.log('\n  · cuentas de prueba borradas');

console.log(`\n${'─'.repeat(50)}`);
console.log(`  ${ok} correctas · ${fallos} fallidas`);
if (fallos > 0) {
  console.log('\nFallos:');
  for (const e of errores) console.log(`  · ${e}`);
}
process.exit(fallos > 0 ? 1 : 0);
