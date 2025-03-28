import React, { useRef } from 'react';
import { useLoader } from '@react-three/fiber';
import { TextureLoader, RepeatWrapping, Vector2 } from 'three';

// Componente para una pieza individual del puzzle
function PuzzlePiece({ position, textureOffset, textureSize, size, color }) {
  const meshRef = useRef();
  
  // Carga la textura desde public/4.jpg
  const texture = useLoader(TextureLoader, '/4.jpg');
  
  // Configuramos la textura para mostrar solo una porción
  const clonedTexture = texture.clone();
  clonedTexture.repeat.set(textureSize.x, textureSize.y);
  clonedTexture.offset.set(textureOffset.x, textureOffset.y);
  clonedTexture.wrapS = RepeatWrapping;
  clonedTexture.wrapT = RepeatWrapping;
  clonedTexture.needsUpdate = true;
  
  return (
    <mesh 
      ref={meshRef} 
      position={position}
      rotation={[0, 0, 0]}
    >
      <boxGeometry args={[size.x, 0.2, size.y]} />
      <meshStandardMaterial attach="material-0" color={color} /> {/* Derecha */}
      <meshStandardMaterial attach="material-1" color={color} /> {/* Izquierda */}
      <meshStandardMaterial attach="material-2" map={clonedTexture} /> {/* Arriba - con textura */}
      <meshStandardMaterial attach="material-3" color={color} /> {/* Abajo */}
      <meshStandardMaterial attach="material-4" color={color} /> {/* Frente */}
      <meshStandardMaterial attach="material-5" color={color} /> {/* Atrás */}
    </mesh>
  );
}

function Cube() {
  // Configuración del puzzle
  const puzzleWidth = 4;
  const puzzleHeight = 3;
  const gapSize = 0.05; // Espacio entre piezas
  
  // Dimensiones de cada pieza (2x3 grid)
  const pieceWidth = (puzzleWidth - gapSize) / 3;
  const pieceHeight = (puzzleHeight - gapSize) / 2;
  
  // Colores para las piezas (caras laterales)
  const colors = [
    0xff0000, // rojo
    0x00ff00, // verde
    0x0000ff, // azul
    0xffff00, // amarillo
    0xff00ff, // magenta
    0x00ffff  // cian
  ];
  
  // Disposición de las piezas (2 filas x 3 columnas)
  const pieces = [
    // Fila superior (de izquierda a derecha)
    {
      position: [-(pieceWidth + gapSize), 0, -(pieceHeight + gapSize)/2],
      textureOffset: new Vector2(0, 0),
      textureSize: new Vector2(1/3, 1/2),
      size: {x: pieceWidth, y: pieceHeight},
      color: colors[0]
    },
    {
      position: [0, 0, -(pieceHeight + gapSize)/2],
      textureOffset: new Vector2(1/3, 0),
      textureSize: new Vector2(1/3, 1/2),
      size: {x: pieceWidth, y: pieceHeight},
      color: colors[1]
    },
    {
      position: [(pieceWidth + gapSize), 0, -(pieceHeight + gapSize)/2],
      textureOffset: new Vector2(2/3, 0),
      textureSize: new Vector2(1/3, 1/2),
      size: {x: pieceWidth, y: pieceHeight},
      color: colors[2]
    },
    
    // Fila inferior (de izquierda a derecha)
    {
      position: [-(pieceWidth + gapSize), 0, (pieceHeight + gapSize)/2],
      textureOffset: new Vector2(0, 1/2),
      textureSize: new Vector2(1/3, 1/2),
      size: {x: pieceWidth, y: pieceHeight},
      color: colors[3]
    },
    {
      position: [0, 0, (pieceHeight + gapSize)/2],
      textureOffset: new Vector2(1/3, 1/2),
      textureSize: new Vector2(1/3, 1/2),
      size: {x: pieceWidth, y: pieceHeight},
      color: colors[4]
    },
    {
      position: [(pieceWidth + gapSize), 0, (pieceHeight + gapSize)/2],
      textureOffset: new Vector2(2/3, 1/2),
      textureSize: new Vector2(1/3, 1/2),
      size: {x: pieceWidth, y: pieceHeight},
      color: colors[5]
    }
  ];

  return (
    <group>
      {pieces.map((piece, index) => (
        <PuzzlePiece 
          key={index}
          position={piece.position}
          textureOffset={piece.textureOffset}
          textureSize={piece.textureSize}
          size={piece.size}
          color={piece.color}
        />
      ))}
    </group>
  );
}

export default Cube; 