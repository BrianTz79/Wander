import { create } from 'zustand';
import { api } from '../lib/api';
import type { Bloque, PerfilPropio, TemaPerfil, TipoBloque, UsuarioPerfil } from '../lib/perfil';
import { buscarPlantilla, PLANTILLA_PERSONALIZADA } from '../lib/plantillas';

/**
 * Estado del editor de perfil.
 *
 * Patrón: cada mutación llama a la API y sincroniza el estado con la
 * respuesta del servidor (que es quien valida). La única excepción es el
 * tema: se aplica al instante en local para que la vista previa responda
 * al teclear, y el PATCH sale con un rebote de 600 ms para no disparar
 * una petición por cada movimiento del selector de color.
 */

type EstadoGuardado = 'inactivo' | 'guardando' | 'guardado' | 'error';

interface RespuestaMia {
  perfil: PerfilPropio;
  usuario: UsuarioPerfil;
  /** Qué le quitó el sanitizador al CSS (Fase 9). */
  avisosCss?: string[];
}

interface EstadoEditor {
  perfil: PerfilPropio | null;
  usuario: UsuarioPerfil | null;
  cargando: boolean;
  errorCarga: string | null;
  guardado: EstadoGuardado;

  cargar: () => Promise<void>;
  cambiarTema: (tema: TemaPerfil) => void;
  aplicarPlantilla: (id: string) => Promise<void>;
  guardarPerfil: (datos: {
    publicado?: boolean;
    displayName?: string;
    bio?: string;
    /** Ruta de `/uploads/…` de una foto propia, o `null` para quitarla. */
    avatarUrl?: string | null;
    // ── Música de fondo (Fase 11) ──
    /** Ruta de `/uploads/…` de un audio propio, o `null` para quitarla. */
    audioUrl?: string | null;
    audioTitulo?: string | null;
    audioArtista?: string | null;
    audioVolumen?: number;
    audioAutoplay?: boolean;
    audioLoop?: boolean;
  }) => Promise<void>;
  /**
   * Guarda el CSS propio. Devuelve los avisos del sanitizador para que el
   * panel pueda enseñarlos, y lanza con el mensaje del servidor si el CSS
   * se rechazó entero (error de sintaxis o pasado de tamaño).
   */
  guardarCss: (css: string) => Promise<string[]>;
  crearBloque: (tipo: TipoBloque, configInicial: Record<string, unknown>) => Promise<void>;
  actualizarBloque: (
    id: string,
    datos: { config?: Record<string, unknown>; visible?: boolean }
  ) => Promise<void>;
  borrarBloque: (id: string) => Promise<void>;
  moverBloque: (id: string, direccion: -1 | 1) => Promise<void>;
}

let temporizadorTema: ReturnType<typeof setTimeout> | null = null;

/** Marca "guardado" y lo desvanece solo después de un momento. */
function marcarGuardado(set: (p: Partial<EstadoEditor>) => void) {
  set({ guardado: 'guardado' });
  setTimeout(() => set({ guardado: 'inactivo' }), 1600);
}

