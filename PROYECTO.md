# PROYECTO — Plataforma de perfiles gamer

> Documento maestro. Recoge la idea completa, las decisiones tomadas, el esquema de
> datos, la arquitectura, las fases y lo que queda pendiente.
>
> **Nombre:** **Wander** — https://wander.ourocore.net (en vivo)
> **Última actualización:** 30 de julio de 2026

---

## 0. Estado del proyecto

**Fases 1, 3, 4 y 5 completas, y la 2 al 90 %. La plataforma cumple ya su promesa
central: quien entra con Steam ve sus juegos, sus horas y su actividad en el perfil sin
escribir nada.** Lo único que le falta a la Fase 2 es la verificación de correo, que
**se aplazó a propósito** (30/07): sin usuarios reales todavía, no compensa dar de alta
un proveedor de correo ni tocar el DNS. Lo siguiente es la **Fase 6 (cuentas
vinculadas: Discord y Google)**.

### Resumen por fases

| # | Fase | Estado |
|---|---|---|
| 1 | Andamio + deploy | ✅ **Completa** |
| 2 | Auth | 🟡 Correo+contraseña y Steam OpenID listos; la verificación de correo queda aplazada (decisión del 30/07) |
| 3 | Perfil mínimo | ✅ **Completa** |
| 4 | Tema y plantillas | ✅ **Completa** |
| 5 | Steam | ✅ **Completa** |
| 6 | Cuentas vinculadas | ⬜ **Siguiente** |
| 7 | Social | ⬜ |
| 8 | Mensajería | ⬜ |
| 9 | CSS propio | ⬜ |
| 10 | Pulido | ⬜ |
| 11 | Música de fondo | ⬜ |
| 12 | SEO + GEO | 🟡 Landing hecha; falta el SSR de los perfiles |

### ✅ Hecho

**Infraestructura (Fase 1)**
- Los cuatro contenedores corriendo: `wander_db`, `wander_backend`, `wander_frontend`,
  `wander_tunnel`.
- PostgreSQL 17 con la migración inicial aplicada — 20 tablas creadas.
- Túnel de Cloudflare `wander` (`b385cca3-…`) con CNAME proxied y el ingress apuntando
  a `frontend:80`. El sitio responde por HTTPS.
- `.env` con secretos reales generados (`openssl rand -hex 32`) y la Steam API key.
- Las 8 cabeceras de seguridad llegan en todas las rutas, verificado en producción.

**Autenticación (Fase 2)**
- Backend: registro, login, refresh con rotación de token, logout, `/yo`, cambio de
  contraseña y comprobación de handle. Contraseñas con argon2id, sesiones en cookies
  httpOnly + Secure, rate limit en dos capas (nginx y Express).
- Frontend: landing, login, registro con comprobación de handle en vivo, 404, guarda de
  rutas y punto de entrada completo.
- Probado de extremo a extremo por HTTPS: registro, login, rotación del refresh token,
  revocación al cerrar sesión y borrado en cascada.

**Perfil mínimo (Fase 3)**
- API completa de perfiles y bloques: `GET/PATCH /api/perfiles/mio`, CRUD de bloques,
  reorden transaccional y `GET /api/perfiles/:handle` público. Toda escritura parte de
  la sesión (imposible tocar el perfil de otro); todo `config` pasa por el schema zod
  de su tipo; enlaces solo http(s) — `javascript:` rechazado y verificado.
- Tres bloques v1: **Presentación** (hero), **Texto** y **Enlaces**, con un registro
  compartido entre el editor y la página pública.
- **Editor** (`/editor`): identidad (nombre + bio), panel de tema (5 colores,
  tipografía, redondez) con guardado con rebote, lista de bloques con
  añadir/editar/mover/ocultar/borrar, y vista previa en vivo que usa exactamente los
  mismos componentes que la página pública.
- **Perfil público** (`/u/:handle`): tema del usuario vía variables `--p-*` (aisladas
  de la interfaz de Wander), botón de compartir, contador de vistas (solo visitas
  ajenas), aviso de "sin publicar" para el dueño y un único 404 indistinguible para
  no-existe/oculto/sin-publicar.
- El registro crea el perfil con bloques iniciales; publicar es opt-in explícito.
- `prisma/seed.ts`: 86 handles reservados sembrados (incluye `mio`, que ahora es ruta).
- Probado E2E por HTTPS: flujo feliz + 7 casos de seguridad (tipo desconocido, URL
  `javascript:`, color no-hex, campo extra, bloque ajeno, reorden con ids colados,
  escritura anónima) + render real del frontend contra el stack vivo.

**Login con Steam (Fase 2)**
- OpenID 2.0 completo: `GET /api/auth/steam` redirige a Steam y
  `GET /api/auth/steam/callback` lo recibe de vuelta. Son GET con redirección porque
  quien los recorre es el navegador, no `fetch()`.
- **El paso que sostiene todo:** `check_authentication` contra Steam. Los parámetros que
  vuelven en la URL no valen nada por sí solos — sin esa llamada, cualquiera podría
  escribir a mano un `claimed_id` con el SteamID de otro y entrar como esa persona.
  Verificado: una respuesta falsificada con el SteamID real de Mizllet **no crea sesión**.
- Un SteamID ya vinculado entra a **esa** cuenta (lo garantiza el
  `@@unique([proveedor, proveedorId])` del schema). Si el vínculo se creó solo para traer
  datos, el primer login por Steam lo asciende a método de acceso.
- Cuenta nueva por Steam: sin correo ni contraseña (el schema ya los tenía opcionales).
  El handle se genera desde el nombre de Steam en `handle.service.ts`, que aguanta
  emoji, acentos y nombres en alfabetos no latinos, con sufijo aleatorio — no un contador
  (`-2`, `-3`), que dejaría adivinar cuántas cuentas parecidas hay.
- El avatar de Steam solo se acepta si viene de un host `*.steamstatic.com`: acaba en un
  `<img>` para todos los visitantes del perfil.
- **Límite de tasa propio** (`limiteOAuth` + zona `api_oauth` en nginx). No reutiliza el
  de contraseñas: un login correcto por Steam responde 302, y `skipSuccessfulRequests`
  solo perdona los 2xx — con el límite de auth, los inicios de sesión BUENOS gastaban
  cupo y 8 de ellos dejaban al usuario fuera 15 minutos.
- Probado E2E por HTTPS: 16 comprobaciones, todas de seguridad o de forma del flujo.

**Tema y plantillas (Fase 4)**
- **Cinco plantillas**: `base-oscuro`, `minimal-claro`, `cyber-violeta`, `retro-crt` y
  `shooter-angular`. Viven **en código** (`server/src/schemas/plantillas.ts`, espejadas
  en `client/src/lib/plantillas.ts`), no en una tabla: cambian solo al desplegar, y el
  servidor necesita la lista de todos modos para validar el nombre.
- Selector en el editor con **miniatura** de cada preset (el propio tema pintado en
  pequeño, no cuadritos de color sueltos).
- **Aplicar una plantilla solo cambia el tema; los bloques no se tocan.** Se pueden
  probar las cinco sin perder nada de lo escrito.
- El tema que se guarda es **el del catálogo del servidor**: mandar
  `{plantilla: 'retro-crt', tema: {...}}` no cuela colores arbitrarios bajo un nombre
  conocido — verificado en el E2E.
- Editar un color a mano marca el perfil como `personalizada`, así el selector deja de
  señalar un preset del que el tema ya se alejó. "Restaurar" vuelve a `base-oscuro`.
- Probado E2E por HTTPS: 25 comprobaciones — flujo feliz, las 5 plantillas, y los casos
  de seguridad (plantilla inventada, `personalizada` no elegible por el cliente, tema
  colado junto a la plantilla, tipo no-string, campo extra, escritura anónima).

**Datos de Steam (Fase 5)**
- **`cache.service.ts`** — `obtenerConCache` con TTL por clave. La regla que ordena toda
  la fase: **el render de un perfil nunca llama a Steam**; lee de Postgres. Si el refresco
  falla, **se sigue sirviendo el dato viejo** marcado como tal (`hayDatosViejos`), porque
  datos de hace tres horas valen infinitamente más que un hueco.
