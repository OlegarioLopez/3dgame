import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Cube from './Cube';

function Scene() {
  return (
    <Canvas style={{ background: '#111' }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <Suspense fallback={null}>
        <Cube />
        <OrbitControls />
      </Suspense>
    </Canvas>
  );
}

export default Scene; 