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
    volver: 'Volver',
    volverInicio: 'Volver al inicio',
    saltarContenido: 'Saltar al contenido',
    algoSalioMal: 'Algo salió mal.',
    reintentar: 'Reintentar',
    cargarMas: 'Cargar más',
  },

  idioma: {
    etiqueta: 'Idioma',
    cambiar: 'Cambiar idioma',
  },

  navbar: {
    explorar: 'Explorar',
    actividad: 'Actividad',
    mensajes: 'Mensajes',
    mensajesSinLeer_one: '{{count}} conversación sin leer',
    mensajesSinLeer_other: '{{count}} conversaciones sin leer',
    temaClaro: 'Activar tema claro',
    temaOscuro: 'Activar tema oscuro',
    menuCuenta: 'Menú de cuenta',
    moderacion: 'Moderación',
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
    fotoPerfil: 'Foto de perfil',
    cambiarFoto: 'Cambiar foto',
    subiendoFoto: 'Subiendo…',
    quitarFoto: 'Quitar',
    fotoAyuda: 'JPG, PNG, WebP o GIF. Se recorta en círculo al mostrarla.',
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

    vistaPreviaTelefono: 'Vista de teléfono',

    cssPropio: 'Edición avanzada',
    cssAyuda:
      'Para cuando el tema se te queda corto. Escribe tu propio CSS y cambia tu perfil a fondo.',
    cssActivo: 'Tienes CSS propio aplicado a tu perfil.',
    cssAbrirAvanzada: 'Abrir edición avanzada',
    cssEditarAvanzada: 'Editar mi CSS',
    cssGuardar: 'Guardar CSS',
    cssGuardando: 'Guardando…',
    cssAvisosTitulo: 'Se guardó, pero hubo cosas que no se pudieron aceptar:',

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

    // Música de fondo (Fase 11).
    musica: 'Música de fondo',
    musicaAyuda: 'Un archivo que suena al abrir tu perfil. Quien te visita decide el volumen.',
    musicaSubir: 'Subir música',
    musicaCambiar: 'Cambiar música',
    musicaQuitar: 'Quitar',
    musicaSubiendo: 'Subiendo…',
    musicaPrevia: 'Escuchar la música de tu perfil',
    musicaTitulo: 'Título',
    musicaArtista: 'Artista',
    musicaVolumen: 'Volumen inicial ({{valor}} %)',
    musicaVolumenAyuda: 'Es una propuesta: quien visita tu perfil puede subirlo o bajarlo.',
    musicaAutoplay: 'Intentar reproducir al abrir el perfil',
    musicaAutoplayAyuda:
      'Muchos navegadores lo bloquean hasta que la persona interactúa con la página. Si pasa, se le muestra un botón de reproducir.',
    musicaLoop: 'Repetir en bucle',
    musicaGuardar: 'Guardar música',
    musicaDerechos:
      'Sube solo música tuya o que tengas permiso para usar. Subir música ajena puede hacer que se retire tu archivo y, si se repite, que se cierre tu cuenta.',

    // Bloques manuales (Fase 10).
    setupTituloPlaceholder: 'Mi setup',
    componentePieza: 'Componente {{numero}}',
    modeloPieza: 'Modelo del componente {{numero}}',
    quitarPieza: 'Quitar componente {{numero}}',
    anadirPieza: 'Añadir componente',
    galeriaTituloPlaceholder: 'Capturas',
    anadirImagenes: 'Añadir imágenes',
    altImagen: 'Texto alternativo de la imagen {{numero}}',
    altPlaceholder: 'Describe la imagen (opcional)',
    quitarImagen: 'Quitar imagen {{numero}}',
    columnas: 'Columnas',
    columnasAyuda: 'En pantallas de teléfono siempre son dos.',
    galeriaTope: 'Hasta {{max}} imágenes.',

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

  /** Edición avanzada: la página de CSS propio (`/editor/css`). */
  cssPagina: {
    volver: 'Volver al editor',
    titulo: 'Edición avanzada',
    entradilla:
      'Aquí escribes CSS y cambias tu perfil a fondo: colores, tipografías, espaciado, animaciones y hasta la forma de las tarjetas. Solo afecta a tu perfil.',

    avisoTitulo: 'Esto es la parte difícil, y no hace falta para tener un buen perfil.',
    avisoTexto:
      'Con el <editor>editor normal</editor> puedes cambiar colores, tipografía, redondez y el orden de tus bloques sin escribir una línea. Ven aquí solo si quieres algo que ahí no se pueda. Si rompes algo, «Borrar todo» lo deja como estaba.',

    tuCss: 'Tu CSS',
    // El <codigo> es un <code> con el selector del contenedor.
    scopeAviso:
      'Todos tus selectores se limitan a <codigo>{{scope}}</codigo> automáticamente, así que escribe como si tu perfil fuera la página entera. Puedes usar <codigo>body</codigo> y se traduce a tu contenedor.',
    placeholder: 'Escribe aquí tu CSS, o aplica uno de los presets de abajo para empezar.',
    borrarTodo: 'Borrar todo',
    verPerfil: 'Ver mi perfil',
    vistaPreviaNota:
      'Es tu perfil real con tu CSS aplicado. En escritorio los bloques se reparten en dos columnas; aquí se ven en una por el ancho.',

    presetsTitulo: 'Presets',
    presetsAyuda:
      'Temas completos listos para usar. Al aplicar uno reemplaza tu CSS actual, y después puedes editarlo a tu gusto.',
    aplicar: 'Aplicar',
    copiar: 'Copiar',
    copiado: 'Copiado',
    copiarContexto: 'Copiar contexto',
    anadirAlEditor: 'Añadir al editor',

    presets: {
      neonNombre: 'Neón',
      neonDescripcion: 'Morado oscuro, rosa eléctrico y tarjetas que brillan al pasar el ratón.',
      cristalNombre: 'Cristal',
      cristalDescripcion: 'Tarjetas translúcidas con desenfoque sobre un fondo con luces.',
      minimalNombre: 'Minimal',
      minimalDescripcion: 'Claro, sin adornos y con mucho aire. Todo el peso en el contenido.',
      terminalNombre: 'Terminal',
      terminalDescripcion: 'Monoespaciado y verde fósforo, como una consola.',
      revistaNombre: 'Revista',
      revistaDescripcion: 'Serif, títulos grandes y un acento rojo. Se lee como una portada.',
    },

    guiaTitulo: '¿Qué es esto?',
    guiaQueEs:
      'El CSS es el lenguaje con el que se decide cómo se ve una página: colores, tamaños, posiciones y animaciones. Se escribe eligiendo QUÉ quieres cambiar (el selector) y luego CÓMO (las propiedades). Por ejemplo, «h2 { color: red }» pone en rojo todos los títulos de tus bloques.',

    ganchosTitulo: 'A qué te puedes agarrar',
    ganchosAyuda:
      'Estos selectores son estables y no van a cambiar. Por dentro los bloques usan clases de la herramienta con la que están hechos, que sí cambian entre versiones: si te agarras a esas, tu CSS se romperá solo algún día.',

    ganchos: {
      bloque: 'Cualquier bloque de tu perfil',
      hero: 'El bloque de tu avatar, nombre y bio',
      enlaces: 'El bloque de enlaces',
      texto: 'Un bloque de texto libre',
      steamActividad: 'El bloque de lo que juegas últimamente',
      estadisticas: 'El bloque de contadores (juegos, horas, nivel)',
      favoritos: 'El bloque de juegos favoritos',
      discordEstado: 'El bloque de tu estado de Discord',
      spotify: 'El bloque de Spotify',
      lateral: 'La columna estrecha de la izquierda (solo en escritorio)',
      principal: 'La columna ancha de la derecha (solo en escritorio)',
      h1: 'Tu nombre',
      h2: 'El título de cada bloque',
      section: 'La caja de cada bloque',
      enlace: 'Cualquier enlace',
      imagen: 'Cualquier imagen (avatar, carátulas)',
    },

    variablesTitulo: 'Las variables de tu tema',
    variablesAyuda:
      'Es la forma más limpia de cambiarlo todo de golpe: cada una se usa en muchos sitios a la vez, así que si redefines el acento se actualiza en todos.',

    variables: {
      fondo: 'El color de fondo del perfil',
      texto: 'El color del texto',
      acento: 'El color de los detalles: enlaces, iconos, números',
      tarjeta: 'El fondo de cada bloque',
      borde: 'El color de los bordes',
      radio: 'Qué tan redondeadas son las esquinas',
    },

    limitesTitulo: 'Lo que no se puede',
    limiteFixed:
      '«position: fixed» y «sticky» se quitan: se saldrían de tu perfil y taparían el resto de la página. «relative» y «absolute» sí funcionan.',
    limiteUrl:
      'Las imágenes de otros sitios se quitan. Puedes usar las que subas a Wander (/uploads/…) y las incrustadas como «data:image/…».',
    limiteImport: '«@import» y «@font-face» se quitan enteros: los dos cargan archivos de fuera.',
    limiteContent:
      'La propiedad «content» está prohibida, así que «::before» y «::after» no te van a servir (un pseudo-elemento sin «content» no llega a existir).',
    limiteSintaxis: 'Si el CSS tiene un error de sintaxis no se guarda nada y te decimos la línea.',
    limiteTamano: 'Máximo 20 KB y 400 reglas.',

    recetasTitulo: 'Cómo están hechos tus bloques',
    recetasAyuda:
      'El CSS que pinta cada bloque hoy, para que veas cómo se escribe y lo puedas modificar. Cópialo, cámbiale lo que quieras y pégalo arriba.',

    iaTitulo: 'Pedirle ayuda a una IA',
    iaAyuda:
      'Copia este texto y pégaselo a ChatGPT, Claude o el que uses, añadiendo al final lo que quieres. Lleva dentro las reglas de Wander para que no se invente clases que aquí no existen.',
    ideasTitulo: 'Ideas para pedir',
    ideas: {
      neonRosa: 'Haz que mis tarjetas tengan un borde neón rosa que brille al pasar el ratón.',
      tarjetasCristal: 'Quiero tarjetas translúcidas con efecto de cristal esmerilado.',
      animarHover: 'Que mis bloques se levanten un poco y crezcan al pasar el ratón por encima.',
      fondoDegradado: 'Ponme un fondo con un degradado oscuro de morado a azul.',
      compactar: 'Compacta todo: menos espacio entre bloques y tipografía más pequeña.',
      tipografia: 'Quiero una tipografía monoespaciada y títulos en mayúsculas muy espaciadas.',
    },
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
    setupNombre: 'Setup',
    setupDescripcion: 'Los componentes de tu equipo, escritos por ti.',
    galeriaNombre: 'Galería',
    galeriaDescripcion: 'Capturas y fotos de tu setup, en una rejilla.',

    // Visor de la galería a pantalla completa.
    galeriaVisor: 'Imagen a pantalla completa',
    galeriaAnterior: 'Imagen anterior',
    galeriaSiguiente: 'Imagen siguiente',

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

  /** Capa social (Fase 7): feed, explorar, publicaciones y comentarios. */
  social: {
    tituloFeed: 'Actividad',
    tituloExplorar: 'Explorar',
    subtituloExplorar: 'Encuentra gente que juega lo mismo que tú.',

    // ── Redactar y publicar ──
    queJuegas: '¿Qué estás jugando?',
    publicar: 'Publicar',
    enviar: 'Enviar',
    cargarMas: 'Cargar más',
    editado: '(editado)',
    borrar: 'Borrar',
    confirmarBorrarPublicacion: '¿Borrar esta publicación? No se puede deshacer.',
    juegoNumero: 'Juego #{{appid}}',
    publicacion: 'Publicación',
    publicacionNoExiste: 'Esta publicación no existe o se borró.',

    // ── Interacción ──
    meGusta: 'Me gusta',
    comentarios: 'Comentarios',
    publicaciones: 'Publicaciones',
    escribeComentario: 'Escribe un comentario…',
    verMasComentarios: 'Ver más comentarios',
    inicioParaComentar: 'Inicia sesión para comentar.',
    inicioParaInteractuar: 'Inicia sesión para reaccionar.',
    nMeGusta_one: '{{count}} me gusta',
    nMeGusta_other: '{{count}} me gusta',
    nComentarios_one: '{{count}} comentario',
    nComentarios_other: '{{count}} comentarios',

    // ── Seguir y bloquear ──
    seguir: 'Seguir',
    siguiendo: 'Siguiendo',
    dejarDeSeguir: 'Dejar de seguir',
    seguidores: 'seguidores',
    siguiendoA: 'siguiendo',
    teSigue: 'Te sigue',
    bloquear: 'Bloquear',
    desbloquear: 'Desbloquear',
    confirmarBloqueo:
      '¿Bloquear a @{{handle}}? Dejarán de seguirse mutuamente y no podrán interactuar.',

    // ── Muro del perfil ──
    muro: 'Muro',
    dejaUnComentario: 'Deja un comentario…',
    muroVacio: 'Todavía no hay comentarios en este perfil.',

    // ── Vacíos del feed ──
    // Dos mensajes distintos a propósito: "no sigues a nadie" se arregla
    // yendo a explorar y "no han publicado" no se arregla con nada.
    feedVacioSinSeguidos: 'Todavía no sigues a nadie. Busca gente y su actividad aparecerá aquí.',
    feedVacioSilencio: 'La gente que sigues no ha publicado nada todavía.',
    buscarGente: 'Buscar gente',

    // ── Explorar ──
    buscar: 'Buscar',
    buscarPlaceholder: 'Busca por nombre o @usuario',
    perfilesDestacados: 'Perfiles destacados',
    perfilesQueCoinciden: 'Perfiles',
    publicacionesQueCoinciden: 'Publicaciones',
    sinPerfiles: 'No se encontró ningún perfil.',
    sinPublicaciones: 'No se encontró ninguna publicación.',
    filtrandoPorJuego: 'Filtrando por el juego #{{appid}}.',
    quitarFiltro: 'Quitar filtro',
  },

  configuracion: {
    titulo: 'Cuentas vinculadas',
    subtitulo:
      'Conecta tus plataformas para que tu perfil se mantenga solo. Tú decides qué se muestra, y puedes desconectar cuando quieras.',
    comoTratamosDatos: 'Cómo tratamos tus datos',
    cargando: 'Cargando tus cuentas…',

    // Música de los perfiles (Fase 11).
    musica: 'Música en los perfiles',
    musicaAyuda:
      'Algunos perfiles tienen música de fondo. Si prefieres que ninguno suene, apágalo aquí y no se reproducirá en ninguno.',
    musicaActivar: 'Permitir que los perfiles reproduzcan música',

    // Aparecer en buscadores (§13).
    indexado: 'Aparecer en buscadores',
    indexadoAyuda:
      'Si lo apagas, tu perfil deja de salir en Google y en el mapa del sitio. Seguirá viéndose bien cuando pegues tu enlace en un chat: eso no es lo mismo que salir en un buscador.',
    indexadoActivar: 'Dejar que los buscadores indexen mi perfil',
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

  // ── Notificaciones (Fase 8) ────────────────────────────────────────
  notificaciones: {
    titulo: 'Notificaciones',
    abrir: 'Abrir notificaciones',
    // `count` activa las reglas de plural de i18next: es lo que distingue
    // «1 sin leer» de «5 sin leer» sin escribirlo a mano por idioma.
    abrirConPendientes_one: 'Abrir notificaciones ({{count}} sin leer)',
    abrirConPendientes_other: 'Abrir notificaciones ({{count}} sin leer)',
    vacio: 'Aquí aparecerán cuando alguien interactúe contigo.',
    verTodas: 'Ver todas',
    alguien: 'Alguien',
    teSiguio: '{{quien}} te empezó a seguir',
    comentoTuPublicacion: '{{quien}} comentó tu publicación',
    comentoTuPerfil: '{{quien}} escribió en tu perfil',
    reacciono: 'A {{quien}} le gustó tu publicación',
    teEscribio: '{{quien}} te envió un mensaje',
    teInvito: '{{quien}} te añadió a un grupo',
    teMenciono: '{{quien}} te mencionó',
    sistema: 'Aviso de Wander',
  },

  // ── Mensajería (Fase 8) ────────────────────────────────────────────
  mensajes: {
    titulo: 'Mensajes',
    bandeja: 'Bandeja',
    solicitudes: 'Solicitudes',
    bandejaVacia: 'Todavía no tienes conversaciones.',
    sinSolicitudes: 'No tienes solicitudes pendientes.',
    eligeConversacion: 'Elige una conversación para empezar a leer.',
    sinNombre: 'Conversación',
    sinMensajes: 'Sin mensajes todavía',
    hiloVacio: 'Escribe el primer mensaje.',
    escribeUnMensaje: 'Escribe un mensaje…',
    enviar: 'Enviar',
    editado: 'editado',
    borrado: 'Mensaje borrado',
    estaEscribiendo: '{{quien}} está escribiendo…',
    participantes_one: '{{count}} participante',
    participantes_other: '{{count}} participantes',
    silenciar: 'Silenciar conversación',
    activarAvisos: 'Activar avisos',
    salirGrupo: 'Salir del grupo',
    confirmarSalir: '¿Seguro que quieres salir de este grupo?',
    noSePudoCargar: 'No se pudo cargar la conversación.',
    noExiste: 'Esta conversación no existe.',
    esSolicitud:
      'Esta persona te escribió por primera vez. Si aceptas, la conversación pasa a tu bandeja.',
    aceptar: 'Aceptar',
    enviarMensaje: 'Enviar mensaje',
    mensaje: 'Mensaje',
    noSePudoAbrir: 'No se pudo abrir la conversación.',

    // ── Empezar una conversación (Fase 10) ──
    nuevaConversacion: 'Nueva conversación',
    nuevoGrupo: 'Nuevo grupo',
    buscarPersonas: 'Busca por nombre o @handle…',
    sinResultados: 'Nadie coincide con esa búsqueda.',
    nombreDelGrupo: 'Nombre del grupo',
    crearGrupo: 'Crear grupo',
    elegidas_one: '{{count}} persona elegida',
    elegidas_other: '{{count}} personas elegidas',
    quitar: 'Quitar',
    faltaNombre: 'Ponle un nombre al grupo.',
    faltaGente: 'Elige al menos a una persona.',
    cancelar: 'Cancelar',
    // Los mensajes de sistema se guardan como una clave y se traducen aquí:
    // el mismo evento lo leen personas con la interfaz en distintos idiomas.
    'evento.participante-anadido': '{{quien}} añadió a {{objetivo}}',
    'evento.participante-quitado': '{{quien}} quitó a {{objetivo}}',
    'evento.participante-salio': '{{objetivo}} salió del grupo',
  },

  // ── Compositor: emojis, GIFs y adjuntos (Fase 8) ───────────────────
  compositor: {
    emojis: 'Emojis',
    gifs: 'Buscar GIFs',
    buscarGifs: 'Buscar GIFs…',
    sinGifs: 'No se encontraron GIFs.',
    viaGiphy: 'GIFs vía GIPHY',
    adjuntar: 'Adjuntar archivo',
    quitarAdjunto: 'Quitar archivo',
    archivo: 'Archivo',
    video: 'Video',
    demasiadoGrande: 'El archivo supera el límite de {{max}} MB.',
    maximoAlcanzado_one: 'Máximo {{count}} archivo',
    maximoAlcanzado_other: 'Máximo {{count}} archivos',
  },

  // ── Reproductor de música del perfil (Fase 11) ─────────────────────
  musica: {
    reproductor: 'Música de este perfil',
    reproducir: 'Reproducir la música',
    pausar: 'Pausar la música',
    silenciar: 'Silenciar',
    activarSonido: 'Activar el sonido',
    volumen: 'Volumen',
    sinTitulo: 'Música de fondo',
    pulsaParaSonar: 'Pulsa para escucharla',
  },

  // ── Reportar (Fase 10) ─────────────────────────────────────────────
  reportar: {
    abrir: 'Reportar',
    accion: 'Reportar',
    titulo: 'Reportar contenido',
    motivo: '¿Qué pasa con esto?',
    detalle: 'Cuéntanos más (opcional)',
    detallePlaceholder: 'Lo que creas que ayuda a entender el caso.',
    aviso: 'Lo revisará una persona del equipo. No se le dice a nadie quién reportó.',
    enviar: 'Enviar reporte',
    gracias: 'Gracias. El equipo lo revisará.',
  },

  // ── Panel de moderación (Fase 10) ──────────────────────────────────
  admin: {
    titulo: 'Moderación',
    subtitulo: 'La cola de reportes y las acciones sobre cuentas.',
    filtrar: 'Filtrar reportes por estado',
    estadoPENDIENTE: 'Pendientes',
    estadoREVISADO: 'Revisados',
    estadoDESCARTADO: 'Descartados',
    pendientes: 'Pendientes',
    revisados: 'Revisados',
    suspendidos: 'Suspendidos',
    usuarios: 'Cuentas',
    colaVacia: 'No hay nada pendiente. Buen momento.',
    sinReportes: 'No hay reportes en este estado.',

    motivo_spam: 'Spam',
    motivo_acoso: 'Acoso',
    motivo_contenido_ilegal: 'Contenido ilegal',
    motivo_suplantacion: 'Suplantación',
    motivo_otro: 'Otro',

    tipo_usuario: 'Cuenta',
    tipo_perfil: 'Perfil',
    tipo_publicacion: 'Publicación',
    tipo_comentario: 'Comentario',
    tipo_mensaje: 'Mensaje',

    yaOculto: 'ya oculto',
    yaSuspendido: 'ya suspendida',
    sinTexto: 'Sin texto',
    objetoBorrado: 'Lo reportado ya no existe.',
    resolucion: 'Resolución',

    accion: 'Acción',
    accionNinguna: 'Sin acción',
    accionOcultar: 'Ocultar el contenido',
    accionSuspender: 'Suspender la cuenta',
    dias: 'Días',
    diasPlaceholder: 'Vacío = permanente',
    nota: 'Nota de resolución',
    notaPlaceholder: 'Qué se decidió y por qué (queda en el registro).',
    marcarRevisado: 'Resolver',
    descartar: 'Descartar',
    avisoAccion: 'Descartar cierra el reporte sin aplicar ninguna acción.',

    accionesDirectas: 'Acciones sobre una cuenta',
    accionesDirectasAyuda:
      'Para actuar sin que haya un reporte de por medio. Todo queda registrado con tu nombre.',
    handle: 'Handle',
    motivo: 'Motivo',
    motivoPlaceholder: 'Queda en el registro de auditoría.',
    suspender: 'Suspender',
    levantar: 'Levantar suspensión',
    hechoSuspender: 'Se suspendió a @{{handle}}.',
    hechoLevantar: 'Se levantó la suspensión de @{{handle}}.',

    roles: 'Roles',
    rolesAyuda: 'Solo un administrador puede repartir permisos.',
    rol: 'Rol',
    cambiarRol: 'Cambiar rol',
    hechoRol: '@{{handle}} ahora es {{rol}}.',
  },
} as const;

/**
 * La forma del catálogo con los valores relajados a `string`.
 *
 * Es lo que tipa a `en.ts`: exige exactamente las mismas claves —ni una
 * menos, ni una de más— sin exigir además el texto español literal. Una
 * clave que se añada aquí rompe la compilación del inglés hasta que se
 * traduzca, que es precisamente el punto.
 *
 * Es RECURSIVO porque hay secciones con un nivel más de anidamiento
 * (`cssPagina.presets.neonNombre`). Con un `Record<clave, string>` plano,
 * un grupo anidado se exigía como `string` y el inglés no compilaba
 * aunque estuviera bien traducido.
 */
type Traducible<T> = T extends string ? string : { [C in keyof T]: Traducible<T[C]> };

export type Catalogo = Traducible<typeof es>;
