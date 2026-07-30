/**
 * Botón de "entrar con Steam".
 *
 * Es un <a> con navegación real del navegador, NO un fetch: el flujo de
 * OpenID es una cadena de redirecciones (Wander → Steam → Wander) que
 * termina con la sesión puesta en cookies. Hacerlo con fetch rompería la
 * cadena y además chocaría con la política de mismo origen de Steam.
 *
 * Por eso tampoco lleva `target="_blank"`: la vuelta tiene que ocurrir en
 * la misma pestaña para que el usuario acabe dentro de la app.
 */
export function BotonSteam({ texto = 'Continuar con Steam' }: { texto?: string }) {
  return (
    <a
      href="/api/auth/steam"
      className="btn-secundario h-11 w-full"
      // rel por higiene: esta navegación sale del origen.
      rel="noopener"
    >
      <IconoSteam className="h-5 w-5" />
      {texto}
    </a>
  );
}

/** El logotipo de Steam. Va como SVG inline (no como <img> a un CDN) para
 *  no depender de un host externo ni tener que abrirlo en la CSP. */
function IconoSteam({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M11.98 2a10.01 10.01 0 0 0-9.96 9.02l5.36 2.22a2.82 2.82 0 0 1 1.6-.49l2.38-3.46v-.05a3.77 3.77 0 1 1 3.77 3.77h-.09l-3.4 2.43v.2a2.83 2.83 0 0 1-5.6.57L2.2 14.63A10.01 10.01 0 1 0 11.98 2Zm-4.7 13.17 1.23.5a2.14 2.14 0 1 0 1.2-2.9l1.27.53a1.58 1.58 0 0 1-1.2 2.92l-2.5-1.05Zm7.85-8.4a2.51 2.51 0 1 0 0 5.03 2.51 2.51 0 0 0 0-5.03Zm0 .79a1.72 1.72 0 1 1 0 3.45 1.72 1.72 0 0 1 0-3.45Z" />
    </svg>
  );
}

/** Separador "o" entre el formulario y el acceso con Steam. */
export function SeparadorO() {
  return (
    <div className="my-5 flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      <span className="text-xs uppercase tracking-wide text-zinc-400">o</span>
      <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}
