import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App';
// Antes que App: `init()` es síncrono y deja i18next listo para el primer
// render, así que ningún componente llega a pintarse sin traducciones.
import './i18n';
import './styles/global.css';

const contenedor = document.getElementById('root');
if (!contenedor) {
  throw new Error('No se encontró #root en el documento.');
}

createRoot(contenedor).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
