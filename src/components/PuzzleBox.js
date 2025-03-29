import React, { useRef, useMemo } from 'react';
import { MeshStandardMaterial } from 'three';

// Componente para la caja contenedora del puzzle
function PuzzleBox({ width, height, depth, wallHeight, wallThickness, position }) {
  const boxRef = useRef();
  
  // Material para la caja
  const boxMaterial = useMemo(() => {
    return new MeshStandardMaterial({
      color: 0x666666,
      roughness: 0.8,
      metalness: 0.2
    });
  }, []);
  
  return (
    <group ref={boxRef} position={position}>
      {/* Base de la caja */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[width, 0.1, height]} />
        <meshStandardMaterial color={0x444444} roughness={0.9} />
      </mesh>
      
      {/* Pared izquierda */}
      <mesh position={[-width/2 - wallThickness/2, wallHeight/2, 0]} receiveShadow>
        <boxGeometry args={[wallThickness, wallHeight, height + wallThickness*2]} />
        <primitive object={boxMaterial} />
      </mesh>
      
      {/* Pared derecha */}
      <mesh position={[width/2 + wallThickness/2, wallHeight/2, 0]} receiveShadow>
        <boxGeometry args={[wallThickness, wallHeight, height + wallThickness*2]} />
        <primitive object={boxMaterial} />
      </mesh>
      
      {/* Pared superior */}
      <mesh position={[0, wallHeight/2, -height/2 - wallThickness/2]} receiveShadow>
        <boxGeometry args={[width + wallThickness*2, wallHeight, wallThickness]} />
        <primitive object={boxMaterial} />
      </mesh>
      
      {/* Pared inferior */}
      <mesh position={[0, wallHeight/2, height/2 + wallThickness/2]} receiveShadow>
        <boxGeometry args={[width + wallThickness*2, wallHeight, wallThickness]} />
        <primitive object={boxMaterial} />
      </mesh>
    </group>
  );
}

export default PuzzleBox; 