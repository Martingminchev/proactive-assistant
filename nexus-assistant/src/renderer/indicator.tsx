// =============================================================================
// NEXUS - Drawer/Indicator Entry Point
// React application for the edge indicator and slide-out drawer
// =============================================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Drawer } from './components/Drawer';
import './styles/globals.css';

// Additional styles specific to the indicator window
const style = document.createElement('style');
style.textContent = `
  html, body, #root {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  
  #root {
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Drawer />
  </React.StrictMode>
);
