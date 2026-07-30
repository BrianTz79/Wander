import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';

import { useAuth } from '../store/authStore';
import { useEditor } from '../store/editorStore';
import { api, mensajeError } from '../lib/api';
import { horasDe } from '../lib/steam';
import {
  FUENTES_ETIQUETAS,
  temaCompleto,
  varsDeTema,
  type Bloque,
  type TemaPerfil,
  type TipoBloque,
} from '../lib/perfil';
import {
  PLANTILLAS,
  PLANTILLA_PERSONALIZADA,
  PLANTILLA_POR_DEFECTO,
  type Plantilla,
} from '../lib/plantillas';
import { necesitaSteam, REGISTRO_BLOQUES, RenderBloque } from '../components/bloques/registro';
import { ProveedorSteam, useSteam } from '../lib/steamContexto';

/**
 * Editor de perfil (Fase 3) — el corazón de Wander.
 *
 * Dos columnas: controles a la izquierda, vista previa EN VIVO a la
 * derecha. La vista previa usa exactamente los mismos componentes que la
 * página pública, así que lo que se ve aquí es lo que verá cualquiera.
 */
export function EditorPerfilPage() {
  const usuarioAuth = useAuth((e) => e.usuario);
  const { perfil, usuario, cargando, errorCarga, guardado, cargar } = useEditor();

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (cargando) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status">
        <span className="sr-only">Cargando editor…</span>
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
        <p className="text-zinc-600 dark:text-zinc-400">{errorCarga ?? 'Algo salió mal.'}</p>
      </div>
    );
  }

  return (
    /* La vista previa pide los datos reales de Steam del dueño: el editor
       tiene que enseñar lo que verá un visitante, no un maniquí. El propio
       usuario siempre puede leer su perfil aunque esté sin publicar. */
    <ProveedorSteam handle={usuarioAuth?.handle} activo={necesitaSteam(perfil.bloques)}>
    <div className="contenedor-app py-8">
      {/* Cabecera: título, estado de guardado y publicación */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Editor de perfil
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Tu perfil vive en{' '}
            <Link to={`/u/${usuarioAuth?.handle}`} className="enlace-acento font-mono">
              /u/{usuarioAuth?.handle}
            </Link>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <IndicadorGuardado estado={guardado} />
          <BotonPublicar />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[24rem_1fr]">
        {/* ── Columna de controles ── */}
        <div className="space-y-6">
          <PanelIdentidad />
          <PanelPlantillas />
          <PanelTema />
          <PanelBloques />
        </div>

        {/* ── Vista previa ── */}
        <div className="min-w-0">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Vista previa
          </p>
          <div
            className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800"
            style={varsDeTema(perfil.tema)}
          >
            <div
              className="mx-auto max-w-2xl px-4 pb-12"
              style={{ backgroundColor: 'var(--p-fondo)', color: 'var(--p-texto)' }}
            >
              {perfil.bloques.filter((b) => b.visible).length === 0 && (
                <p className="py-24 text-center text-sm" style={{ opacity: 0.6 }}>
                  Añade bloques para dar vida a tu perfil.
                </p>
              )}
              {perfil.bloques
                .filter((b) => b.visible)
                .map((bloque) => (
                  <div key={bloque.id} className="mt-6 first:mt-0">
                    <RenderBloque bloque={bloque} usuario={usuario} />
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
    </ProveedorSteam>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Indicador de guardado y publicación
// ─────────────────────────────────────────────────────────────────────

function IndicadorGuardado({ estado }: { estado: 'inactivo' | 'guardando' | 'guardado' | 'error' }) {
  if (estado === 'inactivo') return null;
  return (
    <span
      role="status"
      className="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400"
    >
      {estado === 'guardando' && (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Guardando…
        </>
      )}
      {estado === 'guardado' && (
        <>
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden="true" />{' '}
          Guardado
        </>
      )}
      {estado === 'error' && (
        <>
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" aria-hidden="true" /> No
          se pudo guardar
        </>
      )}
    </span>
  );
}

function BotonPublicar() {
  const { perfil, guardarPerfil } = useEditor();
  if (!perfil) return null;

  return (
    <button
      type="button"
      onClick={() => void guardarPerfil({ publicado: !perfil.publicado }).catch(() => undefined)}
      className={perfil.publicado ? 'btn-secundario h-10 px-5' : 'btn-primario h-10 px-5'}
    >
      {perfil.publicado ? (
        <>
          <EyeOff className="h-4 w-4" aria-hidden="true" /> Ocultar perfil
        </>
      ) : (
        <>
          <Eye className="h-4 w-4" aria-hidden="true" /> Publicar
        </>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Panel: identidad (displayName + bio, campos de User)
// ─────────────────────────────────────────────────────────────────────

function PanelIdentidad() {
  const { usuario, guardarPerfil } = useEditor();
  const setUsuarioAuth = useAuth((e) => e.setUsuario);
  const usuarioAuth = useAuth((e) => e.usuario);

  const [nombre, setNombre] = useState(usuario?.displayName ?? '');
  const [bio, setBio] = useState(usuario?.bio ?? '');
  const [error, setError] = useState('');

  if (!usuario) return null;
  const sinCambios = nombre === usuario.displayName && bio === (usuario.bio ?? '');

  async function alGuardar(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await guardarPerfil({ displayName: nombre.trim(), bio });
      // La navbar muestra el displayName: se sincroniza el authStore.
      if (usuarioAuth) setUsuarioAuth({ ...usuarioAuth, displayName: nombre.trim() });
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <form onSubmit={alGuardar} className="tarjeta">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">Identidad</h2>

      {error && <p className="texto-error mb-3">{error}</p>}

      <label htmlFor="ed-nombre" className="etiqueta">
        Nombre para mostrar
      </label>
      <input
        id="ed-nombre"
        type="text"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        maxLength={40}
        className="campo mb-4"
      />

      <label htmlFor="ed-bio" className="etiqueta">
        Bio
      </label>
      <textarea
        id="ed-bio"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        maxLength={500}
        rows={4}
        className="campo mb-1 h-auto resize-y py-3"
        placeholder="Cuenta quién eres como jugador."
      />
      <p className="mb-4 text-right text-xs text-zinc-400">{bio.length}/500</p>

      <button type="submit" disabled={sinCambios || !nombre.trim()} className="btn-primario h-10 w-full">
        Guardar identidad
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Panel: plantillas
// ─────────────────────────────────────────────────────────────────────

/**
 * Selector de plantillas (Fase 4).
 *
 * Una plantilla solo cambia el TEMA — los bloques y su contenido no se
 * tocan. Es lo que permite probar los cinco presets sin miedo: se puede
 * ir y volver sin perder nada de lo escrito.
 */
function PanelPlantillas() {
  const { perfil, aplicarPlantilla } = useEditor();
  if (!perfil) return null;

  return (
    <section className="tarjeta">
      <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-white">Plantillas</h2>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Un punto de partida. Cambia solo los colores y la tipografía: tus bloques se quedan como
        están.
      </p>

      <ul className="grid grid-cols-2 gap-2">
        {PLANTILLAS.map((plantilla) => {
          const activa = perfil.plantilla === plantilla.id;
          return (
            <li key={plantilla.id}>
              <button
                type="button"
                onClick={() => void aplicarPlantilla(plantilla.id)}
                aria-pressed={activa}
                title={plantilla.descripcion}
                className={`w-full overflow-hidden rounded-xl border text-left transition-colors ${
                  activa
                    ? 'border-zinc-900 dark:border-white'
                    : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600'
                }`}
              >
                <MiniaturaPlantilla plantilla={plantilla} />
                <span className="flex items-center justify-between gap-1 px-2 py-1.5">
                  <span className="truncate text-xs font-medium text-zinc-900 dark:text-white">
                    {plantilla.nombre}
                  </span>
                  {activa && (
                    <Check
                      className="h-3.5 w-3.5 shrink-0 text-zinc-900 dark:text-white"
                      aria-hidden="true"
                    />
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {perfil.plantilla === PLANTILLA_PERSONALIZADA && (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Tu tema está personalizado. Elegir una plantilla reemplazará los colores.
        </p>
      )}
    </section>
  );
}

/** Miniatura del preset: el propio tema pintado en pequeño, que dice más
 *  que cinco cuadritos de color sueltos. */
function MiniaturaPlantilla({ plantilla }: { plantilla: Plantilla }) {
  const t = plantilla.tema;
  return (
    <span
      aria-hidden="true"
      className="flex h-16 flex-col justify-center gap-1.5 px-2.5"
      style={{ backgroundColor: t.colorFondo }}
    >
      <span
        className="flex items-center gap-1.5 px-1.5 py-1"
        style={{
          backgroundColor: t.colorTarjeta,
          border: `1px solid ${t.colorBorde}`,
          borderRadius: `${Math.min(t.radio, 10)}px`,
        }}
      >
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: t.colorAcento }}
        />
        <span className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: t.colorTexto, opacity: 0.8 }} />
      </span>
      <span
        className="h-1.5 w-2/3 rounded-full"
        style={{ backgroundColor: t.colorTexto, opacity: 0.35 }}
      />
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Panel: tema
// ─────────────────────────────────────────────────────────────────────

const CAMPOS_COLOR: Array<{ clave: keyof TemaPerfil; etiqueta: string }> = [
  { clave: 'colorFondo', etiqueta: 'Fondo' },
  { clave: 'colorTexto', etiqueta: 'Texto' },
  { clave: 'colorAcento', etiqueta: 'Acento' },
  { clave: 'colorTarjeta', etiqueta: 'Tarjetas' },
  { clave: 'colorBorde', etiqueta: 'Bordes' },
];

function PanelTema() {
  const { perfil, cambiarTema, aplicarPlantilla } = useEditor();
  if (!perfil) return null;

  const tema = temaCompleto(perfil.tema);

  function poner<K extends keyof TemaPerfil>(clave: K, valor: TemaPerfil[K]) {
    cambiarTema({ ...temaCompleto(perfil!.tema), [clave]: valor });
  }

  return (
    <section className="tarjeta">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Tema</h2>
        {/* Restaurar = volver a la plantilla base, no solo a sus colores:
            así el perfil deja de estar marcado como "personalizada". */}
        <button
          type="button"
          onClick={() => void aplicarPlantilla(PLANTILLA_POR_DEFECTO)}
          className="btn-fantasma h-8 px-3 text-xs"
        >
          Restaurar
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        {CAMPOS_COLOR.map(({ clave, etiqueta }) => (
          <label key={clave} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="color"
              value={String(tema[clave])}
              onChange={(e) => poner(clave, e.target.value)}
              className="h-8 w-10 shrink-0 cursor-pointer rounded border border-zinc-300 bg-transparent p-0.5 dark:border-zinc-700"
              aria-label={`Color de ${etiqueta.toLowerCase()}`}
            />
            {etiqueta}
          </label>
        ))}
      </div>

      <label htmlFor="ed-fuente" className="etiqueta">
        Tipografía
      </label>
      <select
        id="ed-fuente"
        value={tema.fuente}
        onChange={(e) => poner('fuente', e.target.value as TemaPerfil['fuente'])}
        className="campo mb-4"
      >
        {Object.entries(FUENTES_ETIQUETAS).map(([valor, etiqueta]) => (
          <option key={valor} value={valor}>
            {etiqueta}
          </option>
        ))}
      </select>

      <label htmlFor="ed-radio" className="etiqueta">
        Redondez de esquinas: {tema.radio}px
      </label>
      <input
        id="ed-radio"
        type="range"
        min={0}
        max={32}
        step={2}
        value={tema.radio}
        onChange={(e) => poner('radio', Number(e.target.value))}
        className="w-full accent-zinc-900 dark:accent-white"
      />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Panel: bloques (lista + añadir)
// ─────────────────────────────────────────────────────────────────────

function PanelBloques() {
  const { perfil } = useEditor();
  const [abierto, setAbierto] = useState<string | null>(null);
  if (!perfil) return null;

  return (
    <section className="tarjeta">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">Bloques</h2>

      <ul className="space-y-2">
        {perfil.bloques.map((bloque, indice) => (
          <TarjetaBloque
            key={bloque.id}
            bloque={bloque}
            esPrimero={indice === 0}
            esUltimo={indice === perfil.bloques.length - 1}
            abierto={abierto === bloque.id}
            alternar={() => setAbierto(abierto === bloque.id ? null : bloque.id)}
          />
        ))}
      </ul>

      <MenuAnadirBloque />
    </section>
  );
}

function MenuAnadirBloque() {
  const { perfil, crearBloque } = useEditor();
  const [abierto, setAbierto] = useState(false);
  if (!perfil) return null;

  async function anadir(tipo: TipoBloque) {
    setAbierto(false);
    await crearBloque(tipo, { ...REGISTRO_BLOQUES[tipo].configInicial });
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="btn-secundario h-10 w-full"
        aria-expanded={abierto}
      >
        <Plus className="h-4 w-4" aria-hidden="true" /> Añadir bloque
      </button>

      {abierto && (
        <div className="mt-2 space-y-1">
          {(Object.keys(REGISTRO_BLOQUES) as TipoBloque[]).map((tipo) => {
            const def = REGISTRO_BLOQUES[tipo];
            return (
              <button
                key={tipo}
                type="button"
                onClick={() => void anadir(tipo)}
                className="flex w-full items-start gap-3 rounded-lg border border-zinc-200 p-3 text-left
                           transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <def.Icono className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-semibold text-zinc-900 dark:text-white">
                    {def.nombre}
                  </span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                    {def.descripcion}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Tarjeta de bloque en la lista (cabecera + formulario desplegable)
// ─────────────────────────────────────────────────────────────────────

function TarjetaBloque({
  bloque,
  esPrimero,
  esUltimo,
  abierto,
  alternar,
}: {
  bloque: Bloque;
  esPrimero: boolean;
  esUltimo: boolean;
  abierto: boolean;
  alternar: () => void;
}) {
  const { moverBloque, actualizarBloque, borrarBloque } = useEditor();
  const def = REGISTRO_BLOQUES[bloque.tipo];
  if (!def) return null;

  return (
    <li className="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center gap-2 p-2">
        <def.Icono className="ml-1 h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
        <button
          type="button"
          onClick={alternar}
          className="min-w-0 flex-1 truncate text-left text-sm font-medium text-zinc-900 dark:text-white"
          aria-expanded={abierto}
        >
          {def.nombre}
        </button>

        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => void moverBloque(bloque.id, -1)}
            disabled={esPrimero}
            className="btn-fantasma h-8 w-8 px-0 disabled:opacity-30"
            aria-label="Subir bloque"
          >
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => void moverBloque(bloque.id, 1)}
            disabled={esUltimo}
            className="btn-fantasma h-8 w-8 px-0 disabled:opacity-30"
            aria-label="Bajar bloque"
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => void actualizarBloque(bloque.id, { visible: !bloque.visible }).catch(() => undefined)}
            className="btn-fantasma h-8 w-8 px-0"
            aria-label={bloque.visible ? 'Ocultar bloque' : 'Mostrar bloque'}
          >
            {bloque.visible ? (
              <Eye className="h-4 w-4" aria-hidden="true" />
            ) : (
              <EyeOff className="h-4 w-4 opacity-50" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => void borrarBloque(bloque.id)}
            className="btn-fantasma h-8 w-8 px-0 text-red-500 hover:text-red-600"
            aria-label="Eliminar bloque"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {abierto && (
        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          {bloque.tipo === 'hero' && <FormHero bloque={bloque} />}
          {bloque.tipo === 'texto' && <FormTexto bloque={bloque} />}
          {bloque.tipo === 'enlaces' && <FormEnlaces bloque={bloque} />}
          {bloque.tipo === 'steam-actividad' && <FormSteamActividad bloque={bloque} />}
          {bloque.tipo === 'estadisticas' && <FormEstadisticas bloque={bloque} />}
          {bloque.tipo === 'favoritos' && <FormFavoritos bloque={bloque} />}
        </div>
      )}
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Formularios por tipo de bloque
// ─────────────────────────────────────────────────────────────────────

function FormHero({ bloque }: { bloque: Bloque }) {
  const { actualizarBloque } = useEditor();
  const [tagline, setTagline] = useState(String(bloque.config['tagline'] ?? ''));
  const [mostrarBio, setMostrarBio] = useState(bloque.config['mostrarBio'] !== false);
  const [error, setError] = useState('');

  async function alGuardar(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await actualizarBloque(bloque.id, { config: { tagline: tagline.trim(), mostrarBio } });
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <form onSubmit={alGuardar} className="space-y-3">
      {error && <p className="texto-error">{error}</p>}
      <div>
        <label htmlFor={`tag-${bloque.id}`} className="etiqueta">
          Frase corta
        </label>
        <input
          id={`tag-${bloque.id}`}
          type="text"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          maxLength={120}
          className="campo h-10"
          placeholder="Cazador de logros · main support"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={mostrarBio}
          onChange={(e) => setMostrarBio(e.target.checked)}
          className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:border-zinc-700 dark:accent-white"
        />
        Mostrar la bio en este bloque
      </label>
      <button type="submit" className="btn-primario h-9 w-full text-xs">
        Guardar bloque
      </button>
    </form>
  );
}

function FormTexto({ bloque }: { bloque: Bloque }) {
  const { actualizarBloque } = useEditor();
  const [titulo, setTitulo] = useState(String(bloque.config['titulo'] ?? ''));
  const [contenido, setContenido] = useState(String(bloque.config['contenido'] ?? ''));
  const [error, setError] = useState('');

  async function alGuardar(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await actualizarBloque(bloque.id, { config: { titulo: titulo.trim(), contenido } });
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <form onSubmit={alGuardar} className="space-y-3">
      {error && <p className="texto-error">{error}</p>}
      <div>
        <label htmlFor={`tit-${bloque.id}`} className="etiqueta">
          Título
        </label>
        <input
          id={`tit-${bloque.id}`}
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={80}
          className="campo h-10"
        />
      </div>
      <div>
        <label htmlFor={`con-${bloque.id}`} className="etiqueta">
          Contenido
        </label>
        <textarea
          id={`con-${bloque.id}`}
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          maxLength={5000}
          rows={5}
          className="campo h-auto resize-y py-2"
        />
      </div>
      <button type="submit" className="btn-primario h-9 w-full text-xs">
        Guardar bloque
      </button>
    </form>
  );
}

function FormEnlaces({ bloque }: { bloque: Bloque }) {
  const { actualizarBloque } = useEditor();

  const iniciales = Array.isArray(bloque.config['enlaces'])
    ? (bloque.config['enlaces'] as Array<{ etiqueta: string; url: string }>)
    : [];

  const [titulo, setTitulo] = useState(String(bloque.config['titulo'] ?? ''));
  const [enlaces, setEnlaces] = useState(iniciales.map((e) => ({ ...e })));
  const [error, setError] = useState('');

  function cambiar(indice: number, campo: 'etiqueta' | 'url', valor: string) {
    setEnlaces((lista) => lista.map((e, i) => (i === indice ? { ...e, [campo]: valor } : e)));
  }

  async function alGuardar(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await actualizarBloque(bloque.id, {
        config: {
          titulo: titulo.trim(),
          enlaces: enlaces
            .map((en) => ({ etiqueta: en.etiqueta.trim(), url: en.url.trim() }))
            .filter((en) => en.etiqueta || en.url),
        },
      });
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <form onSubmit={alGuardar} className="space-y-3">
      {error && <p className="texto-error">{error}</p>}

      <div>
        <label htmlFor={`et-${bloque.id}`} className="etiqueta">
          Título de la sección
        </label>
        <input
          id={`et-${bloque.id}`}
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={80}
          className="campo h-10"
          placeholder="Encuéntrame en"
        />
      </div>

      {enlaces.map((enlace, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <input
              type="text"
              value={enlace.etiqueta}
              onChange={(e) => cambiar(i, 'etiqueta', e.target.value)}
              maxLength={40}
              className="campo h-9 text-sm"
              placeholder="Steam"
              aria-label={`Etiqueta del enlace ${i + 1}`}
            />
            <input
              type="url"
              value={enlace.url}
              onChange={(e) => cambiar(i, 'url', e.target.value)}
              maxLength={500}
              className="campo h-9 font-mono text-xs"
              placeholder="https://steamcommunity.com/id/…"
              aria-label={`URL del enlace ${i + 1}`}
            />
          </div>
          <button
            type="button"
            onClick={() => setEnlaces((lista) => lista.filter((_, j) => j !== i))}
            className="btn-fantasma mt-1 h-8 w-8 shrink-0 px-0 text-red-500"
            aria-label={`Quitar enlace ${i + 1}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}

      {enlaces.length < 20 && (
        <button
          type="button"
          onClick={() => setEnlaces((lista) => [...lista, { etiqueta: '', url: '' }])}
          className="btn-fantasma h-9 w-full border border-dashed border-zinc-300 text-xs dark:border-zinc-700"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Añadir enlace
        </button>
      )}

      <button type="submit" className="btn-primario h-9 w-full text-xs">
        Guardar bloque
      </button>

      <p className="flex items-center gap-1 text-xs text-zinc-400">
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
        Solo se aceptan enlaces http(s).
      </p>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Formularios de los bloques de Steam (Fase 5)
// ─────────────────────────────────────────────────────────────────────

/**
 * Aviso común a los tres: si no hay Steam vinculado, el bloque no pintará
 * nada. Decirlo aquí evita el desconcierto de añadir un bloque y ver un
 * hueco sin ninguna explicación.
 */
function AvisoSinSteam() {
  const { vinculado, cargando } = useSteam();
  if (cargando || vinculado) return null;

  return (
    <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      No tienes Steam vinculado, así que este bloque no se mostrará en tu perfil. Entra con Steam
      desde el inicio de sesión para traer tus datos.
    </p>
  );
}

/** Casilla reutilizable de los formularios de Steam. */
function Casilla({
  id,
  etiqueta,
  valor,
  alCambiar,
}: {
  id: string;
  etiqueta: string;
  valor: boolean;
  alCambiar: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
      <input
        id={id}
        type="checkbox"
        checked={valor}
        onChange={(e) => alCambiar(e.target.checked)}
        className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:border-zinc-700 dark:accent-white"
      />
      {etiqueta}
    </label>
  );
}

function FormSteamActividad({ bloque }: { bloque: Bloque }) {
  const { actualizarBloque } = useEditor();
  const [titulo, setTitulo] = useState(String(bloque.config['titulo'] ?? ''));
  const [limite, setLimite] = useState(
    typeof bloque.config['limite'] === 'number' ? bloque.config['limite'] : 6
  );
  const [mostrarTotales, setMostrarTotales] = useState(
    bloque.config['mostrarHorasTotales'] !== false
  );
  const [error, setError] = useState('');

  async function alGuardar(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await actualizarBloque(bloque.id, {
        config: { titulo: titulo.trim(), limite, mostrarHorasTotales: mostrarTotales },
      });
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <form onSubmit={alGuardar} className="space-y-3">
      {error && <p className="texto-error">{error}</p>}
      <AvisoSinSteam />

      <div>
        <label htmlFor={`sa-tit-${bloque.id}`} className="etiqueta">
          Título
        </label>
        <input
          id={`sa-tit-${bloque.id}`}
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={80}
          className="campo h-10"
          placeholder="Jugando últimamente"
        />
      </div>

      <div>
        <label htmlFor={`sa-lim-${bloque.id}`} className="etiqueta">
          Cuántos juegos mostrar: {limite}
        </label>
        <input
          id={`sa-lim-${bloque.id}`}
          type="range"
          min={1}
          max={12}
          value={limite}
          onChange={(e) => setLimite(Number(e.target.value))}
          className="w-full accent-zinc-900 dark:accent-white"
        />
      </div>

      <Casilla
        id={`sa-tot-${bloque.id}`}
        etiqueta="Mostrar también las horas totales"
        valor={mostrarTotales}
        alCambiar={setMostrarTotales}
      />

      <button type="submit" className="btn-primario h-9 w-full text-xs">
        Guardar bloque
      </button>
      <BotonSincronizar />
    </form>
  );
}

function FormEstadisticas({ bloque }: { bloque: Bloque }) {
  const { actualizarBloque } = useEditor();
  const [titulo, setTitulo] = useState(String(bloque.config['titulo'] ?? ''));
  const [nivel, setNivel] = useState(bloque.config['mostrarNivel'] !== false);
  const [juegos, setJuegos] = useState(bloque.config['mostrarTotalJuegos'] !== false);
  const [horas, setHoras] = useState(bloque.config['mostrarHoras'] !== false);
  const [error, setError] = useState('');

  async function alGuardar(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await actualizarBloque(bloque.id, {
        config: {
          titulo: titulo.trim(),
          mostrarNivel: nivel,
          mostrarTotalJuegos: juegos,
          mostrarHoras: horas,
        },
      });
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <form onSubmit={alGuardar} className="space-y-3">
      {error && <p className="texto-error">{error}</p>}
      <AvisoSinSteam />

      <div>
        <label htmlFor={`es-tit-${bloque.id}`} className="etiqueta">
          Título
        </label>
        <input
          id={`es-tit-${bloque.id}`}
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={80}
          className="campo h-10"
          placeholder="En números"
        />
      </div>

      <Casilla
        id={`es-jue-${bloque.id}`}
        etiqueta="Total de juegos"
        valor={juegos}
        alCambiar={setJuegos}
      />
      <Casilla id={`es-hor-${bloque.id}`} etiqueta="Horas jugadas" valor={horas} alCambiar={setHoras} />
      <Casilla id={`es-niv-${bloque.id}`} etiqueta="Nivel de Steam" valor={nivel} alCambiar={setNivel} />

      <button type="submit" className="btn-primario h-9 w-full text-xs">
        Guardar bloque
      </button>
      <BotonSincronizar />
    </form>
  );
}

/**
 * Favoritos: se eligen de la biblioteca real, no tecleando appids.
 *
 * Pedirle a alguien el "appid" de un juego es pedirle que se vaya a Steam,
 * abra la ficha y copie un número de la URL. Con la biblioteca ya cacheada
 * en el servidor, elegir de una lista es gratis para nosotros y trivial
 * para el usuario.
 */
function FormFavoritos({ bloque }: { bloque: Bloque }) {
  const { actualizarBloque } = useEditor();
  const { datos, vinculado } = useSteam();

  const [titulo, setTitulo] = useState(String(bloque.config['titulo'] ?? ''));
  const [appids, setAppids] = useState<number[]>(
    Array.isArray(bloque.config['appids'])
      ? (bloque.config['appids'] as unknown[]).filter((a): a is number => typeof a === 'number')
      : []
  );
  const [error, setError] = useState('');

  const biblioteca = datos?.masJugados ?? [];
  const MAXIMO = 12;

  function alternar(appid: number) {
    setAppids((lista) =>
      lista.includes(appid)
        ? lista.filter((a) => a !== appid)
        : lista.length < MAXIMO
          ? [...lista, appid]
          : lista
    );
  }

  async function alGuardar(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await actualizarBloque(bloque.id, { config: { titulo: titulo.trim(), appids } });
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <form onSubmit={alGuardar} className="space-y-3">
      {error && <p className="texto-error">{error}</p>}
      <AvisoSinSteam />

      <div>
        <label htmlFor={`fa-tit-${bloque.id}`} className="etiqueta">
          Título
        </label>
        <input
          id={`fa-tit-${bloque.id}`}
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={80}
          className="campo h-10"
          placeholder="Juegos favoritos"
        />
      </div>

      {vinculado && biblioteca.length > 0 && (
        <fieldset>
          <legend className="etiqueta">
            Elige tus destacados ({appids.length}/{MAXIMO})
          </legend>
          <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 p-1.5 dark:border-zinc-800">
            {biblioteca.map((juego) => {
              const elegido = appids.includes(juego.appid);
              return (
                <li key={juego.appid}>
                  <button
                    type="button"
                    onClick={() => alternar(juego.appid)}
                    aria-pressed={elegido}
                    disabled={!elegido && appids.length >= MAXIMO}
                    className={`flex w-full items-center gap-2 rounded-md p-1.5 text-left text-xs transition-colors
                                disabled:cursor-not-allowed disabled:opacity-40 ${
                                  elegido
                                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                }`}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{juego.nombre}</span>
                    <span className="shrink-0 tabular-nums opacity-60">
                      {horasDe(juego.minutosTotales)}
                    </span>
                    {elegido && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            Ordenados por horas jugadas. Las horas se actualizan solas: aquí solo eliges cuáles
            destacar.
          </p>
        </fieldset>
      )}

      {vinculado && biblioteca.length === 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Todavía no hemos podido leer tu biblioteca. Si tu perfil de Steam es privado, sus juegos
          no son visibles ni siquiera para nosotros.
        </p>
      )}

      <button type="submit" className="btn-primario h-9 w-full text-xs">
        Guardar bloque
      </button>
      <BotonSincronizar />
    </form>
  );
}

/**
 * "Sincronizar ahora": salta el TTL y repide a Steam.
 *
 * Existe porque los TTLs son largos a propósito (6 h la biblioteca) y
 * alguien que acaba de comprar un juego quiere verlo ya. El backend lo
 * limita con `limiteExterno`, así que pulsarlo en bucle no nos quema la
 * cuota de la API.
 */
function BotonSincronizar() {
  const { vinculado } = useSteam();
  const [estado, setEstado] = useState<'listo' | 'sincronizando' | 'hecho' | 'error'>('listo');

  if (!vinculado) return null;

  async function sincronizar() {
    setEstado('sincronizando');
    try {
      await api.post('/externo/steam/sincronizar');
      setEstado('hecho');
      // Los datos se recargan al volver a montar el proveedor; recargar la
      // página es lo más simple y lo que menos sorprende.
      window.location.reload();
    } catch {
      setEstado('error');
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void sincronizar()}
        disabled={estado === 'sincronizando'}
        className="btn-fantasma h-8 w-full text-xs"
      >
        <RefreshCw
          className={`h-3.5 w-3.5 ${estado === 'sincronizando' ? 'animate-spin' : ''}`}
          aria-hidden="true"
        />
        {estado === 'sincronizando' ? 'Sincronizando…' : 'Sincronizar con Steam ahora'}
      </button>
      {estado === 'error' && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          No se pudo sincronizar. Espera un momento y vuelve a intentar.
        </p>
      )}
    </div>
  );
}
