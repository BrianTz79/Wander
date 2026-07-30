import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App';
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
