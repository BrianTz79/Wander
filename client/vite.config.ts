import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  build: {
    // `esnext` no: los navegadores de la gente no siempre son los últimos.
    target: 'es2022',
    sourcemap: false,
    // Separar las dependencias grandes ayuda al cacheo: cambiar código de
    // la app no invalida el chunk de React.
    //
    // Vite 8 usa Rolldown, que ya no acepta el `manualChunks` en forma de
    // objeto de Rollup: la opción se ignoraba con un warning y no se
    // separaba nada. El equivalente actual es `codeSplitting.groups`.
    rollupOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
            },
          ],
        },
      },
    },
  },

  server: {
    port: 5173,
    // En desarrollo, /api y /socket.io van al backend local para que las
    // cookies de sesión funcionen sin líos de CORS ni de SameSite.
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true,
      },
      '/uploads': 'http://localhost:4000',
    },
  },
});
