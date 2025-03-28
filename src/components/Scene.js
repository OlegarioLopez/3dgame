import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Cube from './Cube';

// Componente para visualizar los ejes XYZ
function AxesHelper({ size = 10 }) {
  return (
    <group>
      {/* Eje X - Rojo */}
      <mesh position={[size/2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, size, 8]} />
        <meshBasicMaterial color="red" />
      </mesh>
      <mesh position={[size, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.2, 0.5, 8]} />
        <meshBasicMaterial color="red" />
      </mesh>
      <mesh position={[size/2, 0.5, 0]}>
        <textGeometry args={["X", { size: 0.5 }]} />
        <meshBasicMaterial color="red" />
      </mesh>

      {/* Eje Y - Verde */}
      <mesh position={[0, size/2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, size, 8]} />
        <meshBasicMaterial color="green" />
      </mesh>
      <mesh position={[0, size, 0]}>
        <coneGeometry args={[0.2, 0.5, 8]} />
        <meshBasicMaterial color="green" />
      </mesh>
      <mesh position={[0, size/2, 0.5]}>
        <textGeometry args={["Y", { size: 0.5 }]} />
        <meshBasicMaterial color="green" />
      </mesh>

      {/* Eje Z - Azul */}
      <mesh position={[0, 0, size/2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, size, 8]} />
        <meshBasicMaterial color="blue" />
      </mesh>
      <mesh position={[0, 0, size]} rotation={[0, Math.PI / 2, 0]}>
        <coneGeometry args={[0.2, 0.5, 8]} />
        <meshBasicMaterial color="blue" />
      </mesh>
      <mesh position={[0.5, 0, size/2]}>
        <textGeometry args={["Z", { size: 0.5 }]} />
        <meshBasicMaterial color="blue" />
      </mesh>
    </group>
  );
}

// Componente simplificado para los ejes
function SimpleAxesHelper({ size = 5 }) {
  return (
    <group>
      {/* Eje X - Rojo */}
      <line>
        <bufferGeometry attach="geometry">
          <float32BufferAttribute attach="attributes-position" args={[[0, 0, 0, size, 0, 0], 3]} />
        </bufferGeometry>
        <lineBasicMaterial attach="material" color="red" linewidth={2} />
      </line>
      
      {/* Eje Y - Verde */}
      <line>
        <bufferGeometry attach="geometry">
          <float32BufferAttribute attach="attributes-position" args={[[0, 0, 0, 0, size, 0], 3]} />
        </bufferGeometry>
        <lineBasicMaterial attach="material" color="green" linewidth={2} />
      </line>
      
      {/* Eje Z - Azul */}
      <line>
        <bufferGeometry attach="geometry">
          <float32BufferAttribute attach="attributes-position" args={[[0, 0, 0, 0, 0, size], 3]} />
        </bufferGeometry>
        <lineBasicMaterial attach="material" color="blue" linewidth={2} />
      </line>
    </group>
  );
}

function Scene() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <Canvas 
        style={{ background: '#111' }}
        camera={{ 
          position: [0, 15, 0],
          fov: 30,
          up: [0, 0, -1] // Necesario para orientar correctamente la cámara
        }}
      >
        <ambientLight intensity={1.0} />
        <pointLight position={[10, 20, 10]} intensity={1.5} />
        <directionalLight position={[0, 10, 0]} intensity={1} />
        <Suspense fallback={null}>
          <Cube />
        </Suspense>
        
        {/* Sistema de ejes - Alternativa más simple */}
        <axesHelper args={[5]} />
        
        <OrbitControls 
          enablePan={false} 
          enableZoom={true} 
          enableRotate={false}
          minPolarAngle={Math.PI/2}
          maxPolarAngle={Math.PI/2}
          target={[0, 0, 0]}
          makeDefault
        />
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
        <div>Posición: X:0 Y:15 Z:0</div>
        <div>Vista: Cenital (desde arriba)</div>
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
        <div><strong>INSTRUCCIONES</strong></div>
        <div>Arrastra las piezas de la derecha</div>
        <div>Colócalas en la caja de la izquierda</div>
        <div>Usa zoom para acercarte si es necesario</div>
        <div>EJES VISIBLES: X=Rojo, Z=Azul</div>
      </div>
      
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        background: 'rgba(0,0,0,0.7)',
        color: '#f8f',
        padding: '10px',
        borderRadius: '5px',
        fontFamily: 'monospace',
        fontSize: '12px',
        zIndex: 100
      }}>
        <div><strong>ORIENTACIÓN ACTUAL</strong></div>
        <div>Vista desde el eje Y (Verde)</div>
        <div>- X (Rojo): Izquierda{'->'} Derecha</div>
        <div>- Z (Azul): Arriba{'->'} Abajo</div>
      </div>
    </div>
  );
}

export default Scene;