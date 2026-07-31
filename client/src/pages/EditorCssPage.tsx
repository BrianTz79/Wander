import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ClipboardCopy,
  Code,
  ExternalLink,
  Loader2,
  RotateCcw,
  Save,
  Sparkles,
} from 'lucide-react';

import { useEditor } from '../store/editorStore';
import { mensajeError } from '../lib/api';
import { idDeScope } from '../lib/perfil';
import { CssDePerfil } from '../components/CssDePerfil';
import { RenderBloque, necesitaDiscord, necesitaSteam } from '../components/bloques/registro';
import { ProveedorSteam } from '../lib/steamContexto';
import { ProveedorDiscord } from '../lib/discordContexto';
import { useAuth } from '../store/authStore';
import {
  CONTEXTO_IA,
  GANCHOS_CSS,
  IDEAS_PROMPT,
  PRESETS_CSS,
  RECETAS_BLOQUE,
  VARIABLES_CSS,
} from '../lib/cssRecetas';

/**
 * Edición avanzada: la página de CSS propio.
 *
 * Vive aparte del editor normal por una razón de producto: el editor de
 * bloques tiene que ser suficiente para la mayoría, y meter un textarea de
 * código entre los paneles empuja a todo el mundo hacia algo que casi
 * nadie necesita. Aquí, en cambio, quien entra ya sabe a qué viene — y se
 * le puede dar sitio de verdad: guía, presets, el código de cada bloque y
 * la vista previa al lado.
 *
 * La vista previa usa los MISMOS componentes que el perfil público y el
 * mismo id de scope, así que lo que se ve aquí es lo que verá cualquiera.
 */
