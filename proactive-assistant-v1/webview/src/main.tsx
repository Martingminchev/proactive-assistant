import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/main.css';

// Diagnostic logging
console.log('=== WEBVIEW MAIN.TSX START ===');
console.log('acquireVsCodeApi exists:', typeof acquireVsCodeApi === 'function');
console.log('Document readyState:', document.readyState);
console.log('Root element:', document.getElementById('root'));

// Error handling
window.onerror = (msg, url, line, col, error) => {
  console.error('=== GLOBAL ERROR ===');
  console.error('Message:', msg);
  console.error('URL:', url);
  console.error('Line:', line, 'Column:', col);
  console.error('Error:', error);
  return false;
};

window.onunhandledrejection = (event) => {
  console.error('=== UNHANDLED REJECTION ===');
  console.error('Reason:', event.reason);
};

try {
  const root = document.getElementById('root');
  if (!root) {
    console.error('CRITICAL: Root element not found!');
  } else {
    console.log('Mounting React app...');
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log('React app mounted successfully');
  }
} catch (error) {
  console.error('CRITICAL: Failed to mount React app:', error);
}
