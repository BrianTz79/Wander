# PRIVACIDAD — Wander

> Qué datos guarda Wander, por qué, y cómo quitarlos.
>
> Este documento es la versión técnica y completa. La versión en lenguaje
> llano vive en **https://wander.ourocore.net/privacidad**, y la parte de
> proveedores se sirve desde el mismo sitio del que sale la pantalla de
> consentimiento (`GET /api/cuentas/privacidad`), para que no puedan
> contradecirse.
>
> **Última actualización:** 30 de julio de 2026

---

## 1. Principios

1. **Lo mínimo que haga falta.** No se pide un scope de OAuth "por si acaso":
   Discord se conecta solo con `identify`, y de Google no se guarda ningún
   token porque solo se usa para saber quién eres al entrar.
2. **Lo que no se guarda no se puede filtrar.** El caso ejemplar es
   `vacBanned` de Steam: no se omite al pintar, es que `GetPlayerBans` **ni
   se llama** y el campo no existe en ninguna estructura ni fila de la DB.
3. **El consentimiento se pide antes, no se informa después.** La pantalla
   que dice qué se leerá aparece *antes* de salir al proveedor.
4. **Desvincular borra de verdad.** La fila y su caché se borran en la misma
   transacción.
5. **Los secretos no salen nunca.** Ninguna ruta serializa un token de OAuth;
   los `select` de Prisma son listas blancas explícitas.

---

## 2. Qué se guarda

| Dato | Dónde | Por qué | Notas |
|---|---|---|---|
| Correo | `User.email` | Identificar la cuenta y recuperarla | Opcional: quien entra por Steam o Discord no tiene |
| Contraseña | `User.passwordHash` | Entrar | **argon2id**, nunca en claro ni reversible |
| Handle, nombre, avatar, bio | `User` | Es el perfil público | Solo visible si el perfil está publicado |
| Fecha de nacimiento | `User.fechaNacimiento` | Mayoría de edad, si algún día hace falta | Opcional y **nunca se muestra** |
| Bloques y tema | `Perfil`, `Bloque` | Es lo que el usuario construye | |
| Datos de plataformas | `CacheExterno` | No pedírselos al proveedor en cada visita | Se borran al desvincular |
| Vinculaciones | `CuentaVinculada` | Saber a quién pedirle los datos | Tokens cifrados con AES-256-GCM |
| Sesiones | `Sesion` | Poder cerrarlas una a una | Guarda el **hash** del refresh token, no el token |
| IPs | `Sesion.ipHash`, `AuditLog.ipHash` | Detectar abuso e investigar incidentes | **Hasheadas con HMAC**, nunca en claro |
| Eventos sensibles | `AuditLog` | Investigar un incidente de seguridad | Login, vinculación, desvinculación, cambio de contraseña |

### Qué NO se guarda

- Contraseñas de terceros: Wander nunca ve tu contraseña de Steam, Discord ni Google.
- `vacBanned` de Steam (§2 de PROYECTO.md) — no se consulta siquiera.
- El correo de Discord: el scope `email` no se pide.
- Ningún token de acceso de Google: se descarta en cuanto se lee la identidad.
- Tu IP en claro, en ningún sitio.

---

## 3. Cookies

Solo dos, ambas `httpOnly` + `Secure` + `SameSite=Lax`:

| Cookie | Vida | Ámbito | Para qué |
|---|---|---|---|
| `wander_at` | 15 min | `/` | Access token de sesión |
| `wander_rt` | 30 días | `/api/auth` | Refresh token, rotativo |

`httpOnly` significa que el JavaScript de la página **no puede leerlas**: un
XSS no se lleva la sesión. El `path` acotado del refresh evita que la
credencial de 30 días viaje en cada petición.

No hay cookies de análisis ni de publicidad, así que tampoco hay banner.

---

## 4. Proveedores externos

### Steam (OpenID 2.0)

- **Se lee:** SteamID64, nombre público, avatar, nivel, fecha de alta,
  biblioteca de juegos con horas, y lo jugado en dos semanas.
- **Se guarda:** el SteamID y una copia recortada de juegos destacados
  (24 como máximo) más los totales.
