# PROYECTO — Plataforma de perfiles gamer

> Documento maestro. Recoge la idea completa, las decisiones tomadas, el esquema de
> datos, la arquitectura, las fases y lo que queda pendiente.
>
> **Nombre:** **Wander** — https://wander.ourocore.net (en vivo)
> **Última actualización:** 31 de julio de 2026 (Fase 8 completa)

---

## 0. Estado del proyecto

**Fases 1, 3, 4, 5, 6, 6.5, 7, 8 y 9 completas, y la 2 al 90 %. La plataforma cumple ya su
promesa central por partida doble: quien entra con Steam ve sus juegos, sus horas y su
actividad sin escribir nada, y quien vincula Discord tiene además su estado y su música
en vivo. Desde la 6.5 hace las dos cosas en español o en inglés, desde la 7 dejó de ser
una colección de perfiles sueltos —se sigue gente, hay un feed, se comenta y se
descubre—, desde la 8 la gente además se habla: mensajes directos, grupos, imágenes,
GIFs y emojis, con una campana que avisa de todo lo que pasa, y desde la 9 quien sepa CSS
puede escribir el suyo y que solo afecte a su perfil.** Lo único que le falta a
la Fase 2 es la verificación de correo, que **se aplazó a propósito** (30/07). Lo
siguiente es la **Fase 10 (pulido)**. La traducción de contenido sigue **aplazada
hasta nuevo aviso** (ver §8).

**Ya no queda ninguna pantalla "en construcción":** `/mensajes` era la última, y con ella
todos los enlaces de la navbar y del pie llevan a algo real.

### Resumen por fases

| # | Fase | Estado |
|---|---|---|
| 1 | Andamio + deploy | ✅ **Completa** |
| 2 | Auth | 🟡 Correo+contraseña, Steam OpenID y OAuth (Discord/Google) listos; la verificación de correo queda aplazada (decisión del 30/07) |
| 3 | Perfil mínimo | ✅ **Completa** |
| 4 | Tema y plantillas | ✅ **Completa** |
| 5 | Steam | ✅ **Completa** |
| 6 | Cuentas vinculadas | ✅ **Completa** |
| 6.5 | i18n (español + inglés) | ✅ **Completa** |
| 7 | Social | ✅ **Completa** |
| 8 | Mensajería + adjuntos + notificaciones | ✅ **Completa** (sin traducción: aplazada) |
| 9 | CSS propio | ✅ **Completa** |
| 10 | Pulido | ⬜ **Siguiente** |
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

**Cuentas vinculadas (Fase 6)**
- **OAuth 2.0 con PKCE (S256) para Discord y Google**, escrito a mano en
  `services/oauth.service.ts` — sin `openid-client`, que habría traído toda una
  maquinaria de descubrimiento para dos proveedores fijos y conocidos.
- **El `state` es un token firmado con HMAC, no una fila en una tabla.** Lleva dentro la
  intención (`login` | `vincular`), el usuario, el verificador PKCE, el proveedor y una
  caducidad de 10 min. Una tabla exigiría limpieza periódica y un viaje a la DB por
  callback; la cookie de sesión no vale porque **el flujo de login empieza sin sesión**.
  La clave se deriva de `JWT_SECRET`, no es `JWT_SECRET`: un fallo aquí no toca la firma
  de las sesiones.
- **La intención se decide al SALIR, no al volver.** Si se dedujera al regresar mirando
  si hay cookie, abrir "vincular" con la sesión caducada te crearía una cuenta nueva en
  silencio. Verificado: manipular `i: login` → `i: vincular` en el state **invalida la
  firma**, y un state de Discord **no sirve** en el callback de Google.
- **PKCE aunque seamos un cliente confidencial.** Ata el callback a quien inició el
  flujo: sin él, un código robado del historial, de un log de proxy o del `Referer` es
  canjeable por cualquiera que tenga nuestro secreto.
- **La decisión de seguridad más importante de la fase: un correo de Google que ya
  existe NO une cuentas automáticamente.** Es tentador —Google lo da verificado— pero si
  alguien registró `victima@gmail.com` con contraseña y más tarde ese correo cae en otras
  manos, el auto-vínculo le regalaría la cuenta entera sin saber la contraseña. Vincular
  **exige demostrar que controlas la cuenta de Wander**, o sea hacerlo desde
  `/configuracion` con sesión iniciada.
- **De Google no se guarda ningún token.** Solo se usa para saber quién eres al entrar,
  así que guardar un token que no vamos a usar sería superficie de ataque a cambio de
  nada. El `id_token` se valida comprobando `iss`, `aud` (que sea para *esta* app) y
  `exp`; no se verifica la firma con las claves de Google **a propósito**: no llegó por
  el navegador sino en un POST TLS directo al endpoint de tokens, autenticado con nuestro
  `client_secret` — ese canal ya garantiza origen e integridad.
- **Scopes mínimos:** Discord solo `identify`. No se pide `email` ni `guilds`.
- **`/configuracion`** con consentimiento granular: catálogo **cerrado** de permisos en
  `schemas/cuentas.schema.ts`, así una clave inventada se descarta en vez de acabar en la
  columna JSON. La pantalla que dice qué se leerá aparece **antes** de salir al proveedor
  — una que lo explique después no es consentimiento, es un informe. Y se puede leer
  "qué datos se leerían" **sin** vincular nada.
- **El filtro de consentimiento se aplica en el SERVIDOR, al construir la respuesta.** Si
  viviera en React, el dato seguiría viajando en el JSON y cualquiera lo vería con las
  herramientas de desarrollo: un interruptor de privacidad que no quita el dato de la red
  no es un interruptor de privacidad.
- **Desvincular borra de verdad**: la `CuentaVinculada` y su `CacheExterno` en la **misma
  transacción**. Si se borrara solo la fila, quedarían datos huérfanos de un proveedor ya
  desvinculado que ningún flujo volvería a limpiar.
- **No se puede quitar la única forma de entrar.** El backend lo rechaza con un mensaje
  que explica qué hacer, y la interfaz además desactiva el botón y dice el motivo como
  texto visible (no solo en un `title`, que ni los lectores de pantalla ni el móvil ven).
- **Una cuenta remota ya vinculada a otro usuario no se mueve ni se roba** — lo garantiza
  el `@@unique([proveedor, proveedorId])`. Permitir moverla dejaría que alguien con
  acceso temporal a un Discord se lo quitara a su dueño.
- **Bloques de Discord y Spotify en vivo** vía **Lanyard**, con la misma caché y el mismo
  circuit breaker de la Fase 5. Se eligió Lanyard frente a un bot propio porque leer
  presencia exige el intent privilegiado `GUILD_PRESENCES` **y** compartir servidor con
  cada usuario, lo cual no escala en una plataforma. El precio se dice en la interfaz:
  hace falta unirse a `discord.gg/UrXF2cfJ7F`.
- Un **404 de Lanyard no dispara el circuit breaker**: significa "no está en el servidor",
  que es una respuesta estable y no un fallo que se arregle reintentando.
- El bloque de Spotify **se oculta solo cuando no suena nada**: un bloque permanentemente
  vacío es peor que no tenerlo. Su barra de progreso avanza en el cliente cada segundo,
  porque con un TTL de un minuto daría saltos y parecería congelada.
- **`PRIVACIDAD.md` y `/privacidad`**, y la parte de proveedores **se sirve del mismo
  endpoint** que la pantalla de consentimiento (`GET /api/cuentas/privacidad`, público):
  con dos textos separados, tarde o temprano uno diría una cosa y la vinculación haría
  otra.
- **Arreglo del pendiente heredado de la Fase 5:** vincular Steam ya no exige cerrar
  sesión y volver a entrar por Steam; se hace desde `/configuracion` como los demás.
- **La trampa de nginx, otra vez.** El bloque `^/api/auth/steam` se amplió a
  `^/api/(auth/steam|oauth/)`: sin eso, `/api/oauth/` caía en `^/api/(auth|oauth)/` con
  la zona `api_auth` de **5 r/m**, la de contraseñas. Medido en producción: la ruta de
  OAuth aguanta **12 de 12** peticiones a 4/s, mientras `/api/auth/login` corta en la
  novena. Es el mismo fallo que ya mordió con Steam en la Fase 2.