- **Circuit breaker**: tras 5 fallos seguidos se deja de reintentar durante 30 min. Si la
  API key se revoca o el perfil se vuelve privado, insistir en cada visita solo gasta
  latencia. Un éxito pone el contador a cero — mide fallos *consecutivos*.
- **`steam.service.ts`** — resumen, jugados recientes, biblioteca y nivel, cada uno con su
  TTL (15 min / 30 min / 6 h / 24 h). Nada de Steam se pasa tal cual: cada respuesta se
  recorta a una forma nuestra, así un campo nuevo de Valve no acaba publicado por accidente.
- **`vacBanned` no se publica** (§2), y no por omisión al pintar: `GetPlayerBans` **ni se
  llama** y el campo no entra en la estructura, así que no está ni en la respuesta HTTP ni
  en `CacheExterno`. Lo que no se guarda no se puede filtrar después por descuido. La
  cuenta de pruebas tiene `VACBanned: true`, así que el filtro se ejercita de verdad.
- **Tres bloques nuevos**: Actividad (jugado en 2 semanas), Estadísticas (juegos, horas,
  nivel) y Favoritos. Su `config` guarda **solo preferencias, nunca datos de Steam** —
  Favoritos guarda appids y resuelve nombre, carátula y horas contra la caché. Si el config
  guardara las horas, cada perfil tendría una copia congelada que el usuario podría editar
  para inventarse sus estadísticas.
- La biblioteca se pide entera (942 juegos en la cuenta real) pero **se guardan solo los 24
  más jugados** + los totales: §2 decidió "destacados curados, sin biblioteca navegable".
- **Endpoint aparte** (`GET /api/externo/steam/:handle`), no dentro del perfil: así el
  perfil se pinta enseguida desde la DB y los bloques de Steam rellenan al llegar. Usa la
  **misma regla de visibilidad y el mismo 404 indistinguible** que el perfil — si fuera más
  permisivo, sería la vía para saber qué handles existen con perfil oculto.
- El editor deja **elegir favoritos de la biblioteca real**, no teclear appids: pedirle a
  alguien el "appid" es pedirle que abra Steam y copie un número de la URL.
- **Job de refresco** cada 10 min (por delante del TTL más corto), en lotes de 20, en serie
  y **solo sobre perfiles publicados**: refrescar cuentas que nadie puede ver gastaría cuota
  para nada.
- **Arreglo de un fallo latente de la Fase 2:** la Web API devuelve hoy los avatares desde
  `avatars.steamstatic.com`, host que **no estaba en `img-src`**. El backend ya lo aceptaba,
  así que el avatar de quien entraba con Steam se bloqueaba en el navegador sin ningún error
  en el servidor. Detectado sondeando la respuesta real, no leyendo el código.
- Probado E2E por HTTPS: 37 comprobaciones + la prueba de Steam caído (ver §11).

**SEO de la landing (parte de la Fase 12)**
- JSON-LD (`WebSite` + `WebApplication`), canónica, Open Graph y Twitter Card.
- Tarjeta al compartir en PNG 1200×630 (`/og.png`).
- `robots.txt` con los rastreadores de IA permitidos de forma explícita (GEO).
- `llms.txt` describiendo qué es Wander para los motores generativos.
- `sitemap.xml` dinámico, que solo lista perfiles publicados **y** públicos.

**Idioma**
- Toda la interfaz y los mensajes están en español neutro/mexicano (de «tú»). Se eliminó
  el voseo que se había colado en la primera versión de los textos.

### ⬜ Lo siguiente

1. **Fase 6 — Cuentas vinculadas**: Discord y Google por OAuth 2.0 con PKCE,
   `/configuracion` con consentimiento granular, vincular/desvincular y `/privacidad`.
   La Fase 5 ya dejó puesta media infraestructura: `cache.service.ts` es agnóstico del
   proveedor y `borrarCache(userId, proveedor)` existe justo para que desvincular borre
   de verdad (§14).
2. **Verificación de correo (lo que falta de la Fase 2), cuando haga falta.** Aplazada el
   30/07 — ver la nota en los pendientes.
3. Pendiente heredado de la Fase 5: **el vínculo de Steam solo se crea al *entrar* con
   Steam.** Quien se registró con correo no tiene forma de vincular su cuenta sin cerrar
   sesión y volver a entrar por Steam. Se arregla en la Fase 6, que es donde vive
   "vincular con sesión activa" — es el mismo flujo para los tres proveedores.
4. Opcional de la Fase 4, si se quiere más adelante: que una plantilla pueda traer
   también un **set inicial de bloques** (hoy solo trae tema). Se dejó fuera a propósito
   — aplicarla a un perfil ya escrito tendría que decidir qué hacer con lo que ya hay,
   y "solo cambia los colores" es una promesa mucho más fácil de cumplir.

### ⚠️ Pendientes que conviene no olvidar

- **Regenerar la Steam API key** en `steamcommunity.com/dev/apikey` antes de abrir el
  registro: la actual se compartió por chat durante la planeación.
- **Logros e insignias de Steam: no implementados.** §1 y §5 los mencionan, y la Fase 5
  entregó juegos, horas, nivel y actividad, pero **no logros**. Se dejaron fuera porque
  `GetPlayerAchievements` es *una llamada por juego*: con 942 juegos, un solo perfil serían
  942 peticiones. Traerlos de verdad exige decidir antes un alcance acotado (solo los
  juegos destacados, o solo el total de `GetBadges`), no es un "añadir otra clave a la
  caché". La estructura ya lo admite: `CacheExterno.clave` contempla `logros`.
- **Borrar un registro DNS sobrante.** Al crear el túnel, `cloudflared` generó por error
  `wander.ourocore.net.idolrevenant.com` (el `cert.pem` local está atado a la zona
  `idolrevenant.com`). No afecta a nada, pero conviene limpiarlo desde el panel de
  Cloudflare. El registro correcto, `wander.ourocore.net`, ya existe y funciona.
- **SSR de perfiles — decidido (30/07):** los perfiles quedan como SPA en la v1. El SEO
  prioritario es la landing, cuyo contenido ya viaja en el HTML. Si más adelante se
  quieren perfiles indexables/citables por IA, se añade prerender + tarjetas OG del lado
  del servidor (encaja con la Fase 10).
- **Política de derechos de autor** para la música de fondo, antes de abrir el registro.
- **Repositorio git creado** (30/07), pero **solo local**: sigue sin remoto, así que un
  disco dañado se lo lleva igual. Falta un `git remote add` a algo fuera de esta máquina.
- **Términos y privacidad mínimos antes de abrir el registro.** El formulario obliga a
  aceptar `/terminos` y `/privacidad`… que hoy son páginas "en construcción". Aceptar
  documentos que no existen no protege a nadie; con una versión corta y honesta basta
  para empezar.
- **Backups de Postgres.** `pgdata/` es un bind-mount sin ninguna estrategia de
  respaldo: un fallo de disco se lleva todos los usuarios. Un `pg_dump` diario a otro
  disco (cron del host o contenedor dedicado) es suficiente al principio.
- **Verificación de correo — aplazada a propósito (30/07).** No hay SMTP ni proveedor en
  `.env`, y `emailVerified` existe en el schema pero hoy nadie lo pone a `true`. La
  decisión fue no dar de alta un proveedor mientras no haya usuarios reales. Cuando toque,
  el trabajo pendiente es: elegir proveedor, añadir un modelo de token (**no existe**
  ninguno en el schema: hace falta migración), el endpoint de reenvío, y decidir qué se le
  bloquea a quien no ha verificado — la opción sensata es **impedir publicar el perfil**,
  no impedir entrar.
  Comparativa hecha el 30/07, por si sirve al retomarlo:
  · **Resend** — 3.000/mes gratis permanente pero con tope de **100/día**, sin proceso de
    aprobación, el mejor SDK de Node. Exige verificar `ourocore.net` por DNS: su dominio
    de pruebas solo escribe a tu propia dirección. Era la recomendación.
  · **Brevo** — 300/día gratis, sin aprobación, pero estampa su logo salvo que pagues
    ~10 USD/mes, y su pool gratuito compartido es el de peor reputación.
  · **Amazon SES** — el más barato a escala (0,10 USD/1.000), pero el sandbox es un
    bloqueo real de 1-3 días hábiles y el tramo gratis ya solo dura 12 meses.
  · **Mailgun y Postmark quedan descartados**: el sandbox de Mailgun solo escribe a 5
    destinatarios autorizados (imposible para un registro público) y el tramo gratis de
    Postmark son 100 correos **al mes**.
  Nota para cuando se haga: usar un subdominio (`mail.ourocore.net`) y no la raíz, para
  aislar la reputación de envío del dominio principal.
