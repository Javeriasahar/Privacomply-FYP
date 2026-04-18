import React from 'react';
import ReactDOM from 'react-dom/client';
import Popup from './Popup';
import '@/globals.css';
import '@/i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