- **CSP ampliada** con `media.discordapp.net` (imágenes de actividad) y
  `lh3.googleusercontent.com` (avatares de Google). `cdn.discordapp.com` e `i.scdn.co`
  ya estaban.
- Probado E2E: **61 comprobaciones, todas en verde** (`docs/pruebas/e2e-fase6.mjs`).
- **Lanyard verificado con datos reales**, no con un mock: la cuenta de Mizllet
  (`246498520041783297`) devolvió `online` jugando a *Deadlock*, y el recorte se ejerció de
  verdad — ni uno de los campos crudos de Discord (`public_flags`, `collectibles`,
  `sku_id`, `primary_guild`, `avatar_decoration_data`, `content_classification`) aparece en
  lo que Wander publica.

**SEO de la landing (parte de la Fase 12)**
- JSON-LD (`WebSite` + `WebApplication`), canónica, Open Graph y Twitter Card.
- Tarjeta al compartir en PNG 1200×630 (`/og.png`).
- `robots.txt` con los rastreadores de IA permitidos de forma explícita (GEO).
- `llms.txt` describiendo qué es Wander para los motores generativos.
- `sitemap.xml` dinámico, que solo lista perfiles publicados **y** públicos.

**Idioma e i18n (Fase 6.5)**
- **Dos idiomas: español neutro/mexicano (de «tú») e inglés estadounidense.** El español
  es la fuente —los textos se escribieron así— y también el idioma de respaldo. Se eliminó
  el voseo que se había colado en la primera versión de los textos.
- **`react-i18next` con los catálogos importados, no cargados por HTTP.** Con dos idiomas
  y unos pocos kilobytes, un backend de carga asíncrona solo añadiría un parpadeo de texto
  sin traducir en el primer render y una petición más que puede fallar.
- **La detección se escribió a mano** (quince líneas en `client/src/i18n/index.ts`) en vez
  de usar `i18next-browser-languagedetector`: hacía falta control exacto sobre el orden de
  prioridades y sobre cómo se normaliza `es-MX` → `es`. Se recorre `navigator.languages`
  entera, no solo `navigator.language`: alguien con el sistema en inglés y el español como
  segunda preferencia debe caer en español antes que en el respaldo.
- **Orden de prioridades:** lo elegido en ESTE navegador (`localStorage`) → lo guardado en
  la cuenta → el idioma del navegador → español. El 1 va por delante del 2 a propósito: si
  alguien acaba de pulsar «English», que `/auth/yo` responda `es` medio segundo después no
  puede devolverle la página al español delante de sus ojos.
- **El idioma vive también en la cuenta** (`User.idioma`, migración
  `20260730120000_idioma_usuario`) y no solo en el navegador. No es simetría con el tema:
  en la Fase 8 el servidor tendrá que escribir notificaciones y correos, y para eso
  necesita saber en qué idioma hablarle a cada quien. `PATCH /api/auth/preferencias`, con
  `limiteEscritura` y un `z.enum` cerrado — el idioma acaba en `<html lang>`.
- **Selector en tres sitios**, según quién mire: menú de cuenta (con sesión), botón
  compacto en la navbar de escritorio (sin sesión, que no tiene menú donde buscarlo) y
  sección propia en `/configuracion`. Cada idioma se nombra **en su propio idioma**
  («English», no «Inglés»): quien necesita cambiarlo es, por definición, quien no entiende
  el que está viendo.
- **`Intl` para todo lo que no es una cadena fija:** `PluralRules` vía i18next para
  «1 juego / 5 juegos» y «1 view / 5 views», `toLocaleString` para los miles (56,312 en
  inglés pero 56.312 en español de España — el separador cambia de significado), y
  `RelativeTimeFormat` para los «hace 3 días», donde el orden de las palabras no es algo
  que se pueda parchear con interpolación.
- **Los marcadores de `<Trans>` van por NOMBRE (`<terminos>`), no por índice (`<1>`).**
  Con índices hay que contar los hijos del JSX y ahí cuentan también los `{' '}` sueltos:
  el E2E cazó exactamente ese fallo — el consentimiento del registro renderizaba
  «I accept the and the .», sin los dos enlaces y sin que nada reventara.
- **`<html lang>` se actualiza al cambiar de idioma.** No es cosmético: es lo que usan los
  lectores de pantalla para elegir voz y pronunciación.
- **Las páginas legales NO se traducen.** `/terminos` y `/privacidad` son ~480 líneas de
  prosa jurídica; traducirlas genera una segunda versión que puede decir algo ligeramente
  distinto, y entonces hay que decidir cuál manda. Quedan en español, y
  `AvisoIdiomaLegal` lo dice —en inglés— cuando la interfaz no está en español.
- **Lo que sigue en español: los mensajes de error del backend.** Traducirlos exige que el
  servidor mande un código por cada error de zod, que hay decenas repartidos por todos los
  schemas. Sí están traducidos los que se originan en el cliente (red, timeout) y los
  **códigos** de los flujos externos, que son los que la gente ve a menudo. Ver pendientes.
- Probado E2E contra el sitio real con Playwright, en dos tandas: **detección automática
  por `Accept-Language`** (en-US → inglés, es-MX → español, de-DE → respaldo español),
  cambio manual sin recargar, persistencia tras recargar, **persistencia en la cuenta
  verificada desde un segundo navegador sin `localStorage`**, y ausencia de texto español
  colado en `/editor`, `/configuracion` y el perfil público. **Dos bugs encontrados y
  corregidos**: el de `<Trans>` de arriba y un `PATCH` que mandaba el idioma *viejo*
  (`idioma` en vez de `nuevo`), con lo que la cuenta nunca se enteraba del cambio.

**Social (Fase 7)**
- **API completa en `/api/social`**: seguir/dejar de seguir, bloquear/desbloquear,
  relación entre dos cuentas, publicaciones (crear, editar, borrar, ver, listar por
  autor), comentarios en publicaciones **y** en el muro de un perfil, reacciones, feed,
  `/explorar` y notificaciones. Las tablas ya existían desde la migración inicial; esta
  fase las estrena.
- **Pantallas nuevas**: `/feed` (redactor + publicaciones de quien sigues, protegida) y
  `/explorar` (pública a propósito: es la puerta de entrada de quien llega sin cuenta).
  Las dos sustituyen a su `EnConstruccionPage`. El perfil público estrena `SocialDePerfil`
  —contadores, botón de seguir, publicaciones y muro— pintado con las variables `--p-*`
  del tema del usuario, no con las de Wander.
- **Escritas ya con `t()` desde la primera línea**, en español e inglés. Para esto se hizo
  la 6.5 antes: la fase duplicó el número de pantallas.
- **El bloqueo es simétrico y se comprueba en cada interacción**, no solo al crear la
  relación: alguien puede bloquearte después de que ya te siguiera. Bloquear rompe el
  seguimiento **en ambos sentidos** dentro de la misma transacción y borra las
  notificaciones que esa persona ya había generado — si solo se creara la fila de
  `Bloqueo`, quien fue bloqueado seguiría en la lista de seguidores y seguiría viendo las
  publicaciones, que es justo lo que el bloqueo debía impedir. Desbloquear **no** restaura
  el seguimiento.
- **Bug real corregido en el camino:** el esquema decía que los índices únicos parciales
  de `Reaccion` «se añaden en la migración», pero la migración inicial nunca los añadió —
  creó dos índices únicos normales sobre columnas que pueden ser NULL. Como en Postgres
  dos NULL nunca son iguales, `UNIQUE(userId, publicacionId, tipo)` **no impedía nada**
  cuando `publicacionId` era nulo: un mismo usuario podía dar «me gusta» al mismo perfil
  tantas veces como quisiera e inflar el contador sin límite. Arreglado con índices
  parciales de verdad (`WHERE ... IS NOT NULL`) y verificado con un `INSERT` duplicado
  contra la base real, que ahora sí rebota.
- **Paginación por cursor, nunca por `?pagina=3`.** El offset es incorrecto en un feed:
  si alguien publica entre la página 1 y la 2, todo se desplaza y la 2 repite el último
  elemento de la 1. Se pide siempre un elemento de más que el límite para saber si hay
  página siguiente sin un `count(*)` aparte.