- **i18n antes de que la interfaz crezca.** «Español + inglés» está decidido (§2) pero no
  asignado a ninguna fase, y todo el texto está incrustado en los componentes. Meterlo
  con la interfaz pequeña (antes de la Fase 7) cuesta poco; hacerlo al final significa
  tocar cada pantalla dos veces.

---

## 1. La idea

Una plataforma web donde cualquier jugador se registra, arma su **perfil de jugador**
y lo comparte. Una especie de "LinkedIn de los videojuegos": en vez de experiencia
laboral, tu identidad como gamer — los juegos que juegas, tus horas, tu setup, tus
logros, tus perfiles en cada plataforma, y con quién juegas.

### Cómo nació

Empezó como una página personal para **Mizllet**: una infografía-biografía de jugador
con perfiles de Steam y Discord, actividad, juegos favoritos, componentes del PC y
horas jugadas, tirando datos de la base de Steam.

A mitad de la planeación el alcance cambió a propósito: en vez de codear una página
hardcodeada para una persona, **construir el marco para que cualquiera pueda hacer la
suya**. Las plantillas son un punto de partida, no una jaula — la gente parte de una y
la personaliza hasta donde quiera.

### Qué la hace distinta

- **Los datos se traen solos.** Vinculas Steam y tus horas, juegos y logros aparecen
  sin escribir nada. No es un "link en la bio" que hay que actualizar a mano.
- **Personalización real.** Bloques que añades, quitas y reordenas + control total del
  tema (colores, fuentes, fondo, bordes, glow) + CSS propio para quien sepa.
- **Social de verdad.** Seguir gente, feed de actividad, comentarios, y mensajería
  privada con grupos y adjuntos.
- **Transparente con los datos.** Cada vinculación dice exactamente qué se lee y qué se
  guarda, con permisos granulares y desvinculación que borra de verdad.

---

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Personalización | Bloques reordenables + control de tema + **CSS propio** |
| Autenticación | Steam (OpenID), Discord, Google, correo+contraseña |
| Cuentas vinculadas | Aparte del login: en configuración se vinculan para traer datos |
| Alcance v1 | Paquete social completo (seguir, feed, comentarios, likes, búsqueda) |
| Mensajería | DM + grupos, con imágenes, GIFs y archivos |
| Estructura del perfil | Scroll único por bloques |
| Idioma | Español + inglés |
| Dominio | `wander.ourocore.net`. Dominio propio más adelante, no ahora. |
| Steam API key | El usuario la consigue (gratis, `steamcommunity.com/dev/apikey`) |
| Música de fondo | Cada perfil puede tener audio propio, al 30 % y con control del visitante (§7) |
| SEO y GEO | Requisito explícito, no un extra (§13) |
| Seguridad y rendimiento | Prioridad alta: es una red social con datos de gente (§14) |
| Dato `vacBanned` | **No se publica** — se filtra en el ingest |
| Catálogo de juegos | Destacados curados + total, sin biblioteca navegable completa |

---

## 3. Stack técnico

Elegido para reusar lo que ya está probado en `PaginaClips` (Prisma + Postgres + JWT +
bcrypt + React), corrigiendo sus puntos débiles.

| Capa | Elección | Por qué |
|---|---|---|
| Frontend | React 19 + Vite 8 + TypeScript | Mismo stack que `PaginaClips/client`. Un editor con vista previa en vivo necesita SPA, no Astro estático. |
| Rutas | `react-router-dom` 7 | Ya usado en Frieren. |
| Estado | `zustand` 5 | Ya usado en Clips. |
| Estilos | Tailwind 4 (`@tailwindcss/vite`) | Config en CSS. Los perfiles necesitan variables CSS por usuario en runtime. |
| Backend | Express 5 + TypeScript | Réplica de la estructura por capas de `PaginaClips/server`. |
| ORM / DB | Prisma 7 + PostgreSQL 17 | Relacional es lo correcto: usuarios, seguidores, bloques, mensajes. |
| Auth | JWT propio + OAuth manual | `better-auth` se evaluó y se descartó: no trae proveedor de Steam OpenID 2.0. |
| Tiempo real | socket.io 4.8 | Mensajería. Ya usado en Frieren. |
| Uploads | `multer` 2 + `sharp` 0.35 + `file-type` 22 | Validación por contenido real, recompresión, sin EXIF. |
| Sanitización | `sanitize-html` 2.17 + `postcss` 8.5 | Crítico para el CSS propio. |
| Validación | `zod` 4 | Toda entrada del cliente. |
| Rate limit | `express-rate-limit` 8 | Auth y escrituras. |
| Servidor web | nginx (config por bind-mount) | Patrón Frieren: cambiar nginx sin rebuild. |
| Túnel | `cloudflare/cloudflared:latest` | Patrón establecido en todos los proyectos. |

Versiones verificadas en npm el 29/07/2026. Node 22-alpine en los contenedores.

---

## 4. Esquema de datos

### Identidad y vinculaciones

```prisma
model User {
  id            String   @id @default(cuid())
  email         String?  @unique      // opcional: quien entra solo con Steam no tiene
  passwordHash  String?              // null si solo usa OAuth
  handle        String   @unique      // el slug del perfil: /u/mizllet
  displayName   String
  avatarUrl     String?
  bannerUrl     String?
  bio           String?  @db.Text
  ubicacion     String?
  rol           String   @default("USER")   // USER | ADMIN
  emailVerified Boolean  @default(false)
  perfilPublico Boolean  @default(true)
  privacidadDm  String   @default("seguidos") // todos | seguidos | nadie
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// Sirve para AMBAS cosas: iniciar sesión Y vincular para traer datos.
// `esMetodoLogin` distingue si con esta cuenta se puede entrar.
model CuentaVinculada {
  id             String   @id @default(cuid())
  userId         String
  proveedor      String   // steam | discord | google | spotify | github | twitch
  proveedorId    String   // SteamID64, snowflake de Discord, etc.
  usuarioRemoto  String?
  esMetodoLogin  Boolean  @default(false)
  accessToken    String?  @db.Text  // cifrado AES-256-GCM, nunca sale al cliente
  refreshToken   String?  @db.Text
  expiraEn       DateTime?
  permisos       Json     @default("{}")  // consentimiento granular
  sincronizadoEn DateTime?

  @@unique([proveedor, proveedorId])  // una cuenta remota = un usuario
  @@unique([userId, proveedor])       // no dos Steam en la misma cuenta
}
```

### Perfil y bloques

```prisma
model Perfil {
  id         String  @id @default(cuid())
  userId     String  @unique
  plantilla  String  @default("base-oscuro")  // preset del que partió
  tema       Json                             // tokens de diseño
  cssPropio  String? @db.Text                 // sanitizado al guardar
  publicado  Boolean @default(false)
  vistas     Int     @default(0)
  bloques    Bloque[]
}

model Bloque {
  id       String  @id @default(cuid())
  perfilId String
  tipo     String  // hero | steam-actividad | setup | favoritos | enlaces |
                   // texto | galeria | estadisticas | discord-estado | spotify
  orden    Int
  visible  Boolean @default(true)
  config   Json    // props del tipo, validadas con zod por tipo
  @@index([perfilId, orden])
}

// Caché de datos externos. El render NUNCA consulta Steam en vivo.
model CacheExterno {
  id         String   @id @default(cuid())
  userId     String
  proveedor  String
  clave      String   // resumen | juegos | logros
  datos      Json
  obtenidoEn DateTime @default(now())
  expiraEn   DateTime
  @@unique([userId, proveedor, clave])
}
```

### Social