export const useEditor = create<EstadoEditor>((set, get) => ({
  perfil: null,
  usuario: null,
  cargando: true,
  errorCarga: null,
  guardado: 'inactivo',

  async cargar() {
    set({ cargando: true, errorCarga: null });
    try {
      const { data } = await api.get<RespuestaMia>('/perfiles/mio');
      set({ perfil: data.perfil, usuario: data.usuario, cargando: false });
    } catch {
      set({ cargando: false, errorCarga: 'No se pudo cargar tu perfil. Recarga la página.' });
    }
  },

  cambiarTema(tema) {
    const { perfil } = get();
    if (!perfil) return;

    // Vista previa inmediata. `plantilla` pasa a "personalizada" ya en
    // local (es lo que hará el servidor) para que el selector deje de
    // señalar el preset en el mismo momento en que se toca un color, no
    // 600 ms después.
    set({
      perfil: { ...perfil, tema, plantilla: PLANTILLA_PERSONALIZADA },
      guardado: 'guardando',
    });

    // …y guardado con rebote.
    if (temporizadorTema) clearTimeout(temporizadorTema);
    temporizadorTema = setTimeout(() => {
      api
        .patch<RespuestaMia>('/perfiles/mio', { tema })
        .then(({ data }) => {
          // Solo se sincronizan tema y plantilla: pisar los bloques con una
          // respuesta vieja desharía una edición hecha durante el rebote.
          const actual = get().perfil;
          if (actual) {
            set({
              perfil: { ...actual, tema: data.perfil.tema, plantilla: data.perfil.plantilla },
            });
          }
          marcarGuardado(set);
        })
        .catch(() => set({ guardado: 'error' }));
    }, 600);
  },

  async aplicarPlantilla(id) {
    const { perfil } = get();
    if (!perfil) return;

    // Cancela el PATCH de tema pendiente: si saliera después del de la
    // plantilla, un ajuste de color de hace medio segundo desharía el
    // preset recién aplicado.
    if (temporizadorTema) {
      clearTimeout(temporizadorTema);
      temporizadorTema = null;
    }

    const preset = buscarPlantilla(id);
    // Vista previa inmediata con el tema local; la respuesta manda.
    if (preset) set({ perfil: { ...perfil, tema: preset.tema, plantilla: id } });
    set({ guardado: 'guardando' });

    try {
      const { data } = await api.patch<RespuestaMia>('/perfiles/mio', { plantilla: id });
      const actual = get().perfil;
      if (actual) {
        set({
          perfil: { ...actual, tema: data.perfil.tema, plantilla: data.perfil.plantilla },
        });
      }
      marcarGuardado(set);
    } catch {
      // Se restaura el tema real: la vista previa optimista ya cambió.
      set({ guardado: 'error' });
      void get().cargar();
    }
  },

  async guardarPerfil(datos) {
    set({ guardado: 'guardando' });
    try {
      const { data } = await api.patch<RespuestaMia>('/perfiles/mio', datos);
      set({ perfil: data.perfil, usuario: data.usuario });
      marcarGuardado(set);
    } catch {
      set({ guardado: 'error' });
      throw new Error('No se pudo guardar.');
    }
  },

  async guardarCss(css) {
    set({ guardado: 'guardando' });
    try {
      // Cadena vacía → `null`: es "bórralo", no "guarda un CSS vacío".
      const { data } = await api.patch<RespuestaMia>('/perfiles/mio', {
        cssPropio: css.trim() ? css : null,
      });
      // Se sincroniza el perfil entero: el servidor devuelve el CSS ya
      // sanitizado, que es lo que tiene que ver la vista previa.
      set({ perfil: data.perfil, usuario: data.usuario });
      marcarGuardado(set);
      return data.avisosCss ?? [];
    } catch (error) {
      set({ guardado: 'error' });
      // Se propaga el mensaje real del servidor ("error de sintaxis en la
      // línea 4"), que es justo lo que la persona necesita leer.
      throw error;
    }
  },

  async crearBloque(tipo, configInicial) {
    const { perfil } = get();
    if (!perfil) return;
    set({ guardado: 'guardando' });
    try {
      const { data } = await api.post<{ bloque: Bloque }>('/perfiles/mio/bloques', {
        tipo,
        config: configInicial,
      });
      set({ perfil: { ...perfil, bloques: [...perfil.bloques, data.bloque] } });
      marcarGuardado(set);
    } catch {
      set({ guardado: 'error' });
    }
  },

  async actualizarBloque(id, datos) {
    const { perfil } = get();
    if (!perfil) return;
    set({ guardado: 'guardando' });
    try {
      const { data } = await api.patch<{ bloque: Bloque }>(`/perfiles/mio/bloques/${id}`, datos);
      set({
        perfil: {
          ...perfil,
          bloques: perfil.bloques.map((b) => (b.id === id ? data.bloque : b)),
        },
      });
      marcarGuardado(set);
    } catch {
      set({ guardado: 'error' });
      throw new Error('No se pudo guardar el bloque.');
    }
  },

  async borrarBloque(id) {
    const { perfil } = get();
    if (!perfil) return;
    set({ guardado: 'guardando' });
    try {
      await api.delete(`/perfiles/mio/bloques/${id}`);
      set({ perfil: { ...perfil, bloques: perfil.bloques.filter((b) => b.id !== id) } });
      marcarGuardado(set);
    } catch {
      set({ guardado: 'error' });
    }
  },

  async moverBloque(id, direccion) {
    const { perfil } = get();
    if (!perfil) return;

    const indice = perfil.bloques.findIndex((b) => b.id === id);
    const destino = indice + direccion;
    if (indice < 0 || destino < 0 || destino >= perfil.bloques.length) return;

    // Intercambio optimista para que la interfaz responda al momento.
    const nuevos = [...perfil.bloques];
    const [movido] = nuevos.splice(indice, 1);
    nuevos.splice(destino, 0, movido!);
    set({ perfil: { ...perfil, bloques: nuevos }, guardado: 'guardando' });

    try {
      const { data } = await api.put<{ bloques: Bloque[] }>('/perfiles/mio/bloques/orden', {
        orden: nuevos.map((b) => b.id),
      });
      const actual = get().perfil;
      if (actual) set({ perfil: { ...actual, bloques: data.bloques } });
      marcarGuardado(set);
    } catch {
      // Si el servidor lo rechazó, se restaura el orden real.
      set({ guardado: 'error' });
      void get().cargar();
    }
  },
}));
