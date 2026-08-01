import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Code,
  Eye,
  EyeOff,
  ExternalLink,
  ImagePlus,
  Loader2,
  Music,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';

import { useAuth } from '../store/authStore';
import { useEditor } from '../store/editorStore';
import { api, mensajeError } from '../lib/api';
import { horasDe } from '../lib/steam';
import { archivos } from '../lib/archivos';
import {
  FUENTES_ETIQUETAS,
  idDeScope,
  temaCompleto,
  type Bloque,
  type TemaPerfil,
  type TipoBloque,
} from '../lib/perfil';
import { CssDePerfil } from '../components/CssDePerfil';
import {
  PLANTILLAS,
  PLANTILLA_PERSONALIZADA,
  PLANTILLA_POR_DEFECTO,
  type Plantilla,
} from '../lib/plantillas';
import {
  necesitaDiscord,
  necesitaSteam,
  REGISTRO_BLOQUES,
  RenderBloque,
} from '../components/bloques/registro';
import { ProveedorSteam, useSteam } from '../lib/steamContexto';
import { ProveedorDiscord, useDiscord } from '../lib/discordContexto';

/**
 * Editor de perfil (Fase 3) — el corazón de Wander.
 *
 * Dos columnas: controles a la izquierda, vista previa EN VIVO a la
 * derecha. La vista previa usa exactamente los mismos componentes que la
 * página pública, así que lo que se ve aquí es lo que verá cualquiera.
 */