export function EditorCssPage() {
  const { t } = useTranslation();
  const usuarioAuth = useAuth((e) => e.usuario);
  const { perfil, usuario, cargando, errorCarga, cargar, guardarCss } = useEditor();

  const [borrador, setBorrador] = useState('');
  const [avisos, setAvisos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // El borrador arranca con lo que la persona escribió (no con lo
  // sanitizado): ver tu propio CSS reordenado y sin comentarios cada vez
  // que vuelves sería desconcertante.
  const cssGuardado = perfil?.cssOriginal ?? '';
  useEffect(() => {
    setBorrador(cssGuardado);
  }, [cssGuardado]);

  if (cargando) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status">
        <span className="sr-only">{t('editor.cargando')}</span>
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900
                     dark:border-zinc-700 dark:border-t-white"
          aria-hidden="true"
        />
      </div>
    );
  }

  if (errorCarga || !perfil || !usuario) {
    return (
      <div className="contenedor-app py-24 text-center">
        <p className="text-zinc-600 dark:text-zinc-400">{errorCarga ?? t('comun.algoSalioMal')}</p>
      </div>
    );
  }

  const sucio = borrador !== cssGuardado;

  async function guardar(css = borrador) {
    setGuardando(true);
    setError(null);
    setGuardadoOk(false);
    try {
      setAvisos(await guardarCss(css));
      setGuardadoOk(true);
      setTimeout(() => setGuardadoOk(false), 2500);
    } catch (e) {
      setError(mensajeError(e));
      setAvisos([]);
    } finally {
      setGuardando(false);
    }
  }

  /** Mete un preset en el editor y lo guarda de una. */
  async function aplicarPreset(css: string) {
    setBorrador(css);
    await guardar(css);
    areaRef.current?.focus();
  }

  async function restaurar() {
    setBorrador('');
    await guardar('');
  }

  const bloquesVisibles = perfil.bloques.filter((b) => b.visible);

  return (
    <div className="contenedor-app py-8">
      {/* ── Cabecera ── */}
      <Link
        to="/editor"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('cssPagina.volver')}
      </Link>

      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          <Code className="h-6 w-6" aria-hidden="true" />
          {t('cssPagina.titulo')}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
          {t('cssPagina.entradilla')}
        </p>
      </div>

      {/* ── Aviso de que esto es la parte difícil ── */}
      <div className="mb-8 flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
        <AlertTriangle
          className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden="true"
        />
        <div className="text-sm text-amber-900 dark:text-amber-100">
          <p className="font-semibold">{t('cssPagina.avisoTitulo')}</p>
          <p className="mt-1">
            <Trans
              i18nKey="cssPagina.avisoTexto"
              components={{ editor: <Link to="/editor" className="font-semibold underline" /> }}
            />
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-start">
        {/* ══ Columna izquierda: editor + material ══ */}
        <div className="min-w-0 space-y-8">
          {/* ── El editor ── */}
          <section className="tarjeta">
            <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-white">
              {t('cssPagina.tuCss')}
            </h2>
            <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
              <Trans
                i18nKey="cssPagina.scopeAviso"
                values={{ scope: `#${idDeScope(perfil.id)}` }}
                components={{ codigo: <code className="font-mono text-xs" /> }}
              />
            </p>

            <label htmlFor="css-area" className="sr-only">
              {t('cssPagina.tuCss')}
            </label>
            <textarea
              id="css-area"
              ref={areaRef}
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              rows={20}
              spellCheck={false}
              className="campo font-mono text-xs"
              placeholder={t('cssPagina.placeholder')}
            />

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
              >
                {error}
              </p>
            )}

            {avisos.length > 0 && (
              <div
                role="status"
                className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
              >
                <p className="font-medium">{t('editor.cssAvisosTitulo')}</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                  {avisos.map((aviso) => (
                    <li key={aviso}>{aviso}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void guardar()}
                disabled={guardando || !sucio}
                className="btn-primario h-10 px-5 text-sm"
              >
                {guardando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    {t('editor.cssGuardando')}
                  </>
                ) : guardadoOk ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    {t('editor.guardado')}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" aria-hidden="true" />
                    {t('editor.cssGuardar')}
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => void restaurar()}
                disabled={guardando || (!cssGuardado && !borrador)}
                className="btn-secundario h-10 px-5 text-sm"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                {t('cssPagina.borrarTodo')}
              </button>

              <Link
                to={`/u/${usuarioAuth?.handle}`}
                className="btn-fantasma h-10 px-4 text-sm"
                target="_blank"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {t('cssPagina.verPerfil')}
              </Link>
            </div>
          </section>

          {/* ── Presets ── */}
          <section className="tarjeta">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-white">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {t('cssPagina.presetsTitulo')}
            </h2>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              {t('cssPagina.presetsAyuda')}
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {PRESETS_CSS.map((preset) => (
                <div
                  key={preset.id}
                  className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  {/* Miniatura: los tres colores del preset. */}
                  <div
                    className="flex h-16 items-center justify-center gap-2 rounded-lg"
                    style={{ backgroundColor: preset.muestra[0] }}
                    aria-hidden="true"
                  >
                    <span
                      className="h-8 w-16 rounded"
                      style={{ backgroundColor: preset.muestra[1] }}
                    />
                    <span
                      className="h-8 w-8 rounded-full"
                      style={{ backgroundColor: preset.muestra[2] }}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                      {t(`cssPagina.presets.${preset.clave}Nombre`)}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                      {t(`cssPagina.presets.${preset.clave}Descripcion`)}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void aplicarPreset(preset.css)}
                      disabled={guardando}
                      className="btn-primario h-8 flex-1 px-3 text-xs"
                    >
                      {t('cssPagina.aplicar')}
                    </button>
                    <BotonCopiar texto={preset.css} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Qué es esto y a qué agarrarse ── */}
          <section className="tarjeta">
            <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-white">
              {t('cssPagina.guiaTitulo')}
            </h2>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              {t('cssPagina.guiaQueEs')}
            </p>

            <h3 className="mb-2 mt-5 text-sm font-semibold text-zinc-900 dark:text-white">
              {t('cssPagina.ganchosTitulo')}
            </h3>
            <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
              {t('cssPagina.ganchosAyuda')}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <tbody>
                  {GANCHOS_CSS.map((gancho) => (
                    <tr key={gancho.selector} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="py-1.5 pr-4 align-top">
                        <code className="font-mono text-xs text-zinc-900 dark:text-zinc-200">
                          {gancho.selector}
                        </code>
                      </td>
                      <td className="py-1.5 text-zinc-600 dark:text-zinc-400">
                        {t(`cssPagina.ganchos.${gancho.clave}`)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="mb-2 mt-6 text-sm font-semibold text-zinc-900 dark:text-white">
              {t('cssPagina.variablesTitulo')}
            </h3>
            <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
              {t('cssPagina.variablesAyuda')}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <tbody>
                  {VARIABLES_CSS.map((v) => (
                    <tr key={v.nombre} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="py-1.5 pr-4 align-top">
                        <code className="font-mono text-xs text-zinc-900 dark:text-zinc-200">
                          {v.nombre}
                        </code>
                      </td>
                      <td className="py-1.5 text-zinc-600 dark:text-zinc-400">
                        {t(`cssPagina.variables.${v.clave}`)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="mb-2 mt-6 text-sm font-semibold text-zinc-900 dark:text-white">
              {t('cssPagina.limitesTitulo')}
            </h3>
            <ul className="list-inside list-disc space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              <li>{t('cssPagina.limiteFixed')}</li>
              <li>{t('cssPagina.limiteUrl')}</li>
              <li>{t('cssPagina.limiteImport')}</li>
              <li>{t('cssPagina.limiteContent')}</li>
              <li>{t('cssPagina.limiteSintaxis')}</li>
              <li>{t('cssPagina.limiteTamano')}</li>
            </ul>
          </section>

          {/* ── El código de cada bloque ── */}
          <section className="tarjeta">
            <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-white">
              {t('cssPagina.recetasTitulo')}
            </h2>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              {t('cssPagina.recetasAyuda')}
            </p>

            <div className="space-y-3">
              {RECETAS_BLOQUE.map((receta) => (
                <details
                  key={receta.clave}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800"
                >
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-zinc-900 dark:text-white">
                    {t(`bloques.${receta.clave}Nombre`)}{' '}
                    <code className="ml-1 font-mono text-xs font-normal text-zinc-500 dark:text-zinc-400">
                      {receta.selector}
                    </code>
                  </summary>
                  <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
                    <pre className="overflow-x-auto rounded-lg bg-zinc-50 p-3 text-xs leading-relaxed dark:bg-zinc-900">
                      <code className="font-mono text-zinc-800 dark:text-zinc-200">{receta.css}</code>
                    </pre>
                    <div className="mt-2 flex gap-2">
                      <BotonCopiar texto={receta.css} />
                      <button
                        type="button"
                        onClick={() => setBorrador((v) => `${v.trimEnd()}\n\n${receta.css}\n`)}
                        className="btn-fantasma h-8 px-3 text-xs"
                      >
                        {t('cssPagina.anadirAlEditor')}
                      </button>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </section>

          {/* ── Pedirle ayuda a una IA ── */}
          <section className="tarjeta">
            <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-white">
              {t('cssPagina.iaTitulo')}
            </h2>
            <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
              {t('cssPagina.iaAyuda')}
            </p>

            <pre className="overflow-x-auto rounded-lg bg-zinc-50 p-3 text-xs leading-relaxed dark:bg-zinc-900">
              <code className="whitespace-pre-wrap font-mono text-zinc-800 dark:text-zinc-200">
                {CONTEXTO_IA}
              </code>
            </pre>
            <div className="mt-2">
              <BotonCopiar texto={CONTEXTO_IA} etiquetaLarga />
            </div>

            <h3 className="mb-2 mt-5 text-sm font-semibold text-zinc-900 dark:text-white">
              {t('cssPagina.ideasTitulo')}
            </h3>
            <ul className="space-y-2">
              {IDEAS_PROMPT.map((idea) => {
                const texto = t(`cssPagina.ideas.${idea.clave}`);
                return (
                  <li key={idea.clave} className="flex items-start gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-400" aria-hidden="true" />
                    <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">{texto}</span>
                    <BotonCopiar texto={`${CONTEXTO_IA}${texto}`} />
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {/* ══ Columna derecha: vista previa pegajosa ══ */}
        <div className="lg:sticky lg:top-24">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t('editor.vistaPrevia')}
          </p>
          <ProveedorSteam handle={usuarioAuth?.handle} activo={necesitaSteam(bloquesVisibles)}>
            <ProveedorDiscord handle={usuarioAuth?.handle} activo={necesitaDiscord(bloquesVisibles)}>
              <div
                /* Mismo id de scope que el perfil real: es lo que hace que
                   el CSS guardado aplique también aquí. */
                id={idDeScope(perfil.id)}
                className="perfil-raiz max-h-[75vh] overflow-y-auto rounded-2xl border border-zinc-200 dark:border-zinc-800"
              >
                <CssDePerfil perfilId={perfil.id} tema={perfil.tema} css={perfil.cssPropio} />
                <div className="flex flex-col gap-6 px-4 py-6">
                  {bloquesVisibles.length === 0 && (
                    <p className="py-16 text-center text-sm" style={{ opacity: 0.6 }}>
                      {t('editor.sinBloques')}
                    </p>
                  )}
                  {bloquesVisibles.map((bloque) => (
                    <RenderBloque key={bloque.id} bloque={bloque} usuario={usuario} />
                  ))}
                </div>
              </div>
            </ProveedorDiscord>
          </ProveedorSteam>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {t('cssPagina.vistaPreviaNota')}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Botón de copiar al portapapeles con confirmación. */
function BotonCopiar({ texto, etiquetaLarga = false }: { texto: string; etiquetaLarga?: boolean }) {
  const { t } = useTranslation();
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* el navegador puede negar el portapapeles: no es un error que
         merezca romper nada, simplemente no se confirma */
    }
  }

  return (
    <button type="button" onClick={() => void copiar()} className="btn-fantasma h-8 shrink-0 px-3 text-xs">
      {copiado ? (
        <>
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          {t('cssPagina.copiado')}
        </>
      ) : (
        <>
          <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />
          {etiquetaLarga ? t('cssPagina.copiarContexto') : t('cssPagina.copiar')}
        </>
      )}
    </button>
  );
}
