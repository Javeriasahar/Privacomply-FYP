import React from 'react';
import ReactDOM from 'react-dom/client';
import SidePanel from './SidePanel';
import '@/globals.css';
import '@/i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SidePanel />
  </React.StrictMode>
);
