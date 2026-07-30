import { create } from 'zustand';
import { api } from '../lib/api';
import type { Bloque, PerfilPropio, TemaPerfil, TipoBloque, UsuarioPerfil } from '../lib/perfil';

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
}

interface EstadoEditor {
  perfil: PerfilPropio | null;
  usuario: UsuarioPerfil | null;
  cargando: boolean;
  errorCarga: string | null;
  guardado: EstadoGuardado;

  cargar: () => Promise<void>;
  cambiarTema: (tema: TemaPerfil) => void;
  guardarPerfil: (datos: {
    publicado?: boolean;
    displayName?: string;
    bio?: string;
  }) => Promise<void>;
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

    // Vista previa inmediata…
    set({ perfil: { ...perfil, tema }, guardado: 'guardando' });

    // …y guardado con rebote.
    if (temporizadorTema) clearTimeout(temporizadorTema);
    temporizadorTema = setTimeout(() => {
      api
        .patch<RespuestaMia>('/perfiles/mio', { tema })
        .then(({ data }) => {
          // Solo se sincroniza el tema: pisar los bloques con una respuesta
          // vieja desharía una edición hecha durante el rebote.
          const actual = get().perfil;
          if (actual) set({ perfil: { ...actual, tema: data.perfil.tema } });
          marcarGuardado(set);
        })
        .catch(() => set({ guardado: 'error' }));
    }, 600);
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
