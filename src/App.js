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
    setPuzzleCompleted(false);
  }, []);
  
  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => !prev);
  }, []);
  
  return (
    <div className="app-container">
      {/* Canvas para el contenido 3D */}
      <Canvas camera={{ position: [0, 3, 5], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <Cube
          puzzleCompleted={puzzleCompleted}
          setPuzzleCompleted={setPuzzleCompleted}
          soundEnabled={soundEnabled}
        />
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minPolarAngle={0}
          maxPolarAngle={Math.PI / 2}
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