import { Link } from 'react-router-dom';
import { AlertTriangle, Check, X } from 'lucide-react';

import { AvisoIdiomaLegal } from '../components/AvisoIdiomaLegal';

/**
 * Términos del servicio.
 *
 * Escritos cortos y en lenguaje llano a propósito. Unos términos que nadie
 * lee no protegen a nadie: si la única forma de saber qué se puede publicar
 * es aguantar cuatro pantallas de jerga, la gente marca la casilla sin leer
 * y el documento no cumple su función.
 *
 * También son honestos sobre lo que Wander es hoy: un proyecto personal, no
 * una empresa con equipo de soporte. Prometer disponibilidad o permanencia
 * que no se pueden sostener sería peor que no prometer nada.
 *
 * **Este documento no pasa por i18n** (Fase 6.5): existe solo en español, y
 * `AvisoIdiomaLegal` lo dice cuando la interfaz está en otro idioma.
 */
export function TerminosPage() {
  return (
    <div className="contenedor-app max-w-3xl py-12">
      <AvisoIdiomaLegal />

      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Términos del servicio
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Las reglas de usar Wander, en lenguaje llano. Si algo no se entiende, es un fallo
          nuestro: escribe y lo aclaramos.
        </p>
      </header>

      <div className="space-y-10">
        <Seccion titulo="Lo esencial">
          <ul className="space-y-2">
            <Punto texto="Tu perfil y lo que escribes en él siguen siendo tuyos." />
            <Punto texto="Solo se publica si tú lo publicas: las cuentas empiezan sin publicar." />
            <Punto texto="Puedes irte cuando quieras y llevarte —o borrar— lo tuyo." />
            <Punto texto="Wander es un proyecto personal, no una empresa: no hay garantías de disponibilidad." />
          </ul>
        </Seccion>

        <Seccion titulo="Quién puede usarlo">
          <p className="text-zinc-600 dark:text-zinc-400">
            Necesitas tener al menos <strong>13 años</strong>. Si donde vives hace falta más edad
            para aceptar un servicio así por tu cuenta, aplica esa. Una cuenta es de una persona;
            no la compartas ni la vendas.
          </p>
        </Seccion>

        <Seccion titulo="Tu cuenta">
          <ul className="space-y-2">
            <Punto texto="Eres responsable de lo que pase con tu cuenta: cuida tu contraseña." />
            <Punto texto="Si entras con Steam, Discord o Google, proteger esas cuentas es igual de importante: son la llave de esta." />
            <Punto texto="Si crees que alguien entró a tu cuenta, escríbenos y avísanos." />
          </ul>
        </Seccion>

        <Seccion titulo="Qué puedes publicar">
          <p className="mb-4 text-zinc-600 dark:text-zinc-400">
            Wander es para presentarte como jugador. Casi todo cabe ahí. Lo que{' '}
            <strong>no</strong> cabe:
          </p>
          <ul className="space-y-2">
            <Prohibido texto="Contenido ilegal, o que promueva hacer daño a alguien." />
            <Prohibido texto="Acoso, amenazas o incitación al odio contra personas o grupos." />
            <Prohibido texto="Contenido sexual explícito, y en absoluto nada que involucre a menores." />
            <Prohibido texto="Hacerte pasar por otra persona, marca o por el equipo de Wander." />
            <Prohibido texto="Material del que no tengas derechos: imágenes, música o textos ajenos." />
            <Prohibido texto="Malware, phishing o enlaces que engañen sobre a dónde llevan." />
            <Prohibido texto="Spam, publicidad encubierta o inflar tus números artificialmente." />
          </ul>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            Esto vale para todo: tu perfil, tus bloques, tu avatar, tu banner, tu música de fondo
            y tu nombre de usuario.
          </p>
        </Seccion>

        <Seccion titulo="Qué NO puedes hacer con el servicio">
          <ul className="space-y-2">
            <Prohibido texto="Intentar romperlo, saturarlo o saltarte los límites de uso." />
            <Prohibido texto="Rascar el sitio de forma masiva o automatizada." />
            <Prohibido texto="Acceder a cuentas o datos que no sean tuyos." />
            <Prohibido texto="Usar la plataforma para revender o redistribuir sus datos." />
          </ul>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            Buscar fallos de seguridad de buena fe y avisarnos <strong>no</strong> es un problema:
            es de agradecer. Escríbenos antes de hacer nada que pueda afectar a otros usuarios.
          </p>
        </Seccion>

        <Seccion titulo="Tu contenido es tuyo">
          <p className="text-zinc-600 dark:text-zinc-400">
            No reclamamos propiedad sobre nada de lo que publiques. Lo único que necesitamos es el
            permiso técnico para <em>mostrarlo</em>: guardarlo, servirlo a quien visite tu perfil y
            generar las vistas previas que se ven al compartir tu enlace. Ese permiso termina
            cuando borras el contenido o tu cuenta.
          </p>
          <p className="mt-3 text-zinc-600 dark:text-zinc-400">
            Al subir algo confirmas que tienes derecho a hacerlo. Con la música de fondo hay que
            tener cuidado especial: subir una canción ajena puede acarrear una reclamación de
            derechos de autor, y en ese caso la retiraremos.
          </p>
        </Seccion>

        <Seccion titulo="Datos de otras plataformas">
          <p className="text-zinc-600 dark:text-zinc-400">
            Cuando conectas Steam, Discord o Google, esos datos siguen siendo suyos y se rigen por
            sus propias condiciones. Wander solo guarda la copia que autorizaste, y esas
            plataformas pueden cambiar sus reglas o cortar el acceso sin avisarnos. Si eso pasa, la
            parte del perfil que dependa de ellas dejará de actualizarse. Los detalles están en{' '}
            <Link to="/privacidad" className="enlace-acento">
              privacidad
            </Link>
            .
          </p>
        </Seccion>

        <Seccion titulo="Moderación">
          <p className="text-zinc-600 dark:text-zinc-400">
            Si algo incumple estas reglas podemos retirarlo o suspender la cuenta. Ante casos
            graves o repetidos, la suspensión puede ser permanente. Salvo que sea ilegal o urgente,
            la intención es siempre avisar y dar la oportunidad de corregirlo antes de borrar nada.
          </p>
          <p className="mt-3 text-zinc-600 dark:text-zinc-400">
            Si crees que nos equivocamos contigo, escríbenos: se revisa a mano.
          </p>
        </Seccion>

        <Seccion titulo="Irte">
          <p className="text-zinc-600 dark:text-zinc-400">
            Puedes borrar tu cuenta cuando quieras, y con ella se va tu perfil, tus bloques y los
            datos que hubiéramos guardado de las plataformas conectadas. Si prefieres solo
            desaparecer de la vista, despublicar el perfil es inmediato y no borra nada.
          </p>
        </Seccion>

        <Seccion titulo="Sin garantías">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
            <p className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Wander es un proyecto personal, servido tal cual. Puede caerse, tener fallos o
                dejar de estar disponible. <strong>No lo uses como el único sitio donde guardas
                algo que te importe</strong>: quédate con una copia de lo que no quieras perder.
                Dentro de lo que permita la ley, no asumimos responsabilidad por pérdidas
                derivadas del uso del servicio.
              </span>
            </p>
          </div>
          {/* Nada de "hay copias de seguridad": hoy no las hay (es un pendiente
              conocido de PROYECTO.md). Prometerlo aquí sería mentir en el único
              documento donde no se puede. */}
          <p className="mt-3 text-zinc-600 dark:text-zinc-400">
            Dicho eso, la intención es cuidarlo, y avisaremos con antelación si alguna vez hubiera
            que cerrar.
          </p>
        </Seccion>

        <Seccion titulo="Cambios">
          <p className="text-zinc-600 dark:text-zinc-400">
            Si estas reglas cambian de forma relevante, se avisará en el sitio antes de que
            apliquen. Seguir usando Wander después de un cambio significa aceptarlo; si no estás de
            acuerdo, puedes borrar tu cuenta. Última actualización: 30 de julio de 2026.
          </p>
        </Seccion>
      </div>

      <p className="mt-12 border-t border-zinc-200 pt-6 text-sm text-zinc-500 dark:border-zinc-800">
        ¿Dudas, un reporte o una reclamación de derechos? Escribe a{' '}
        <a href="mailto:lucio.tellez@gmail.com" className="enlace-acento">
          lucio.tellez@gmail.com
        </a>
        . Lee también la{' '}
        <Link to="/privacidad" className="enlace-acento">
          política de privacidad
        </Link>
        .
      </p>
    </div>
  );
}

// ── Piezas ───────────────────────────────────────────────────────────

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Punto({ texto }: { texto: string }) {
  return (
    <li className="flex items-start gap-2 text-zinc-600 dark:text-zinc-400">
      <Check
        className="mt-1 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
        aria-hidden="true"
      />
      {texto}
    </li>
  );
}

function Prohibido({ texto }: { texto: string }) {
  return (
    <li className="flex items-start gap-2 text-zinc-600 dark:text-zinc-400">
      <X className="mt-1 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
      {texto}
    </li>
  );
}