- **`idioma` en `Publicacion`, `Comentario` y `Mensaje`** (migración
  `20260731090000_fase7_social`), detectado al escribir con
  `services/texto.service.ts` — palabras funcionales, sin librería ni llamadas externas.
  **Hoy no lo lee nadie**: la traducción de contenido está aplazada (§8). Se rellena
  igualmente porque es la única pieza de aquel diseño que no se puede añadir después. La
  columna es nullable y `null` significa «no se sabe», no «español»: un DEFAULT sería una
  mentira sobre las filas viejas.
- **El texto se guarda tal cual, y eso es deliberado.** La defensa contra XSS es que el
  cliente lo pinta como texto (`{texto}` en JSX, jamás `dangerouslySetInnerHTML`), así que
  un `<script>` se ve literalmente. «Sanitizar» el texto rompería una publicación
  legítima sobre código (`if (a < b && c > d)`). Lo que sí se quita son los caracteres de
  control invisibles, incluidos los **bidi** (el truco del *Trojan Source*, que hace que
  un texto se renderice en un orden distinto al que tiene guardado).
- **El nombre del juego lo resuelve el servidor** contra la caché de Steam del autor; el
  cliente solo manda el `appid`. Aceptar el nombre permitiría inventarse juegos o colar
  variantes con espacios raros, y el filtro por juego dejaría de agrupar nada.
- **`pg_trgm` + índices GIN** en `handle` y `displayName`: sin ellos, cada búsqueda de
  `/explorar` es un recorrido completo de la tabla de usuarios. Más índices parciales
  `WHERE borradoEn IS NULL` para el feed y los hilos, que son las únicas filas que se
  miran nunca.
- Probado E2E por HTTPS contra el sitio real: **45 comprobaciones, todas en verde** —
  flujo feliz completo (publicar, seguir, feed, reaccionar, comentar, muro, explorar,
  notificaciones) más los casos de seguridad: publicar sin sesión, campo extra,
  texto vacío, texto de 1001 caracteres, tipo de reacción inventado, `q` de 41
  caracteres, parámetro de query inventado, editar y borrar contenido ajeno, y las cinco
  vías que el bloqueo tiene que cortar (comentar, reaccionar, seguir, ver el muro, y el
  seguimiento roto en ambos sentidos).

**Mensajería, adjuntos y notificaciones (Fase 8)**
- **La tabla ya estaba: esta fase no necesitó migración.** `Conversacion`, `Participante`,
  `Mensaje` y `Archivo` se crearon en la migración inicial, y `Mensaje.idioma` lo añadió la
  Fase 7 con la tabla vacía a propósito. Se estrenan aquí sin tocar el esquema.
- **socket.io en `/chat`, autenticado con la MISMA cookie httpOnly del REST.** No se acepta
  token por query ni por `auth`: si se admitiera, habría que ponerlo al alcance del
  JavaScript de la página y se perdería justo la propiedad que hace la cookie resistente a
  XSS. La autenticación va en un middleware del namespace, así que un cliente sin sesión se
  rechaza **antes** de que el socket quede establecido.
- **Persistencia primero, socket después, en todos los endpoints.** El REST es la fuente de
  verdad y el socket solo acelera — el chat funciona entero detrás de un proxy que bloquee
  websockets, y por eso el cliente arranca en polling y sube a websocket si puede, en vez
  de forzar `transports: ['websocket']`.
- **En el socket NO se escribe nada en la base.** El único evento entrante que se acepta es
  `escribiendo`, que es efímero por naturaleza. Todo lo que persiste va por REST, donde ya
  viven zod, el rate limit y los permisos: dos caminos de escritura con dos copias de las
  reglas es la forma segura de que un día una de las dos se quede corta.
- **`conv:entrar` verifica la pertenencia contra la base cada vez.** Sin eso, cualquiera con
  sesión válida podría suscribirse a un id ajeno y escuchar en vivo una conversación que no
  es suya. Es el `exigirParticipante` del socket, y es lo que sostiene la privacidad del
  chat en tiempo real.
- **No-participante devuelve 404, nunca 403.** Un 403 confirmaría que esa conversación
  existe; el 404 no distingue "no existe" de "no es tuya".
- **`privacidadDm` con tres modos**, y el bloqueo comprobado **por encima** de la
  preferencia: aunque tengas los DMs abiertos a todos, quien bloqueaste no entra. Las reglas
  se aplican al **abrir** el hilo; una vez existe, la conversación ya está consentida — pero
  escribir vuelve a comprobar el bloqueo, porque te pueden bloquear después (verificado en
  el E2E).
- **Añadir a alguien a un grupo no es la vía para saltarse un bloqueo**: se comprueba al
  crear el grupo y al añadir participantes.
- **Al salir el último ADMIN se asciende al participante más antiguo.** Un grupo sin
  administrador queda congelado para siempre: nadie puede renombrarlo ni moderar, y no hay
  forma de arreglarlo desde dentro.
- **Los mensajes de sistema guardan una CLAVE, no una frase.** `{"evento":
  "participante-anadido", ...}` y `t()` lo traduce al pintarlo: el mismo evento lo leen
  personas con la interfaz en español y en inglés, y una frase guardada quedaría congelada
  en el idioma de quien la provocó.
- **Un mensaje borrado no se sirve con su texto.** El borrado es suave para no romper los
  hilos que responden a él, pero eso es almacenamiento: hacia fuera, borrado significa que
  el contenido ya no está. Si se mandara con una marca y lo ocultara React, seguiría
  viajando en el JSON — el mismo error que se evitó con el consentimiento de la Fase 6.
- **Subidas: el filtro son los magic bytes, no el nombre ni el `Content-Type`.** Ambos los
  escribe quien sube. Y ni eso basta: las imágenes se **reescriben** con sharp, así que lo
  que se guarda es un archivo generado por nosotros a partir de los píxeles. Con eso se van
  los EXIF (incluida la geolocalización de una foto), los perfiles de color raros y
  cualquier payload embebido. **Verificado en el E2E:** un HTML con `<script>` subido como
  `inofensiva.png` con `Content-Type: image/png` se rechaza.
- **`memoryStorage` y no `diskStorage`**: guardar en disco antes de validar deja una ventana
  en la que un archivo sin verificar existe en el servidor.
- **`limitInputPixels` contra las bombas de descompresión.** Un PNG de 4 KB puede declarar
  50000×50000 px: pasa el límite de tamaño sin problema porque comprimido es diminuto, y
  revienta la memoria al expandirse. Lo que hay que limitar es el tamaño **descomprimido**.
- **SVG no está en la lista blanca, y su ausencia es deliberada**: es XML que puede llevar
  `<script>`, o sea un vector de XSS disfrazado de imagen.
- **La subida va separada de enviar.** El archivo se registra sin dueño y se ata al mandar
  el mensaje; así se ve la miniatura mientras se escribe y una foto de 6 MB no bloquea el
  envío. Un job barre cada 6 h los que nunca se llegaron a usar.
- **Los GIFs de Giphy pasan por un proxy nuestro**: la clave no viaja en el bundle y la CSP
  sigue con `connect-src 'self'`. Solo se guarda la URL (`externo: true`), y **solo de hosts
  del proveedor** — aceptar una URL arbitraria haría que cada persona que abre el chat
  pidiera una imagen a un servidor cualquiera y le revelara su IP.
- **Campana de notificaciones** con dos piezas separadas: un `contador` que solo hace un
  `count` (se pide en cada carga) y la lista, que solo se pide al abrir el panel. Se
  actualiza por socket, así que se enciende sola sin sondear. **Cada notificación lleva el
  contexto para enlazar a la interacción exacta** — `comentarioId` incluido, para aterrizar
  en el comentario y no arriba del hilo.
- **`/publicacion/:id` nace en esta fase** porque las notificaciones necesitan un destino:
  una que solo pudiera abrir el feed obligaría a buscar la publicación entre todas, y si ya
  bajó del feed sería imposible encontrarla.
- **emoji-mart montado con la API imperativa, no con `@emoji-mart/react`.** El wrapper crea
  un web component y gestiona su ciclo de vida por su cuenta, lo que choca con el doble
  montaje del modo estricto de React 19. Sus datos (~900 KB) se cargan con `import()`
  dinámico: en el bundle principal los descargaría todo el mundo, incluido quien solo entra
  a ver un perfil. **Comprobado en un navegador real** que monta y que monta *una sola vez*.
