import React, { useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Cube from './components/Cube';
import VictoryMessage from './components/VictoryMessage';
import SoundToggleButton from './components/SoundToggleButton';
import './App.css';

function App() {
  // Estados compartidos
  const [puzzleCompleted, setPuzzleCompleted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Manejadores de eventos compartidos
  const handleRestart = useCallback(() => {
    // Forzar reseteo completo del puzzle
    setPuzzleCompleted(false);
    
    // Usar un pequeño retraso para asegurar que el componente Cube reciba el cambio de estado
    setTimeout(() => {
      const cubeEvent = new CustomEvent('resetPuzzle');
      window.dispatchEvent(cubeEvent);
    }, 50);
  }, []);
  
  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => !prev);
  }, []);
  
  return (
    <div className="app-container">
      {/* Canvas para el contenido 3D */}
      <Canvas camera={{ position: [0, 8, 0], fov: 50, up: [0, 1, 0] }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <Cube
          puzzleCompleted={puzzleCompleted}
          setPuzzleCompleted={setPuzzleCompleted}
          soundEnabled={soundEnabled}
        />
        <OrbitControls 
          enablePan={false}
          enableZoom={true}
          enableRotate={false}
          minDistance={5}
          maxDistance={40}
          target={[0, 0, 0]}
        />
      </Canvas>
      
      {/* Componentes de UI superpuestos */}
      <VictoryMessage 
        visible={puzzleCompleted} 
        onRestart={handleRestart}
      />
      
      <SoundToggleButton 
        enabled={soundEnabled}
        onToggle={toggleSound}
      />
    </div>
  );
}

export default App; 