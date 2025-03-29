import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Desactivar el preventDefault automático en dispositivos táctiles
// Esto es necesario para que funcionen correctamente los eventos táctiles en iOS
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log("Initializing iOS touch support");
    
    // Prevenir que el navegador bloquee los eventos táctiles
    const preventDefaultOverride = (e) => {
      // Solo evitar el comportamiento por defecto si es un scroll en la escena 3D
      const canvasElement = document.querySelector('canvas');
      if (canvasElement && e.target === canvasElement) {
        e.preventDefault();
      }
    };
    
    // Añadir listeners al canvas cuando esté disponible
    setTimeout(() => {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        console.log("Canvas found, adding touch handlers");
        canvas.style.touchAction = 'none'; // Desactivar acciones táctiles predeterminadas
        canvas.addEventListener('touchstart', preventDefaultOverride, { passive: false });
        canvas.addEventListener('touchmove', preventDefaultOverride, { passive: false });
        canvas.addEventListener('touchend', preventDefaultOverride, { passive: false });
      } else {
        console.warn("Canvas not found for touch initialization");
      }
    }, 1000); // Dar tiempo para que se monte el canvas
  });
} 