```prisma
model Seguimiento {
  seguidorId String
  seguidoId  String
  createdAt  DateTime @default(now())
  @@id([seguidorId, seguidoId])
}

model Comentario {
  id        String   @id @default(cuid())
  texto     String   @db.Text   // sanitizado
  autorId   String
  perfilId  String
  createdAt DateTime @default(now())
  @@index([perfilId, createdAt])
}

model Reaccion {
  userId   String
  perfilId String
  tipo     String @default("like")
  @@id([userId, perfilId, tipo])
}

model ActividadFeed {
  id        String   @id @default(cuid())
  userId    String
  tipo      String   // perfil-publicado | bloque-nuevo | juego-nuevo | logro
  datos     Json
  createdAt DateTime @default(now())
  @@index([userId, createdAt])
}

model Bloqueo {
  bloqueadorId String
  bloqueadoId  String
  createdAt    DateTime @default(now())
  @@id([bloqueadorId, bloqueadoId])
}
```

### Mensajería

Un solo modelo cubre DM y grupo: un DM es una conversación de dos con
`esGrupo: false`. Evita duplicar toda la lógica dos veces.

```prisma
model Conversacion {
  id          String   @id @default(cuid())
  esGrupo     Boolean  @default(false)
  nombre      String?              // solo grupos
  iconoUrl    String?              // solo grupos
  creadorId   String?
  ultimoMsgEn DateTime @default(now())  // para ordenar la bandeja
  createdAt   DateTime @default(now())
  @@index([ultimoMsgEn])
}

model Participante {
  id             String    @id @default(cuid())
  conversacionId String
  userId         String
  rol            String    @default("MIEMBRO")  // ADMIN | MIEMBRO
  leidoHastaId   String?              // último mensaje leído → no leídos
  silenciado     Boolean   @default(false)
  salioEn        DateTime?
  @@unique([conversacionId, userId])
  @@index([userId, conversacionId])
}

model Mensaje {
  id             String    @id @default(cuid())
  conversacionId String
  autorId        String
  texto          String?   @db.Text   // sanitizado
  tipo           String    @default("texto") // texto|imagen|gif|archivo|sistema
  editadoEn      DateTime?
  borradoEn      DateTime?            // borrado suave
  respondeAId    String?              // hilo simple
  createdAt      DateTime  @default(now())
  adjuntos       Adjunto[]
  @@index([conversacionId, createdAt])
}

model Adjunto {
  id           String  @id @default(cuid())
  mensajeId    String
  url          String
  miniaturaUrl String?
  mime         String
  bytes        Int
  ancho        Int?
  alto         Int?
  externo      Boolean @default(false)  // GIFs de Giphy/Tenor: solo la URL
}
```

---

## 5. Autenticación y cuentas vinculadas

Dos conceptos separados, una sola tabla.

### Entrar (`esMetodoLogin: true`)

- **Correo + contraseña** — bcrypt + JWT, adaptado de
  `PaginaClips/server/src/controllers/auth.controller.ts`. Mejoras: validación zod,
  rate limit, y mensaje de error **idéntico** para "correo no existe" y "contraseña
  mala" (no filtrar qué correos están registrados).
- **Steam** ✅ — OpenID 2.0. Sigue soportado; no hay fecha de retiro anunciada. Devuelve
  solo el SteamID64 y no da correo, así que el handle se **genera** a partir del nombre
  de Steam (`services/handle.service.ts`) y el usuario lo cambia después si quiere.
  La respuesta se valida con `check_authentication` contra Steam: los parámetros de la
  URL no se creen nunca por sí solos.
- **Discord / Google** — OAuth 2.0 con PKCE vía `openid-client` 6.

Todos convergen en `encontrarOCrearUsuario(proveedor, proveedorId, datos)`.

### Sesión

JWT en **cookie httpOnly + SameSite=Lax + Secure**, no en localStorage. Es una mejora
deliberada sobre Clips: con CSS y contenido de usuarios en juego, un XSS que pueda leer
el token es un riesgo real. Refresh token rotativo, access de 15 minutos.

### Vincular (en `/configuracion`)

El mismo flujo OAuth pero con sesión activa; añade una `CuentaVinculada` con
`esMetodoLogin: false`. Reglas:

1. Antes de redirigir, una pantalla dice **exactamente** qué se leerá y qué se guardará.
2. `permisos` se rellena con los switches que marque el usuario
   (ej. `{"mostrarHoras": true, "mostrarJuegosOcultos": false}`).
3. Desvincular borra la fila y su `CacheExterno`. No se puede desvincular el único
   método de login sin poner antes una contraseña.
4. Tokens cifrados con AES-256-GCM (`config/cripto.ts`, clave en `ENCRYPTION_KEY`).
   Nunca se serializan al cliente.
5. `PRIVACIDAD.md` + una página `/privacidad` con lo mismo en lenguaje llano.

### Proveedores de datos

| Proveedor | Qué da | Requiere |
|---|---|---|
| Steam | Perfil, nivel, horas, juegos, logros, badges, estado en línea | API key (gratis) — el feed XML público funciona sin ella |
| Discord | Presencia en vivo, qué juega, Spotify | Lanyard: unirse a `discord.gg/UrXF2cfJ7F`, gratis y sin key |
| Spotify | Canción sonando | Vía Lanyard, o OAuth propio |
| GitHub | Contribuciones, repos | API pública |
| Twitch | Estado de stream | OAuth |

**Dato verificado:** el feed `https://steamcommunity.com/id/Mizllet/?xml=1` responde
público y trae `steamID64`, `onlineState`, `avatarFull`, `memberSince`, `location`,
`realname` y `mostPlayedGames` con horas de 2 semanas y totales. **Sin API key.**
También trae `vacBanned`, que se filtra y no se publica.

---

## 6. Personalización

### Bloques

`@dnd-kit` 6 para reordenar. Cada tipo tiene su schema zod; el backend valida `config`
contra el schema del `tipo` antes de guardar. Un bloque con config inválida se rechaza.

**`client/src/components/bloques/registro.ts` es la pieza clave de extensibilidad**:
añadir un tipo de bloque = añadir una entrada ahí (componente de render + editor +
schema zod + icono). Ni el editor ni el renderizador de perfiles se tocan.

### Tema

`Perfil.tema` es JSON con tokens acotados que se emiten como variables CSS en un
`<style>` con scope al perfil:

```
--p-fondo, --p-superficie, --p-texto, --p-texto-suave,
--p-primario, --p-acento, --p-borde, --p-radio,
--p-fuente-display, --p-fuente-cuerpo, --p-glow, --p-patron-fondo
```

Colores validados como hex/hsl. Fuentes desde una **lista blanca** auto-hospedada, no
URLs arbitrarias (o se rompe la CSP).

### Plantillas

`base-oscuro`, `cyber-violeta`, `retro-crt`, `minimal-claro`, `shooter-angular`.

Son presets de ese JSON de tema. De ahí que no encierren a nadie: se editan libremente
después de aplicarlas, y aplicarlas **no toca los bloques** — solo los colores, la
tipografía y la redondez. Se puede probar las cinco sin perder nada de lo escrito.

Viven en `server/src/schemas/plantillas.ts`, con un espejo en
`client/src/lib/plantillas.ts` para el selector. La copia del servidor es la
autoritativa: al aplicar una, el tema que se guarda es el suyo, nunca el que mande el
cliente. Un perfil cuyo tema se ha editado a mano queda marcado como `personalizada`.

### CSS propio — la parte delicada

Viable, pero necesita defensa en serio:

1. Parsear con **PostCSS**; si no parsea, rechazar.
2. **Prefijar cada selector** con `#perfil-<id>` para que no pueda tocar la navbar ni
   otros perfiles.
3. Lista negra: `position: fixed`, `@import`, `url()` a hosts externos, `behavior`,
   `-moz-binding`, `expression(`.
4. Prohibir `content` con `attr()`. Selectores que salgan del scope (`:root`, `html`,
   `body`) se reescriben al contenedor.
5. Límite de tamaño (~20 KB) y de número de reglas.
6. Se guarda el **CSS sanitizado**, no el original.
7. Botón "restaurar" siempre visible: si alguien rompe su perfil, no queda atrapado.

**Nunca** se acepta HTML o JS arbitrario del usuario. Los bloques de texto pasan por
`sanitize-html` con lista blanca corta (negritas, cursivas, enlaces, listas). Esa línea
no se cruza: es la diferencia entre "personalizable" y "XSS almacenado contra todos los
visitantes".

