import { create } from 'zustand';
import { api } from '../lib/api';

export interface Usuario {
  id: string;
  handle: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  rol: string;
  emailVerified: boolean;
}

interface EstadoAuth {
  usuario: Usuario | null;
  /** true hasta que se resuelve la primera comprobación de sesión. Evita
   *  el parpadeo de "no estás logueado" al recargar la página. */
  cargando: boolean;

  comprobarSesion: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  registro: (datos: {
    email: string;
    password: string;
    handle: string;
    displayName: string;
    aceptaTerminos: true;
  }) => Promise<void>;
  logout: () => Promise<void>;
  setUsuario: (usuario: Usuario | null) => void;
}

/**
 * Estado de autenticación.
 *
 * Nota importante: NO se persiste nada en localStorage. La sesión vive
 * exclusivamente en las cookies httpOnly que pone el backend; este store
 * solo guarda una copia en memoria de los datos del usuario para pintar la
 * interfaz. Al recargar, `comprobarSesion` los vuelve a pedir.
 */
export const useAuth = create<EstadoAuth>((set) => ({
  usuario: null,
  cargando: true,

  async comprobarSesion() {
    try {
      const { data } = await api.get<{ usuario: Usuario | null }>('/auth/yo');
      set({ usuario: data.usuario, cargando: false });
    } catch {
      set({ usuario: null, cargando: false });
    }
  },

  async login(email, password) {
    const { data } = await api.post<{ usuario: Usuario }>('/auth/login', { email, password });
    set({ usuario: data.usuario, cargando: false });
  },

  async registro(datos) {
    const { data } = await api.post<{ usuario: Usuario }>('/auth/registro', datos);
    set({ usuario: data.usuario, cargando: false });
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      // Aunque falle la llamada, se limpia el estado local: el usuario
      // pidió salir y la interfaz debe reflejarlo.
      set({ usuario: null });
    }
  },

  setUsuario(usuario) {
    set({ usuario });
  },
}));