- **No se pide:** contraseña, correo, método de pago, inventario ni baneos.

### Discord (OAuth 2.0 + PKCE)

- **Scope:** `identify`, y nada más.
- **Se lee:** ID de Discord, nombre y avatar.
- **Se guarda:** el ID, el nombre y el avatar. El access token va cifrado.
- **No se pide:** mensajes, lista de servidores ni correo.

### Google (OAuth 2.0 + PKCE)

- **Scope:** `openid profile email`.
- **Se lee:** identificador, nombre, correo y foto.
- **Se guarda:** el identificador, y el correo solo si Google lo da por
  verificado. **No se guarda ningún token**: solo se usa para entrar.
- **No se pide:** Gmail, Drive, contactos ni calendario.

### Lanyard (presencia de Discord)

Servicio de terceros ([github.com/Phineas/lanyard](https://github.com/Phineas/lanyard))
que expone la presencia pública de Discord de quien esté en su servidor.
Solo se consulta si el usuario **activa explícitamente** el permiso
correspondiente; está desactivado por defecto. Requiere unirse a
`discord.gg/UrXF2cfJ7F`.

---

## 5. Consentimiento granular

Cada vinculación guarda un objeto `permisos` con valores booleanos que el
usuario controla desde `/configuracion`. El catálogo es **cerrado** y vive en
`server/src/schemas/cuentas.schema.ts`: una clave que no esté ahí se descarta
al guardar, así que la pantalla no puede prometer una cosa y la DB guardar
otra.

| Proveedor | Permiso | Por defecto |
|---|---|---|
| Steam | Mostrar juegos y horas | ✅ |
| Steam | Mostrar actividad reciente | ✅ |
| Steam | Mostrar si estoy en línea | ❌ |
| Discord | Mostrar mi cuenta de Discord | ✅ |
| Discord | Mostrar mi estado en vivo | ❌ |
| Discord | Mostrar qué escucho en Spotify | ❌ |

**El filtro se aplica en el servidor, al construir la respuesta.** Si viviera
en el cliente, el dato seguiría viajando en el JSON y cualquiera lo vería con
las herramientas de desarrollo — un interruptor de privacidad que no quita el
dato de la red no es un interruptor de privacidad.

---

## 6. Derechos del usuario

| Quiero… | Cómo |
|---|---|
| Ver qué se guarda de mí | Esta página y `/privacidad` |
| Dejar de ser visible | Despublicar el perfil en el editor |
| Quitar una plataforma | `/configuracion` → Desconectar |
| Cambiar qué se muestra | `/configuracion` → los interruptores |
| Borrar todo | Borrar la cuenta (borra en cascada) |

Desvincular borra la `CuentaVinculada` **y** su `CacheExterno` en una sola
transacción. No se puede desvincular el único método de acceso sin poner
antes una contraseña o vincular otro proveedor: la alternativa sería dejar al
usuario fuera de su propia cuenta.

---

## 7. Seguridad

- Contraseñas con **argon2id**.
- Tokens de OAuth cifrados en reposo con **AES-256-GCM** (autenticado:
  detecta manipulación, no solo la impide).
- Refresh tokens **hasheados** en la DB y **rotativos**; reusar uno revocado
  se trata como robo y cierra todas las sesiones.
- CSRF en OAuth cubierto con un `state` firmado con HMAC y verificado en
  tiempo constante, más **PKCE (S256)** en los dos proveedores.
- Rate limit en dos capas (nginx y Express).
- CSP estricta, sin `unsafe-inline` en scripts.

---

## 8. Contacto

lucio.tellez@gmail.com

---

## 9. Pendientes conocidos

Honestidad sobre lo que todavía no está:

- **Exportar tus datos** en un archivo descargable: no implementado.
- **Borrado de cuenta desde la interfaz**: el borrado en cascada funciona a
  nivel de base de datos, pero falta el botón.
- **Verificación de correo**: aplazada a propósito (ver PROYECTO.md §0).
- **Backups**: `pgdata/` no tiene todavía estrategia de respaldo.