- **`file-type` 22 es ESM puro y el servidor es CommonJS.** Se carga con `import()` dinámico
  con el especificador en una variable (si no, `moduleResolution: node` intenta resolver sus
  tipos y falla). TypeScript lo emite como `require()`, y eso funciona porque **Node 22
  carga ESM desde `require`** — verificado dentro del contenedor, no solo en la máquina de
  desarrollo. Si algún día se baja de Node 22, esto es lo primero que se rompe.
- **Tres bugs reales cazados por las pruebas, no leyendo el código:**
  1. **`/uploads/` devolvía 404 en archivos que SÍ existían.** El bloque de nginx tenía un
     `alias` dentro de una `location ~*` anidada; en una location con regex, `alias` solo
     funciona bien si la ruta usa las capturas de la propia regex. Reescrito con `root`, y
     la lista negra de extensiones ejecutables movida delante (en nginx gana la primera
     regex que casa). Sin la prueba que **pedía el archivo por HTTP** en vez de mirar el
     disco, esto llegaba a producción y ninguna imagen se veía.
  2. **Abrir un DM «consigo mismo» devolvía 200 con la conversación de otra persona.**
     `buscarDm(yo, yo)` sí encuentra hilos, porque las dos condiciones `some` se satisfacen
     con la MISMA fila de participante, y la validación vivía después. Ahora va antes.
  3. **`uploads/` era de root y el backend corre como `node` (uid 1000):** toda subida
     habría fallado con EACCES. Detectado probando la escritura dentro del contenedor antes
     de desplegar.
- **Fuga de filas encontrada al limpiar las pruebas:** `Conversacion` no tiene FK a `User`
  (su `creadorId` es un campo suelto), así que al borrarse todas las cuentas de un hilo la
  conversación sobrevive sin participantes — invisible e imborrable. Se añadió
  `limpiarConversacionesVacias` al barrido de cada 6 h.
- Probado E2E por HTTPS contra el stack vivo: **74 comprobaciones, todas en verde**
  (`docs/pruebas/e2e-fase8.mjs`) — flujo feliz completo (DM, grupo, adjuntos, publicar con
  imagen, notificaciones) más los casos de seguridad: leer/escribir en conversación ajena,
  escribir sin sesión, campo `autorId` colado, mensaje vacío y de 4001 caracteres, editar el
  mensaje de otro, HTML disfrazado de PNG, `uso` inventado, adjunto ajeno, adjunto
  reutilizado, GIF de host arbitrario, GIF por http://, MIEMBRO renombrando un grupo, ajeno
  leyendo un grupo, lectura tras salir, y el bloqueo cortando un DM que ya existía.
  **Más 16 comprobaciones de interfaz con un navegador real** (Playwright): la campana abre,
  el picker de emojis monta bajo React 19 sin duplicarse, Giphy devuelve resultados, el chat
  se pinta, el socket conecta y la interfaz sale en inglés con `locale: en-US`.

**CSS propio (Fase 9)**
- `services/sanitizar.service.ts`: PostCSS con el parser **estricto** (si no parsea, se
  rechaza con el error de sintaxis y la línea), prefijado de **cada** selector con
  `#perfil-<id>`, lista negra de propiedades y valores, tope de 20 KB y de 400 reglas.
- El editor tiene su panel de CSS con textarea, botón de guardar, botón de **restaurar** y
  una lista de **avisos de lo que se quitó** — un sanitizador mudo deja a la persona
  mirando un CSS que no hace nada sin saber por qué.
- Se guardan **dos** versiones: `cssPropio` (sanitizado, lo único que se sirve al público)
  y `cssOriginal` (lo que escribió, solo para su dueño, para poder seguir editándolo).
- **No hizo falta migración:** las dos columnas ya venían de la migración inicial.
- **Bug encontrado con el navegador, no leyendo código:** `varsDeTema()` ponía el fondo, el
  color y la tipografía como estilo **en línea**, y un estilo en línea gana a cualquier
  hoja de estilos — así que el `body { background: … }` de quien escribiera su CSS (que el
  sanitizador reescribe al contenedor) no hacía nada. Se movieron a la clase
  `.perfil-raiz` de `global.css`, que sí se puede sobreescribir. La suite HTTP daba las 58
  comprobaciones en verde con el bug presente.
- Probado E2E contra el stack vivo: **58 comprobaciones, todas en verde**
  (`docs/pruebas/e2e-fase9.mjs`), escritas como una lista de ataques — `body{display:none}`,
  `.navbar{display:none}`, `position: fixed`/`sticky`, `@import`, `@font-face`, `url()` a
  host externo y por protocolo relativo, `data:text/html`, `expression()`, `-moz-binding`,
  `behavior`, `content: attr()`, una `url()` externa escondida en una variable CSS, un CSS
  de 30 KB, uno de 500 reglas, uno con la llave sin cerrar, y un perfil intentando escribir
  CSS bajo el scope de otro. **Más 9 comprobaciones en un navegador real** (Playwright):
  la navbar de Wander sigue visible, el `<body>` del documento no cambia de color, el
  contenedor del perfil sí lo hace, y el `<style>` inyectado no tiene ni un selector sin
  prefijar.

### ⬜ Lo siguiente

1. **Fase 10 — Pulido.** Landing completa, tarjetas OG, moderación en `/admin`, el resto de
   los bloques (Setup PC, Galería), accesibilidad y responsive.
2. **Verificación de correo (lo que falta de la Fase 2), cuando haga falta.** Aplazada el
   30/07 — ver la nota en los pendientes.
3. Opcional de la Fase 4, si se quiere más adelante: que una plantilla pueda traer
   también un **set inicial de bloques** (hoy solo trae tema). Se dejó fuera a propósito
   — aplicarla a un perfil ya escrito tendría que decidir qué hacer con lo que ya hay,
   y "solo cambia los colores" es una promesa mucho más fácil de cumplir.

### ⚠️ Pendientes que conviene no olvidar

- **Regenerar la Steam API key** en `steamcommunity.com/dev/apikey` antes de abrir el
  registro: la actual se compartió por chat durante la planeación.
- **Aviso de `npm audit` en `react-router` 7.18.2 (visto el 31/07).** Es
  `GHSA-qwww-vcr4-c8h2`, un bypass de CSRF **del modo RSC**. **No aplica a Wander**: aquí
  `react-router-dom` se usa como SPA, sin RSC ni Server Actions, así que el código
  vulnerable ni se carga. No se bajó de versión porque `npm audit fix --force` instala
  7.11.0, que es un cambio mayor hacia atrás. Conviene subir cuando publiquen el parche.
- **Cuota de subidas: 500 MB por cuenta y 8 MB por archivo, sin panel para verlo.** El
  backend los aplica, pero el usuario no tiene forma de saber cuánto lleva usado hasta que
  algo se rechaza. Cuando haya usuarios reales, conviene un indicador en `/configuracion`.
- **Los adjuntos no se borran del disco al borrar el mensaje.** El borrado de mensajes es
  suave (`borradoEn`), y `limpiarHuerfanos` solo barre los que nunca se ataron a nada. Un
  archivo de un mensaje borrado sigue ocupando disco y sigue siendo accesible por su URL
  (que es un uuid impredecible, pero accesible). Decidir si se borran de verdad —y con qué
  margen— es trabajo aparte, no un retoque.
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
- ~~**Términos y privacidad mínimos antes de abrir el registro.**~~ ✅ **Hecho (30/07).**
  Ambas páginas son reales: `/privacidad` salió con la Fase 6 y `/terminos` se escribió
  justo después, al detectar el usuario que el formulario obligaba a aceptar un documento
  que seguía "en construcción". Los términos **no prometen backups** a propósito, porque
  todavía no los hay — ver el pendiente de más abajo.
- **Backups de Postgres.** `pgdata/` es un bind-mount sin ninguna estrategia de
  respaldo: un fallo de disco se lleva todos los usuarios. Un `pg_dump` diario a otro
  disco (cron del host o contenedor dedicado) es suficiente al principio. **Los términos
  evitan a propósito prometer copias de seguridad** mientras esto siga pendiente.
