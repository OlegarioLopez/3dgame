import React, { useRef, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { 
  TextureLoader, 
  RepeatWrapping, 
  Vector2, 
  Shape, 
  ExtrudeGeometry, 
  DoubleSide,
  MeshStandardMaterial,
  BufferAttribute,
  Vector3,
  Matrix4
} from 'three';

// Componente para una pieza individual del puzzle
function PuzzlePiece({ position, textureOffset, textureSize, size, color, connections }) {
  const meshRef = useRef();
  
  // Carga la textura desde public/4.jpg
  const texture = useLoader(TextureLoader, '/4.jpg');
  
  // Configuramos la textura para mostrar solo una porción
  const clonedTexture = texture.clone();
  // Importante: NO repetir la textura
  clonedTexture.wrapS = RepeatWrapping;
  clonedTexture.wrapT = RepeatWrapping;
  // Configuramos explícitamente offset y repeat para que cada pieza muestre solo su porción
  clonedTexture.offset.set(textureOffset.x, textureOffset.y);
  clonedTexture.repeat.set(textureSize.x, textureSize.y);
  clonedTexture.needsUpdate = true;
  
  // Crear la forma de la pieza de puzzle
  const puzzleShape = useMemo(() => {
    // Tamaño del nodo (protuberancia/hendidura)
    const nodeSize = Math.min(size.x, size.y) * 0.2;
    
    // Crear la forma base rectangular
    const shape = new Shape();
    shape.moveTo(-size.x/2, -size.y/2);
    
    // Lado inferior: con nodo si es necesario
    if (connections.bottom === 1) {
      // Con protuberancia
      shape.lineTo(-nodeSize, -size.y/2);
      shape.bezierCurveTo(
        -nodeSize*0.5, -size.y/2 - nodeSize*1.5,
        nodeSize*0.5, -size.y/2 - nodeSize*1.5,
        nodeSize, -size.y/2
      );
      shape.lineTo(size.x/2, -size.y/2);
    } else if (connections.bottom === -1) {
      // Con hendidura
      shape.lineTo(-nodeSize, -size.y/2);
      shape.bezierCurveTo(
        -nodeSize*0.5, -size.y/2 + nodeSize*1.5,
        nodeSize*0.5, -size.y/2 + nodeSize*1.5,
        nodeSize, -size.y/2
      );
      shape.lineTo(size.x/2, -size.y/2);
    } else {
      // Recto
      shape.lineTo(size.x/2, -size.y/2);
    }
    
    // Lado derecho: con nodo si es necesario
    if (connections.right === 1) {
      // Con protuberancia
      shape.lineTo(size.x/2, -nodeSize);
      shape.bezierCurveTo(
        size.x/2 + nodeSize*1.5, -nodeSize*0.5,
        size.x/2 + nodeSize*1.5, nodeSize*0.5,
        size.x/2, nodeSize
      );
      shape.lineTo(size.x/2, size.y/2);
    } else if (connections.right === -1) {
      // Con hendidura
      shape.lineTo(size.x/2, -nodeSize);
      shape.bezierCurveTo(
        size.x/2 - nodeSize*1.5, -nodeSize*0.5,
        size.x/2 - nodeSize*1.5, nodeSize*0.5,
        size.x/2, nodeSize
      );
      shape.lineTo(size.x/2, size.y/2);
    } else {
      // Recto
      shape.lineTo(size.x/2, size.y/2);
    }
    
    // Lado superior: con nodo si es necesario
    if (connections.top === 1) {
      // Con protuberancia
      shape.lineTo(nodeSize, size.y/2);
      shape.bezierCurveTo(
        nodeSize*0.5, size.y/2 + nodeSize*1.5,
        -nodeSize*0.5, size.y/2 + nodeSize*1.5,
        -nodeSize, size.y/2
      );
      shape.lineTo(-size.x/2, size.y/2);
    } else if (connections.top === -1) {
      // Con hendidura
      shape.lineTo(nodeSize, size.y/2);
      shape.bezierCurveTo(
        nodeSize*0.5, size.y/2 - nodeSize*1.5,
        -nodeSize*0.5, size.y/2 - nodeSize*1.5,
        -nodeSize, size.y/2
      );
      shape.lineTo(-size.x/2, size.y/2);
    } else {
      // Recto
      shape.lineTo(-size.x/2, size.y/2);
    }
    
    // Lado izquierdo: con nodo si es necesario
    if (connections.left === 1) {
      // Con protuberancia
      shape.lineTo(-size.x/2, nodeSize);
      shape.bezierCurveTo(
        -size.x/2 - nodeSize*1.5, nodeSize*0.5,
        -size.x/2 - nodeSize*1.5, -nodeSize*0.5,
        -size.x/2, -nodeSize
      );
      shape.lineTo(-size.x/2, -size.y/2);
    } else if (connections.left === -1) {
      // Con hendidura
      shape.lineTo(-size.x/2, nodeSize);
      shape.bezierCurveTo(
        -size.x/2 + nodeSize*1.5, nodeSize*0.5,
        -size.x/2 + nodeSize*1.5, -nodeSize*0.5,
        -size.x/2, -nodeSize
      );
      shape.lineTo(-size.x/2, -size.y/2);
    } else {
      // Recto
      shape.lineTo(-size.x/2, -size.y/2);
    }
    
    return shape;
  }, [size, connections]);
  
  // Crear la geometría de la pieza de puzzle
  const puzzleGeometry = useMemo(() => {
    // Configuración de la extrusión
    const extrudeSettings = {
      steps: 1,
      depth: 0.2,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelOffset: 0,
      bevelSegments: 1
    };
    
    // Crear la geometría extruida
    const geometry = new ExtrudeGeometry(puzzleShape, extrudeSettings);
    
    // En lugar de calcular UVs personalizados, usamos UVs simples de 0 a 1
    // que se mapearán según los parámetros offset y repeat de la textura
    const positionAttribute = geometry.attributes.position;
    const count = positionAttribute.count;
    const uvs = new Float32Array(count * 2);
    
    // Crear un sistema UV simple para la cara frontal
    const tempVector = new Vector3();
    const transformMatrix = new Matrix4().makeRotationX(-Math.PI/2);
    
    for (let i = 0; i < count; i++) {
      tempVector.set(
        positionAttribute.getX(i),
        positionAttribute.getY(i),
        positionAttribute.getZ(i)
      );
      
      // Aplicar transformación para simular la rotación final
      tempVector.applyMatrix4(transformMatrix);
      
      // Si es la cara superior (que después de rotar será la frontal)
      const isTopFace = Math.abs(tempVector.y - 0.2) < 0.05;
      
      if (isTopFace) {
        // Normalizar las coordenadas al rango 0-1 para esta cara
        const normalizedX = (tempVector.x + size.x/2) / size.x;
        const normalizedZ = (tempVector.z + size.y/2) / size.y;
        
        // Asignar UVs directas sin multiplicar por textureSize o sumar textureOffset
        // esos ajustes se harán en la textura directamente
        uvs[i * 2] = normalizedX;
        uvs[i * 2 + 1] = normalizedZ;
      } else {
        // Para las demás caras, usar UVs en el rango 0-1
        const normalizedX = (tempVector.x + size.x/2) / size.x;
        const normalizedZ = (tempVector.z + size.y/2) / size.y;
        
        uvs[i * 2] = normalizedX;
        uvs[i * 2 + 1] = normalizedZ;
      }
    }
    
    // Asignar los UVs a la geometría
    geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
    geometry.attributes.uv.needsUpdate = true;
    
    return geometry;
  }, [puzzleShape, size]);
  
  // Crear materiales
  const materials = useMemo(() => {
    // Material para los lados
    const sideMaterial = new MeshStandardMaterial({
      color: color,
      roughness: 0.7,
      metalness: 0.1
    });
    
    // Material para la cara superior con textura
    const topMaterial = new MeshStandardMaterial({
      color: 0xffffff,
      map: clonedTexture,
      roughness: 0.5,
      metalness: 0.1
    });
    
    // Asignar todos los materiales
    return Array(6).fill(sideMaterial).map((mat, index) => {
      // Para la cara superior (que será la frontal después de rotar)
      if (index === 0) {
        return topMaterial;
      }
      return mat;
    });
  }, [color, clonedTexture]);

  return (
    <mesh 
      ref={meshRef} 
      position={[position[0], position[1], position[2]]} 
      geometry={puzzleGeometry}
      rotation={[Math.PI/2, 0, 0]} // Rotamos para que la cara frontal (con textura) quede hacia arriba
    >
      <primitive object={materials} attach="material" />
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
  
  // Definir las conexiones entre piezas
  // 1 = protuberancia, -1 = hendidura, 0 = borde recto
  const connectionsMap = [
    // Fila superior (de izquierda a derecha)
    { left: 0, right: 1, top: 0, bottom: 1 },    // Pieza 0
    { left: -1, right: 1, top: 0, bottom: -1 },  // Pieza 1
    { left: -1, right: 0, top: 0, bottom: 1 },   // Pieza 2
    
    // Fila inferior (de izquierda a derecha)
    { left: 0, right: -1, top: -1, bottom: 0 },  // Pieza 3
    { left: 1, right: -1, top: 1, bottom: 0 },   // Pieza 4
    { left: 1, right: 0, top: -1, bottom: 0 }    // Pieza 5
  ];
  
  // Disposición de las piezas (2 filas x 3 columnas)
  const pieces = [
    // Fila superior (de izquierda a derecha)
    {
      position: [-(pieceWidth + gapSize), 0, -(pieceHeight + gapSize)/2],
      textureOffset: new Vector2(0, 0),
      textureSize: new Vector2(1/3, 1/2),
      size: {x: pieceWidth, y: pieceHeight},
      color: colors[0],
      connections: connectionsMap[0]
    },
    {
      position: [0, 0, -(pieceHeight + gapSize)/2],
      textureOffset: new Vector2(1/3, 0),
      textureSize: new Vector2(1/3, 1/2),
      size: {x: pieceWidth, y: pieceHeight},
      color: colors[1],
      connections: connectionsMap[1]
    },
    {
      position: [(pieceWidth + gapSize), 0, -(pieceHeight + gapSize)/2],
      textureOffset: new Vector2(2/3, 0),
      textureSize: new Vector2(1/3, 1/2),
      size: {x: pieceWidth, y: pieceHeight},
      color: colors[2],
      connections: connectionsMap[2]
    },
    
    // Fila inferior (de izquierda a derecha)
    {
      position: [-(pieceWidth + gapSize), 0, (pieceHeight + gapSize)/2],
      textureOffset: new Vector2(0, 1/2),
      textureSize: new Vector2(1/3, 1/2),
      size: {x: pieceWidth, y: pieceHeight},
      color: colors[3],
      connections: connectionsMap[3]
    },
    {
      position: [0, 0, (pieceHeight + gapSize)/2],
      textureOffset: new Vector2(1/3, 1/2),
      textureSize: new Vector2(1/3, 1/2),
      size: {x: pieceWidth, y: pieceHeight},
      color: colors[4],
      connections: connectionsMap[4]
    },
    {
      position: [(pieceWidth + gapSize), 0, (pieceHeight + gapSize)/2],
      textureOffset: new Vector2(2/3, 1/2),
      textureSize: new Vector2(1/3, 1/2),
      size: {x: pieceWidth, y: pieceHeight},
      color: colors[5],
      connections: connectionsMap[5]
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
          connections={piece.connections}
        />
      ))}
    </group>
  );
}

export default Cube; 