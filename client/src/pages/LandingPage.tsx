import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Gamepad2,
  Link2,
  LayoutGrid,
  Lock,
  MessageSquare,
  Palette,
  Share2,
  UserPlus,
} from 'lucide-react';

import { useAuth } from '../store/authStore';

/**
 * Landing (§7 de PROYECTO.md) — el "por qué".
 *
 * Están las secciones que se sostienen solas: hero, cómo funciona,
 * características, comparación y CTA. Faltan a propósito el perfil de
 * ejemplo animado y los "perfiles destacados reales", que necesitan
 * bloques (Fase 3) y datos de gente registrada (Fase 7): ponerlos ahora
 * significaría inventar perfiles falsos.
 */
export function LandingPage() {
  const usuario = useAuth((e) => e.usuario);

  return (
    <>
      <Hero autenticado={Boolean(usuario)} handle={usuario?.handle} />
      <ComoFunciona />
      <Caracteristicas />
      <Comparacion />
      <LlamadoFinal autenticado={Boolean(usuario)} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────

function Hero({ autenticado, handle }: { autenticado: boolean; handle?: string }) {
  const { t } = useTranslation();
  return (
    <section className="relative overflow-hidden">
      {/* Rejilla de fondo (§5.2): reemplaza blobs y partículas. */}
      <div className="rejilla-hero absolute inset-0" aria-hidden="true" />

      <div className="contenedor-app relative">
        <div className="mx-auto max-w-3xl py-24 text-center md:py-32">
          <span className="badge mb-8">
            <Gamepad2 className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('landing.insignia')}
          </span>

          <h1 className="titulo-hero mb-6">{t('landing.titulo')}</h1>

          <p className="mx-auto mb-10 max-w-2xl text-xl font-medium text-zinc-600 md:text-3xl dark:text-zinc-400">
            {t('landing.subtitulo')}
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            {autenticado ? (
              <>
                <Link to="/editor" className="btn-primario">
                  {t('landing.editarMiPerfil')}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link to={`/u/${handle}`} className="btn-secundario">
                  {t('landing.verMiPerfil')}
                </Link>
              </>
            ) : (
              <>
                <Link to="/registro" className="btn-primario">
                  {t('landing.crearMiPerfil')}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link to="/explorar" className="btn-secundario">
                  {t('landing.verEjemplos')}
                </Link>
              </>
            )}
          </div>

          <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
            <Trans
              i18nKey="landing.gratis"
              components={{ mono: <span className="font-mono" /> }}
            />
          </p>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────

/* Solo el icono y la clave: el texto se resuelve en el render, para que
   cambiar de idioma no exija recargar. */
const PASOS = [
  { icono: UserPlus, clave: 'paso1' },
  { icono: Link2, clave: 'paso2' },
  { icono: Share2, clave: 'paso3' },
] as const;

function ComoFunciona() {
  const { t } = useTranslation();
  return (
    <section className="seccion-alterna">
      <div className="contenedor-seccion">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-zinc-900 md:text-5xl dark:text-white">
            {t('landing.pasosTitulo')}
          </h2>
          <p className="text-base leading-relaxed text-zinc-600 md:text-lg dark:text-zinc-400">
            {t('landing.pasosSubtitulo')}
          </p>
        </div>

        <ol className="grid gap-6 md:grid-cols-3">
          {PASOS.map((paso, indice) => (
            <li key={paso.clave} className="tarjeta">
              <div className="mb-5 flex items-center justify-between">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl border
                             border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <paso.icono
                    className="h-5 w-5 text-zinc-700 dark:text-zinc-300"
                    aria-hidden="true"
                  />
                </div>
                <span className="font-mono text-sm text-blue-600 dark:text-blue-400">
                  0{indice + 1}
                </span>
              </div>
              <h3 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-white">
                {t(`landing.${paso.clave}Titulo`)}
              </h3>
              <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
                {t(`landing.${paso.clave}Texto`)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────

const CARACTERISTICAS = [
  { icono: Gamepad2, clave: 'car1' },
  { icono: LayoutGrid, clave: 'car2' },
  { icono: Palette, clave: 'car3' },
  { icono: MessageSquare, clave: 'car4' },
  { icono: Lock, clave: 'car5' },
  { icono: Share2, clave: 'car6' },
] as const;

function Caracteristicas() {
  const { t } = useTranslation();
  return (
    <section className="seccion">
      <div className="contenedor-seccion">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-zinc-900 md:text-5xl dark:text-white">
            {t('landing.caracteristicasTitulo')}
          </h2>
          <p className="text-base leading-relaxed text-zinc-600 md:text-lg dark:text-zinc-400">
            {t('landing.caracteristicasSubtitulo')}
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CARACTERISTICAS.map((c) => (
            <article key={c.clave} className="tarjeta-interactiva">
              <div
                className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border
                           border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <c.icono className="h-5 w-5 text-zinc-700 dark:text-zinc-300" aria-hidden="true" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">
                {t(`landing.${c.clave}Titulo`)}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {t(`landing.${c.clave}Texto`)}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────

const COMPARACION = ['comp1', 'comp2', 'comp3', 'comp4', 'comp5'] as const;

function Comparacion() {
  const { t } = useTranslation();
  return (
    <section className="seccion-alterna">
      <div className="contenedor-seccion">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-zinc-900 md:text-5xl dark:text-white">
            {t('landing.comparacionTitulo')}
          </h2>
        </div>

        <div className="mx-auto max-w-3xl overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">{t('landing.comparacionLeyenda')}</caption>
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th scope="col" className="py-4 pr-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                  <span className="sr-only">{t('landing.comparacionAspecto')}</span>
                </th>
                <th scope="col" className="px-4 py-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                  {t('landing.comparacionLink')}
                </th>
                <th scope="col" className="py-4 pl-4 text-sm font-semibold text-zinc-900 dark:text-white">
                  Wander
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARACION.map((clave) => (
                <tr key={clave} className="border-b border-zinc-200 dark:border-zinc-800/60">
                  <th
                    scope="row"
                    className="py-4 pr-4 text-sm font-medium text-zinc-900 dark:text-white"
                  >
                    {t(`landing.${clave}Punto`)}
                  </th>
                  <td className="px-4 py-4 text-sm text-zinc-500 dark:text-zinc-500">
                    {t(`landing.${clave}Link`)}
                  </td>
                  <td className="py-4 pl-4 text-sm text-zinc-700 dark:text-zinc-300">
                    {t(`landing.${clave}Wander`)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────

function LlamadoFinal({ autenticado }: { autenticado: boolean }) {
  const { t } = useTranslation();
  if (autenticado) return null;

  return (
    <section className="seccion-destacada">
      <div className="contenedor-seccion">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-zinc-900 md:text-5xl dark:text-white">
            {t('landing.finalTitulo')}
          </h2>
          <p className="mb-10 text-base leading-relaxed text-zinc-600 md:text-lg dark:text-zinc-400">
            {t('landing.finalTexto')}
          </p>
          <Link to="/registro" className="btn-primario">
            {t('landing.crearMiPerfil')}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