- **Al correr suites E2E: limpiar después y contar con el límite de registro.**
  `limiteRegistro` son 5 cuentas por hora **y por IP**, así que una tanda de pruebas deja
  al usuario real sin poder registrarse desde su propia conexión — pasó el 30/07. El
  contador vive **en memoria**: `docker compose restart backend` lo pone a cero. Las
  cuentas de prueba se borran con
  `DELETE FROM "User" WHERE email LIKE '%@ejemplo.test';` y el `onDelete: Cascade` se
  lleva perfil, bloques, sesiones y caché (verificado: quedaron 0 huérfanos).
  Ojo también con **`CF-Connecting-IP`: Cloudflare devuelve 403** si llega falsificada
  desde fuera, así que simular varias IPs solo funciona desde dentro de la red Docker
  (`WANDER_INTERNO=1` en la suite).
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
- **Los mensajes de error del backend siguen en español** (pendiente que deja la Fase
  6.5). Un usuario con la interfaz en inglés ve inglés en todas partes menos cuando un
  endpoint rechaza algo: ahí `mensajeError` pinta tal cual lo que manda el servidor.
  Arreglarlo bien significa que el backend devuelva un **código** por error y que el
  cliente lo resuelva contra su catálogo — el mismo patrón que ya usan los flujos externos
  (`lib/erroresExternos.ts`). Son decenas de mensajes repartidos por todos los schemas de
  zod, así que es una tarea con nombre propio, no un retoque. Mientras tanto los que más
  se ven —red, timeout y los códigos de OAuth/Steam— sí están traducidos.
  Lo mismo aplica a las listas de «qué leemos / qué guardamos» de `/privacidad` y de la
  pantalla de consentimiento: las redacta `cuentas.controller.ts`.
- **Páginas legales en un solo idioma.** `/terminos` y `/privacidad` son ~480 líneas de
  prosa jurídica y **no** se meten en los catálogos de i18n: traducir términos legales
  tiene consecuencias que no son técnicas. Quedan en español con el aviso de que la
  versión en español es la que rige. Si algún día se traducen, van como documento
  aparte por idioma, no como cadenas sueltas.
- **Traducción de contenido: aplazada hasta nuevo aviso (30/07).** No se construye en la
  Fase 8 ni en ninguna fecha fijada. La gente lee las publicaciones y los mensajes en su
  idioma original y se entiende con lo que sabe; el idioma de la **interfaz** sí está
  resuelto (Fase 6.5) y es lo que de verdad hacía falta. El diseño con DeepL queda
  escrito en §8 por si algún día se retoma, junto con lo que habría que vigilar entonces
  (el plan gratuito son 500.000 caracteres al mes **para toda la plataforma**, no por
  usuario, así que haría falta un tope y decidir qué pasa al agotarse). Lo único que se
  adelanta es el campo `idioma` del contenido, porque es el único pedazo que no se puede
  añadir después: rellenarlo exige preguntárselo a quien escribió el texto.

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
| Idioma | Español neutro/mexicano + inglés estadounidense, con `react-i18next` (Fase 6.5) |
| Traducir contenido | ⏸️ **Aplazado hasta nuevo aviso** (30/07). Cada quien lee en el idioma original y conversa con lo que sabe. El diseño con DeepL queda escrito en §8 para retomarlo mucho después, si hace falta. Solo se conserva el campo `idioma` en el contenido. |
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
| i18n | `i18next` 26 + `react-i18next` 17 | Español e inglés (Fase 6.5). Catálogos importados, sin backend de carga: con dos idiomas no compensa. |
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
- **Discord / Google** ✅ — OAuth 2.0 con PKCE (S256), implementado a mano en
  `services/oauth.service.ts`. Se descartó `openid-client`: traía descubrimiento
  dinámico y negociación para dos proveedores fijos y conocidos, y el `state` firmado
  que necesitábamos (con la intención dentro) había que escribirlo igual.

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

### CSS propio — la parte delicada ✅ (Fase 9)

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

Lo que se añadió al implementarlo y no estaba en este diseño:

8. **Los `@keyframes` se renombran** a `p-<perfilId>-<nombre>`, y sus referencias en
   `animation`/`animation-name` con ellos. El nombre de una animación es **global al
   documento**: prefijar selectores no lo aísla, así que un `@keyframes spin` de un
   usuario le pisaba el `spin` de la interfaz de Wander mientras su perfil estuviera
   abierto. Los fotogramas (`from`, `to`, `50%`) **no** se prefijan: no son selectores.
9. **Parser estricto, nunca `postcss-safe-parser`.** El parser tolerante arregla CSS roto
   adivinando la intención, y adivinar en una frontera de seguridad es justo lo que crea
   los bypass: un CSS que el sanitizador y el navegador leen distinto. Si no parsea, se
   rechaza con la línea del error.
10. **Reglas anidadas no se vuelven a prefijar.** Su padre ya está prefijado, y volver a
    hacerlo cambiaría a qué casan (en `.a { &:hover {} }` el `&` es `.a`, no el
    contenedor).
11. **Avisos de lo que se quitó**, devueltos en la respuesta del PATCH. Sanitizar en
    silencio deja a la persona mirando un CSS que no hace nada sin saber por qué.
12. El fondo del perfil vive en la clase `.perfil-raiz`, **no** en un estilo en línea: un
    estilo en línea gana a cualquier hoja de estilos y dejaría el `body { background: … }`
    del usuario sin efecto para siempre.

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
| Estado de Discord ✅ | En línea, qué juega — **en vivo** | Lanyard |
| Spotify ✅ | Canción sonando — **en vivo** | Lanyard |
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

### Social ✅ (Fase 7)

Seguir · feed de a quién sigues · publicaciones · comentarios en publicaciones y en el
muro de un perfil · reacciones · bloqueo · notificaciones · `/explorar` con búsqueda y
filtro por juego.

Queda fuera de la v1 el filtro por **plataforma y etiqueta** de `/explorar`: hoy no hay
ni etiquetas ni más plataforma que Steam, así que serían dos desplegables con una sola
opción. Vuelven cuando haya de qué filtrar.

---

## 8. Mensajería

> ✅ **Implementada el 31/07 (Fase 8).** Lo que sigue era el diseño previo y se cumplió
> casi tal cual; lo aprendido al construirlo —y los tres bugs que cazaron las pruebas—
> está en §0. La única parte que **no** se construyó es la traducción de contenido, que
> sigue aplazada (ver el recuadro más abajo).

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

**Traducción de mensajes y publicaciones — ⏸️ APLAZADA HASTA NUEVO AVISO (30/07)**

> **Esto NO se construye en la Fase 8.** Queda como idea a retomar mucho más adelante, y
> solo cuando de verdad haga falta: cuando haya gente suficiente escribiendo en idiomas
> distintos como para que el idioma sea un estorbo real, no una hipótesis. Mientras tanto
> las publicaciones y los mensajes se leen **en su idioma original** y quien conversa lo
> hace con lo que sabe, como en cualquier chat de juego.
>
> **Qué implica el aplazamiento:** no se contrata DeepL, no se añade `DEEPL_API_KEY`, no
> se crea el modelo `Traduccion` ni el endpoint ni el botón «Ver traducción». Lo que sí
> se hace igual es **el campo `idioma` en `Publicacion`, `Comentario` y `Mensaje`**, por
> el motivo que ya estaba escrito abajo: añadir esa columna cuando la tabla ya tiene
> filas obliga a adivinar el idioma de textos viejos, y eso no tiene arreglo después. Es
> barato ahora y caro luego, así que se rellena desde el primer día aunque nadie lo lea
> todavía.
>
> El resto de esta sección queda tal cual, como el diseño ya pensado para el día que se
> retome. Nada de lo que sigue está implementado.

Dos personas que hablan idiomas distintos escriben cada una en el suyo, y quien lee
decide si quiere la traducción. El modelo es el de X: un botón «Ver traducción» debajo
del mensaje, nunca automático.

**Proveedor: la API de DeepL** (decidido el 30/07). El nivel gratuito son 500.000
caracteres al mes, que para el volumen de la v1 sobra, y la calidad en el par
inglés↔español es la mejor de las opciones evaluadas. Se descartaron Google Cloud
Translation (más idiomas y más barato a escala, pero nada de eso hace falta todavía) y
Claude vía la API de Anthropic (mejor con jerga gamer y apodos, pero se paga desde el
primer carácter — reconsiderar si la calidad de DeepL con abreviaturas de gamer resulta
pobre en la práctica). Clave en `DEEPL_API_KEY`; el endpoint del plan gratuito es
`api-free.deepl.com`, **distinto** del de pago (`api.deepl.com`) — mandar a la URL
equivocada devuelve 403 y parece un problema de clave.