export function EditorPerfilPage() {
  const { t } = useTranslation();
  const usuarioAuth = useAuth((e) => e.usuario);
  const { perfil, usuario, cargando, errorCarga, guardado, cargar } = useEditor();

  useEffect(() => {
    void cargar();
  }, [cargar]);

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

  return (
    /* La vista previa pide los datos reales de Steam del dueño: el editor
       tiene que enseñar lo que verá un visitante, no un maniquí. El propio
       usuario siempre puede leer su perfil aunque esté sin publicar. */
    <ProveedorSteam handle={usuarioAuth?.handle} activo={necesitaSteam(perfil.bloques)}>
    <ProveedorDiscord handle={usuarioAuth?.handle} activo={necesitaDiscord(perfil.bloques)}>
    <div className="contenedor-app py-8">
      {/* Cabecera: título, estado de guardado y publicación */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {t('editor.titulo')}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            <Trans
              i18nKey="editor.tuPerfilVive"
              values={{ handle: usuarioAuth?.handle }}
              components={{
                perfil: (
                  <Link to={`/u/${usuarioAuth?.handle}`} className="enlace-acento font-mono" />
                ),
              }}
            />
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
          <PanelMusica />
          <PanelCssPropio />
        </div>

        {/* ── Vista previa ── */}
        <div className="min-w-0">
          {/* La vista previa vive en una columna estrecha, así que enseña
              siempre el perfil en UNA columna. Es la vista de teléfono, y
              se dice para que nadie crea que su perfil se verá así en
              escritorio: ahí los bloques se reparten en dos columnas. El
              enlace «ver mi perfil» de arriba lleva al real. */}
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t('editor.vistaPrevia')}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t('editor.vistaPreviaTelefono')}
            </p>
          </div>
          <div
            /* El mismo id que el perfil público: es lo que hace que el CSS
               propio (prefijado con `#perfil-<id>`) también aplique aquí.
               Sin esto la vista previa mentiría justo en la fase en la que
               más falta hace que no mienta. */
            id={idDeScope(perfil.id)}
            className="perfil-raiz overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800"
          >
            <CssDePerfil perfilId={perfil.id} tema={perfil.tema} css={perfil.cssPropio} />
            {/* Sin fondo propio: lo hereda de `.perfil-raiz`, para que el
                CSS del usuario pueda cambiarlo también en la vista previa
                (un `background` en línea aquí le ganaría siempre). */}
            <div className="mx-auto max-w-2xl px-4 pb-12">
              {perfil.bloques.filter((b) => b.visible).length === 0 && (
                <p className="py-24 text-center text-sm" style={{ opacity: 0.6 }}>
                  {t('editor.sinBloques')}
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
    </ProveedorDiscord>
    </ProveedorSteam>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Indicador de guardado y publicación
// ─────────────────────────────────────────────────────────────────────

function IndicadorGuardado({ estado }: { estado: 'inactivo' | 'guardando' | 'guardado' | 'error' }) {
  const { t } = useTranslation();
  if (estado === 'inactivo') return null;
  return (
    <span
      role="status"
      className="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400"
    >
      {estado === 'guardando' && (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t('editor.guardando')}
        </>
      )}
      {estado === 'guardado' && (
        <>
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden="true" />{' '}
          {t('editor.guardado')}
        </>
      )}
      {estado === 'error' && (
        <>
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" aria-hidden="true" />{' '}
          {t('editor.errorGuardar')}
        </>
      )}
    </span>
  );
}

function BotonPublicar() {
  const { t } = useTranslation();
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
          <EyeOff className="h-4 w-4" aria-hidden="true" /> {t('editor.ocultarPerfil')}
        </>
      ) : (
        <>
          <Eye className="h-4 w-4" aria-hidden="true" /> {t('editor.publicar')}
        </>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Panel: identidad (displayName + bio, campos de User)
// ─────────────────────────────────────────────────────────────────────

/**
 * Foto de perfil: subir una propia o volver a la de la cuenta vinculada.
 *
 * El avatar inicial lo pone el servidor al entrar con Steam, Discord o
 * Google, y eso está bien como punto de partida — pero era irreversible:
 * no había forma de cambiarlo. Aquí se sube una imagen (que pasa por la
 * misma validación por magic bytes y el mismo reescalado con sharp que
 * cualquier adjunto) y se guarda su ruta.
 *
 * Se guarda AL INSTANTE, sin esperar al botón «guardar identidad»: elegir
 * un archivo ya es una confirmación explícita, y dejar la foto nueva a la
 * vista pero sin aplicar hasta pulsar otro botón es de las cosas que más
 * confunden en un formulario.
 */
function CampoAvatar() {
  const { t } = useTranslation();
  const { usuario, guardarPerfil } = useEditor();
  const setUsuarioAuth = useAuth((e) => e.setUsuario);
  const usuarioAuth = useAuth((e) => e.usuario);
  const entradaRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [errorFoto, setErrorFoto] = useState('');

  if (!usuario) return null;

  /** Aplica un avatar (o lo quita con `null`) y sincroniza la navbar. */
  async function aplicar(url: string | null) {
    await guardarPerfil({ avatarUrl: url });
    // La navbar y el menú de cuenta pintan el avatar del authStore.
    if (usuarioAuth) setUsuarioAuth({ ...usuarioAuth, avatarUrl: url });
  }

  async function alElegir(e: ChangeEvent<HTMLInputElement>) {
    const fichero = e.target.files?.[0];
    // El input se limpia siempre: si no, elegir el MISMO archivo dos veces
    // seguidas no dispara `change` y parecería que no hace nada.
    e.target.value = '';
    if (!fichero) return;

    setSubiendo(true);
    setErrorFoto('');
    try {
      const [subido] = await archivos.subir([fichero], 'avatar');
      if (subido) await aplicar(subido.url);
    } catch (err) {
      setErrorFoto(mensajeError(err));
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="mb-4">
      <span className="etiqueta">{t('editor.fotoPerfil')}</span>

      <div className="mt-1 flex items-center gap-4">
        {usuario.avatarUrl ? (
          <img
            src={usuario.avatarUrl}
            alt=""
            className="h-16 w-16 shrink-0 rounded-full border border-zinc-200 object-cover dark:border-zinc-700"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-2xl font-bold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
          >
            {usuario.displayName.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-2">
          {/* El input está oculto y lo dispara el botón de al lado, pero
              sigue siendo un control de formulario: sin `aria-label` un
              lector de pantalla que llegue a él por tabulación anuncia
              "botón examinar" sin decir de qué. Lo cazó la auditoría con
              axe de la Fase 10. */}
          <input
            ref={entradaRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => void alElegir(e)}
            className="sr-only"
            id="ed-avatar"
            aria-label={t('editor.fotoPerfil')}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => entradaRef.current?.click()}
              disabled={subiendo}
              className="btn-secundario h-9 px-4 text-sm"
            >
              {subiendo ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {t('editor.subiendoFoto')}
                </>
              ) : (
                <>
                  <ImagePlus className="h-4 w-4" aria-hidden="true" />
                  {t('editor.cambiarFoto')}
                </>
              )}
            </button>

            {usuario.avatarUrl && (
              <button
                type="button"
                onClick={() => void aplicar(null).catch((e) => setErrorFoto(mensajeError(e)))}
                disabled={subiendo}
                className="btn-fantasma h-9 px-3 text-sm"
              >
                {t('editor.quitarFoto')}
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('editor.fotoAyuda')}</p>
        </div>
      </div>

      {errorFoto && <p className="texto-error mt-2">{errorFoto}</p>}
    </div>
  );
}

function PanelIdentidad() {
  const { t } = useTranslation();
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
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
        {t('editor.identidad')}
      </h2>

      {error && <p className="texto-error mb-3">{error}</p>}

      <CampoAvatar />

      <label htmlFor="ed-nombre" className="etiqueta">
        {t('editor.nombreMostrar')}
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
        {t('editor.bio')}
      </label>
      <textarea
        id="ed-bio"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        maxLength={500}
        rows={4}
        className="campo mb-1 h-auto resize-y py-3"
        placeholder={t('editor.bioPlaceholder')}
      />
      <p className="mb-4 text-right text-xs text-zinc-500 dark:text-zinc-400">{bio.length}/500</p>

      <button type="submit" disabled={sinCambios || !nombre.trim()} className="btn-primario h-10 w-full">
        {t('editor.guardarIdentidad')}
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
  const { t } = useTranslation();
  const { perfil, aplicarPlantilla } = useEditor();
  if (!perfil) return null;

  return (
    <section className="tarjeta">
      <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-white">
        {t('editor.plantillas')}
      </h2>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">{t('editor.plantillasAyuda')}</p>

      <ul className="grid grid-cols-2 gap-2">
        {PLANTILLAS.map((plantilla) => {
          const activa = perfil.plantilla === plantilla.id;
          return (
            <li key={plantilla.id}>
              <button
                type="button"
                onClick={() => void aplicarPlantilla(plantilla.id)}
                aria-pressed={activa}
                title={t(`plantillas.${plantilla.id}Descripcion`)}
                className={`w-full overflow-hidden rounded-xl border text-left transition-colors ${
                  activa
                    ? 'border-zinc-900 dark:border-white'
                    : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600'
                }`}
              >
                <MiniaturaPlantilla plantilla={plantilla} />
                <span className="flex items-center justify-between gap-1 px-2 py-1.5">
                  <span className="truncate text-xs font-medium text-zinc-900 dark:text-white">
                    {t(`plantillas.${plantilla.id}Nombre`)}
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
          {t('editor.plantillaPersonalizada')}
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

/* Las etiquetas salen del catálogo por la misma clave: `editor.colorFondo`,
   `editor.colorTexto`… */
const CAMPOS_COLOR: Array<keyof TemaPerfil> = [
  'colorFondo',
  'colorTexto',
  'colorAcento',
  'colorTarjeta',
  'colorBorde',
];

function PanelTema() {
  const { t } = useTranslation();
  const { perfil, cambiarTema, aplicarPlantilla } = useEditor();
  if (!perfil) return null;

  const tema = temaCompleto(perfil.tema);

  function poner<K extends keyof TemaPerfil>(clave: K, valor: TemaPerfil[K]) {
    cambiarTema({ ...temaCompleto(perfil!.tema), [clave]: valor });
  }

  return (
    <section className="tarjeta">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t('editor.tema')}</h2>
        {/* Restaurar = volver a la plantilla base, no solo a sus colores:
            así el perfil deja de estar marcado como "personalizada". */}
        <button
          type="button"
          onClick={() => void aplicarPlantilla(PLANTILLA_POR_DEFECTO)}
          className="btn-fantasma h-8 px-3 text-xs"
        >
          {t('editor.restaurar')}
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        {CAMPOS_COLOR.map((clave) => {
          const etiqueta = t(`editor.${clave}`);
          return (
            <label
              key={clave}
              className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"
            >
              <input
                type="color"
                value={String(tema[clave])}
                onChange={(e) => poner(clave, e.target.value)}
                className="h-8 w-10 shrink-0 cursor-pointer rounded border border-zinc-300 bg-transparent p-0.5 dark:border-zinc-700"
                aria-label={t('editor.colorDe', { campo: etiqueta.toLowerCase() })}
              />
              {etiqueta}
            </label>
          );
        })}
      </div>

      <label htmlFor="ed-fuente" className="etiqueta">
        {t('editor.tipografia')}
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
        {t('editor.redondez', { radio: tema.radio })}
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
//  Panel: CSS propio (Fase 9)
// ─────────────────────────────────────────────────────────────────────

/**
 * Editor de CSS propio.
 *
 * A diferencia del resto del editor, esto NO se guarda con rebote al
 * teclear: el CSS a medio escribir casi siempre es CSS inválido, así que
 * un guardado automático dispararía errores de sintaxis constantes
 * mientras la persona escribe. Se guarda cuando lo pide.
 *
 * El textarea muestra `cssOriginal` (lo que escribió), no `cssPropio` (lo
 * sanitizado): ver su propio CSS reescrito y reordenado a cada guardado
 * sería desconcertante y le borraría los comentarios.
 */
function PanelCssPropio() {
  const { t } = useTranslation();
  const { perfil } = useEditor();
  if (!perfil) return null;

  const tieneCss = Boolean(perfil.cssOriginal);

  return (
    <section className="tarjeta">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-white">
        <Code className="h-4 w-4" aria-hidden="true" />
        {t('editor.cssPropio')}
      </h2>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        {tieneCss ? t('editor.cssActivo') : t('editor.cssAyuda')}
      </p>
      <Link to="/editor/css" className="btn-secundario h-10 w-full px-4 text-sm">
        {tieneCss ? t('editor.cssEditarAvanzada') : t('editor.cssAbrirAvanzada')}
      </Link>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Panel: música de fondo (Fase 11)
// ─────────────────────────────────────────────────────────────────────

function PanelMusica() {
  const { t } = useTranslation();
  const { perfil, guardarPerfil } = useEditor();
  const entradaRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');

  const [titulo, setTitulo] = useState(perfil?.audioTitulo ?? '');
  const [artista, setArtista] = useState(perfil?.audioArtista ?? '');
  const [volumen, setVolumen] = useState(perfil?.audioVolumen ?? 30);
  const [autoplay, setAutoplay] = useState(perfil?.audioAutoplay ?? true);
  const [loop, setLoop] = useState(perfil?.audioLoop ?? true);

  if (!perfil) return null;
  const tieneAudio = Boolean(perfil.audioUrl);

  async function alElegir(e: ChangeEvent<HTMLInputElement>) {
    const fichero = e.target.files?.[0];
    e.target.value = '';
    if (!fichero) return;

    setSubiendo(true);
    setError('');
    try {
      const [subido] = await archivos.subir([fichero], 'audio-perfil');
      if (subido) {
        // Se guarda junto con la ficha que haya escrita, para que subir el
        // archivo no borre el título que la persona ya puso.
        await guardarPerfil({
          audioUrl: subido.url,
          audioTitulo: titulo.trim() || null,
          audioArtista: artista.trim() || null,
          audioVolumen: volumen,
          audioAutoplay: autoplay,
          audioLoop: loop,
        });
      }
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setSubiendo(false);
    }
  }

  async function guardarAjustes(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await guardarPerfil({
        audioTitulo: titulo.trim() || null,
        audioArtista: artista.trim() || null,
        audioVolumen: volumen,
        audioAutoplay: autoplay,
        audioLoop: loop,
      });
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  async function quitar() {
    setError('');
    try {
      await guardarPerfil({ audioUrl: null });
      setTitulo('');
      setArtista('');
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <section className="tarjeta">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-white">
        <Music className="h-4 w-4" aria-hidden="true" />
        {t('editor.musica')}
      </h2>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">{t('editor.musicaAyuda')}</p>

      {error && <p className="texto-error mb-3">{error}</p>}

      {tieneAudio && (
        <audio
          src={perfil.audioUrl ?? undefined}
          controls
          preload="none"
          className="mb-3 w-full"
          aria-label={t('editor.musicaPrevia')}
        />
      )}

      <input
        ref={entradaRef}
        type="file"
        accept="audio/mpeg,audio/ogg,audio/wav,audio/mp4,audio/x-m4a"
        onChange={(e) => void alElegir(e)}
        className="sr-only"
        id="ed-audio"
        aria-label={t('editor.musicaSubir')}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => entradaRef.current?.click()}
          disabled={subiendo}
          className="btn-secundario h-10 px-4 text-sm"
        >
          {subiendo ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t('editor.musicaSubiendo')}
            </>
          ) : (
            <>
              <Music className="h-4 w-4" aria-hidden="true" />
              {tieneAudio ? t('editor.musicaCambiar') : t('editor.musicaSubir')}
            </>
          )}
        </button>

        {tieneAudio && (
          <button
            type="button"
            onClick={() => void quitar()}
            disabled={subiendo}
            className="btn-fantasma h-10 px-3 text-sm"
          >
            {t('editor.musicaQuitar')}
          </button>
        )}
      </div>

      {/*
        Aviso de derechos de autor. Va aquí, justo donde se sube, y no
        escondido en /terminos: subir música ajena es la vía directa a una
        queja de DMCA, y quien lo lee en el momento de elegir el archivo es
        quien todavía puede cambiar de idea. Ver §7 y la cláusula de
        /terminos.
      */}
      <p className="mb-4 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{t('editor.musicaDerechos')}</span>
      </p>

      {tieneAudio && (
        <form onSubmit={(e) => void guardarAjustes(e)} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="audio-titulo" className="etiqueta">
                {t('editor.musicaTitulo')}
              </label>
              <input
                id="audio-titulo"
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={80}
                className="campo h-10"
              />
            </div>
            <div>
              <label htmlFor="audio-artista" className="etiqueta">
                {t('editor.musicaArtista')}
              </label>
              <input
                id="audio-artista"
                type="text"
                value={artista}
                onChange={(e) => setArtista(e.target.value)}
                maxLength={80}
                className="campo h-10"
              />
            </div>
          </div>

          <div>
            <label htmlFor="audio-volumen" className="etiqueta">
              {t('editor.musicaVolumen', { valor: volumen })}
            </label>
            <input
              id="audio-volumen"
              type="range"
              min={0}
              max={100}
              value={volumen}
              onChange={(e) => setVolumen(Number(e.target.value))}
              className="w-full accent-zinc-900 dark:accent-white"
            />
            {/* Que el volumen es una PROPUESTA conviene decirlo: si no,
                quien lo sube al 100 espera que suene así y no entiende
                por qué a otra persona le suena bajito. */}
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {t('editor.musicaVolumenAyuda')}
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={autoplay}
              onChange={(e) => setAutoplay(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:border-zinc-700 dark:accent-white"
            />
            {t('editor.musicaAutoplay')}
          </label>
          <p className="-mt-1 ml-6 text-xs text-zinc-500 dark:text-zinc-400">
            {t('editor.musicaAutoplayAyuda')}
          </p>

          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={loop}
              onChange={(e) => setLoop(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:border-zinc-700 dark:accent-white"
            />
            {t('editor.musicaLoop')}
          </label>

          <button type="submit" className="btn-primario h-10 w-full text-sm">
            {t('editor.musicaGuardar')}
          </button>
        </form>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Panel: bloques (lista + añadir)
// ─────────────────────────────────────────────────────────────────────

function PanelBloques() {
  const { t } = useTranslation();
  const { perfil } = useEditor();
  const [abierto, setAbierto] = useState<string | null>(null);
  if (!perfil) return null;

  return (
    <section className="tarjeta">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
        {t('editor.bloques')}
      </h2>

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
  const { t } = useTranslation();
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
        <Plus className="h-4 w-4" aria-hidden="true" /> {t('editor.anadirBloque')}
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
                    {t(`bloques.${def.clave}Nombre`)}
                  </span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                    {t(`bloques.${def.clave}Descripcion`)}
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
  const { t } = useTranslation();
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
          {t(`bloques.${def.clave}Nombre`)}
        </button>

        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => void moverBloque(bloque.id, -1)}
            disabled={esPrimero}
            className="btn-fantasma h-8 w-8 px-0 disabled:opacity-30"
            aria-label={t('editor.subirBloque')}
          >
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => void moverBloque(bloque.id, 1)}
            disabled={esUltimo}
            className="btn-fantasma h-8 w-8 px-0 disabled:opacity-30"
            aria-label={t('editor.bajarBloque')}
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => void actualizarBloque(bloque.id, { visible: !bloque.visible }).catch(() => undefined)}
            className="btn-fantasma h-8 w-8 px-0"
            aria-label={bloque.visible ? t('editor.ocultarBloque') : t('editor.mostrarBloque')}
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
            aria-label={t('editor.eliminarBloque')}
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
          {bloque.tipo === 'discord-estado' && <FormDiscordEstado bloque={bloque} />}
          {bloque.tipo === 'spotify' && <FormSpotify bloque={bloque} />}
          {bloque.tipo === 'setup' && <FormSetup bloque={bloque} />}
          {bloque.tipo === 'galeria' && <FormGaleria bloque={bloque} />}
        </div>
      )}
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Formularios por tipo de bloque
// ─────────────────────────────────────────────────────────────────────

function FormHero({ bloque }: { bloque: Bloque }) {
  const { t } = useTranslation();
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
          {t('editor.frase')}
        </label>
        <input
          id={`tag-${bloque.id}`}
          type="text"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          maxLength={120}
          className="campo h-10"
          placeholder={t('editor.frasePlaceholder')}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={mostrarBio}
          onChange={(e) => setMostrarBio(e.target.checked)}
          className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:border-zinc-700 dark:accent-white"
        />
        {t('editor.mostrarBio')}
      </label>
      <button type="submit" className="btn-primario h-9 w-full text-xs">
        {t('editor.guardarBloque')}
      </button>
    </form>
  );
}

function FormTexto({ bloque }: { bloque: Bloque }) {
  const { t } = useTranslation();
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
          {t('editor.tituloCampo')}
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
          {t('editor.contenido')}
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
        {t('editor.guardarBloque')}
      </button>
    </form>
  );
}

function FormEnlaces({ bloque }: { bloque: Bloque }) {
  const { t } = useTranslation();
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
          {t('editor.tituloSeccion')}
        </label>
        <input
          id={`et-${bloque.id}`}
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={80}
          className="campo h-10"
          placeholder={t('editor.tituloSeccionPlaceholder')}
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
              aria-label={t('editor.etiquetaEnlace', { numero: i + 1 })}
            />
            <input
              type="url"
              value={enlace.url}
              onChange={(e) => cambiar(i, 'url', e.target.value)}
              maxLength={500}
              className="campo h-9 font-mono text-xs"
              placeholder="https://steamcommunity.com/id/…"
              aria-label={t('editor.urlEnlace', { numero: i + 1 })}
            />
          </div>
          <button
            type="button"
            onClick={() => setEnlaces((lista) => lista.filter((_, j) => j !== i))}
            className="btn-fantasma mt-1 h-8 w-8 shrink-0 px-0 text-red-500"
            aria-label={t('editor.quitarEnlace', { numero: i + 1 })}
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
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t('editor.anadirEnlace')}
        </button>
      )}

      <button type="submit" className="btn-primario h-9 w-full text-xs">
        {t('editor.guardarBloque')}
      </button>

      <p className="flex items-center gap-1 text-xs text-zinc-400">
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
        {t('editor.soloHttp')}
      </p>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Formularios de los bloques manuales (Fase 10)
// ─────────────────────────────────────────────────────────────────────

/** Sugerencias de componente para el setup. Son solo `placeholder`: el
 *  campo es libre a propósito (ver el schema), así que esto orienta sin
 *  limitar a quien quiera listar su silla o su micrófono. */
const EJEMPLOS_SETUP: Array<[string, string]> = [
  ['CPU', 'Ryzen 9 7900X'],
  ['GPU', 'RX 7900 XTX'],
  ['RAM', '64 GB DDR5'],
  ['Monitor', '27" 1440p 165 Hz'],
];

function FormSetup({ bloque }: { bloque: Bloque }) {
  const { t } = useTranslation();
  const { actualizarBloque } = useEditor();

  const iniciales = Array.isArray(bloque.config['piezas'])
    ? (bloque.config['piezas'] as Array<{ etiqueta: string; valor: string }>)
    : [];

  const [titulo, setTitulo] = useState(String(bloque.config['titulo'] ?? ''));
  const [piezas, setPiezas] = useState(iniciales.map((p) => ({ ...p })));
  const [error, setError] = useState('');

  function cambiar(indice: number, campo: 'etiqueta' | 'valor', valor: string) {
    setPiezas((lista) => lista.map((p, i) => (i === indice ? { ...p, [campo]: valor } : p)));
  }

  async function alGuardar(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await actualizarBloque(bloque.id, {
        config: {
          titulo: titulo.trim(),
          // Las filas a medio escribir se descartan: el schema exige que
          // ambos campos tengan contenido, así que mandarlas sería un
          // error de validación por una fila que el usuario dejó vacía sin
          // querer. Filtrar aquí es más amable que explicárselo.
          piezas: piezas
            .map((p) => ({ etiqueta: p.etiqueta.trim(), valor: p.valor.trim() }))
            .filter((p) => p.etiqueta && p.valor),
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
        <label htmlFor={`set-${bloque.id}`} className="etiqueta">
          {t('editor.tituloSeccion')}
        </label>
        <input
          id={`set-${bloque.id}`}
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={80}
          className="campo h-10"
          placeholder={t('editor.setupTituloPlaceholder')}
        />
      </div>

      {piezas.map((pieza, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <input
              type="text"
              value={pieza.etiqueta}
              onChange={(e) => cambiar(i, 'etiqueta', e.target.value)}
              maxLength={40}
              className="campo h-9 text-sm"
              placeholder={EJEMPLOS_SETUP[i % EJEMPLOS_SETUP.length]?.[0]}
              aria-label={t('editor.componentePieza', { numero: i + 1 })}
            />
            <input
              type="text"
              value={pieza.valor}
              onChange={(e) => cambiar(i, 'valor', e.target.value)}
              maxLength={80}
              className="campo h-9 text-sm"
              placeholder={EJEMPLOS_SETUP[i % EJEMPLOS_SETUP.length]?.[1]}
              aria-label={t('editor.modeloPieza', { numero: i + 1 })}
            />
          </div>
          <button
            type="button"
            onClick={() => setPiezas((lista) => lista.filter((_, j) => j !== i))}
            className="btn-fantasma mt-1 h-8 w-8 shrink-0 px-0 text-red-500"
            aria-label={t('editor.quitarPieza', { numero: i + 1 })}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}

      {piezas.length < 20 && (
        <button
          type="button"
          onClick={() => setPiezas((lista) => [...lista, { etiqueta: '', valor: '' }])}
          className="btn-fantasma h-9 w-full border border-dashed border-zinc-300 text-xs dark:border-zinc-700"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t('editor.anadirPieza')}
        </button>
      )}

      <button type="submit" className="btn-primario h-9 w-full text-xs">
        {t('editor.guardarBloque')}
      </button>
    </form>
  );
}

/** Tope de imágenes de la galería. Espeja el `.max(12)` del schema. */
const MAX_GALERIA = 12;

function FormGaleria({ bloque }: { bloque: Bloque }) {
  const { t } = useTranslation();
  const { actualizarBloque } = useEditor();
  const entradaRef = useRef<HTMLInputElement>(null);

  const iniciales = Array.isArray(bloque.config['imagenes'])
    ? (bloque.config['imagenes'] as Array<{ url: string; alt: string }>)
    : [];

  const [titulo, setTitulo] = useState(String(bloque.config['titulo'] ?? ''));
  const [columnas, setColumnas] = useState(Number(bloque.config['columnas'] ?? 3));
  const [imagenes, setImagenes] = useState(iniciales.map((im) => ({ ...im })));
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');

  /**
   * Guarda una lista concreta en vez de leer el estado.
   *
   * Es lo que permite que subir una imagen la persista sola, sin que haya
   * que acordarse de pulsar "guardar": tras subir, el estado de React
   * todavía no se ha actualizado, así que pasarle la lista ya calculada es
   * la única forma de guardar lo correcto en el mismo gesto.
   */
  async function guardar(lista: Array<{ url: string; alt: string }>, cols = columnas) {
    await actualizarBloque(bloque.id, {
      config: {
        titulo: titulo.trim(),
        columnas: cols,
        imagenes: lista.map((im) => ({ url: im.url, alt: im.alt.trim() })),
      },
    });
  }

  async function alElegir(e: ChangeEvent<HTMLInputElement>) {
    const ficheros = Array.from(e.target.files ?? []);
    // Igual que en el avatar: sin limpiar el input, elegir el mismo archivo
    // dos veces seguidas no vuelve a disparar `change`.
    e.target.value = '';
    if (ficheros.length === 0) return;

    const hueco = MAX_GALERIA - imagenes.length;
    if (hueco <= 0) return;

    setSubiendo(true);
    setError('');
    try {
      const subidos = await archivos.subir(ficheros.slice(0, hueco), 'galeria');
      const lista = [...imagenes, ...subidos.map((s) => ({ url: s.url, alt: '' }))];
      setImagenes(lista);
      await guardar(lista);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setSubiendo(false);
    }
  }

  async function alGuardar(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await guardar(imagenes);
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <form onSubmit={alGuardar} className="space-y-3">
      {error && <p className="texto-error">{error}</p>}

      <div>
        <label htmlFor={`gal-${bloque.id}`} className="etiqueta">
          {t('editor.tituloSeccion')}
        </label>
        <input
          id={`gal-${bloque.id}`}
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={80}
          className="campo h-10"
          placeholder={t('editor.galeriaTituloPlaceholder')}
        />
      </div>

      {imagenes.length > 0 && (
        <ul className="space-y-2">
          {imagenes.map((imagen, i) => (
            <li key={`${imagen.url}-${i}`} className="flex items-start gap-2">
              <img
                src={imagen.url}
                alt=""
                className="h-14 w-14 shrink-0 rounded-md border border-zinc-200 object-cover dark:border-zinc-700"
              />
              <div className="min-w-0 flex-1">
                {/* El texto alternativo se edita aquí y no en un diálogo
                    aparte para que se vea que existe: escondido, nadie lo
                    rellena y la galería queda muda para un lector de
                    pantalla. */}
                <input
                  type="text"
                  value={imagen.alt}
                  onChange={(e) =>
                    setImagenes((lista) =>
                      lista.map((im, j) => (j === i ? { ...im, alt: e.target.value } : im))
                    )
                  }
                  maxLength={200}
                  className="campo h-9 text-sm"
                  placeholder={t('editor.altPlaceholder')}
                  aria-label={t('editor.altImagen', { numero: i + 1 })}
                />
              </div>
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  onClick={() => {
                    const lista = imagenes.filter((_, j) => j !== i);
                    setImagenes(lista);
                    void guardar(lista).catch((err) => setError(mensajeError(err)));
                  }}
                  className="btn-fantasma h-8 w-8 px-0 text-red-500"
                  aria-label={t('editor.quitarImagen', { numero: i + 1 })}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Oculto y disparado por el botón de abajo; `aria-label` por el
          mismo motivo que el del avatar. */}
      <input
        ref={entradaRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        multiple
        onChange={(e) => void alElegir(e)}
        className="sr-only"
        id={`gal-file-${bloque.id}`}
        aria-label={t('editor.anadirImagenes')}
      />

      {imagenes.length < MAX_GALERIA && (
        <button
          type="button"
          onClick={() => entradaRef.current?.click()}
          disabled={subiendo}
          className="btn-fantasma h-9 w-full border border-dashed border-zinc-300 text-xs dark:border-zinc-700"
        >
          {subiendo ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              {t('editor.subiendoFoto')}
            </>
          ) : (
            <>
              <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
              {t('editor.anadirImagenes')}
            </>
          )}
        </button>
      )}

      <div>
        <label htmlFor={`cols-${bloque.id}`} className="etiqueta">
          {t('editor.columnas')}
        </label>
        <select
          id={`cols-${bloque.id}`}
          value={columnas}
          onChange={(e) => setColumnas(Number(e.target.value))}
          className="campo h-9 text-sm"
        >
          {[2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t('editor.columnasAyuda')}</p>
      </div>

      <button type="submit" className="btn-primario h-9 w-full text-xs">
        {t('editor.guardarBloque')}
      </button>

      <p className="text-xs text-zinc-400">
        {t('editor.galeriaTope', { max: MAX_GALERIA })}
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

  // Desde la Fase 6 se vincula con la sesión abierta, así que ya no hay que
  // cerrar sesión y volver a entrar por Steam: se manda a /configuracion.
  return (
    <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <Trans
        i18nKey="editor.sinSteam"
        components={{ config: <Link to="/configuracion" className="font-semibold underline" /> }}
      />
    </p>
  );
}

/** Equivalente para los bloques de Discord. Distingue los dos motivos por
 *  los que un bloque puede quedarse vacío, porque se arreglan de forma
 *  distinta: vincular la cuenta, o unirse al servidor de Lanyard. */
function AvisoSinDiscord() {
  const { vinculado, cargando, datos } = useDiscord();
  if (cargando) return null;

  if (!vinculado) {
    return (
      <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        <Trans
          i18nKey="editor.sinDiscord"
          components={{ config: <Link to="/configuracion" className="font-semibold underline" /> }}
        />
      </p>
    );
  }

  // Vinculado pero sin permiso de presencia: el dato ni se pide.
  if (!datos?.presencia) {
    return (
      <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        <Trans
          i18nKey="editor.sinPresencia"
          components={{ config: <Link to="/configuracion" className="font-semibold underline" /> }}
        />
      </p>
    );
  }

  // Vinculado y con permiso, pero Lanyard no lo ve.
  if (!datos.presencia.monitorizado) {
    return (
      <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        <Trans
          i18nKey="editor.sinLanyard"
          components={{
            lanyard: (
              <a
                href="https://discord.gg/UrXF2cfJ7F"
                target="_blank"
                rel="noreferrer noopener"
                className="font-semibold underline"
              />
            ),
          }}
        />
      </p>
    );
  }

  return null;
}

function FormDiscordEstado({ bloque }: { bloque: Bloque }) {
  const { t } = useTranslation();
  const { actualizarBloque } = useEditor();
  const [titulo, setTitulo] = useState(String(bloque.config['titulo'] ?? ''));
  const [actividad, setActividad] = useState(bloque.config['mostrarActividad'] !== false);
  const [avatar, setAvatar] = useState(bloque.config['mostrarAvatar'] !== false);
  const [error, setError] = useState('');

  async function alGuardar(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await actualizarBloque(bloque.id, {
        config: { titulo: titulo.trim(), mostrarActividad: actividad, mostrarAvatar: avatar },
      });
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <form onSubmit={alGuardar} className="space-y-3">
      {error && <p className="texto-error">{error}</p>}
      <AvisoSinDiscord />

      <div>
        <label htmlFor={`dc-tit-${bloque.id}`} className="etiqueta">
          {t('editor.tituloCampo')}
        </label>
        <input
          id={`dc-tit-${bloque.id}`}
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={80}
          className="campo h-10"
          placeholder={t('bloques.tituloDiscord')}
        />
      </div>

      <Casilla
        id={`dc-avt-${bloque.id}`}
        etiqueta={t('editor.mostrarAvatarDiscord')}
        valor={avatar}
        alCambiar={setAvatar}
      />
      <Casilla
        id={`dc-act-${bloque.id}`}
        etiqueta={t('editor.mostrarActividadDiscord')}
        valor={actividad}
        alCambiar={setActividad}
      />

      <button type="submit" className="btn-primario h-9 w-full text-xs">
        {t('editor.guardarBloque')}
      </button>
    </form>
  );
}

function FormSpotify({ bloque }: { bloque: Bloque }) {
  const { t } = useTranslation();
  const { actualizarBloque } = useEditor();
  const [titulo, setTitulo] = useState(String(bloque.config['titulo'] ?? ''));
  const [progreso, setProgreso] = useState(bloque.config['mostrarProgreso'] !== false);
  const [error, setError] = useState('');

  async function alGuardar(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await actualizarBloque(bloque.id, {
        config: { titulo: titulo.trim(), mostrarProgreso: progreso },
      });
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <form onSubmit={alGuardar} className="space-y-3">
      {error && <p className="texto-error">{error}</p>}
      <AvisoSinDiscord />

      <p className="rounded-lg bg-zinc-100 p-2.5 text-xs text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400">
        {t('editor.spotifySeOculta')}
      </p>

      <div>
        <label htmlFor={`sp-tit-${bloque.id}`} className="etiqueta">
          {t('editor.tituloCampo')}
        </label>
        <input
          id={`sp-tit-${bloque.id}`}
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={80}
          className="campo h-10"
          placeholder={t('bloques.tituloSonandoAhora')}
        />
      </div>

      <Casilla
        id={`sp-pro-${bloque.id}`}
        etiqueta={t('editor.mostrarProgreso')}
        valor={progreso}
        alCambiar={setProgreso}
      />

      <button type="submit" className="btn-primario h-9 w-full text-xs">
        {t('editor.guardarBloque')}
      </button>
    </form>
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
  const { t } = useTranslation();
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
          {t('editor.tituloCampo')}
        </label>
        <input
          id={`sa-tit-${bloque.id}`}
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={80}
          className="campo h-10"
          placeholder={t('bloques.tituloJugandoUltimamente')}
        />
      </div>

      <div>
        <label htmlFor={`sa-lim-${bloque.id}`} className="etiqueta">
          {t('editor.cuantosJuegos', { limite })}
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
        etiqueta={t('editor.horasTotales')}
        valor={mostrarTotales}
        alCambiar={setMostrarTotales}
      />

      <button type="submit" className="btn-primario h-9 w-full text-xs">
        {t('editor.guardarBloque')}
      </button>
      <BotonSincronizar />
    </form>
  );
}

function FormEstadisticas({ bloque }: { bloque: Bloque }) {
  const { t } = useTranslation();
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
          {t('editor.tituloCampo')}
        </label>
        <input
          id={`es-tit-${bloque.id}`}
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={80}
          className="campo h-10"
          placeholder={t('bloques.tituloEnNumeros')}
        />
      </div>

      <Casilla
        id={`es-jue-${bloque.id}`}
        etiqueta={t('editor.totalJuegos')}
        valor={juegos}
        alCambiar={setJuegos}
      />
      <Casilla id={`es-hor-${bloque.id}`} etiqueta={t('editor.horasJugadas')} valor={horas} alCambiar={setHoras} />
      <Casilla id={`es-niv-${bloque.id}`} etiqueta={t('editor.nivelSteam')} valor={nivel} alCambiar={setNivel} />

      <button type="submit" className="btn-primario h-9 w-full text-xs">
        {t('editor.guardarBloque')}
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
  const { t } = useTranslation();
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
          {t('editor.tituloCampo')}
        </label>
        <input
          id={`fa-tit-${bloque.id}`}
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={80}
          className="campo h-10"
          placeholder={t('bloques.tituloFavoritos')}
        />
      </div>

      {vinculado && biblioteca.length > 0 && (
        <fieldset>
          <legend className="etiqueta">
            {t('editor.elegirDestacados', { elegidos: appids.length, maximo: MAXIMO })}
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
            {t('editor.ordenadosPorHoras')}
          </p>
        </fieldset>
      )}

      {vinculado && biblioteca.length === 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {t('editor.sinBiblioteca')}
        </p>
      )}

      <button type="submit" className="btn-primario h-9 w-full text-xs">
        {t('editor.guardarBloque')}
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
  const { t } = useTranslation();
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
        {estado === 'sincronizando' ? t('editor.sincronizando') : t('editor.sincronizar')}
      </button>
      {estado === 'error' && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          {t('editor.errorSincronizar')}
        </p>
      )}
    </div>
  );
}
