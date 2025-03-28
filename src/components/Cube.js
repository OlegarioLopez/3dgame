import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { useLoader, useThree, useFrame } from '@react-three/fiber';
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
  Matrix4,
  BoxGeometry,
  Raycaster,
  Plane as ThreePlane,
  Audio,
  AudioListener,
  AudioLoader
} from 'three';
import { Text } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';

// Sonidos
const SOUNDS = {
  PICK: '/sounds/pick.mp3',
  DROP: '/sounds/drop.mp3',
  SNAP: '/sounds/snap.mp3',
  VICTORY: '/sounds/victory.mp3'
};

// Componente para una pieza individual del puzzle
function PuzzlePiece({ 
  position, 
  textureOffset, 
  textureSize, 
  size, 
  color, 
  connections, 
  index, 
  onPieceMoved, 
  isSnapped, 
  correctPosition, 
  checkCollisions,
  soundEnabled = true
}) {
  const meshRef = useRef();
  const { camera, raycaster, mouse, viewport } = useThree();
  const [isDragging, setIsDragging] = useState(false);
  
  // Referencias para sonidos
  const audioListener = useMemo(() => new AudioListener(), []);
  const pickSound = useMemo(() => new Audio(audioListener), [audioListener]);
  const dropSound = useMemo(() => new Audio(audioListener), [audioListener]);
  const snapSound = useMemo(() => new Audio(audioListener), [audioListener]);
  
  // Cargar los sonidos
  useEffect(() => {
    if (!soundEnabled) return;
    
    const audioLoader = new AudioLoader();
    
    audioLoader.load(SOUNDS.PICK, (buffer) => {
      pickSound.setBuffer(buffer);
      pickSound.setVolume(0.5);
    });
    
    audioLoader.load(SOUNDS.DROP, (buffer) => {
      dropSound.setBuffer(buffer);
      dropSound.setVolume(0.5);
    });
    
    audioLoader.load(SOUNDS.SNAP, (buffer) => {
      snapSound.setBuffer(buffer);
      snapSound.setVolume(0.7);
    });
    
    // Añadir el listener a la cámara
    camera.add(audioListener);
    
    return () => {
      camera.remove(audioListener);
    };
  }, [audioListener, camera, pickSound, dropSound, snapSound, soundEnabled]);
  
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

  // Implementación simplificada de arrastre para vista 2D
  const [dragOffset, setDragOffset] = useState({ x: 0, z: 0 });
  
  // Animaciones con Spring para movimientos más suaves
  const [spring, api] = useSpring(() => ({
    position: [position.x, position.y, position.z],
    scale: 1,
    rotation: [Math.PI/2, 0, 0],
    config: { mass: 1, tension: 170, friction: 26 }
  }));
  
  // Efectos para animaciones cuando se encaja una pieza
  useEffect(() => {
    if (isSnapped) {
      // Animación cuando encaja
      api.start({
        scale: [1.05, 1.05, 1.05],
        onRest: () => {
          api.start({ scale: 1 });
        }
      });
      
      // Sonar el efecto de snap
      if (snapSound.buffer && soundEnabled) {
        snapSound.play();
      }
    }
  }, [isSnapped, api, snapSound, soundEnabled]);
  
  // Uso de useFrame para actualizar la posición de la pieza mientras se arrastra
  useFrame(() => {
    if (isDragging && meshRef.current) {
      // Obtener coordenadas normalizadas del mouse (-1 a 1)
      // Convertir posición del mouse a coordenadas del mundo
      raycaster.setFromCamera(mouse, camera);
      
      // Calcular el punto de intersección con el plano y = 0 (donde están las piezas)
      const plane = new ThreePlane(new Vector3(0, 1, 0), 0);
      const intersection = new Vector3();
      raycaster.ray.intersectPlane(plane, intersection);
      
      // Animar la posición usando spring para que sea más suave
      api.start({
        position: [
          intersection.x - dragOffset.x,
          isDragging ? 0.3 : 0.101, // Elevar mientras se arrastra
          intersection.z - dragOffset.z
        ]
      });
    }
  });
  
  // Manejadores de eventos simplificados
  const onPointerDown = useCallback((e) => {
    e.stopPropagation();
    setIsDragging(true);
    
    // Reproducir sonido al levantar la pieza
    if (pickSound.buffer && soundEnabled) {
      pickSound.play();
    }
    
    // Animar la pieza al empezar a arrastrar
    api.start({
      scale: 1.05,
      position: [meshRef.current.position.x, 0.3, meshRef.current.position.z]
    });
    
    // Calcular el offset para que la pieza no "salte" al comienzo del arrastre
    const plane = new ThreePlane(new Vector3(0, 1, 0), 0);
    const intersection = new Vector3();
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(plane, intersection);
    
    setDragOffset({ 
      x: intersection.x - meshRef.current.position.x,
      z: intersection.z - meshRef.current.position.z
    });
  }, [camera, raycaster, mouse, api, pickSound, soundEnabled]);
  
  const onPointerUp = useCallback((e) => {
    if (isDragging) {
      e.stopPropagation();
      setIsDragging(false);
      
      // Reproducir sonido al soltar la pieza
      if (dropSound.buffer && soundEnabled) {
        dropSound.play();
      }
      
      // Volver a la escala normal
      api.start({ scale: 1 });
      
      // Bajar la pieza a la altura normal
      if (meshRef.current) {
        const newPosition = new Vector3(
          meshRef.current.position.x,
          0.101,
          meshRef.current.position.z
        );
        
        // Comprobar si está cerca de su posición correcta
        const snapDistance = 0.5;
        if (correctPosition && newPosition.distanceTo(correctPosition) < snapDistance) {
          // Hacer snap a la posición correcta con animación
          api.start({
            position: [correctPosition.x, correctPosition.y, correctPosition.z],
            config: { mass: 1, tension: 170, friction: 26 }
          });
          
          onPieceMoved(index, correctPosition, true);
        } else {
          // Notificar nueva posición y comprobar colisiones con otras piezas
          api.start({
            position: [newPosition.x, newPosition.y, newPosition.z],
            config: { mass: 1, tension: 170, friction: 26 }
          });
          
          onPieceMoved(index, newPosition, false);
          checkCollisions(index, newPosition);
        }
      }
    }
  }, [isDragging, correctPosition, onPieceMoved, checkCollisions, index, api, dropSound, soundEnabled]);
  
  // Actualizar materiales basados en estado
  useEffect(() => {
    if (isSnapped) {
      // Si la pieza está encajada, actualizar materiales (opcional: efecto visual)
      materials.forEach(mat => {
        if (mat.emissive) {
          mat.emissive.set(0x222222);
        }
      });
    } else {
      // Reestablecer materiales
      materials.forEach(mat => {
        if (mat.emissive) {
          mat.emissive.set(0x000000);
        }
      });
    }
  }, [isSnapped, materials]);

  return (
    <animated.mesh 
      ref={meshRef} 
      position={spring.position}
      rotation={spring.rotation}
      scale={spring.scale}
      geometry={puzzleGeometry}
      userData={{ type: 'puzzlePiece', index }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <primitive object={materials} attach="material" />
    </animated.mesh>
  );
}

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

// Componente para el mensaje de victoria
function VictoryMessage({ visible, onRestart }) {
  // Animaciones con spring
  const [spring, api] = useSpring(() => ({
    scale: 0,
    opacity: 0,
    config: { mass: 1, tension: 280, friction: 60 }
  }));
  
  // Actualizar animación cuando cambia la visibilidad
  useEffect(() => {
    if (visible) {
      api.start({
        scale: 1,
        opacity: 1,
        delay: 500
      });
    } else {
      api.start({
        scale: 0,
        opacity: 0
      });
    }
  }, [visible, api]);
  
  if (!visible) return null;
  
  return (
    <group position={[0, 1, 0]}>
      <animated.mesh 
        position={[0, 0, 0]} 
        scale={spring.scale}
        onClick={onRestart}
      >
        <planeGeometry args={[6, 2]} />
        <animated.meshBasicMaterial 
          color={0x00aa00} 
          transparent 
          opacity={spring.opacity} 
        />
      </animated.mesh>
      
      <animated.group scale={spring.scale} position={[0, 0, 0.01]}>
        <Text
          position={[0, 0.3, 0]}
          fontSize={0.5}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          ¡PUZZLE COMPLETADO!
        </Text>
        <Text
          position={[0, -0.3, 0]}
          fontSize={0.25}
          color="#dddddd"
          anchorX="center"
          anchorY="middle"
        >
          Haz clic para reiniciar
        </Text>
      </animated.group>
    </group>
  );
}

function Cube() {
  // Estado para rastrear las piezas
  const [pieces, setPieces] = useState([]);
  const [snappedPieces, setSnappedPieces] = useState({});
  const [puzzleCompleted, setPuzzleCompleted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Referencia para el sonido de victoria
  const { camera } = useThree();
  const audioListener = useMemo(() => new AudioListener(), []);
  const victorySound = useMemo(() => new Audio(audioListener), [audioListener]);
  
  // Cargar sonido de victoria
  useEffect(() => {
    if (!soundEnabled) return;
    
    const audioLoader = new AudioLoader();
    audioLoader.load(SOUNDS.VICTORY, (buffer) => {
      victorySound.setBuffer(buffer);
      victorySound.setVolume(0.7);
    });
    
    camera.add(audioListener);
    
    return () => {
      camera.remove(audioListener);
    };
  }, [camera, audioListener, victorySound, soundEnabled]);
  
  // Configuración del puzzle
  const puzzleWidth = 4;
  const puzzleHeight = 3;
  const gapSize = 0.2; // Aumentado el espacio entre piezas
  
  // Dimensiones de cada pieza (2x3 grid)
  const pieceWidth = (puzzleWidth - gapSize) / 3;
  const pieceHeight = (puzzleHeight - gapSize) / 2;
  
  // Posiciones correctas de las piezas en la caja (izquierda)
  const correctPositions = useMemo(() => [
    // Fila superior (de izquierda a derecha)
    new Vector3(-3 - pieceWidth, 0.101, -pieceHeight),
    new Vector3(-3, 0.101, -pieceHeight),
    new Vector3(-3 + pieceWidth, 0.101, -pieceHeight),
    
    // Fila inferior (de izquierda a derecha)
    new Vector3(-3 - pieceWidth, 0.101, 0),
    new Vector3(-3, 0.101, 0),
    new Vector3(-3 + pieceWidth, 0.101, 0)
  ], [pieceWidth, pieceHeight]);
  
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
  
  // Inicializar las piezas si es necesario
  useEffect(() => {
    if (pieces.length === 0) {
      // Factores de aleatorización para la posición de las piezas
      const randomPositions = Array(6).fill(0).map(() => ({
        x: Math.random() * 2 - 1, // Entre -1 y 1
        z: Math.random() * 2 - 1  // Entre -1 y 1
      }));
      
      // Crear las piezas con posiciones aleatorias
      const initialPieces = [
        // Fila superior (de izquierda a derecha)
        {
          position: new Vector3(3 + randomPositions[0].x, 0.101, -1 + randomPositions[0].z),
          textureOffset: new Vector2(0, 0),
          textureSize: new Vector2(1/3, 1/2),
          size: {x: pieceWidth, y: pieceHeight},
          color: colors[0],
          connections: connectionsMap[0],
          isSnapped: false
        },
        {
          position: new Vector3(4 + randomPositions[1].x, 0.101, 0 + randomPositions[1].z),
          textureOffset: new Vector2(1/3, 0),
          textureSize: new Vector2(1/3, 1/2),
          size: {x: pieceWidth, y: pieceHeight},
          color: colors[1],
          connections: connectionsMap[1],
          isSnapped: false
        },
        {
          position: new Vector3(5 + randomPositions[2].x, 0.101, 1 + randomPositions[2].z),
          textureOffset: new Vector2(2/3, 0),
          textureSize: new Vector2(1/3, 1/2),
          size: {x: pieceWidth, y: pieceHeight},
          color: colors[2],
          connections: connectionsMap[2],
          isSnapped: false
        },
        
        // Fila inferior (de izquierda a derecha)
        {
          position: new Vector3(3 + randomPositions[3].x, 0.101, 1 + randomPositions[3].z),
          textureOffset: new Vector2(0, 1/2),
          textureSize: new Vector2(1/3, 1/2),
          size: {x: pieceWidth, y: pieceHeight},
          color: colors[3],
          connections: connectionsMap[3],
          isSnapped: false
        },
        {
          position: new Vector3(4 + randomPositions[4].x, 0.101, 2 + randomPositions[4].z),
          textureOffset: new Vector2(1/3, 1/2),
          textureSize: new Vector2(1/3, 1/2),
          size: {x: pieceWidth, y: pieceHeight},
          color: colors[4],
          connections: connectionsMap[4],
          isSnapped: false
        },
        {
          position: new Vector3(5 + randomPositions[5].x, 0.101, 0 + randomPositions[5].z),
          textureOffset: new Vector2(2/3, 1/2),
          textureSize: new Vector2(1/3, 1/2),
          size: {x: pieceWidth, y: pieceHeight},
          color: colors[5],
          connections: connectionsMap[5],
          isSnapped: false
        }
      ];
      
      setPieces(initialPieces);
    }
  }, [pieces.length, colors, connectionsMap, pieceWidth, pieceHeight]);
  
  // Manejar el movimiento de una pieza
  const handlePieceMoved = useCallback((index, newPosition, isSnapped) => {
    setPieces(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        position: newPosition,
        isSnapped
      };
      return updated;
    });
    
    if (isSnapped) {
      setSnappedPieces(prev => ({
        ...prev,
        [index]: true
      }));
    }
  }, []);
  
  // Comprobar si el puzzle está completo
  useEffect(() => {
    const totalSnappedPieces = Object.keys(snappedPieces).length;
    if (totalSnappedPieces === 6 && !puzzleCompleted) {
      setPuzzleCompleted(true);
      
      // Reproducir sonido de victoria
      if (victorySound.buffer && soundEnabled) {
        setTimeout(() => victorySound.play(), 500);
      }
    }
  }, [snappedPieces, puzzleCompleted, victorySound, soundEnabled]);
  
  // Función para comprobar si las piezas encajan entre sí
  const checkPiecesConnection = useCallback((pieceA, pieceB) => {
    // Comprobar si las piezas encajan horizontalmente
    if (pieceA.connections.right === 1 && pieceB.connections.left === -1) {
      return 'horizontal';
    }
    if (pieceA.connections.left === 1 && pieceB.connections.right === -1) {
      return 'horizontal';
    }
    
    // Comprobar si las piezas encajan verticalmente
    if (pieceA.connections.bottom === 1 && pieceB.connections.top === -1) {
      return 'vertical';
    }
    if (pieceA.connections.top === 1 && pieceB.connections.bottom === -1) {
      return 'vertical';
    }
    
    return null;
  }, []);
  
  // Comprobar colisiones con otras piezas y ajustar si es necesario
  const checkCollisions = useCallback((movedIndex, newPosition) => {
    const snapDistanceForPieces = 0.3; // Distancia de tolerancia para snap entre piezas
    
    // Comprobar contra cada otra pieza
    pieces.forEach((piece, otherIndex) => {
      if (otherIndex === movedIndex) return; // Evitar comprobarse a sí misma
      
      const distance = newPosition.distanceTo(piece.position);
      
      // Si están lo suficientemente cerca
      if (distance < snapDistanceForPieces * 2) {
        // Comprobar si tienen conexión válida
        const connectionType = checkPiecesConnection(pieces[movedIndex], piece);
        
        if (connectionType) {
          // Calcular posición de snap basada en el tipo de conexión
          let snappedPosition = new Vector3();
          
          if (connectionType === 'horizontal') {
            // Si la pieza A tiene protuberancia derecha y B hendidura izquierda
            if (pieces[movedIndex].connections.right === 1 && piece.connections.left === -1) {
              snappedPosition.copy(piece.position).sub(new Vector3(pieceWidth, 0, 0));
            } 
            // Si la pieza A tiene protuberancia izquierda y B hendidura derecha
            else if (pieces[movedIndex].connections.left === 1 && piece.connections.right === -1) {
              snappedPosition.copy(piece.position).add(new Vector3(pieceWidth, 0, 0));
            }
          } else if (connectionType === 'vertical') {
            // Si la pieza A tiene protuberancia inferior y B hendidura superior
            if (pieces[movedIndex].connections.bottom === 1 && piece.connections.top === -1) {
              snappedPosition.copy(piece.position).sub(new Vector3(0, 0, pieceHeight));
            } 
            // Si la pieza A tiene protuberancia superior y B hendidura inferior
            else if (pieces[movedIndex].connections.top === 1 && piece.connections.bottom === -1) {
              snappedPosition.copy(piece.position).add(new Vector3(0, 0, pieceHeight));
            }
          }
          
          // Aplicar el snap
          handlePieceMoved(movedIndex, snappedPosition, false);
        }
      }
    });
  }, [pieces, pieceWidth, pieceHeight, checkPiecesConnection, handlePieceMoved]);
  
  // Reiniciar el juego
  const handleRestart = useCallback(() => {
    setPuzzleCompleted(false);
    setSnappedPieces({});
    setPieces([]);
  }, []);

  return (
    <group>
      {/* Caja del puzzle (posicionada a la izquierda) */}
      <PuzzleBox 
        width={puzzleWidth} 
        height={puzzleHeight} 
        depth={0.3} 
        wallHeight={0.3} 
        wallThickness={0.1} 
        position={[-3, 0, 0]} 
      />
      
      {/* Piezas del puzzle */}
      {pieces.map((piece, index) => (
        <PuzzlePiece 
          key={index}
          index={index}
          position={piece.position}
          textureOffset={piece.textureOffset}
          textureSize={piece.textureSize}
          size={piece.size}
          color={piece.color}
          connections={piece.connections}
          isSnapped={piece.isSnapped}
          correctPosition={correctPositions[index]}
          onPieceMoved={handlePieceMoved}
          checkCollisions={checkCollisions}
          soundEnabled={soundEnabled}
        />
      ))}
      
      {/* Mensaje de victoria */}
      <VictoryMessage 
        visible={puzzleCompleted} 
        onRestart={handleRestart}
      />
    </group>
  );
}

export default Cube; 