**La regla que ordena la fase es la misma de la Fase 5: el render nunca llama a DeepL.**
Lee de Postgres. La traducción se pide una sola vez por (mensaje, idioma destino), se
guarda, y el resto de la gente la lee de la base. En un grupo de 20 personas, la primera
paga la llamada y las otras 19 no cuestan nada.

```prisma
model Traduccion {
  id            String   @id @default(cuid())
  // Excluyentes: una traducción es de un mensaje O de una publicación/comentario.
  mensajeId     String?
  publicacionId String?
  comentarioId  String?
  idiomaDestino String   // 'es' | 'en'
  texto         String   @db.Text
  proveedor     String   @default("deepl")
  createdAt     DateTime @default(now())
  @@unique([mensajeId, idiomaDestino])
  @@unique([publicacionId, idiomaDestino])
  @@unique([comentarioId, idiomaDestino])
}
```

`Mensaje`, `Publicacion` y `Comentario` llevan además un campo `idioma String?`, que se
rellena **al escribir** el contenido. Añadirlo en la Fase 7 y no aquí: poner la columna
cuando ya hay filas con texto obliga a rellenarlas a posteriori, y el idioma de un texto
viejo ya no se puede preguntar a quien lo escribió. Con `idioma` nulo, el botón
simplemente no aparece.

- **El botón solo se ofrece si `idioma` ≠ idioma de quien mira.** Detección al guardar,
  local y sin llamadas externas.
- **Traducir un DM privado es mandárselo a un tercero.** Por eso el botón es explícito:
  quien lo pulsa consiente ese envío. Va dicho en `PRIVACIDAD.md` y en la interfaz, y es
  la razón principal para no traducir de oficio.
- **Límite de tasa propio**, como el `limiteOAuth` de Steam, más un tope de caracteres
  por usuario y día. Es un endpoint que gasta cuota ajena: sin tope, alguien pega un
  texto enorme en bucle y deja el mes sin traducciones para todos.
- **Solo el texto original.** Nunca traducir handles, títulos de juegos, ni retraducir lo
  ya traducido.
- Se muestra bajo el original, con la marca de «traducido automáticamente» y la opción de
  volver a ver el original. El original nunca se sustituye ni se pierde.

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
│       │   ├── steam.service.ts       # Web API + filtro vacBanned
│       │   ├── steamAuth.service.ts   # OpenID 2.0 + check_authentication
│       │   ├── oauth.service.ts       # PKCE + state firmado (Discord/Google)
│       │   ├── lanyard.service.ts     # presencia de Discord y Spotify
│       │   ├── cache.service.ts       # get-or-fetch con TTL
│       │   ├── social.service.ts      # bloqueo simétrico + notificaciones
│       │   ├── texto.service.ts       # limpieza + detección de idioma
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
        ├── lib/{tema,idioma,bloques}.ts
        ├── i18n/
        │   ├── index.ts           # init + detección de idioma
        │   └── locales/{es,en}.ts # `en` tipado contra la forma de `es`
        ├── components/
        │   ├── {SelectorIdioma,AvisoIdiomaLegal}.tsx
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
                               # (DEEPL_API_KEY: no se usa — traducción aplazada, §8)
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
| 2 | 🟡 **Auth** | Correo+contraseña (zod, argon2id, JWT en cookie httpOnly, rate limit) ✅ + Steam OpenID ✅. Registro, login, logout y sesión persistente ✅. Steam distingue entrar de vincular con el mismo `state` firmado que OAuth (corregido el 31/07; ver el histórico al final de §11). Falta solo la verificación de correo, aplazada (ver §0). |
| 3 | ✅ **Perfil mínimo** | `Perfil`+`Bloque`, editor con 3 bloques (Hero, Texto, Enlaces), reordenar, `/u/:handle` público. **Aquí ya es usable.** |
| 4 | ✅ **Tema y plantillas** | `PanelTema` y vista previa en vivo (salieron con la Fase 3) + las 5 plantillas y su selector con miniaturas. El tema lo escribe el servidor desde el catálogo. |
| 5 | ✅ **Steam** | `steam.service.ts` (Web API, sin tocar `vacBanned`), `cache.service.ts` con TTL y circuit breaker, bloques de Actividad / Estadísticas / Favoritos, job de refresco. |
| 6 | ✅ **Cuentas vinculadas** | Discord y Google por OAuth 2.0 con PKCE, `/configuracion` con consentimiento granular, vincular/desvincular con borrado real, `PRIVACIDAD.md` y `/privacidad`. Bloques de Discord y Spotify vía Lanyard. |
| 6.5 | ✅ **i18n** | `react-i18next`, catálogos `es`/`en`, selector en navbar y `/configuracion`, detección por navegador con respaldo a español, `User.idioma` para que la preferencia siga al usuario entre dispositivos. Se hizo **antes** de la 7 porque la Fase 7 duplica el número de pantallas: cada una escrita sin i18n habría que reabrirla. Los errores de zod del backend quedan pendientes (ver §0). |
| 7 | ✅ **Social** | Seguir, feed, comentarios, likes, `/explorar` con búsqueda. Añade `idioma` a `Publicacion` y `Comentario` — **no** para traducir (eso está aplazado), sino porque esa columna solo se puede rellenar bien mientras no haya filas viejas. |
| 8 | ✅ **Mensajería + adjuntos + notificaciones** | socket.io en `/chat` autenticado con la cookie de sesión, DMs y grupos, `privacidadDm` y bandeja de solicitudes. Subidas validadas por magic bytes y reescritas con sharp, emojis, GIFs de Giphy por proxy. Campana de notificaciones que enlaza a la interacción exacta. **Sin traducción**: aplazada hasta nuevo aviso (§8). |
| 9 | ✅ **CSS propio** | `sanitizar.service.ts` con PostCSS (parser estricto), prefijado de scope, lista negra, renombrado de `@keyframes`, avisos de lo que se quitó y botón de restaurar. Al final a propósito: es lo más riesgoso y no bloquea nada. |
| 10 | **Pulido** | Landing completa, tarjetas OG, moderación en `/admin`, resto de bloques, accesibilidad, responsive. |
| 11 | **Música de fondo** | Subida de audio validada por contenido, reproductor al 30 % con control del visitante, ajuste global para silenciar todo (§7). |
| 12 | **SEO + GEO** | JSON-LD, `sitemap.xml`, `robots.txt`, `llms.txt`, `hreflang` (§13). Landing ✅; el SSR de perfiles quedó decidido: SPA en la v1 (ver §0). |

### Registro de cambios

El estado actual está en **§0** al inicio del documento. Aquí solo queda el histórico de
qué se hizo y cuándo.

**31/07/2026 — Vincular Steam creaba una segunda cuenta (corregido)**

Lo encontró un usuario de prueba: entró con Google, pulsó «conectar Steam» en
`/configuracion` y acabó con **dos cuentas separadas** en vez de una vinculada.

- **La causa.** El flujo de Steam no distinguía «entrar» de «vincular». `iniciarSteam` era
  un `res.redirect()` que no miraba la sesión, y el callback, al no encontrar el SteamID,
  caía siempre en la rama de cuenta nueva. OAuth (Discord/Google) sí hacía esa distinción
  desde la Fase 6; Steam se quedó atrás porque llegó antes, en la Fase 2.
- **El arreglo.** Steam usa ahora el **mismo `state` firmado** que OAuth: la intención se
  decide al salir (según haya sesión o no) y viaja dentro. Se reutilizó `crearState`/
  `leerState` en vez de escribir una pieza paralela, para que ambos flujos caduquen, se
  firmen y se validen igual. `authOpcional` en la ruta `/api/auth/steam` es lo que permite
  ver la sesión al salir.
- **El `state` va dentro de `openid.return_to`**, porque OpenID 2.0 no tiene campo propio
  para él. Y `verificarRespuestaSteam` comprueba que el `state` de la query **coincida con
  el del `return_to` firmado**: sin eso el state sería decorativo —va fuera de los campos
  `openid.*`, así que cambiarlo no rompe la firma de Steam— y se podría pegar una respuesta
  legítima al flujo de otra persona.
