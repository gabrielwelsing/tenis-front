import React from 'react';
import ReactDOM from 'react-dom/client';
import Root from './App';
import { iniciarPwa } from '@services/pwaService';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);

iniciarPwa();
