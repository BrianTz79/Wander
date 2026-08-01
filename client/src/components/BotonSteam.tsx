import { useTranslation } from 'react-i18next';

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
 *
 * `registro` cambia el texto a "crear cuenta" en vez de "continuar". Antes
 * era una prop de texto libre; ahora es un booleano porque el texto sale
 * del catálogo y quien lo usa no tiene por qué traducirlo.
 */
export function BotonSteam({ registro = false }: { registro?: boolean }) {
  const { t } = useTranslation();
  return (
    <a
      href="/api/auth/steam"
      className="btn-secundario h-11 w-full"
      // rel por higiene: esta navegación sale del origen.
      rel="noopener"
    >
      <IconoSteam className="h-5 w-5" />
      {t(registro ? 'proveedores.crearSteam' : 'proveedores.continuarSteam')}
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

/**
 * Botones de Discord y Google (Fase 6). Mismo principio que el de Steam:
 * navegación real del navegador, misma pestaña, logotipo como SVG inline
 * para no depender de un CDN externo ni tener que abrirlo en la CSP.
 */
export function BotonDiscord({ registro = false }: { registro?: boolean }) {
  const { t } = useTranslation();
  return (
    <a href="/api/oauth/discord" className="btn-secundario h-11 w-full" rel="noopener">
      <IconoDiscord className="h-5 w-5" />
      {t(registro ? 'proveedores.crearDiscord' : 'proveedores.continuarDiscord')}
    </a>
  );
}

export function BotonGoogle({ registro = false }: { registro?: boolean }) {
  const { t } = useTranslation();
  return (
    <a href="/api/oauth/google" className="btn-secundario h-11 w-full" rel="noopener">
      <IconoGoogle className="h-5 w-5" />
      {t(registro ? 'proveedores.crearGoogle' : 'proveedores.continuarGoogle')}
    </a>
  );
}

function IconoDiscord({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M20.32 4.37A19.8 19.8 0 0 0 15.43 2.9a.07.07 0 0 0-.08.03c-.21.38-.44.87-.6 1.25a18.3 18.3 0 0 0-5.5 0c-.16-.39-.4-.87-.61-1.25a.08.08 0 0 0-.08-.03c-1.71.29-3.35.8-4.89 1.47a.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06c0 .02.01.04.03.05a19.9 19.9 0 0 0 6 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-2a.08.08 0 0 0-.04-.1 13.1 13.1 0 0 1-1.87-.9.08.08 0 0 1 0-.13l.37-.28a.07.07 0 0 1 .08 0 14.2 14.2 0 0 0 12.06 0 .07.07 0 0 1 .08 0l.37.29a.08.08 0 0 1 0 .12c-.6.35-1.22.65-1.87.9a.08.08 0 0 0-.04.1c.36.7.78 1.36 1.23 2a.08.08 0 0 0 .08.02 19.8 19.8 0 0 0 6.02-3.03.08.08 0 0 0 .03-.05c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.96 2.42-2.16 2.42Zm7.98 0c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.22 0 2.18 1.1 2.16 2.42 0 1.34-.94 2.42-2.16 2.42Z" />
    </svg>
  );
}

/** El de Google va con sus colores de marca: sus normas de uso no permiten
 *  recolorearlo, y es el logo que la gente reconoce de un vistazo. */
function IconoGoogle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.59-5.17 3.59-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.87-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

/** Separador "o" entre el formulario y el acceso con Steam. */
export function SeparadorO() {
  const { t } = useTranslation();
  return (
    <div className="my-5 flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      {/* zinc-500/400 y no zinc-400: en claro, `text-zinc-400` sobre blanco
          se queda en 2.8:1 y no llega al 4.5:1 que pide la WCAG AA. Lo cazó
          la auditoría con axe de la Fase 10. */}
      <span className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {t('proveedores.o')}
      </span>
      <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}