- **De regalo, la protección CSRF** que este callback no tenía, y que OAuth sí.
- **Vincular Google/Discord adopta el correo verificado** si la cuenta no tenía ninguno.
  Quien se registra con Steam no tiene correo ni contraseña: sin esto quedaba con Steam
  como único acceso para siempre. Solo se adopta si el campo estaba vacío — sobrescribir un
  correo existente cambiaría en silencio la vía de recuperación de la cuenta.
- Las dos cuentas del incidente se borraron para que la persona pudiera repetirlo limpio.

**31/07/2026 — Fase 9 desplegada: CSS propio con red debajo**

- **`sanitizar.service.ts`**: PostCSS con el parser estricto, prefijado de cada selector
  con `#perfil-<id>`, `:root`/`html`/`body` reescritos al contenedor, lista negra de
  propiedades (`behavior`, `-moz-binding`, `content`) y de valores (`expression()`,
  `javascript:`, `image-set()`), `position: fixed|sticky` fuera, `url()` solo a `/uploads/`
  o `data:` de imagen, at-rules por lista blanca y topes de 20 KB y 400 reglas.
- **Los `@keyframes` se renombran** a `p-<perfilId>-<nombre>`: el nombre de una animación
  vive en un espacio global, así que un `@keyframes spin` de un usuario le pisaba el `spin`
  de la interfaz de Wander a todo el que abriera su perfil. Prefijar selectores no cubre
  esto porque el problema no está en el selector.
- **Panel de CSS en el editor** con avisos de lo que se quitó y botón de restaurar. No hay
  guardado automático a propósito: el CSS a medio escribir es CSS inválido.
- **El fondo del perfil pasó de estilo en línea a la clase `.perfil-raiz`.** Lo encontró el
  navegador: un estilo en línea gana a cualquier hoja de estilos, así que el
  `body { background: … }` del usuario no podía verse nunca. Las 58 comprobaciones HTTP
  estaban en verde con el bug puesto.
- **Sin migración**: `cssPropio` y `cssOriginal` ya estaban en el schema desde la inicial.

**31/07/2026 — Fase 8 desplegada: la gente ya se habla**

- **Mensajería completa**: DMs y grupos (hasta 50), bandeja con solicitudes de
  desconocidos, `privacidadDm`, silenciar, salir, roles de ADMIN y mensajes de sistema.
  socket.io en `/chat` autenticado con la misma cookie httpOnly del REST.
- **Adjuntos en el chat y en las publicaciones**: imágenes, GIFs, video y audio, validados
  por **contenido real** (magic bytes) y reescritos con sharp para tirar los EXIF. Selector
  de emojis y buscador de GIFs de Giphy vía proxy propio, los dos compartidos entre el feed
  y el chat.
- **Campana de notificaciones** en la navbar, con panel, contador en vivo por socket y
  navegación al punto exacto de la interacción (incluido el comentario concreto dentro de
  un hilo). Nace también `/publicacion/:id`, que es a donde llevan.
- **Ya no queda ninguna pantalla "en construcción".**
- **Tres bugs cazados por las pruebas y no leyendo código:** el bloque `/uploads/` de nginx
  daba 404 en archivos que existían (`alias` dentro de una `location` con regex); abrir un
  DM consigo mismo devolvía la conversación de otra persona; y `uploads/` era de root, con
  lo que toda subida habría fallado con EACCES. Además se encontró una fuga de filas:
  `Conversacion` no tiene FK a `User`, así que sobrevivía a la desaparición de todos sus
  participantes — ahora la barre un job.
- **74 comprobaciones E2E por HTTPS + 16 de interfaz con un navegador real**, todas en
  verde. Estas últimas confirmaron lo que la suite HTTP no puede ver: que emoji-mart monta
  bajo React 19 sin duplicarse por el modo estricto.

**31/07/2026 — Fase 7 desplegada: Wander deja de ser perfiles sueltos**

- API completa en `/api/social`: seguir, bloquear, publicaciones, comentarios (en
  publicaciones y en el muro de un perfil), reacciones, feed, `/explorar` y
  notificaciones. Pantallas `/feed` y `/explorar`, y bloque social en el perfil público
  con el tema del propio usuario.
- **Traducción de contenido aplazada hasta nuevo aviso** (decisión de este día). No se
  construye en la Fase 8 ni tiene fecha: la gente lee en el idioma original y conversa
  con lo que sabe. El diseño con DeepL queda escrito en §8 por si se retoma. Lo único que
  se adelantó es el campo `idioma` del contenido, porque es lo único que no se puede
  añadir después.
- **La migración destapó un bug que llevaba ahí desde la inicial:** los índices únicos de
  `Reaccion` no eran parciales, así que no impedían nada sobre columnas NULL — se podía
  dar «me gusta» al mismo perfil infinitas veces. Corregido y verificado contra la base
  real.
- Verificado E2E por HTTPS contra el sitio real: 45 comprobaciones, 0 fallos, incluidas
  las cinco vías que el bloqueo tiene que cortar.

**31/07/2026 — Fase 6.5 desplegada: la interfaz habla dos idiomas**

- `react-i18next` con catálogos `es`/`en` importados (no cargados por HTTP), tipados uno
  contra otro: al inglés no le puede faltar una clave sin que falle la compilación.
- Toda la interfaz extraída — landing, auth, editor, `/configuracion`, perfil público,
  bloques y los formateadores de Steam y Discord. Unas 400 cadenas.
- Detección por `navigator.languages` con respaldo a español, elección manual desde tres
  sitios distintos y `User.idioma` para que la preferencia cruce dispositivos.
- Las páginas legales se quedan solo en español a propósito, con aviso.
- Verificado con Playwright contra `wander.ourocore.net`, no en local. **Encontró dos
  bugs que el typecheck y el build no podían ver**: `<Trans>` con marcadores por índice
  perdía los enlaces del consentimiento («I accept the and the .»), y el `PATCH` de
  preferencias mandaba el idioma que se estaba abandonando en vez del elegido. Los dos
  corregidos y vueltos a verificar.

**30/07/2026 — Fase 6 desplegada: cuentas vinculadas**

- OAuth 2.0 con PKCE (S256) para Discord y Google, escrito a mano. `state` firmado con
  HMAC que transporta intención, usuario, verificador y caducidad — sin tabla que limpiar
  ni viaje a la DB por callback.
- `/configuracion` con consentimiento granular sobre un catálogo cerrado de permisos, y
  la pantalla de "qué se lee / qué se guarda / qué NO se pide" **antes** de salir al
  proveedor. `PRIVACIDAD.md` + `/privacidad`, servida del mismo endpoint para que no
  puedan contradecirse.
- Bloques de **Estado de Discord** y **Spotify** en vivo vía Lanyard, reusando la caché y
  el circuit breaker de la Fase 5.
- **Decisión de seguridad central:** un correo de Google que ya tiene cuenta **no** une
  cuentas automáticamente. Vincular exige sesión iniciada, porque si no, quien controle
  un correo se queda con la cuenta de Wander asociada sin saber la contraseña.
- **Decisión de privacidad:** el filtro de consentimiento se aplica al construir la
  respuesta HTTP, no al pintar. Si el dato viaja y solo se oculta en React, el switch no
  protege nada.
- De Google **no se guarda ningún token**: solo se usa para saber quién eres. El
  `id_token` se valida por `iss`/`aud`/`exp`; no se verifica la firma a propósito, y el
  porqué está razonado en el código.
- **Fallo de infraestructura encontrado y corregido antes de que mordiera:** `/api/oauth/`
  caía en la zona `api_auth` de nginx (5 r/m, la de contraseñas). Un login correcto por
  OAuth responde 302, así que cada inicio de sesión BUENO habría gastado cupo — el mismo
  fallo que ya apareció con Steam en la Fase 2. Medido tras el arreglo: OAuth aguanta
  **12 de 12** peticiones a 4/s; `/api/auth/login` corta en la novena.
- Arreglado el pendiente de la Fase 5: **Steam ya se vincula con la sesión abierta**, sin
  cerrar sesión y volver a entrar.
