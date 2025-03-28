import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import Cube from './Cube';

function Scene() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <Canvas 
        style={{ background: '#111' }}
        camera={{ 
          position: [0.02, 3.46, 2.32],
          rotation: [-0.98, 0.00, 0.01],
          fov: 50 
        }}
      >
        <ambientLight intensity={1.0} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <Suspense fallback={null}>
          <Cube />
        </Suspense>
      </Canvas>

      {/* Información fija de la cámara y la tarjeta */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'rgba(0,0,0,0.7)',
        color: '#8ff',
        padding: '10px',
        borderRadius: '5px',
        fontFamily: 'monospace',
        fontSize: '12px',
        zIndex: 100
      }}>
        <div><strong>CÁMARA</strong></div>
        <div>Posición: X:0.02 Y:3.46 Z:2.32</div>
        <div>Rotación: X:-0.98 Y:0.00 Z:0.01</div>
      </div>

      <div style={{
        position: 'absolute',
        top: '100px',
        left: '10px',
        background: 'rgba(0,0,0,0.7)',
        color: '#ff8',
        padding: '10px',
        borderRadius: '5px',
        fontFamily: 'monospace',
        fontSize: '12px',
        zIndex: 100
      }}>
        <div><strong>TARJETA</strong></div>
        <div>Posición: X:0.00 Y:0.00 Z:0.00</div>
        <div>Rotación: X:0.00 Y:0.00 Z:0.00</div>
      </div>
    </div>
  );
}

export default Scene;