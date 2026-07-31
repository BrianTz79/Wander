/**
 * Catálogo en español neutro/mexicano — la fuente de la que sale el resto.
 *
 * Reglas de escritura (§0 de PROYECTO.md): se trata de «tú», nunca de
 * «vos». Nada de «elegí», «tenés» ni «podés».
 *
 * El objeto se declara `as const` para que `en.ts` pueda tipar contra él y
 * el compilador avise si al inglés le falta una clave o le sobra una que
 * ya no existe. Es la red que evita que el catálogo se desincronice en
 * silencio a medida que la interfaz cambie en las fases siguientes.
 *
 * `as const` por sí solo no basta: convierte cada valor en su tipo
 * literal, así que un `typeof es` a secas le exigiría al inglés el texto
 * español exacto. De ahí `Catalogo`, que conserva la ESTRUCTURA y relaja
 * los valores a `string` — que es justo la comprobación que queremos.
 */
export const es = {
  comun: {
    cargando: 'Cargando…',
    guardar: 'Guardar',
    cancelar: 'Cancelar',
    cerrar: 'Cerrar',
    volverInicio: 'Volver al inicio',
    saltarContenido: 'Saltar al contenido',
    algoSalioMal: 'Algo salió mal.',
  },

  idioma: {
    etiqueta: 'Idioma',
    cambiar: 'Cambiar idioma',
  },

  navbar: {
    explorar: 'Explorar',
    actividad: 'Actividad',
    mensajes: 'Mensajes',
    temaClaro: 'Activar tema claro',
    temaOscuro: 'Activar tema oscuro',
    menuCuenta: 'Menú de cuenta',
    abrirMenu: 'Abrir menú',
    cerrarMenu: 'Cerrar menú',
    verMiPerfil: 'Ver mi perfil',
    miPerfil: 'Mi perfil',
    editarPerfil: 'Editar perfil',
    configuracion: 'Configuración',
    cerrarSesion: 'Cerrar sesión',
    iniciarSesion: 'Iniciar sesión',
    crearPerfil: 'Crear perfil',
  },

  footer: {
    lema: 'Tu identidad como jugador, en un solo enlace. Conecta tus cuentas, arma tu perfil y compártelo.',
    plataforma: 'Plataforma',
    explorarPerfiles: 'Explorar perfiles',
    crearPerfil: 'Crear perfil',
    tuCuenta: 'Tu cuenta',
    miPerfil: 'Mi perfil',
    editarPerfil: 'Editar perfil',
    configuracion: 'Configuración',
    legal: 'Legal',
    privacidad: 'Privacidad',
    terminos: 'Términos',
    derechos: '© {{anio}} Wander. Hecho en Tijuana.',
  },

  landing: {
    tituloPestana: 'Wander — tu identidad como jugador',
    insignia: 'Tu identidad como jugador, en un solo enlace',
    titulo: 'Todo lo que juegas, en un solo lugar',
    subtitulo:
      'Conecta Steam y Discord, arma tu perfil con bloques y compártelo. Los datos se traen solos.',
    editarMiPerfil: 'Editar mi perfil',
    verMiPerfil: 'Ver mi perfil',
    crearMiPerfil: 'Crear mi perfil',
    verEjemplos: 'Ver ejemplos',
    gratis: 'Gratis. Sin tarjeta. Tu perfil vive en <mono>wander/u/tu-nombre</mono>.',

    pasosTitulo: 'Tres pasos y está listo',
    pasosSubtitulo: 'No hay que mantener nada actualizado a mano.',
    paso1Titulo: 'Regístrate',
    paso1Texto: 'Elige tu nombre de usuario. Ese es el enlace de tu perfil, y es tuyo.',
    paso2Titulo: 'Conecta tus cuentas',
    paso2Texto:
      'Vincula Steam y Discord. Tus juegos, horas y logros aparecen sin que escribas nada a mano.',
    paso3Titulo: 'Compártelo',
    paso3Texto: 'Un enlace para tu bio, tu firma o tu servidor. Se ve bien donde lo pongas.',

    caracteristicasTitulo: 'Un perfil que se mantiene solo',
    caracteristicasSubtitulo: 'Lo que hace distinta a Wander de pegar cuatro enlaces en una bio.',
    car1Titulo: 'Los datos se traen solos',
    car1Texto:
      'Vinculas Steam y tus horas, juegos y logros aparecen al momento. No es un enlace en la bio que hay que ir actualizando.',
    car2Titulo: 'Bloques que acomodas',
    car2Texto:
      'Añades, quitas y reordenas: actividad, favoritos, setup del PC, galería, enlaces. Tu perfil, tu orden.',
    car3Titulo: 'Personalización de verdad',
    car3Texto:
      'Colores, tipografías, fondo y bordes. Y si sabes CSS, escribes el tuyo — las plantillas son un punto de partida, no una jaula.',
    car4Titulo: 'Social, no un muro muerto',
    car4Texto: 'Sigue gente, comenta perfiles y habla por privado, con grupos y adjuntos.',
    car5Titulo: 'Claro con tus datos',
    car5Texto:
      'Cada vinculación dice qué se lee y qué se guarda. Permisos por separado y desvincular borra de verdad.',
    car6Titulo: 'Se ve bien al compartir',
    car6Texto: 'Tarjetas para Discord y X generadas desde tu perfil, con tu tema y tus datos.',

    comparacionTitulo: 'Contra un «link en la bio»',
    comparacionLeyenda: 'Comparación entre una página de enlaces y Wander',
    comparacionAspecto: 'Aspecto',
    comparacionLink: 'Link en la bio',
    comp1Punto: 'Tus horas y juegos',
    comp1Link: 'Los escribes a mano',
    comp1Wander: 'Se traen de Steam solos',
    comp2Punto: 'Mantenerlo al día',
    comp2Link: 'Te acuerdas… o no',
    comp2Wander: 'Se actualiza sin tocarlo',
    comp3Punto: 'Aspecto',
    comp3Link: 'La plantilla que hay',
    comp3Wander: 'Tema propio y CSS si quieres',
    comp4Punto: 'Estado en vivo',
    comp4Link: 'No existe',
    comp4Wander: 'Discord y Spotify en tiempo real',
    comp5Punto: 'Gente',
    comp5Link: 'Una lista de enlaces',
    comp5Wander: 'Seguir, comentar y mensajes',

    finalTitulo: 'Arma el tuyo',
    finalTexto:
      'Toma dos minutos. Eliges tu nombre, conectas Steam y ya tienes algo que compartir.',
  },

  login: {
    titulo: 'Inicia sesión',
    subtitulo: 'Entra para seguir armando tu perfil.',
    correo: 'Correo',
    correoPlaceholder: 'tu@ejemplo.com',
    password: 'Contraseña',
    mostrarPassword: 'Mostrar contraseña',
    ocultarPassword: 'Ocultar contraseña',
    entrar: 'Entrar',
    entrando: 'Entrando…',
    sinCuenta: '¿Todavía no tienes cuenta?',
    crearPerfil: 'Crea tu perfil',
    canceloSteam: 'Cancelaste el inicio de sesión con Steam.',
  },

  registro: {
    titulo: 'Crea tu perfil',
    subtitulo: 'Elige tu enlace. Después conectas tus cuentas.',
    handle: 'Nombre de usuario',
    handleAyuda: 'Será la dirección de tu perfil. 3-24 caracteres.',
    handleDisponible: 'Disponible.',
    handleNoDisponible: 'No está disponible.',
    displayName: 'Nombre para mostrar',
    correo: 'Correo',
    correoPlaceholder: 'tu@ejemplo.com',
    password: 'Contraseña',
    passwordPlaceholder: 'Una frase que recuerdes',
    passwordAyuda:
      'Mínimo {{minimo}} caracteres. Una frase larga es más segura que un símbolo raro.',
    // Marcadores por nombre, no por índice: ver el comentario del <Trans>
    // en RegistroPage. Los dos son <Link> a /terminos y /privacidad.
    acepto: 'Acepto los <terminos>términos</terminos> y la <privacidad>política de privacidad</privacidad>.',
    crear: 'Crear mi perfil',
    creando: 'Creando…',
    yaTienesCuenta: '¿Ya tienes cuenta?',
    iniciarSesion: 'Inicia sesión',
  },

  proveedores: {
    o: 'o',
    continuarSteam: 'Continuar con Steam',
    continuarDiscord: 'Continuar con Discord',
    continuarGoogle: 'Continuar con Google',
    crearSteam: 'Crear cuenta con Steam',
    crearDiscord: 'Crear cuenta con Discord',
    crearGoogle: 'Crear cuenta con Google',
  },

  /**
   * Errores que llegan como **código** en la query al volver de un flujo
   * externo. Se traducen aquí, nunca en el servidor: el callback es una
   * redirección del navegador, así que lo único que puede mandar es un
   * código corto — y pintar en pantalla un texto venido de la URL sería un
   * XSS reflejado servido en bandeja.
   */
  erroresExternos: {
    steam: 'No se pudo verificar tu cuenta de Steam. Inténtalo de nuevo.',
    suspendido: 'Esa cuenta está suspendida.',
    proveedor: 'No se pudo hablar con el proveedor. Inténtalo en un momento.',
    state: 'La conexión caducó o no se pudo verificar. Inténtalo otra vez.',
    'sin-codigo': 'El proveedor no devolvió lo necesario para continuar.',
    creacion: 'No se pudo crear la cuenta. Inténtalo de nuevo.',
    sesion: 'Tu sesión cambió durante el proceso. Vuelve a intentarlo.',
    'correo-en-uso':
      'Ya hay una cuenta de Wander con ese correo. Entra con tu contraseña y vincula el proveedor desde configuración.',
    'ya-vinculada':
      'Esa cuenta ya está vinculada a otro usuario de Wander. Desvincúlala allí primero.',
    'no-configurado': 'Ese proveedor no está disponible ahora mismo.',
    generico: 'No se pudo completar la conexión.',
  },

  /** Errores de red y de transporte del cliente HTTP. */
  errores: {
    timeout: 'La petición tardó demasiado. Inténtalo de nuevo.',
    sinConexion: 'No se pudo conectar con el servidor.',
    inesperado: 'Ocurrió un error inesperado.',
  },

  noEncontrada: {
    codigo: '404',
    titulo: 'Esta página no existe',
    texto: 'Puede que el enlace esté mal escrito, o que el perfil que buscas haya cambiado de nombre.',
    explorar: 'Explorar perfiles',
  },

  enConstruccion: {
    explorar: 'Explorar',
    actividad: 'Actividad',
    mensajes: 'Mensajes',
    texto: 'Esta sección todavía no está construida. Llega en la {{fase}}.',
    fase7: 'Fase 7',
    fase8: 'Fase 8',
  },

  perfilPublico: {
    cargando: 'Cargando perfil…',
    tituloPestana: '{{nombre}} (@{{handle}}) — Wander',
    sinPublicar: 'Este perfil todavía no está publicado: solo tú puedes verlo.',
    publicarDesdeEditor: 'Publicar desde el editor',
    sinContenido: 'Este perfil todavía no tiene contenido.',
    compartir: 'Compartir',
    enlaceCopiado: 'Enlace copiado',
    editarMiPerfil: 'Editar mi perfil',
    vistas_one: '{{count}} vista',
    vistas_other: '{{count}} vistas',
  },

  editor: {
    cargando: 'Cargando editor…',
    titulo: 'Editor de perfil',
    tuPerfilVive: 'Tu perfil vive en <perfil>/u/{{handle}}</perfil>',
    guardando: 'Guardando…',
    guardado: 'Guardado',
    errorGuardar: 'No se pudo guardar',
    publicar: 'Publicar',
    ocultarPerfil: 'Ocultar perfil',
    vistaPrevia: 'Vista previa',
    sinBloques: 'Añade bloques para dar vida a tu perfil.',

    identidad: 'Identidad',
    nombreMostrar: 'Nombre para mostrar',
    bio: 'Bio',
    bioPlaceholder: 'Cuenta quién eres como jugador.',
    guardarIdentidad: 'Guardar identidad',

    plantillas: 'Plantillas',
    plantillasAyuda:
      'Un punto de partida. Cambia solo los colores y la tipografía: tus bloques se quedan como están.',
    plantillaPersonalizada: 'Tu tema está personalizado. Elegir una plantilla reemplazará los colores.',

    tema: 'Tema',
    restaurar: 'Restaurar',
    colorFondo: 'Fondo',
    colorTexto: 'Texto',
    colorAcento: 'Acento',
    colorTarjeta: 'Tarjetas',
    colorBorde: 'Bordes',
    colorDe: 'Color de {{campo}}',
    tipografia: 'Tipografía',
    redondez: 'Redondez de esquinas: {{radio}}px',

    bloques: 'Bloques',
    anadirBloque: 'Añadir bloque',
    guardarBloque: 'Guardar bloque',
    subirBloque: 'Subir bloque',
    bajarBloque: 'Bajar bloque',
    mostrarBloque: 'Mostrar bloque',
    ocultarBloque: 'Ocultar bloque',
    eliminarBloque: 'Eliminar bloque',

    frase: 'Frase corta',
    frasePlaceholder: 'Cazador de logros · main support',
    mostrarBio: 'Mostrar la bio en este bloque',
    tituloCampo: 'Título',
    contenido: 'Contenido',
    tituloSeccion: 'Título de la sección',
    tituloSeccionPlaceholder: 'Encuéntrame en',
    etiquetaEnlace: 'Etiqueta del enlace {{numero}}',
    urlEnlace: 'URL del enlace {{numero}}',
    quitarEnlace: 'Quitar enlace {{numero}}',
    anadirEnlace: 'Añadir enlace',
    soloHttp: 'Solo se aceptan enlaces http(s).',

    // El <config> es el <Link> a /configuracion.
    sinSteam:
      'No tienes Steam vinculado, así que este bloque no se mostrará en tu perfil. <config>Vincúlalo en configuración</config>.',
    sinDiscord:
      'No tienes Discord vinculado, así que este bloque no se mostrará en tu perfil. <config>Vincúlalo en configuración</config>.',
    sinPresencia:
      'Tienes Discord vinculado, pero no has activado mostrar tu estado en vivo. <config>Actívalo en configuración</config>.',
    // El <lanyard> es el <a> al servidor de Lanyard.
    sinLanyard:
      'Para leer tu estado en vivo hace falta que te unas al servidor de Lanyard: <lanyard>discord.gg/UrXF2cfJ7F</lanyard>. Es gratis y solo hace falta estar dentro; no tienes que participar.',

    cuantosJuegos: 'Cuántos juegos mostrar: {{limite}}',
    horasTotales: 'Mostrar también las horas totales',
    totalJuegos: 'Total de juegos',
    horasJugadas: 'Horas jugadas',
    nivelSteam: 'Nivel de Steam',
    elegirDestacados: 'Elige tus destacados ({{elegidos}}/{{maximo}})',
    ordenadosPorHoras:
      'Ordenados por horas jugadas. Las horas se actualizan solas: aquí solo eliges cuáles destacar.',
    sinBiblioteca:
      'Todavía no hemos podido leer tu biblioteca. Si tu perfil de Steam es privado, sus juegos no son visibles ni siquiera para nosotros.',
    sincronizar: 'Sincronizar con Steam ahora',
    sincronizando: 'Sincronizando…',
    errorSincronizar: 'No se pudo sincronizar. Espera un momento y vuelve a intentar.',

    mostrarAvatarDiscord: 'Mostrar mi avatar y nombre de Discord',
    mostrarActividadDiscord: 'Mostrar a qué estoy jugando',
    mostrarProgreso: 'Mostrar la barra de progreso',
    spotifySeOculta:
      'Este bloque se oculta solo cuando no estás escuchando nada, así que no deja un hueco vacío en tu perfil.',
  },

  /**
   * Plantillas de tema. Las claves usan el `id` del catálogo
   * (`server/src/schemas/plantillas.ts`), que es lo que viaja a la base de
   * datos y no cambia nunca; aquí solo vive cómo se llaman en pantalla.
   */
  plantillas: {
    'base-oscuroNombre': 'Base oscura',
    'base-oscuroDescripcion': 'Fondo casi negro y acento azul. El punto de partida por defecto.',
    'minimal-claroNombre': 'Minimal claro',
    'minimal-claroDescripcion':
      'Blanco, mucho aire y contraste alto. Se lee bien en cualquier pantalla.',
    'cyber-violetaNombre': 'Cyber violeta',
    'cyber-violetaDescripcion': 'Morados saturados sobre negro azulado. Esquinas muy redondeadas.',
    'retro-crtNombre': 'Retro CRT',
    'retro-crtDescripcion':
      'Verde fósforo sobre negro y tipografía monoespaciada. Esquinas rectas.',
    'shooter-angularNombre': 'Shooter angular',
    'shooter-angularDescripcion': 'Grises fríos, naranja de aviso y cero curvas. Aire táctico.',
  },

  bloques: {
    heroNombre: 'Presentación',
    heroDescripcion: 'Tu avatar, nombre, frase y bio.',
    textoNombre: 'Texto',
    textoDescripcion: 'Un bloque de texto libre con título opcional.',
    enlacesNombre: 'Enlaces',
    enlacesDescripcion: 'Botones a tus perfiles y redes.',
    steamActividadNombre: 'Actividad de Steam',
    steamActividadDescripcion: 'Lo que has jugado estas dos semanas. Se actualiza solo.',
    estadisticasNombre: 'Estadísticas',
    estadisticasDescripcion: 'Tus juegos, horas y nivel de Steam en números.',
    favoritosNombre: 'Juegos favoritos',
    favoritosDescripcion: 'Los juegos que quieres destacar, con su carátula.',
    discordEstadoNombre: 'Estado de Discord',
    discordEstadoDescripcion: 'Si estás en línea y a qué juegas, en vivo.',
    spotifyNombre: 'Spotify',
    spotifyDescripcion: 'La canción que suena ahora mismo. Se oculta si no escuchas nada.',

    // Títulos por defecto de cada bloque en el perfil público.
    tituloEnNumeros: 'En números',
    tituloJugandoUltimamente: 'Jugando últimamente',
    tituloFavoritos: 'Juegos favoritos',
    tituloDiscord: 'Discord',
    tituloSonandoAhora: 'Sonando ahora',

    cargandoSteam: 'Cargando datos de Steam…',
    sinDestacados: 'Todavía no hay juegos destacados en este perfil.',
    steamPrivado: 'Este perfil de Steam es privado, así que su actividad no se puede mostrar.',
    sinPartidas: 'Sin partidas en las últimas dos semanas.',
    juegoDesconocido: 'Juego #{{appid}}',
    enTotal: '{{horas}} en total',
    dosSemanas: 'Tiempo jugado en las últimas 2 semanas',
    enSteam: '{{estado}} en Steam',
    progresoCancion: 'Progreso de la canción',
    avisoLanyard:
      'Para mostrar tu estado en vivo tienes que unirte al servidor de Lanyard: discord.gg/UrXF2cfJ7F',
  },

  steam: {
    sinJugar: 'Sin jugar',
    minutos: '{{minutos}} min',
    horas: '{{horas}} h',
    juegos_one: 'juego',
    juegos_other: 'juegos',
    horasJugadas: 'horas jugadas',
    nivel: 'nivel de Steam',
    desconectado: 'Desconectado',
    ocupado: 'Ocupado',
    ausente: 'Ausente',
    durmiendo: 'Durmiendo',
    enLinea: 'En línea',
  },

  discord: {
    enLinea: 'En línea',
    ausente: 'Ausente',
    noMolestar: 'No molestar',
    desconectado: 'Desconectado',
    jugandoA: 'Jugando a',
    transmitiendo: 'Transmitiendo',
    escuchando: 'Escuchando',
    viendo: 'Viendo',
    compitiendoEn: 'Compitiendo en',
    acabaDeEmpezar: 'acaba de empezar',
    llevaMinutos: '{{minutos}} min',
    llevaHoras: '{{horas}} h',
    llevaHorasMinutos: '{{horas}} h {{minutos}} min',
  },

  configuracion: {
    titulo: 'Cuentas vinculadas',
    subtitulo:
      'Conecta tus plataformas para que tu perfil se mantenga solo. Tú decides qué se muestra, y puedes desconectar cuando quieras.',
    comoTratamosDatos: 'Cómo tratamos tus datos',
    cargando: 'Cargando tus cuentas…',
    cerrarAviso: 'Cerrar aviso',
    conectado: 'Conectado',
    sirveParaEntrar: 'Sirve para entrar',
    cuentaConectada: 'Cuenta conectada',
    noDisponible: 'No disponible',
    desconectar: 'Desconectar',
    conectar: 'Conectar',
    verQueDatos: 'Ver qué datos se leerían',
    queSeMuestra: 'Qué se muestra en tu perfil',
    queLeemos: 'Qué leemos de {{proveedor}}',
    queGuardamos: 'Qué guardamos',
    queNoPedimos: 'Qué NO pedimos',
    podrasElegir:
      'Podrás elegir qué se muestra después de conectar, y desconectar cuando quieras: al hacerlo se borran tanto la conexión como los datos que hubiéramos guardado de {{proveedor}}.',
    continuarA: 'Continuar a {{proveedor}}',
    noConfigurado: 'Este proveedor no está configurado en el servidor ahora mismo.',
    requiereReconexion:
      'El permiso caducó o lo revocaste desde {{proveedor}}. Vuelve a conectarlo para que tus datos sigan actualizándose.',
    ultimaEntrada:
      '{{proveedor}} es tu única forma de entrar a Wander. Ponle una contraseña a tu cuenta o vincula otro proveedor antes de desconectarlo.',
    soloProveedores:
      'Entras a Wander solo con las cuentas de arriba. Si algún día pierdes el acceso a ellas, perderías también esta cuenta: por eso no te dejamos desvincular la última.',
    // El <lanyard> es el <a> al servidor de Lanyard.
    avisoLanyard:
      'Para leer tu estado en vivo hace falta que estés en el servidor de Lanyard: <lanyard>discord.gg/UrXF2cfJ7F</lanyard>. Es un servicio externo que lee la presencia de Discord; sin él, Discord no la comparte con nadie.',

    vinculado: '{{proveedor}} quedó vinculado a tu cuenta.',
    canceloConexion: 'Cancelaste la conexión con {{proveedor}}.',

    resumenSteam: 'Tus juegos, tus horas y tu actividad, actualizados solos.',
    resumenDiscord: 'Tu estado en vivo y lo que escuchas en Spotify.',
    resumenGoogle: 'Una forma rápida de entrar, sin contraseña.',

    seccionIdioma: 'Idioma',
    idiomaAyuda:
      'En qué idioma ves Wander. Se recuerda en tu cuenta, así que te sigue a cualquier dispositivo.',
  },
} as const;

/**
 * La forma del catálogo con los valores relajados a `string`.
 *
 * Es lo que tipa a `en.ts`: exige exactamente las mismas claves —ni una
 * menos, ni una de más— sin exigir además el texto español literal. Una
 * clave que se añada aquí rompe la compilación del inglés hasta que se
 * traduzca, que es precisamente el punto.
 */
export type Catalogo = {
  [Seccion in keyof typeof es]: Record<keyof (typeof es)[Seccion], string>;
};
