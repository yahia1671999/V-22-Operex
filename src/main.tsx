import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Fix for ResizeObserver loop and WebSocket errors in preview environment
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    const msg = e.message || '';
    if (
      msg.includes('ResizeObserver') ||
      msg.includes('WebSocket') ||
      msg.includes('failed to connect to websocket')
    ) {
      e.stopImmediatePropagation();
      e.preventDefault();
      const overlay = document.getElementById('vite-error-overlay');
      if (overlay) overlay.remove();
    }
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reasonStr = String(e.reason?.message || e.reason || '');
    if (
      reasonStr.includes('ResizeObserver') ||
      reasonStr.includes('WebSocket') ||
      reasonStr.includes('failed to connect to websocket')
    ) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