- E2E: 61 comprobaciones, todas en verde, guardadas en `docs/pruebas/e2e-fase6.mjs`. Las
  que de verdad importan son las de manipulación
  del `state` (cambiar `login`→`vincular` invalida la firma; un state de Discord no vale
  en Google), las de secretos (ninguna respuesta contiene token ni `client_secret`) y el
  404 indistinguible del endpoint de Discord, byte a byte igual al de un handle
  inexistente.
- **Hallazgo lateral:** Cloudflare devuelve 403 a toda petición externa que traiga
  `CF-Connecting-IP` puesta a mano. Salió al intentar simular varias IPs en las pruebas, y
  confirma la premisa sobre la que descansa el rate limit por visitante corregido el
  30/07: esa cabecera no es falsificable a través del túnel.

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
- Etiquetas `hreflang` para español e inglés. **Sigue pendiente tras la Fase 6.5**: el
  idioma se elige en el cliente y no cambia la URL, así que hoy no hay dos direcciones que
  enlazar entre sí. Hacerlo de verdad exige decidir antes si el idioma pasa a la ruta
  (`/en/...`) o a un parámetro — y eso solo tiene sentido junto con el prerender.
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

### Sanitización de CSS ✅ (31/07)
Intentar `body{display:none}`, `@import url(//evil.com/x.css)`, `position:fixed`,
`.navbar{...}`, un CSS de 1 MB. Verificar en la DB que se guardó la versión sanitizada y
que otro perfil en otra pestaña no se afecta.

Hecho en la Fase 9: **58 comprobaciones** en `docs/pruebas/e2e-fase9.mjs` (todas en verde)
y **9 más en un navegador real**. Verificado en la DB que `cssPropio` guarda la versión
prefijada y que `cssOriginal` nunca sale en la respuesta pública. Dos cosas que hay que
saber al volver aquí:

- **La suite HTTP no ve si el CSS APLICA.** Puede estar todo bien guardado y no pintarse:
  el bug del fondo (estilo en línea ganándole a la hoja de estilos) pasó las 58
  comprobaciones. Lo que lo delata es leer `getComputedStyle` del contenedor en un
  navegador y compararlo con el del `<body>`.
- El **nombre de un `@keyframes` es global**: es la única parte del CSS que el prefijado de
  selectores no aísla. Al añadir cualquier otra cosa con espacio de nombres propio
  (`@counter-style`, `@property`), hay que renombrarla igual.

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

### Cuentas vinculadas ✅ (30/07)
60 comprobaciones E2E por HTTPS. Las que hay que repetir si se toca `oauth.service.ts`:

- **Manipulación del `state`** — cambiar `i: login` por `i: vincular` (o meter otro `u`)
  debe invalidar la firma; un `state` emitido para Discord no debe valer en el callback
  de Google; un callback sin `state` no debe crear sesión.
- **Con `state` válido y código falso**, el canje debe fallar contra el proveedor real y
  no crear nada.
- **Secretos:** `grep` sobre toda respuesta buscando `accessToken|refreshToken|TokenCif|
  client_secret|GOCSPX` → cero resultados, incluida `GET /api/cuentas`.
- **404 indistinguible** de `GET /api/externo/discord/:handle`: byte a byte igual para un
  handle inexistente y para un perfil sin publicar.
- **Rate limit:** `/api/oauth/discord` debe aguantar ~12 peticiones seguidas a 4/s
  (zona `api_oauth`, 20 r/m), mientras `/api/auth/login` corta en la novena (`api_auth`,
  5 r/m). Si OAuth empieza a cortar como login, el bloque de nginx se rompió.
- **Aislamiento:** un anónimo no lista, no desvincula y no toca permisos (401); pasar
  `?userId=` no cambia de quién son las cuentas devueltas.
- **Mass assignment:** un campo extra junto a `permisos` se rechaza (400); una clave de
  permiso inventada se descarta al guardar.

Lo que **no** cubre la suite y hay que probar a mano al menos una vez: el ida y vuelta
real contra Discord y Google (hace falta un humano autenticándose), y que el avatar
remoto se pinte de verdad en el navegador — la CSP se comprueba por cabecera, pero un
host mal escrito solo se ve en la consola del visitante.

### i18n ✅ (31/07)

**Esta fase hay que verificarla en un navegador de verdad, no con `curl`.** El typecheck
y el build pasaron limpios con dos bugs dentro: una clave de traducción mal formada
compila igual, y un `<Trans>` que pierde sus enlaces devuelve una frase perfectamente
válida a la que le faltan palabras. Solo se ven mirando el DOM renderizado.

Lo que hay que repetir si se toca `i18n/`, `lib/idioma.ts` o cualquier `<Trans>`:

- **Detección automática**, abriendo con tres `locale` distintos: `en-US` → inglés,
  `es-MX` → español, y uno que no tenemos (`de-DE`) → español, no una página en blanco ni
  claves crudas. Comprobar `<html lang>` además del texto.
- **Cambio manual sin recargar**, y que sobreviva a la recarga (`localStorage`).
- **Persistencia en la cuenta**: cambiar el idioma, leer `GET /api/auth/yo` y ver el valor
  nuevo; luego abrir un **contexto de navegador limpio** con las mismas cookies y el
  sistema en el OTRO idioma — debe heredar el de la cuenta. Este paso es el que cazó el
  `PATCH` que mandaba el idioma viejo, porque en el navegador original todo se veía bien.
- **Cada `<Trans>` con sus hijos**: contar los `<a>`/`<Link>` que quedan en el DOM, no solo
  buscar el texto. `label[for="acepta"]` debe tener **2** enlaces, y el `.font-mono` de la
  landing debe seguir conteniendo `wander/u/`.
- **Barrido de español colado** en `/editor`, `/configuracion` y `/u/:handle` con la
  interfaz en inglés: buscar «Vista previa», «Añadir bloque», «Cuentas vinculadas»,
  «Compartir», «horas jugadas»… Cero coincidencias.
- **Plurales** por `Intl`, no por ternario: `1 view` / `5 views`.

Ojo con dos cosas al correr la suite: las pausas tienen que ser generosas (con esperas
cortas la SPA todavía no ha pintado y salen **falsos negativos** que parecen fallos de
traducción), y una tanda seguida agota `limiteGeneral` y empieza a devolver 429 en HTML —
que es un fallo de la prueba, no del código. `docker compose restart backend` lo limpia.

### Social ✅ (31/07)

45 comprobaciones por HTTPS con **dos cuentas distintas**, que es el punto: casi todo lo
que puede salir mal aquí es una interacción entre dos personas, y con una sola sesión no
se ve nada. Lo que hay que repetir si se toca `social.controller.ts`:

- **Nadie escribe en nombre de otro.** Editar y borrar contenido ajeno → **404**, no 403:
  un 403 confirmaría que ese id existe.
- **El bloqueo corta las cinco vías**, no una: comentar, reaccionar, seguir, leer el muro,
  y el seguimiento que ya existía (debe romperse **en ambos sentidos**). Comprobar también
  que desbloquear **no** lo restaura.
- **Idempotencia de seguir.** Pulsar dos veces → 200 las dos, un solo seguidor, y **una
  sola notificación** — si no, seguir/dejar de seguir en bucle es una forma de llenarle
  las notificaciones a alguien.
- **Alternancia de reacciones**: poner, quitar, y que dos tipos distintos sumen 2.
- **Duplicados a nivel de base**, no solo de API: un `INSERT` directo de dos reacciones
  iguales al mismo perfil debe rebotar con `unique_violation`. Es la prueba que destapó
  que los índices no eran parciales; sin ella, la API parecía correcta.
- **Validación**: texto vacío, 1001 caracteres, campo extra en el body, tipo de reacción
  inventado, `q` de 41 caracteres y parámetro de query desconocido → todos **400**.
- **Sesión**: publicar, feed y notificaciones sin cookie → **401**. `/explorar` sí es
  público (200).
- **Idioma detectado**: publicar una frase en español y otra en inglés y confirmar en la
  base que `Publicacion.idioma` guardó `es` y `en`. Un texto corto o ambiguo debe quedar
  **`null`**, no adivinado.

El script vive en el scratchpad de la sesión, no en el repo: depende de crear dos cuentas
de prueba y **hay que borrarlas al terminar** (`DELETE FROM "User" WHERE handle LIKE
'e2e%'`, que arrastra en cascada sus publicaciones).

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