---

## 7. Contenido de la plataforma

### Landing (`/`) — el "por qué"

Hero con propuesta de valor · un perfil de ejemplo animado · "cómo funciona" en 3 pasos
(regístrate → vincula → comparte) · rejilla de características · perfiles destacados
reales · comparación con "un link en la bio" · FAQ · CTA.

### Perfil público (`/u/:handle`)

Los bloques del usuario con su tema. Meta OG dinámico + tarjeta OG generada para que se
vea bien al compartir en Discord y X. Botón de compartir, contador de vistas, seguir,
likes, comentarios.

### Bloques en la v1

| Bloque | Qué muestra | Origen |
|---|---|---|
| Hero | Avatar, banner, tagline, estado | Manual + Steam |
| Estadísticas ✅ | Contadores (juegos, horas, nivel) | Steam |
| Actividad Steam ✅ | Jugado recientemente + horas | Steam |
| Juegos favoritos ✅ | Curados, con arte del CDN de Steam | Manual (appid) |
| Setup PC | Componentes con especificaciones | Manual |
| Enlaces / redes | Iconos a todos tus perfiles | Manual |
| Texto libre | Bio extendida, lo que quieras | Manual |
| Galería | Capturas, fotos del setup | Subidas |
| Estado de Discord | En línea, qué juega — **en vivo** | Lanyard |
| Spotify | Canción sonando — **en vivo** | Lanyard |
| Música de fondo | Pista propia que suena al entrar al perfil | Subida |

### Música de fondo del perfil

Cada usuario puede subir un archivo de audio que se reproduce al abrir su perfil.

- **Volumen inicial al 30 %**, y quien mira el perfil puede subirlo, bajarlo o silenciarlo.
- El control de volumen y el mute son **del visitante**, no del dueño del perfil, y la
  preferencia se recuerda entre perfiles (nadie quiere volver a silenciar en cada uno).
- **Respetar el autoplay del navegador:** Chrome y Safari bloquean el audio hasta que hay
  interacción. No pelear contra eso — si el navegador lo bloquea, se muestra un botón de
  reproducir en vez de forzarlo.
- `prefers-reduced-motion` no cubre audio, pero conviene un ajuste global de cuenta del
  tipo "no reproducir música en los perfiles" que gane sobre la preferencia del perfil.
- Validación igual de estricta que las imágenes: `file-type` por contenido real (no por
  extensión), límite de tamaño y duración, y recodificación para tirar metadatos.
- Formatos: `mp3`, `ogg`, `m4a`, `wav` — ya contemplados en el `location` de `/uploads`
  de `nginx.conf`, y `media-src 'self' blob:` ya está en la CSP.

**Ojo con los derechos de autor:** subir música ajena es una vía directa a una queja de
DMCA. Hace falta al menos un aviso al subir y un botón de reporte; conviene decidir la
política antes de abrir el registro.

### Social

Seguir · feed de a quién sigues · comentarios en perfiles · likes · `/explorar` con
búsqueda y filtros (por juego, plataforma, etiqueta).

---

## 8. Mensajería

**Transporte:** socket.io 4.8 en el mismo servidor Express, namespace `/chat`,
autenticado con el JWT de la cookie en el handshake. Cada usuario entra a una room
`user:<id>`; cada conversación a `conv:<id>`. Eventos: `mensaje:nuevo`,
`mensaje:editado`, `mensaje:borrado`, `escribiendo`, `leido`, `conv:actualizada`.

**Persistencia primero, socket después.** El mensaje se guarda en Postgres y luego se
emite. Si el socket está caído el mensaje no se pierde: al reconectar se piden los
mensajes desde `leidoHastaId`. El REST
(`GET /api/conversaciones/:id/mensajes?antes=<cursor>`) es la fuente de verdad y el
socket solo acelera — así el chat funciona incluso con websockets bloqueados.

**Quién puede escribirte** (configurable en `/configuracion`, campo `privacidadDm`):

- `todos` — cualquiera puede iniciar un DM.
- `seguidos` (por defecto) — solo gente a la que sigues o que sigues mutuamente.
- `nadie` — DMs cerrados.

Solicitudes de desconocidos van a una bandeja aparte, no a la principal. `Bloqueo` corta
todo en ambos sentidos.

**Grupos:** los crea cualquiera, con nombre e icono. Rol `ADMIN` puede renombrar,
añadir/quitar y borrar mensajes ajenos. Límite de ~50 participantes para no convertirlo
en Discord. Mensajes de sistema (`tipo: 'sistema'`) para "X se unió".

**Adjuntos — imágenes, GIFs y archivos:**

- Subida con `multer` a disco (bind-mount, patrón Frieren y Clips), **no** a la DB.
- Validación por **contenido real** con `file-type` 22 — no por extensión ni por el
  `Content-Type` que manda el cliente.
- Lista blanca: `image/png|jpeg|webp|gif`, opcionalmente `video/mp4` para clips cortos.
- `sharp` recomprime y genera miniatura; se **re-encodean** las imágenes para tirar
  metadatos EXIF (incluida geolocalización) y payloads embebidos. Los GIFs animados
  pasan por `sharp` con `animated: true` para no perder la animación.
- Nombres de archivo generados (cuid), nunca el nombre original del usuario.
- Se sirven con `Content-Disposition: attachment` para los no-imagen y
  `X-Content-Type-Options: nosniff`, para que un archivo subido no se ejecute como
  HTML/JS.
- **GIFs de Giphy/Tenor**: se guarda solo la URL (`Adjunto.externo: true`), no se
  rehospedan. Requiere añadir su host a `img-src` y una API key del proveedor.

**Escalado:** con un solo contenedor de backend, socket.io en memoria basta. Si algún
día hay varias réplicas se añade `@socket.io/redis-adapter` 8 + Redis, y el código de
los eventos no cambia. No se añade Redis en la v1 por no complicar sin necesidad.

**nginx:** `location /socket.io/` con `proxy_http_version 1.1`, cabeceras
`Upgrade`/`Connection` y timeouts largos — el bloque exacto ya existe en
`FrierenIdolRevenant/frontend/nginx.conf`.

---

## 9. Estructura de archivos

```
<nombre-proyecto>/
├── docker-compose.yml
├── nginx.conf                    # bind-mount :ro, se cambia sin rebuild
├── .env.example                  # todas las claves documentadas
├── README.md                     # setup + túnel
├── PROYECTO.md                   # este documento
├── PRIVACIDAD.md                 # qué datos se guardan y por qué
├── server/
│   ├── Dockerfile
│   ├── prisma/schema.prisma
│   ├── prisma/seed.ts            # plantillas base
│   └── src/
│       ├── index.ts
│       ├── config/{env,prisma,multer,cripto}.ts
│       ├── routes/{auth,oauth,usuarios,perfiles,bloques,social,mensajes,externo,admin}.routes.ts
│       ├── controllers/…         # uno por router
│       ├── sockets/chat.socket.ts
│       ├── middlewares/{auth,rateLimit,validar,errores}.middleware.ts
│       ├── services/
│       │   ├── steam.service.ts       # XML + Web API + filtro vacBanned
│       │   ├── discord.service.ts
│       │   ├── spotify.service.ts
│       │   ├── cache.service.ts       # get-or-fetch con TTL
│       │   └── sanitizar.service.ts   # CSS + HTML ← el más delicado
│       ├── schemas/               # zod: bloques por tipo, tema, auth
│       └── jobs/refrescarCaches.ts
└── client/
    ├── Dockerfile
    └── src/
        ├── main.tsx, App.tsx, index.css
        ├── store/{authStore,editorStore,chatStore}.ts
        ├── hooks/useSocket.ts
        ├── utils/axiosConfig.ts   # interceptor 401
        ├── lib/{tema,bloques}.ts
        ├── components/
        │   ├── layout/{Navbar,Footer}.tsx
        │   ├── bloques/           # un componente por tipo + registro.ts
        │   ├── editor/{ListaBloques,PanelTema,EditorCss,VistaPrevia}.tsx
        │   ├── social/{TarjetaPerfil,BotonSeguir,Comentarios,Feed}.tsx
        │   └── chat/{ListaConversaciones,Hilo,Burbuja,Compositor,SelectorGif,VisorImagen}.tsx
        └── pages/
            ├── LandingPage.tsx
            ├── {Login,Registro}Page.tsx
            ├── EditorPerfilPage.tsx   # el corazón
            ├── PerfilPublicoPage.tsx  # /u/:handle
            ├── ExplorarPage.tsx
            ├── FeedPage.tsx
            ├── MensajesPage.tsx
            ├── ConfiguracionPage.tsx
            └── AdminPage.tsx
```

