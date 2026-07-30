import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { api } from '../lib/api';
import type { DescripcionVinculacion, DefinicionPermiso } from '../lib/cuentas';

/**
 * Página de privacidad (Fase 6).
 *
 * La parte de proveedores **se lee del backend**, del mismo sitio del que
 * sale la pantalla de consentimiento de /configuracion. Es deliberado: si
 * este texto estuviera escrito a mano aquí, tarde o temprano diría una cosa
 * y la vinculación haría otra. Una sola fuente hace que no puedan
 * contradecirse.
 *
 * Es pública a propósito: se puede leer sin cuenta, que es justo cuando
 * alguien decide si confía en el sitio.
 */

interface ProveedorPrivacidad {
  proveedor: string;
  nombre: string;
  disponible: boolean;
  descripcion: DescripcionVinculacion;
  permisos: Record<string, DefinicionPermiso>;
}

export function PrivacidadPage() {
  const [proveedores, setProveedores] = useState<ProveedorPrivacidad[]>([]);

  useEffect(() => {
    api
      .get<{ proveedores: ProveedorPrivacidad[] }>('/cuentas/privacidad')
      .then(({ data }) => setProveedores(data.proveedores))
      // Si falla, el resto de la página (que es lo importante) sigue
      // legible. Un error aquí no debe dejar la privacidad en blanco.
      .catch(() => setProveedores([]));
  }, []);

  return (
    <div className="contenedor-app max-w-3xl py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Privacidad
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Qué datos guarda Wander, por qué, y cómo puedes quitarlos. Sin letra pequeña.
        </p>
      </header>

      <div className="space-y-10">
        <Seccion titulo="Lo esencial">
          <ul className="space-y-2">
            {[
              'Tu perfil solo es visible si tú lo publicas. Empieza sin publicar.',
              'No vendemos tus datos ni los cedemos a anunciantes.',
              'No usamos rastreadores de terceros ni cookies de publicidad.',
              'Puedes desconectar cualquier plataforma cuando quieras, y sus datos se borran con ella.',
              'Si borras tu cuenta, se borra todo lo que cuelga de ella.',
            ].map((punto) => (
              <Punto key={punto} texto={punto} />
            ))}
          </ul>
        </Seccion>

        <Seccion titulo="Qué guardamos de ti">
          <Tabla
            filas={[
              ['Tu cuenta', 'Correo (si te registraste con uno), nombre, handle y avatar.'],
              [
                'Tu contraseña',
                'Nunca en claro. Se guarda un hash con argon2id, del que no se puede volver atrás.',
              ],
              ['Tu perfil', 'Los bloques que creas, tu tema y tus textos.'],
              [
                'Datos de plataformas',
                'Una copia de lo que autorices (juegos, horas, presencia), para no pedírselo al proveedor en cada visita.',
              ],
              [
                'Sesiones',
                'Para poder cerrarlas. Se guarda el navegador y un hash de la IP, nunca la IP en claro.',
              ],
              [
                'Seguridad',
                'Un registro de accesos y de vinculaciones, con las IPs también hasheadas, para poder investigar un incidente.',
              ],
            ]}
          />
        </Seccion>

        <Seccion titulo="Cookies">
          <p className="text-zinc-600 dark:text-zinc-400">
            Solo las necesarias para mantener tu sesión: dos cookies{' '}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-sm dark:bg-zinc-800">
              httpOnly
            </code>{' '}
            que el JavaScript de la página no puede leer. No hay cookies de análisis ni de
            publicidad, así que tampoco hay banner que aceptar.
          </p>
        </Seccion>

        {proveedores.length > 0 && (
          <Seccion titulo="Plataformas que puedes conectar">
            <p className="mb-6 text-zinc-600 dark:text-zinc-400">
              Conectar es opcional y siempre reversible. Esto es exactamente lo que pide cada una:
            </p>

            <div className="space-y-6">
              {proveedores.map((p) => (
                <div
                  key={p.proveedor}
                  className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
                >
                  <h3 className="mb-4 font-semibold text-zinc-900 dark:text-white">{p.nombre}</h3>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <ListaIconos titulo="Qué leemos" elementos={p.descripcion.lee} tipo="ok" />
                    <ListaIconos titulo="Qué guardamos" elementos={p.descripcion.guarda} tipo="ok" />
                  </div>

                  {p.descripcion.noPide.length > 0 && (
                    <div className="mt-5">
                      <ListaIconos
                        titulo="Qué NO pedimos"
                        elementos={p.descripcion.noPide}
                        tipo="no"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Seccion>
        )}

        <Seccion titulo="Tus datos en manos de otros">
          <p className="text-zinc-600 dark:text-zinc-400">
            Cuando conectas una plataforma, sus datos siguen rigiéndose por{' '}
            <em>su</em> política de privacidad. Wander solo guarda la copia que autorizaste. Para
            el estado en vivo de Discord usamos{' '}
            <a
              href="https://github.com/Phineas/lanyard"
              target="_blank"
              rel="noreferrer noopener"
              className="enlace-acento"
            >
              Lanyard
            </a>
            , un servicio externo: si activas ese permiso, tu presencia pública de Discord pasa por
            él.
          </p>
        </Seccion>

        <Seccion titulo="Control sobre tus datos">
          <ul className="space-y-2">
            <Punto texto="Editar o borrar cualquier cosa de tu perfil, cuando quieras." />
            <Punto texto="Despublicar tu perfil: deja de ser accesible al instante." />
            <Punto texto="Desconectar una plataforma, lo que borra también sus datos guardados." />
            <Punto texto="Borrar tu cuenta entera, con todo lo que cuelga de ella." />
          </ul>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            Todo eso se hace desde{' '}
            <Link to="/configuracion" className="enlace-acento">
              configuración
            </Link>{' '}
            y desde el{' '}
            <Link to="/editor" className="enlace-acento">
              editor
            </Link>
            .
          </p>
        </Seccion>

        <Seccion titulo="Menores">
          <p className="text-zinc-600 dark:text-zinc-400">
            Wander no está dirigido a menores de 13 años. Si detectamos una cuenta de alguien por
            debajo de esa edad, la retiramos.
          </p>
        </Seccion>

        <Seccion titulo="Cambios">
          <p className="text-zinc-600 dark:text-zinc-400">
            Si esto cambia de forma relevante, se avisará en el sitio antes de que aplique. Última
            actualización: 30 de julio de 2026.
          </p>
        </Seccion>
      </div>

      <p className="mt-12 border-t border-zinc-200 pt-6 text-sm text-zinc-500 dark:border-zinc-800">
        ¿Dudas sobre tus datos? Escribe a{' '}
        <a href="mailto:lucio.tellez@gmail.com" className="enlace-acento">
          lucio.tellez@gmail.com
        </a>
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

function ListaIconos({
  titulo,
  elementos,
  tipo,
}: {
  titulo: string;
  elementos: string[];
  tipo: 'ok' | 'no';
}) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{titulo}</h4>
      <ul className="space-y-1">
        {elementos.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            {tipo === 'ok' ? (
              <Check
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
            ) : (
              <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
            )}
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tabla({ filas }: { filas: Array<[string, string]> }) {
  return (
    <dl className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {filas.map(([clave, valor]) => (
        <div key={clave} className="grid gap-1 p-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
          <dt className="text-sm font-medium text-zinc-900 dark:text-white">{clave}</dt>
          <dd className="text-sm text-zinc-600 dark:text-zinc-400">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}
