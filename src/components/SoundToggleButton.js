import React from 'react';
import './SoundToggleButton.css';

const SoundToggleButton = ({ enabled, onToggle }) => {
  return (
    <button 
      className={`sound-toggle-button ${enabled ? 'enabled' : 'disabled'}`}
      onClick={onToggle}
      aria-label={enabled ? 'Desactivar sonido' : 'Activar sonido'}
    >
      {enabled ? '🔊' : '🔇'}
    </button>
  );
};

export default SoundToggleButton; 