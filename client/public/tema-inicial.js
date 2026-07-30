/**
 * Evita el parpadeo de tema (FOUC).
 *
 * Es un archivo aparte, no un <script> inline en index.html, porque la CSP
 * de nginx usa `script-src 'self'` SIN 'unsafe-inline' y sin hashes — un
 * bloque inline quedaría bloqueado en producción y el parpadeo volvería
 * en silencio (solo visible en la consola).
 *
 * Va en /public para que Vite lo copie tal cual, sin hash en el nombre:
 * index.html lo carga por ruta fija y con `defer` NO, sino síncrono, para
 * que la clase esté puesta antes de la primera pintura.
 *
 * El oscuro es el estado por defecto (§7 del sistema de diseño): la clase
 * ya viene en el HTML y esto solo la quita si corresponde.
 */
(function () {
  try {
    var guardado = localStorage.getItem('wander-tema');
    var oscuro = guardado
      ? guardado === 'dark'
      : !window.matchMedia('(prefers-color-scheme: light)').matches;
    document.documentElement.classList.toggle('dark', oscuro);
  } catch (e) {
    /* localStorage bloqueado (modo privado): se queda el oscuro. */
  }
})();