---

## 10. Infraestructura

### Docker Compose

Cuatro servicios en `plataforma_net`, patrón `PaginaClips`/Frieren:

| Servicio | Imagen / build | Notas |
|---|---|---|
| `db` | `postgres:17-alpine` | Volumen `./pgdata` |
| `backend` | build `server/` | Healthcheck, `prisma migrate deploy` al arrancar |
| `frontend` | build `client/` → nginx | `3045:80` (puerto verificado libre) |
| `tunnel` | `cloudflare/cloudflared:latest` | `TUNNEL_TOKEN` desde `.env` |

`restart: always`, `container_name` con prefijo.

**Corrección importante sobre Clips:** el frontend se **construye para producción** y se
sirve con nginx. Clips corre Vite en modo dev en producción con bind-mount; no repetir
eso aquí.

Migraciones con `prisma migrate deploy`, no `db push`.

### Variables de entorno

```
POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, DATABASE_URL
JWT_SECRET, REFRESH_SECRET, ENCRYPTION_KEY
STEAM_API_KEY
DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
GIPHY_API_KEY
TUNNEL_TOKEN
PUBLIC_URL, PORT_FRONTEND
```

`config/env.ts` **falla rápido** si falta un secreto (patrón Clips), sin fallbacks
insecuros.

### nginx + CSP

Base: `PaginaOuroCore_V2/nginx.conf` (hardening) + patrón de proxy de
`FrierenIdolRevenant/frontend/nginx.conf`.

- `location /api/` → `proxy_pass http://backend:4000/`
- `location /socket.io/` → proxy con `Upgrade`/`Connection`
- SPA fallback `try_files $uri $uri/ /index.html`
- `style-src 'self' 'unsafe-inline'` (necesario para el tema por perfil);
  `script-src 'self'` **sin** `unsafe-inline`
- `client_max_body_size` acotado para uploads

**`img-src` — hosts verificados en el feed real de Steam:**

```
cdn.cloudflare.steamstatic.com
avatars.akamai.steamstatic.com
shared.akamai.steamstatic.com
community.akamai.steamstatic.com
avatars.fastly.steamstatic.com
media.steampowered.com
cdn.discordapp.com
i.scdn.co                    (Spotify)
media.giphy.com              (GIFs)
```

Faltar uno = imágenes roscas en silencio, fallo visible solo en la consola.

---

## 11. Fases de implementación

Ordenadas para que haya algo desplegado y visible pronto.

| # | Fase | Qué entrega |
|---|---|---|
| 1 | ✅ **Andamio + deploy** | Compose con 4 servicios, Prisma inicial, "Hola" en el front, `/api/health`, túnel arriba. Valida la cadena completa antes de escribir features. |
| 2 | 🟡 **Auth** | Correo+contraseña (zod, argon2id, JWT en cookie httpOnly, rate limit) ✅ + Steam OpenID ✅. Registro, login, logout y sesión persistente ✅. Falta solo la verificación de correo, aplazada (ver §0). |
| 3 | ✅ **Perfil mínimo** | `Perfil`+`Bloque`, editor con 3 bloques (Hero, Texto, Enlaces), reordenar, `/u/:handle` público. **Aquí ya es usable.** |
| 4 | ✅ **Tema y plantillas** | `PanelTema` y vista previa en vivo (salieron con la Fase 3) + las 5 plantillas y su selector con miniaturas. El tema lo escribe el servidor desde el catálogo. |
| 5 | ✅ **Steam** | `steam.service.ts` (Web API, sin tocar `vacBanned`), `cache.service.ts` con TTL y circuit breaker, bloques de Actividad / Estadísticas / Favoritos, job de refresco. |
| 6 | **Cuentas vinculadas** | Discord y Google OAuth, `/configuracion` con consentimiento granular, vincular/desvincular, `PRIVACIDAD.md` y `/privacidad`. Bloques de Discord y Spotify vía Lanyard. |
| 7 | **Social** | Seguir, feed, comentarios, likes, `/explorar` con búsqueda. |
| 8 | **Mensajería** | socket.io, DMs primero, luego grupos, luego adjuntos (imágenes → GIFs). Bloqueo y privacidad de DM. Va después de "seguir" porque las reglas de quién puede escribirte dependen del grafo social. |
| 9 | **CSS propio** | `sanitizar.service.ts` con PostCSS, prefijado de scope, lista negra, botón de restaurar. Al final a propósito: es lo más riesgoso y no bloquea nada. |
| 10 | **Pulido** | Landing completa, tarjetas OG, moderación en `/admin`, resto de bloques, accesibilidad, responsive. |
| 11 | **Música de fondo** | Subida de audio validada por contenido, reproductor al 30 % con control del visitante, ajuste global para silenciar todo (§7). |
| 12 | **SEO + GEO** | JSON-LD, `sitemap.xml`, `robots.txt`, `llms.txt`, `hreflang` (§13). Landing ✅; el SSR de perfiles quedó decidido: SPA en la v1 (ver §0). |

### Registro de cambios

El estado actual está en **§0** al inicio del documento. Aquí solo queda el histórico de
qué se hizo y cuándo.

**30/07/2026 — Fase 5 desplegada: los datos de Steam**

- `cache.service.ts` (get-or-fetch con TTL por clave) y `steam.service.ts` (resumen,
  recientes, biblioteca, nivel). El render de un perfil **nunca** sale a la red de Valve.
- Tres bloques nuevos: Actividad, Estadísticas y Favoritos. `GET /api/externo/steam/:handle`
  para leer y `POST /api/externo/steam/sincronizar` (con `limiteExterno`) para forzar.
- Decisión de forma: los bloques guardan **preferencias, no datos**. Favoritos guarda
  appids y resuelve todo lo demás contra la caché, así las horas suben solas.
- Decisión de privacidad: `GetPlayerBans` no se llama y `vacBanned` no existe en ninguna
  estructura. No se filtra al pintar — **no se guarda**.
- **Prueba de Steam caído**, que era el requisito de §14 y la que de verdad valida el
  diseño: con `api.steampowered.com` apuntado a una IP no enrutable desde el contenedor y
  las 4 claves de caché vencidas a mano, el perfil **siguió sirviendo los 942 juegos** de
  la caché vieja con `hayDatosViejos: true`. Ni error, ni hueco.
  El circuit breaker se ve en los tiempos: 8.165 ms mientras reintenta contra un Steam
  muerto, y **83 ms en la sexta petición**, cuando deja de insistir. Al restaurar la red,
  `intentosFallo` volvió a 0 y la caché se refrescó sola, sin tocar nada.
- E2E por HTTPS: 37 comprobaciones en verde, incluidas las de aislamiento (los dos 404 —
  perfil oculto y handle inexistente — son **byte a byte idénticos**) y las de forma (no se
  filtran campos crudos de Steam ni la API key; las 73 URLs de imagen vienen de hosts de
  Valve). Borrar la cuenta se llevó en cascada sus 4 filas de `CacheExterno`.
- **Fallo latente de la Fase 2, encontrado y corregido:** los avatares llegan hoy desde
  `avatars.steamstatic.com`, que **no estaba en `img-src`**. El backend lo aceptaba, así que
  el avatar se bloqueaba en el navegador y el servidor no registraba nada. Salió de sondear
  la respuesta real de `GetPlayerSummaries`, no de leer el código.

**30/07/2026 — Login con Steam (cierre práctico de la Fase 2)**

- OpenID 2.0 con verificación `check_authentication` contra Steam. Sin ese paso, el
  login sería "escribe el SteamID que quieras ser": los parámetros que vuelven en la URL
  no están firmados de forma que podamos comprobar por nuestra cuenta.
