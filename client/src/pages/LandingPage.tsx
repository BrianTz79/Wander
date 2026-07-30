import { Link } from 'react-router-dom';
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
  return (
    <section className="relative overflow-hidden">
      {/* Rejilla de fondo (§5.2): reemplaza blobs y partículas. */}
      <div className="rejilla-hero absolute inset-0" aria-hidden="true" />

      <div className="contenedor-app relative">
        <div className="mx-auto max-w-3xl py-24 text-center md:py-32">
          <span className="badge mb-8">
            <Gamepad2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Tu identidad como jugador, en un solo enlace
          </span>

          <h1 className="titulo-hero mb-6">Todo lo que juegas, en un solo lugar</h1>

          <p className="mx-auto mb-10 max-w-2xl text-xl font-medium text-zinc-600 md:text-3xl dark:text-zinc-400">
            Conecta Steam y Discord, arma tu perfil con bloques y compártelo. Los datos se traen
            solos.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            {autenticado ? (
              <>
                <Link to="/editor" className="btn-primario">
                  Editar mi perfil
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link to={`/u/${handle}`} className="btn-secundario">
                  Ver mi perfil
                </Link>
              </>
            ) : (
              <>
                <Link to="/registro" className="btn-primario">
                  Crear mi perfil
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link to="/explorar" className="btn-secundario">
                  Ver ejemplos
                </Link>
              </>
            )}
          </div>

          <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
            Gratis. Sin tarjeta. Tu perfil vive en <span className="font-mono">wander/u/tu-nombre</span>.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────

const PASOS = [
  {
    icono: UserPlus,
    titulo: 'Regístrate',
    texto: 'Elige tu nombre de usuario. Ese es el enlace de tu perfil, y es tuyo.',
  },
  {
    icono: Link2,
    titulo: 'Conecta tus cuentas',
    texto:
      'Vincula Steam y Discord. Tus juegos, horas y logros aparecen sin que escribas nada a mano.',
  },
  {
    icono: Share2,
    titulo: 'Compártelo',
    texto: 'Un enlace para tu bio, tu firma o tu servidor. Se ve bien donde lo pongas.',
  },
] as const;

function ComoFunciona() {
  return (
    <section className="seccion-alterna">
      <div className="contenedor-seccion">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-zinc-900 md:text-5xl dark:text-white">
            Tres pasos y está listo
          </h2>
          <p className="text-base leading-relaxed text-zinc-600 md:text-lg dark:text-zinc-400">
            No hay que mantener nada actualizado a mano.
          </p>
        </div>

        <ol className="grid gap-6 md:grid-cols-3">
          {PASOS.map((paso, indice) => (
            <li key={paso.titulo} className="tarjeta">
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
                {paso.titulo}
              </h3>
              <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">{paso.texto}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────

const CARACTERISTICAS = [
  {
    icono: Gamepad2,
    titulo: 'Los datos se traen solos',
    texto:
      'Vinculas Steam y tus horas, juegos y logros aparecen al momento. No es un enlace en la bio que hay que ir actualizando.',
  },
  {
    icono: LayoutGrid,
    titulo: 'Bloques que acomodas',
    texto:
      'Añades, quitas y reordenas: actividad, favoritos, setup del PC, galería, enlaces. Tu perfil, tu orden.',
  },
  {
    icono: Palette,
    titulo: 'Personalización de verdad',
    texto:
      'Colores, tipografías, fondo y bordes. Y si sabes CSS, escribes el tuyo — las plantillas son un punto de partida, no una jaula.',
  },
  {
    icono: MessageSquare,
    titulo: 'Social, no un muro muerto',
    texto: 'Sigue gente, comenta perfiles y habla por privado, con grupos y adjuntos.',
  },
  {
    icono: Lock,
    titulo: 'Claro con tus datos',
    texto:
      'Cada vinculación dice qué se lee y qué se guarda. Permisos por separado y desvincular borra de verdad.',
  },
  {
    icono: Share2,
    titulo: 'Se ve bien al compartir',
    texto: 'Tarjetas para Discord y X generadas desde tu perfil, con tu tema y tus datos.',
  },
] as const;

function Caracteristicas() {
  return (
    <section className="seccion">
      <div className="contenedor-seccion">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-zinc-900 md:text-5xl dark:text-white">
            Un perfil que se mantiene solo
          </h2>
          <p className="text-base leading-relaxed text-zinc-600 md:text-lg dark:text-zinc-400">
            Lo que hace distinta a Wander de pegar cuatro enlaces en una bio.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CARACTERISTICAS.map((c) => (
            <article key={c.titulo} className="tarjeta-interactiva">
              <div
                className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border
                           border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <c.icono className="h-5 w-5 text-zinc-700 dark:text-zinc-300" aria-hidden="true" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">
                {c.titulo}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{c.texto}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────

const COMPARACION = [
  { punto: 'Tus horas y juegos', link: 'Los escribes a mano', wander: 'Se traen de Steam solos' },
  { punto: 'Mantenerlo al día', link: 'Te acuerdas… o no', wander: 'Se actualiza sin tocarlo' },
  { punto: 'Aspecto', link: 'La plantilla que hay', wander: 'Tema propio y CSS si quieres' },
  { punto: 'Estado en vivo', link: 'No existe', wander: 'Discord y Spotify en tiempo real' },
  { punto: 'Gente', link: 'Una lista de enlaces', wander: 'Seguir, comentar y mensajes' },
] as const;

function Comparacion() {
  return (
    <section className="seccion-alterna">
      <div className="contenedor-seccion">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-zinc-900 md:text-5xl dark:text-white">
            Contra un «link en la bio»
          </h2>
        </div>

        <div className="mx-auto max-w-3xl overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">
              Comparación entre una página de enlaces y Wander
            </caption>
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th scope="col" className="py-4 pr-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                  <span className="sr-only">Aspecto</span>
                </th>
                <th scope="col" className="px-4 py-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                  Link en la bio
                </th>
                <th scope="col" className="py-4 pl-4 text-sm font-semibold text-zinc-900 dark:text-white">
                  Wander
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARACION.map((fila) => (
                <tr key={fila.punto} className="border-b border-zinc-200 dark:border-zinc-800/60">
                  <th
                    scope="row"
                    className="py-4 pr-4 text-sm font-medium text-zinc-900 dark:text-white"
                  >
                    {fila.punto}
                  </th>
                  <td className="px-4 py-4 text-sm text-zinc-500 dark:text-zinc-500">
                    {fila.link}
                  </td>
                  <td className="py-4 pl-4 text-sm text-zinc-700 dark:text-zinc-300">
                    {fila.wander}
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
  if (autenticado) return null;

  return (
    <section className="seccion-destacada">
      <div className="contenedor-seccion">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-zinc-900 md:text-5xl dark:text-white">
            Arma el tuyo
          </h2>
          <p className="mb-10 text-base leading-relaxed text-zinc-600 md:text-lg dark:text-zinc-400">
            Toma dos minutos. Eliges tu nombre, conectas Steam y ya tienes algo que compartir.
          </p>
          <Link to="/registro" className="btn-primario">
            Crear mi perfil
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
