import React, { useRef } from 'react';
import { useLoader } from '@react-three/fiber';
import { TextureLoader } from 'three';

function Cube() {
  const meshRef = useRef();
  
  // Carga la textura desde public/4.jpg
  const texture = useLoader(TextureLoader, '/4.jpg');

  // Definimos los materiales para cada cara
  const materials = [
    { color: 0xff0000 }, // X+ (derecha) - rojo
    { color: 0x00ff00 }, // X- (izquierda) - verde
    { map: texture },    // Y+ (arriba) - con textura
    { color: 0x0000ff }, // Y- (abajo) - azul
    { color: 0xffff00 }, // Z+ (frente) - amarillo
    { color: 0xff00ff }  // Z- (atrás) - magenta
  ];

  return (
    <mesh 
      ref={meshRef} 
      position={[0, 0, 0]}
      rotation={[0, 0, 0]}
    >
      <boxGeometry args={[4, 0.2, 3]} />
      {materials.map((props, index) => (
        <meshStandardMaterial key={index} attach={`material-${index}`} {...props} />
      ))}
    </mesh>
  );
}

export default Cube; 