- `services/steamAuth.service.ts` (protocolo + `resumenJugador`),
  `services/handle.service.ts` (generación de handle desde nombres arbitrarios) y
  `controllers/steamAuth.controller.ts`.
- Un SteamID ya vinculado entra a esa cuenta; uno nuevo crea cuenta sin correo ni
  contraseña. Las cuentas suspendidas no entran por esta vía.
- Botón de Steam en login y registro, con el logo como SVG inline para no depender de un
  host externo ni abrir la CSP.
- **Arreglo de un problema que habría salido en producción:** reutilizar `limiteAuth`
  para Steam rompía los logins buenos. Un callback correcto responde 302 y
  `skipSuccessfulRequests` solo perdona los 2xx, así que cada login exitoso gastaba cupo
  y al octavo el usuario quedaba fuera 15 min. Ahora hay `limiteOAuth` (30/15 min) y una
  zona `api_oauth` en nginx (20 r/m) que **va antes** del bloque `^/api/(auth|oauth)/`,
  porque nginx elige la primera expresión regular que casa.
- E2E por HTTPS: 16 comprobaciones. La central — un callback falsificado con el SteamID
  real de Mizllet — no crea sesión. En los logs se ve la diferencia: 139 ms cuando la
  petición llega a preguntarle a Steam, 1 ms cuando el `claimed_id` malformado se
  rechaza antes de salir a la red.
- **Verificación de correo aplazada** por decisión explícita: sin usuarios reales no
  compensa dar de alta un proveedor ni tocar DNS. La comparativa de proveedores queda
  anotada en los pendientes de §0.

**30/07/2026 — Fase 4 desplegada: plantillas**

- Catálogo de 5 plantillas en código (`server/src/schemas/plantillas.ts` + espejo en el
  cliente). Se descartó la tabla: son constantes que solo cambian al desplegar, y el
  servidor necesitaba la lista igualmente para validar el nombre.
- Selector en el editor con miniatura de cada preset. Aplicar una plantilla cambia el
  tema y **no** toca los bloques.
- Decisión de seguridad: `PATCH /perfiles/mio` con `plantilla` escribe el tema **del
  catálogo del servidor**, ignorando cualquier `tema` que venga en la misma petición.
  Sin esto, "elegir una plantilla" sería un hueco para guardar colores arbitrarios con
  un nombre de preset legítimo.
- `Perfil.plantilla` pasa a `personalizada` en cuanto se edita un color a mano — es un
  valor que solo escribe el servidor, no está en el enum del schema.
- E2E por HTTPS: 25 comprobaciones, incluidas 6 de seguridad. Todas en verde.

**30/07/2026 — Fase 3 desplegada: la plataforma es usable**

- API de perfiles/bloques con validación por tipo y autorización por sesión.
- Editor con vista previa en vivo, panel de tema y gestión de bloques.
- Perfil público con tema propio del usuario (variables `--p-*`), compartir y vistas.
- Seed de 86 handles reservados. E2E completo por HTTPS: flujo feliz, 7 casos de
  seguridad y render real del frontend contra el stack vivo (jsdom + XHR reales).
- Nota de despliegue: el seed se corre a mano (`npm run seed` con la DATABASE_URL
  apuntando a la DB) — la imagen de producción no lleva `tsx`. Es idempotente.

**30/07/2026 — Revisión de seguridad e infraestructura**

Pasada de revisión completa sobre lo desplegado. Tres arreglos:

| Problema | Efecto | Arreglo |
|---|---|---|
| Las zonas `limit_req` de nginx usaban `$binary_remote_addr` | Detrás del túnel todas las peticiones comparten la IP de cloudflared: el límite de 5 r/m de auth era **global para todos los visitantes juntos** — con dos usuarios reales, el login se bloqueaba para todos | `map` sobre `CF-Connecting-IP` (que Cloudflare sobreescribe en el borde y no es falsificable a través del túnel) con caída a la IP de conexión; verificado con 12 IPs distintas en paralelo |
| Puerto 3045 publicado en `0.0.0.0` | Cualquiera en la LAN podía falsear `CF-Connecting-IP` y evadir el rate limit por visitante | Atado a `127.0.0.1` en el compose |
| Cookie de refresh con `path: '/'` | La credencial de 30 días viajaba en **cada** petición, aunque solo la leen dos endpoints | Acotada a `path: '/api/auth'` |

También: últimos restos de voseo eliminados y decisión tomada sobre el SSR de perfiles
(quedan como SPA en la v1; ver pendientes de §0).

**29/07/2026 — Fases 1 y 2 desplegadas**

- Andamio completo: los cuatro contenedores en marcha, migración inicial de Prisma
  (20 tablas) y túnel de Cloudflare publicando `wander.ourocore.net` por HTTPS.
- Autenticación con correo y contraseña probada de extremo a extremo contra el
  backend real: registro, login, rotación del refresh token, logout y borrado en
  cascada.
- Frontend completado: punto de entrada, router, landing, login, registro, 404 y
  guarda de rutas.
- SEO de la landing: JSON-LD, Open Graph, tarjeta PNG, `robots.txt`, `llms.txt` y
  `sitemap.xml` dinámico.
- Toda la interfaz pasada a español neutro/mexicano.

Cinco fallos encontrados y corregidos al desplegar por primera vez, todos en código
escrito antes de que existiera un entorno donde ejecutarlo:

| Problema | Efecto | Arreglo |
|---|---|---|
| `prisma.config.ts` no se copiaba a la imagen | El contenedor no arrancaba: bucle de reinicio en `migrate deploy` | Se añadió `prisma.config.prod.js` (JS plano, porque la imagen final no lleva `tsx`) |
| Prisma 7 exige un *driver adapter* | El backend moría al construir el cliente | `@prisma/adapter-pg` en `config/prisma.ts` |
| `keyGenerator` sin `ipKeyGenerator` | **Un cliente IPv6 podía saltarse el rate limit** rotando dentro de su /64 | Se normaliza la IP con el ayudante de la librería |
| `add_header` no se hereda en nginx | La landing se servía **sin CSP, HSTS ni X-Frame-Options** | Cabeceras en `nginx-seguridad.conf`, re-incluidas en los 6 `location` que las pisaban |
| `@apply` con clases propias en Tailwind 4 | El build del frontend fallaba | Se repiten las utilidades base en `.tarjeta-interactiva` |

---

## 12. El nombre — decidido: **Wander**

Se eligió **Wander** por encima del favorito de la planeación (*Loadout*). Ya está fijado
en el código y renombrarlo no es trivial: aparece en los `container_name` del compose
(`wander_db`, `wander_backend`, `wander_frontend`, `wander_tunnel`), en la red
`wander_net`, en el nombre de los paquetes (`wander-server`, `wander-client`), en el
campo `servicio` de `/api/health`, en la marca de la Navbar y el Footer, en la clave de
`localStorage` del tema (`wander-tema`) y en la lista de handles reservados.

Falta solo crear el túnel:

```bash
cloudflared tunnel create wander
# Zero Trust → Networks → Tunnels → wander → Configure → copiar token → .env
# Public Hostname: wander.ourocore.net → HTTP → frontend:80
```

<details>
<summary>Alternativas que se barajaron</summary>


| Nombre | Subdominio | Idea |
|---|---|---|
| **Loadout** ⭐ | `loadout.ourocore.net` | Tu "equipamiento" como jugador. Corto, en jerga gamer, memorable. |
| Playerbase | `playerbase.ourocore.net` | Suena a plataforma/comunidad. Muy claro. |
| GG.Card | `gg.ourocore.net` | Tarjeta de jugador; `gg.` es cortísimo. |
| Respawn | `respawn.ourocore.net` | Reconocible, buen ring. |
| Nexo | `nexo.ourocore.net` | Hub en español, encaja con "OuroCore". |
| Perfil.gg | `perfil.ourocore.net` | Literal y auto-explicativo. |
| Arsenal | `arsenal.ourocore.net` | Tu arsenal de juegos y setup. |
| Checkpoint | `checkpoint.ourocore.net` | Tu punto de guardado como jugador. |

*Loadout* era el favorito — "esto es lo que traigo puesto como jugador" en una palabra
que cualquier gamer entiende — pero se acabó prefiriendo *Wander*.

