import type { Catalogo } from './es';

/**
 * US English catalog.
 *
 * Typed against the Spanish one so the compiler flags a missing or a
 * leftover key the moment the interface changes. That check is the whole
 * reason `es` is declared `as const`.
 *
 * Note the plural keys (`_one` / `_other`): i18next picks the right one
 * through `Intl.PluralRules`, so nothing here concatenates an "s" by hand.
 * Spanish and English happen to agree on two forms, but that is a
 * coincidence, not something to rely on.
 *
 * Translation notes:
 *  - "handle" is the natural English word for what Spanish calls
 *    «nombre de usuario» here, and it is what the URL actually is.
 *  - Wander's voice is informal and direct in both languages. Where
 *    Spanish uses «tú», English simply uses "you" — no attempt to sound
 *    more formal than the original.
 */
export const en: Catalogo = {
  comun: {
    cargando: 'Loading…',
    guardar: 'Save',
    cancelar: 'Cancel',
    cerrar: 'Close',
    volverInicio: 'Back to home',
    saltarContenido: 'Skip to content',
    algoSalioMal: 'Something went wrong.',
  },

  idioma: {
    etiqueta: 'Language',
    cambiar: 'Change language',
  },

  navbar: {
    explorar: 'Explore',
    actividad: 'Activity',
    mensajes: 'Messages',
    temaClaro: 'Switch to light theme',
    temaOscuro: 'Switch to dark theme',
    menuCuenta: 'Account menu',
    abrirMenu: 'Open menu',
    cerrarMenu: 'Close menu',
    verMiPerfil: 'View my profile',
    miPerfil: 'My profile',
    editarPerfil: 'Edit profile',
    configuracion: 'Settings',
    cerrarSesion: 'Sign out',
    iniciarSesion: 'Sign in',
    crearPerfil: 'Create profile',
  },

  footer: {
    lema: 'Your gamer identity in a single link. Connect your accounts, build your profile, and share it.',
    plataforma: 'Platform',
    explorarPerfiles: 'Explore profiles',
    crearPerfil: 'Create profile',
    tuCuenta: 'Your account',
    miPerfil: 'My profile',
    editarPerfil: 'Edit profile',
    configuracion: 'Settings',
    legal: 'Legal',
    privacidad: 'Privacy',
    terminos: 'Terms',
    derechos: '© {{anio}} Wander. Made in Tijuana.',
  },

  landing: {
    tituloPestana: 'Wander — your gamer identity',
    insignia: 'Your gamer identity, in a single link',
    titulo: 'Everything you play, in one place',
    subtitulo:
      'Connect Steam and Discord, build your profile out of blocks, and share it. The data comes in on its own.',
    editarMiPerfil: 'Edit my profile',
    verMiPerfil: 'View my profile',
    crearMiPerfil: 'Create my profile',
    verEjemplos: 'See examples',
    gratis: 'Free. No credit card. Your profile lives at <mono>wander/u/your-name</mono>.',

    pasosTitulo: 'Three steps and you are done',
    pasosSubtitulo: 'Nothing to keep up to date by hand.',
    paso1Titulo: 'Sign up',
    paso1Texto: 'Pick your handle. That is your profile link, and it is yours.',
    paso2Titulo: 'Connect your accounts',
    paso2Texto:
      'Link Steam and Discord. Your games, hours, and achievements show up without typing a thing.',
    paso3Titulo: 'Share it',
    paso3Texto: 'One link for your bio, your signature, or your server. It looks good wherever you put it.',

    caracteristicasTitulo: 'A profile that keeps itself current',
    caracteristicasSubtitulo: 'What sets Wander apart from pasting four links into a bio.',
    car1Titulo: 'The data comes in on its own',
    car1Texto:
      'Link Steam and your hours, games, and achievements show up right away. This is not a bio link you have to keep updating.',
    car2Titulo: 'Blocks you arrange',
    car2Texto:
      'Add, remove, and reorder: activity, favorites, PC setup, gallery, links. Your profile, your order.',
    car3Titulo: 'Real customization',
    car3Texto:
      'Colors, fonts, background, and borders. And if you know CSS, write your own — templates are a starting point, not a cage.',
    car4Titulo: 'Social, not a dead wall',
    car4Texto: 'Follow people, comment on profiles, and talk privately, with groups and attachments.',
    car5Titulo: 'Straight about your data',
    car5Texto:
      'Every connection tells you what gets read and what gets stored. Separate permissions, and disconnecting really deletes.',
    car6Titulo: 'Looks good when shared',
    car6Texto: 'Cards for Discord and X generated from your profile, with your theme and your data.',

    comparacionTitulo: 'Versus a "link in bio"',
    comparacionLeyenda: 'Comparison between a link page and Wander',
    comparacionAspecto: 'Aspect',
    comparacionLink: 'Link in bio',
    comp1Punto: 'Your hours and games',
    comp1Link: 'You type them by hand',
    comp1Wander: 'Pulled from Steam automatically',
    comp2Punto: 'Keeping it current',
    comp2Link: 'You remember… or you do not',
    comp2Wander: 'Updates without touching it',
    comp3Punto: 'Looks',
    comp3Link: 'Whatever template exists',
    comp3Wander: 'Your own theme, and CSS if you want',
    comp4Punto: 'Live status',
    comp4Link: 'Does not exist',
    comp4Wander: 'Discord and Spotify in real time',
    comp5Punto: 'People',
    comp5Link: 'A list of links',
    comp5Wander: 'Follow, comment, and message',

    finalTitulo: 'Build yours',
    finalTexto:
      'It takes two minutes. Pick your name, connect Steam, and you have something to share.',
  },

  login: {
    titulo: 'Sign in',
    subtitulo: 'Sign in to keep building your profile.',
    correo: 'Email',
    correoPlaceholder: 'you@example.com',
    password: 'Password',
    mostrarPassword: 'Show password',
    ocultarPassword: 'Hide password',
    entrar: 'Sign in',
    entrando: 'Signing in…',
    sinCuenta: 'Do not have an account yet?',
    crearPerfil: 'Create your profile',
    canceloSteam: 'You canceled signing in with Steam.',
  },

  registro: {
    titulo: 'Create your profile',
    subtitulo: 'Pick your link. You can connect your accounts next.',
    handle: 'Handle',
    handleAyuda: 'This will be your profile address. 3-24 characters.',
    handleDisponible: 'Available.',
    handleNoDisponible: 'Not available.',
    displayName: 'Display name',
    correo: 'Email',
    correoPlaceholder: 'you@example.com',
    password: 'Password',
    passwordPlaceholder: 'A phrase you will remember',
    passwordAyuda:
      'At least {{minimo}} characters. A long phrase is safer than one odd symbol.',
    acepto: 'I accept the <terminos>terms</terminos> and the <privacidad>privacy policy</privacidad>.',
    crear: 'Create my profile',
    creando: 'Creating…',
    yaTienesCuenta: 'Already have an account?',
    iniciarSesion: 'Sign in',
  },

  proveedores: {
    o: 'or',
    continuarSteam: 'Continue with Steam',
    continuarDiscord: 'Continue with Discord',
    continuarGoogle: 'Continue with Google',
    crearSteam: 'Sign up with Steam',
    crearDiscord: 'Sign up with Discord',
    crearGoogle: 'Sign up with Google',
  },

  erroresExternos: {
    steam: 'We could not verify your Steam account. Please try again.',
    suspendido: 'That account is suspended.',
    proveedor: 'We could not reach the provider. Try again in a moment.',
    state: 'The connection expired or could not be verified. Please try again.',
    'sin-codigo': 'The provider did not return what we need to continue.',
    creacion: 'We could not create the account. Please try again.',
    sesion: 'Your session changed during the process. Please try again.',
    'correo-en-uso':
      'There is already a Wander account with that email. Sign in with your password and link the provider from settings.',
    'ya-vinculada':
      'That account is already linked to another Wander user. Unlink it there first.',
    'no-configurado': 'That provider is not available right now.',
    generico: 'We could not complete the connection.',
  },

  errores: {
    timeout: 'The request took too long. Please try again.',
    sinConexion: 'Could not reach the server.',
    inesperado: 'An unexpected error occurred.',
  },

  noEncontrada: {
    codigo: '404',
    titulo: 'This page does not exist',
    texto: 'The link may be misspelled, or the profile you are looking for may have changed its name.',
    explorar: 'Explore profiles',
  },

  enConstruccion: {
    explorar: 'Explore',
    actividad: 'Activity',
    mensajes: 'Messages',
    texto: 'This section is not built yet. It arrives in {{fase}}.',
    fase7: 'Phase 7',
    fase8: 'Phase 8',
  },

  perfilPublico: {
    cargando: 'Loading profile…',
    tituloPestana: '{{nombre}} (@{{handle}}) — Wander',
    sinPublicar: 'This profile is not published yet: only you can see it.',
    publicarDesdeEditor: 'Publish from the editor',
    sinContenido: 'This profile has no content yet.',
    compartir: 'Share',
    enlaceCopiado: 'Link copied',
    editarMiPerfil: 'Edit my profile',
    vistas_one: '{{count}} view',
    vistas_other: '{{count}} views',
  },

  editor: {
    cargando: 'Loading editor…',
    titulo: 'Profile editor',
    tuPerfilVive: 'Your profile lives at <perfil>/u/{{handle}}</perfil>',
    guardando: 'Saving…',
    guardado: 'Saved',
    errorGuardar: 'Could not save',
    publicar: 'Publish',
    ocultarPerfil: 'Hide profile',
    vistaPrevia: 'Preview',
    sinBloques: 'Add blocks to bring your profile to life.',

    identidad: 'Identity',
    nombreMostrar: 'Display name',
    bio: 'Bio',
    bioPlaceholder: 'Tell people who you are as a gamer.',
    guardarIdentidad: 'Save identity',

    plantillas: 'Templates',
    plantillasAyuda:
      'A starting point. It only changes colors and fonts: your blocks stay exactly as they are.',
    plantillaPersonalizada: 'Your theme is customized. Picking a template will replace the colors.',

    tema: 'Theme',
    restaurar: 'Reset',
    colorFondo: 'Background',
    colorTexto: 'Text',
    colorAcento: 'Accent',
    colorTarjeta: 'Cards',
    colorBorde: 'Borders',
    colorDe: '{{campo}} color',
    tipografia: 'Font',
    redondez: 'Corner roundness: {{radio}}px',

    bloques: 'Blocks',
    anadirBloque: 'Add block',
    guardarBloque: 'Save block',
    subirBloque: 'Move block up',
    bajarBloque: 'Move block down',
    mostrarBloque: 'Show block',
    ocultarBloque: 'Hide block',
    eliminarBloque: 'Delete block',

    frase: 'Tagline',
    frasePlaceholder: 'Achievement hunter · main support',
    mostrarBio: 'Show my bio in this block',
    tituloCampo: 'Title',
    contenido: 'Content',
    tituloSeccion: 'Section title',
    tituloSeccionPlaceholder: 'Find me on',
    etiquetaEnlace: 'Label for link {{numero}}',
    urlEnlace: 'URL for link {{numero}}',
    quitarEnlace: 'Remove link {{numero}}',
    anadirEnlace: 'Add link',
    soloHttp: 'Only http(s) links are accepted.',

    sinSteam:
      'You have no Steam account linked, so this block will not show on your profile. <config>Link it in settings</config>.',
    sinDiscord:
      'You have no Discord account linked, so this block will not show on your profile. <config>Link it in settings</config>.',
    sinPresencia:
      'Your Discord is linked, but you have not turned on showing your live status. <config>Turn it on in settings</config>.',
    sinLanyard:
      'To read your live status you need to join the Lanyard server: <lanyard>discord.gg/UrXF2cfJ7F</lanyard>. It is free and you only need to be in it; you do not have to participate.',

    cuantosJuegos: 'How many games to show: {{limite}}',
    horasTotales: 'Also show total hours',
    totalJuegos: 'Total games',
    horasJugadas: 'Hours played',
    nivelSteam: 'Steam level',
    elegirDestacados: 'Pick your featured games ({{elegidos}}/{{maximo}})',
    ordenadosPorHoras:
      'Sorted by hours played. The hours update on their own: here you only pick which ones to feature.',
    sinBiblioteca:
      'We have not been able to read your library yet. If your Steam profile is private, its games are not visible even to us.',
    sincronizar: 'Sync with Steam now',
    sincronizando: 'Syncing…',
    errorSincronizar: 'Could not sync. Wait a moment and try again.',

    mostrarAvatarDiscord: 'Show my Discord avatar and name',
    mostrarActividadDiscord: 'Show what I am playing',
    mostrarProgreso: 'Show the progress bar',
    spotifySeOculta:
      'This block hides itself when you are not listening to anything, so it never leaves an empty gap on your profile.',
  },

  plantillas: {
    'base-oscuroNombre': 'Dark base',
    'base-oscuroDescripcion': 'Near-black background with a blue accent. The default starting point.',
    'minimal-claroNombre': 'Light minimal',
    'minimal-claroDescripcion': 'White, lots of air, and high contrast. Reads well on any screen.',
    'cyber-violetaNombre': 'Cyber violet',
    'cyber-violetaDescripcion': 'Saturated purples over blue-black. Very rounded corners.',
    'retro-crtNombre': 'Retro CRT',
    'retro-crtDescripcion': 'Phosphor green on black with a monospaced font. Square corners.',
    'shooter-angularNombre': 'Angular shooter',
    'shooter-angularDescripcion': 'Cold grays, warning orange, and zero curves. Tactical feel.',
  },

  bloques: {
    heroNombre: 'Intro',
    heroDescripcion: 'Your avatar, name, tagline, and bio.',
    textoNombre: 'Text',
    textoDescripcion: 'A free text block with an optional title.',
    enlacesNombre: 'Links',
    enlacesDescripcion: 'Buttons to your profiles and socials.',
    steamActividadNombre: 'Steam activity',
    steamActividadDescripcion: 'What you have played over the past two weeks. Updates on its own.',
    estadisticasNombre: 'Stats',
    estadisticasDescripcion: 'Your Steam games, hours, and level in numbers.',
    favoritosNombre: 'Favorite games',
    favoritosDescripcion: 'The games you want to feature, with their cover art.',
    discordEstadoNombre: 'Discord status',
    discordEstadoDescripcion: 'Whether you are online and what you are playing, live.',
    spotifyNombre: 'Spotify',
    spotifyDescripcion: 'The song playing right now. Hides itself when you are not listening.',

    tituloEnNumeros: 'By the numbers',
    tituloJugandoUltimamente: 'Playing lately',
    tituloFavoritos: 'Favorite games',
    tituloDiscord: 'Discord',
    tituloSonandoAhora: 'Now playing',

    cargandoSteam: 'Loading Steam data…',
    sinDestacados: 'No featured games on this profile yet.',
    steamPrivado: 'This Steam profile is private, so its activity cannot be shown.',
    sinPartidas: 'No sessions in the past two weeks.',
    juegoDesconocido: 'Game #{{appid}}',
    enTotal: '{{horas}} total',
    dosSemanas: 'Time played in the past 2 weeks',
    enSteam: '{{estado}} on Steam',
    progresoCancion: 'Song progress',
    avisoLanyard:
      'To show your live status you need to join the Lanyard server: discord.gg/UrXF2cfJ7F',
  },

  steam: {
    sinJugar: 'Not played',
    minutos: '{{minutos}} min',
    horas: '{{horas}} h',
    juegos_one: 'game',
    juegos_other: 'games',
    horasJugadas: 'hours played',
    nivel: 'Steam level',
    desconectado: 'Offline',
    ocupado: 'Busy',
    ausente: 'Away',
    durmiendo: 'Snoozing',
    enLinea: 'Online',
  },

  discord: {
    enLinea: 'Online',
    ausente: 'Idle',
    noMolestar: 'Do not disturb',
    desconectado: 'Offline',
    jugandoA: 'Playing',
    transmitiendo: 'Streaming',
    escuchando: 'Listening to',
    viendo: 'Watching',
    compitiendoEn: 'Competing in',
    acabaDeEmpezar: 'just started',
    llevaMinutos: '{{minutos}} min',
    llevaHoras: '{{horas}} h',
    llevaHorasMinutos: '{{horas}} h {{minutos}} min',
  },

  /** Social layer (Phase 7): feed, explore, posts and comments. */
  social: {
    tituloFeed: 'Activity',
    tituloExplorar: 'Explore',
    subtituloExplorar: 'Find people who play what you play.',

    // ── Composing and posting ──
    queJuegas: "What are you playing?",
    publicar: 'Post',
    enviar: 'Send',
    cargarMas: 'Load more',
    editado: '(edited)',
    borrar: 'Delete',
    confirmarBorrarPublicacion: "Delete this post? This can't be undone.",
    juegoNumero: 'Game #{{appid}}',

    // ── Interaction ──
    meGusta: 'Like',
    comentarios: 'Comments',
    publicaciones: 'Posts',
    escribeComentario: 'Write a comment…',
    verMasComentarios: 'See more comments',
    inicioParaComentar: 'Sign in to comment.',
    inicioParaInteractuar: 'Sign in to react.',
    nMeGusta_one: '{{count}} like',
    nMeGusta_other: '{{count}} likes',
    nComentarios_one: '{{count}} comment',
    nComentarios_other: '{{count}} comments',

    // ── Following and blocking ──
    seguir: 'Follow',
    siguiendo: 'Following',
    dejarDeSeguir: 'Unfollow',
    seguidores: 'followers',
    siguiendoA: 'following',
    teSigue: 'Follows you',
    bloquear: 'Block',
    desbloquear: 'Unblock',
    confirmarBloqueo:
      "Block @{{handle}}? You'll both stop following each other and won't be able to interact.",

    // ── Profile wall ──
    muro: 'Wall',
    dejaUnComentario: 'Leave a comment…',
    muroVacio: 'No comments on this profile yet.',

    // ── Empty feed ──
    feedVacioSinSeguidos:
      "You're not following anyone yet. Find some people and their activity will show up here.",
    feedVacioSilencio: "The people you follow haven't posted anything yet.",
    buscarGente: 'Find people',

    // ── Explore ──
    buscar: 'Search',
    buscarPlaceholder: 'Search by name or @handle',
    perfilesDestacados: 'Featured profiles',
    perfilesQueCoinciden: 'Profiles',
    publicacionesQueCoinciden: 'Posts',
    sinPerfiles: 'No profiles found.',
    sinPublicaciones: 'No posts found.',
    filtrandoPorJuego: 'Filtering by game #{{appid}}.',
    quitarFiltro: 'Clear filter',
  },

  configuracion: {
    titulo: 'Linked accounts',
    subtitulo:
      'Connect your platforms so your profile keeps itself current. You decide what shows, and you can disconnect whenever you want.',
    comoTratamosDatos: 'How we handle your data',
    cargando: 'Loading your accounts…',
    cerrarAviso: 'Dismiss notice',
    conectado: 'Connected',
    sirveParaEntrar: 'Can be used to sign in',
    cuentaConectada: 'Connected account',
    noDisponible: 'Not available',
    desconectar: 'Disconnect',
    conectar: 'Connect',
    verQueDatos: 'See what data would be read',
    queSeMuestra: 'What shows on your profile',
    queLeemos: 'What we read from {{proveedor}}',
    queGuardamos: 'What we store',
    queNoPedimos: 'What we do NOT request',
    podrasElegir:
      'You will be able to choose what shows after connecting, and disconnect whenever you want: doing so deletes both the connection and any data we had stored from {{proveedor}}.',
    continuarA: 'Continue to {{proveedor}}',
    noConfigurado: 'This provider is not configured on the server right now.',
    requiereReconexion:
      'The permission expired or you revoked it from {{proveedor}}. Connect it again to keep your data updating.',
    ultimaEntrada:
      '{{proveedor}} is your only way to sign in to Wander. Set a password on your account or link another provider before disconnecting it.',
    soloProveedores:
      'You sign in to Wander only with the accounts above. If you ever lose access to them, you would lose this account too: that is why we do not let you unlink the last one.',
    avisoLanyard:
      'To read your live status you need to be in the Lanyard server: <lanyard>discord.gg/UrXF2cfJ7F</lanyard>. It is an external service that reads Discord presence; without it, Discord does not share it with anyone.',

    vinculado: '{{proveedor}} is now linked to your account.',
    canceloConexion: 'You canceled connecting with {{proveedor}}.',

    resumenSteam: 'Your games, your hours, and your activity, updated automatically.',
    resumenDiscord: 'Your live status and what you are listening to on Spotify.',
    resumenGoogle: 'A quick way to sign in, no password needed.',

    seccionIdioma: 'Language',
    idiomaAyuda:
      'Which language you see Wander in. It is remembered on your account, so it follows you to any device.',
  },
};