</details>

---

## 13. SEO y GEO

Wander vive de que la gente encuentre los perfiles. Dos frentes distintos:

### SEO clásico (buscadores)

- **SSR o prerender de `/u/:handle`.** Es lo más importante y lo más incómodo: la SPA
  actual sirve un `index.html` vacío, así que un perfil no tiene contenido indexable.
  Sin esto, el resto de la lista da igual. Decidir entre prerender de las rutas públicas
  o meter SSR para el perfil.
- `<title>`, `<meta description>` y canónica **por perfil**, con los datos reales.
- **Datos estructurados** JSON-LD: `ProfilePage` + `Person` en `/u/:handle`,
  `WebSite` con `SearchAction` en la landing.
- `sitemap.xml` dinámico (ya proxyeado en `nginx.conf` a `/api/seo/sitemap.xml`) y
  `robots.txt`. Falta implementar el endpoint en el backend.
- Etiquetas `hreflang` para español e inglés.
- Perfiles privados o marcados como no indexables → `noindex` y fuera del sitemap.
- Rendimiento como factor de posicionamiento: Core Web Vitals, imágenes en `webp`/`avif`
  con `width`/`height` para no provocar saltos de layout.

### GEO (Generative Engine Optimization)

Que ChatGPT, Perplexity, Claude y los resúmenes de IA de Google puedan leer y citar los
perfiles. Se solapa con el SEO pero no es lo mismo:

- El mismo JSON-LD sirve de base: los modelos se apoyan mucho en datos estructurados.
- **Contenido en el HTML, no pintado solo por JS** — los rastreadores de IA suelen no
  ejecutar JavaScript. Otro motivo para el SSR/prerender.
- Encabezados con jerarquía real y texto en prosa, no solo iconos y contadores: un
  perfil que dice "3 200 horas en Counter-Strike" se cita mejor que un número suelto.
- `llms.txt` en la raíz describiendo qué es Wander y qué hay en cada ruta.
- Decidir explícitamente qué rastreadores de IA se permiten en `robots.txt`
  (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`) — y que el usuario pueda
  excluir su perfil, que conecta con la promesa de transparencia de datos.
- Tarjetas OG bien hechas: son lo que se ve al pegar el enlace en Discord o X, que es
  por donde va a llegar la mayoría del tráfico real.

> Va en la Fase 10 (Pulido), salvo el SSR/prerender: esa decisión conviene tomarla
> **antes** de la Fase 3, porque condiciona cómo se renderiza `/u/:handle`.

---

## 14. Verificación

### Auth
Registro→login→refresh→logout por cada proveedor. Confirmar cookie `httpOnly`+`Secure`.
Confirmar que el JWT **no** está en localStorage (DevTools → Application). Confirmar
mensaje de error idéntico para usuario inexistente vs contraseña mala.

### Aislamiento
Con el usuario A logueado, intentar `PATCH /api/bloques/:id` de un bloque del usuario B
→ **403**. Probar cada endpoint de escritura así.

### Sanitización de CSS
Intentar `body{display:none}`, `@import url(//evil.com/x.css)`, `position:fixed`,
`.navbar{...}`, un CSS de 1 MB. Verificar en la DB que se guardó la versión sanitizada y
que otro perfil en otra pestaña no se afecta.

### XSS
Meter `<script>alert(1)</script>` y `<img src=x onerror=alert(1)>` en bio, nombre,
comentarios, mensajes y config de bloques. Cargar el perfil público → no debe ejecutar.

### Secretos
`grep -rE "STEAM_API_KEY|CLIENT_SECRET|ENCRYPTION_KEY" client/dist/` → cero resultados.
Confirmar en la DB que los tokens OAuth están cifrados, no en claro.

### Steam ✅ (30/07)
`steam.service.ts` contra el SteamID64 real `76561198079804890`: 942 juegos y el nivel 65
reales. `vacBanned` **no** aparece en la respuesta — comprobado buscando `/vac|banned/i`
en el JSON completo, y la cuenta tiene un ban de 2016, así que el filtro se ejerce.
Steam caído simulado apuntando `api.steampowered.com` a `203.0.113.1` desde el contenedor,
con las 4 claves de caché vencidas: el perfil renderizó con la caché vieja. Repetir así si
se cambia el servicio.

### Mensajería
Dos navegadores con usuarios distintos, mensaje en vivo en ambos lados. Matar el backend
a mitad → al reconectar no faltan mensajes. Intentar
`GET /api/conversaciones/:id/mensajes` de una conversación ajena → **403**. Con DMs en
`seguidos`, un desconocido no debe poder escribir. Bloquear a alguien y confirmar que se
corta en ambos sentidos.

### Adjuntos
Subir un `.php`/`.html` renombrado a `.png` → debe rechazarse por `file-type`, no por
extensión. Subir un JPEG con EXIF de GPS y confirmar que el archivo servido ya no lo
trae. Pedir un archivo subido por URL directa y confirmar `nosniff` + que no se ejecuta
como HTML. Verificar que un GIF animado sigue animado.

### CSP
DevTools → Console en el perfil público, cero violaciones. Revisar visualmente cada
avatar y arte de juego.

### Contenedores
`docker compose up -d --build`, `docker compose ps` (healthy),
`curl -I localhost:3045`, `docker compose logs tunnel | grep -i registered`.

### Privacidad
Desvincular una cuenta y confirmar en la DB que se borraron la `CuentaVinculada` y su
`CacheExterno`.

---

## 15. Referencias del propio ecosistema

Archivos de otros proyectos de Mizllet que sirven de plantilla:

| Archivo | Para qué |
|---|---|
| `PaginaClips/server/src/config/env.ts` | Fail-fast de secretos |
| `PaginaClips/server/src/controllers/auth.controller.ts` | bcrypt+JWT (adaptar a cookies) |
| `PaginaClips/client/src/utils/axiosConfig.ts` | Interceptor 401 |
| `FrierenIdolRevenant/frontend/nginx.conf` | Proxy `/api/` + `/socket.io/` + bind-mount |
| `PaginaOuroCore_V2/nginx.conf` | Headers, CSP, cachés |
| `ProyectoOzel/PaginaKoko/README.md` | Plantilla de documentación del túnel |

### Convenciones del ecosistema

- Comentarios en **español**, explicando el *por qué*.
- Identificadores en inglés/PascalCase; rutas y slugs en español.
- Túnel siempre `cloudflare/cloudflared:latest` + token desde `.env`, nunca
  `config.yml` ni credenciales montadas.
- Puertos en uso: 3005, 3010, 3030, 3035, 3040, 4000, 4533, 4534, 5173, 8001, 8082,
  8083, 8085, 25565, 25566. **3045 libre** para este proyecto.

---

## 16. Datos de referencia (perfil de Mizllet)

Sirven para pruebas y como perfil semilla.

- Steam: `https://steamcommunity.com/id/Mizllet/` · SteamID64 `76561198079804890`
- Nivel 65 · miembro desde 27/dic/2012 · Tijuana, Baja California, México
- 823 juegos · 617 DLC · 104 insignias · 1374 capturas · 9066 logros · 6 juegos perfectos
- Más jugados: Deadlock 119 h · 7 Days to Die 371 h · Persona 5 Royal 94 h ·
  American Truck Simulator 43 h · Norland 39 h · Age of Empires II DE 28 h ·
  Spider-Man 2 12.8 h
- Setup: Ryzen 9 7900X · RX 7900 XTX · 64 GB DDR5 · triple monitor
  (27" LG 144 Hz, 24.5" 144 Hz, 27" 60 Hz) · periféricos Logitech/Corsair

- Discord User ID: `246498520041783297` — ya unido a `discord.gg/UrXF2cfJ7F`, así que
  Lanyard puede leer su estado.

**Steam API key:** ya conseguida. Va en `STEAM_API_KEY` del `.env` y **no se escribe en
este documento ni en ningún archivo del repo** — `.env` está en `.gitignore`.

> La clave se compartió por chat durante la planeación. Como cualquier secreto que pasa
> por un canal no cifrado, conviene **regenerarla** en `steamcommunity.com/dev/apikey`
> antes de publicar el sitio; es gratis e inmediato.
