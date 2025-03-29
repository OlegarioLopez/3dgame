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
  AudioLoader,
  CanvasTexture
} from 'three';
import { useSpring, animated } from '@react-spring/three';

// Sonidos
const SOUNDS = {
  PICK: '/sounds/cartoon-jump-6462.mp3',     // Sonido al levantar una pieza
  DROP: '',   // Sin sonido al soltar una pieza
  SNAP: '/sounds/coin-recieved-230517.mp3',   // Sonido al encajar una pieza
  VICTORY: '/sounds/winning-218995.mp3'        // Sonido al completar el puzzle
};

// Verificar si un formato de audio es compatible con el navegador
function isAudioFormatSupported(format) {
  const audio = document.createElement('audio');
  return audio.canPlayType && audio.canPlayType(format).replace(/no/, '');
}

// Comprobamos compatibilidad con MP3
const isMp3Supported = isAudioFormatSupported('audio/mpeg');
console.log('MP3 support:', isMp3Supported ? 'Supported' : 'Not supported');

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
  isPlacedInBox,
  correctPosition, 
  soundEnabled = true,
  allPieces, 
  pieceWidth, 
  pieceHeight, 
  checkPiecesConnection,
  puzzleBoxPosition,
  puzzleBoxSize,
  onGroupDragStart,
  onGroupDragEnd,
  draggedGroupInfo, 
  initialPosition,
  // Sound props from Cube
  pickSound,
  playSoundSafely 
}) {
  const meshRef = useRef();
  const { camera, raycaster, mouse } = useThree();
  const [isDraggingThisPiece, setIsDraggingThisPiece] = useState(false); 
  
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
  
  // Animaciones con Spring para movimientos más suaves
  const [spring, api] = useSpring(() => ({
    position: [initialPosition.x, initialPosition.y, initialPosition.z], // Start at the initial position from state
    scale: [1, 1, 1], // Usar array en lugar de escalar
    rotation: [Math.PI/2, 0, 0],
    config: { mass: 1, tension: 170, friction: 26 } // Default config
  }));

  // Update spring position IMMEDIATELY if initialPosition prop changes (e.g., on reset or external update)
  // UNLESS this piece is part of the actively dragged group.
  useEffect(() => {
    // Determine if this piece is currently being dragged as part of the active group
    const isActiveGroupMember = draggedGroupInfo.isActive && allPieces[index]?.groupId === draggedGroupInfo.groupId;
    
    // Only update if the initialPosition actually differs from the current spring value and not actively dragged
    const currentSpringPos = spring.position.get(); // Get current value
    const needsUpdate = currentSpringPos[0] !== initialPosition.x || 
                        currentSpringPos[1] !== initialPosition.y || 
                        currentSpringPos[2] !== initialPosition.z;

    if (!isActiveGroupMember && needsUpdate) {
      // console.log(`Piece ${index} (Group ${allPieces[index]?.groupId}) updating to initialPos:`, initialPosition, `Active Drag: ${draggedGroupInfo.isActive} (Group ${draggedGroupInfo.groupId})`);
      api.start({ 
        to: { position: [initialPosition.x, initialPosition.y, initialPosition.z] },
        immediate: true // Use immediate to avoid animation conflicts
      });
    }
  }, [initialPosition, index, api, spring.position, draggedGroupInfo.isActive, draggedGroupInfo.groupId, allPieces]); // Dependencies

  // Efectos para animaciones cuando se encaja una pieza en su posición FINAL
  useEffect(() => {
    if (isSnapped) {
      // Animación cuando encaja
      api.start({
        scale: [1.05, 1.05, 1.05], // Usar array en lugar de escalar
        onRest: () => {
          api.start({ scale: [1, 1, 1] }); // Usar array en lugar de escalar
        }
      });
      
      // Use sound function and object passed from Cube
      playSoundSafely(pickSound);
    }
  }, [isSnapped, api, pickSound, playSoundSafely]);
  
  // Uso de useFrame para actualizar la posición de la pieza mientras se arrastra (GROUP drag)
  useFrame(() => {
    // If a group drag is active AND this piece belongs to that group
    const pieceData = allPieces[index]; // Get current piece data safely
    if (pieceData && draggedGroupInfo.isActive && pieceData.groupId === draggedGroupInfo.groupId) {
      // Get the target position calculated by Cube for this specific piece
      const targetPos = draggedGroupInfo.targetPositions[index];
      if (targetPos) {
         // Animate towards the target position using this piece's spring
         api.start({ 
           position: [targetPos.x, targetPos.y, targetPos.z],
           config: { mass: 0.5, tension: 500, friction: 40 } // Faster config during drag
         });
      }
    }
  });
  
  // Manejadores de eventos simplificados
  const onPointerDown = useCallback((e) => {
    e.stopPropagation();
    const pieceData = allPieces[index];
    if (pieceData) {
      setIsDraggingThisPiece(true);
      onGroupDragStart(index, pieceData.groupId, e.point); 

      // Use sound function and object passed from Cube
      playSoundSafely(pickSound); 
      
      // Corregir el problema de animación: asegurarse de que scale es siempre un array
      api.start({ 
        scale: [1.05, 1.05, 1.05], // Usar array en lugar de número escalar
        config: { mass: 0.5, tension: 500, friction: 40 } 
      }); 
    }
  }, [index, allPieces, onGroupDragStart, api, playSoundSafely, pickSound]); 
  
  const onPointerUp = useCallback((e) => {
    if (isDraggingThisPiece) { 
      e.stopPropagation();
      setIsDraggingThisPiece(false); // Mark this piece as no longer initiating drag

      // Notify Cube that the drag attempt ended for this group
      // Cube needs the final pointer position on the Y=0 plane for accurate placement checks
      raycaster.setFromCamera(mouse, camera);
      const plane = new ThreePlane(new Vector3(0, 1, 0), 0);
      const finalIntersection = new Vector3();
      if (raycaster.ray.intersectPlane(plane, finalIntersection)) {
        // Pass the index of the piece dropped and the intersection point
        onGroupDragEnd(index, finalIntersection); 
      } else {
        // Fallback if intersection fails (e.g., pointer moved off screen between events)
        // Use the last known good position from the spring as a fallback
        const lastPos = spring.position.get();
        onGroupDragEnd(index, new Vector3(lastPos[0], 0.101, lastPos[2])); 
      }

      // Reset visual feedback (scale) for this piece
      api.start({ 
        scale: [1, 1, 1], // Usar array en lugar de escalar
        config: { mass: 1, tension: 170, friction: 26 } // Reset to default config
       }); 
      
      // Snapping logic is now handled centrally in Cube's handlePiecePlacement,
      // triggered by the onGroupDragEnd call above.
    }
  }, [
    isDraggingThisPiece, // Essential dependency
    index, 
    onGroupDragEnd, 
    api, 
    raycaster, 
    camera, 
    mouse, 
    spring.position // Added spring position for fallback
  ]);

  // Cancel group drag if pointer leaves the window/canvas
  const onPointerLeave = useCallback(() => {
      // SOLO queremos cancelar si realmente el puntero sale de la VENTANA, no de la pieza
      // Este evento está causando problemas al arrastrar, así que lo desactivamos
      // El onPointerUp normal manejará todo cuando se suelte
      
      /* COMENTADO PARA EVITAR CANCELACIÓN ACCIDENTAL
      if (isDraggingThisPiece) {
         console.log(`Pointer left canvas during drag initiated by piece ${index}`);
         // Use the last known target position for this piece from Cube's state if available
         const lastKnownTarget = draggedGroupInfo.isActive ? draggedGroupInfo.targetPositions[index] : null;
         const fallbackPos = lastKnownTarget ? 
            new Vector3(lastKnownTarget.x, 0.101, lastKnownTarget.z) : 
            new Vector3(spring.position.get()[0], 0.101, spring.position.get()[2]); // Current visual position

         onGroupDragEnd(index, fallbackPos, true); // Indicate cancellation = true
         setIsDraggingThisPiece(false); // Stop tracking drag initiation here
         api.start({ scale: 1 }); // Reset scale
      }
      */
      
      // No hacemos nada, permitimos que el arrastre continúe
  }, [isDraggingThisPiece, index, onGroupDragEnd, api, draggedGroupInfo, spring.position]);

  // Actualizar materiales basados en estado isSnapped (final position)
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
      position={spring.position} // Position driven by spring reacting to initialPosition or targetPositions
      rotation={spring.rotation}
      scale={spring.scale}
      geometry={puzzleGeometry}
      userData={{ type: 'puzzlePiece', index, groupId: allPieces[index]?.groupId }} // Include groupId
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp} // Treat cancel like up - triggers onGroupDragEnd
      
      // DESACTIVAMOS onPointerLeave que está causando problemas con el arrastre
      // onPointerLeave={onPointerLeave} // Handle pointer leaving canvas - triggers onGroupDragEnd(..., true)
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

// Función para crear una textura de texto
function createTextTexture(text, textColor = '#ffffff', bgColor = null, fontSize = 24) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  // Establecer dimensiones para que el texto sea nítido
  canvas.width = 256;
  canvas.height = 128;
  
  // Aplicar fondo si se especifica
  if (bgColor) {
    context.fillStyle = bgColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }
  
  // Configurar el estilo del texto
  context.font = `bold ${fontSize}px Arial, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = textColor;
  
  // Dibujar el texto centrado
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  
  // Crear textura a partir del canvas
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  
  return texture;
}

// Componente para mostrar texto como mesh con textura
function TextPlane({ text, position, scale = [1, 0.4, 1], fontSize = 24, textColor = '#ffffff', bgColor = null }) {
  // Crear textura del texto
  const texture = useMemo(() => createTextTexture(text, textColor, bgColor, fontSize), [text, textColor, bgColor, fontSize]);
  
  return (
    <mesh position={position} scale={scale}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  );
}

// Componente para el mensaje de victoria
function VictoryMessage({ visible, onRestart }) {
  // Animaciones con spring
  const [spring, api] = useSpring(() => ({
    scale: 0,
    opacity: 0,
    rotation: [0, 0, 0],
    config: { mass: 1, tension: 280, friction: 60 }
  }));
  
  // Actualizar animación cuando cambia la visibilidad
  useEffect(() => {
    if (visible) {
      api.start({
        scale: 1.2, // Más grande para mayor impacto
        opacity: 0.9, // Más opaco
        rotation: [0, Math.PI * 0.05, 0], // Ligera rotación para efecto 3D
        delay: 300,
        config: { 
          mass: 2,
          tension: 280,
          friction: 60
        }
      });
    } else {
      api.start({
        scale: 0,
        opacity: 0,
        rotation: [0, 0, 0]
      });
    }
  }, [visible, api]);
  
  if (!visible) return null;
  
  return (
    <group position={[0, 1.5, -1]}>
      <animated.mesh 
        position={[0, 0, 0]} 
        rotation={spring.rotation}
        scale={spring.scale}
        onClick={onRestart}
      >
        <planeGeometry args={[7, 3]} />
        <animated.meshBasicMaterial 
          color={0x00aa00} 
          transparent 
          opacity={spring.opacity} 
        />
      </animated.mesh>
      
      <animated.group scale={spring.scale} rotation={spring.rotation} position={[0, 0, 0.01]}>
        <TextPlane
          text="¡PUZZLE COMPLETADO!"
          position={[0, 0.5, 0]}
          scale={[6, 1, 1]}
          fontSize={46}
          textColor="#ffff00"
        />
        <TextPlane
          text="Haz clic para reiniciar"
          position={[0, -0.4, 0]}
          scale={[5, 0.7, 1]}
          fontSize={32}
          textColor="#ffffff"
        />
      </animated.group>
    </group>
  );
}

function Cube() {
  // Estado para rastrear las piezas
  const [pieces, setPieces] = useState([]); // Array of piece objects { position, ..., isSnapped, isPlacedInBox, groupId }
  const [snappedPieces, setSnappedPieces] = useState({}); // Tracks pieces in FINAL correct position by index
  const [puzzleCompleted, setPuzzleCompleted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // State for managing group dragging
  const [draggedGroupInfo, setDraggedGroupInfo] = useState({
     groupId: null,
     basePieceIndex: null, // Which piece in the group was initially clicked
     pointerOffset: new Vector3(), // Offset from the clicked piece's origin to the pointer intersection
     offsets: {}, // Relative offsets of each piece_index in the group from the basePieceIndex origin { index: Vector3, ... }
     targetPositions: {}, // Calculated target positions during drag { index: Vector3, ... }
     isActive: false
  });
  
  // Get necessary three.js elements from the hook at the top level
  const { camera, raycaster, mouse } = useThree();

  // --- Sound Management (Moved from PuzzlePiece) ---
  const audioListener = useMemo(() => new AudioListener(), []);
  const pickSound = useMemo(() => new Audio(audioListener), [audioListener]);
  const dropSound = useMemo(() => new Audio(audioListener), [audioListener]);
  const snapSound = useMemo(() => new Audio(audioListener), [audioListener]);
  const victorySound = useMemo(() => new Audio(audioListener), [audioListener]); // Assuming victory sound was already here
  
  // Función auxiliar para reproducir sonidos de forma segura
  const playSoundSafely = useCallback((sound, delay = 0) => {
    if (!sound || !soundEnabled) return;
    
    // Helper to actually play
    const play = () => {
        try {
            if (!sound.buffer) {
              console.warn('Sound buffer not ready for:', sound);
              return;
            }
            if (sound.isPlaying) {
              sound.stop();
            }
            sound.play();
          } catch (error) {
            console.warn('Error playing sound:', error);
          }
    };

    if (delay > 0) {
      setTimeout(play, delay);
    } else {
      play();
    }
  }, [soundEnabled]); // Dependency: only soundEnabled

  // Cargar los sonidos con manejo de errores
  useEffect(() => {
    if (!soundEnabled) return;
    
    const audioLoader = new AudioLoader();
    
    // Función de ayuda para cargar sonidos con manejo de errores
    const loadSoundSafely = (url, audioObject, volume, name) => {
      // Skip loading if browser doesn't support mp3 (or format detection fails)
      if (!isMp3Supported) {
        console.warn(`MP3 format not supported or check failed. Skipping sound: ${name} (${url})`);
        return; 
      }
      try {
        console.log(`Attempting to load sound: ${name} from ${url}`);
        audioLoader.load(
          url, 
          (buffer) => {
            try {
              audioObject.setBuffer(buffer);
              audioObject.setVolume(volume);
              console.log(`Sound loaded successfully: ${name}`);
            } catch (error) {
              console.warn(`Error setting buffer for ${name}:`, error);
            }
          },
          undefined, // onProgress callback (optional)
          (error) => {
            console.warn(`Error loading sound ${name} from ${url}:`, error);
          }
        );
      } catch (error) {
        console.warn(`Error setting up loader for sound ${name}:`, error);
      }
    };
    
    // Load all sounds needed in Cube
    loadSoundSafely(SOUNDS.PICK, pickSound, 0.5, 'Pick');
    loadSoundSafely(SOUNDS.DROP, dropSound, 0.5, 'Drop'); // Assuming SOUNDS.DROP is defined, even if empty path
    loadSoundSafely(SOUNDS.SNAP, snapSound, 0.7, 'Snap');
    loadSoundSafely(SOUNDS.VICTORY, victorySound, 0.7, 'Victory');
    
    // Ensure listener is added to the camera
    const currentCamera = camera; // Capture camera instance
    try {
        if (!currentCamera.children.includes(audioListener)) {
             currentCamera.add(audioListener);
             console.log("AudioListener added to camera.");
        }
    } catch (error) {
      console.warn('Error adding audio listener to camera:', error);
    }
    
    // Cleanup function
    return () => {
      try {
          // Stop sounds before removing listener
          [pickSound, dropSound, snapSound, victorySound].forEach(sound => {
              if (sound && sound.isPlaying) {
                  sound.stop();
              }
          });
          // Remove listener only if it was added
          if (currentCamera && currentCamera.children.includes(audioListener)) {
            currentCamera.remove(audioListener);
            console.log("AudioListener removed from camera.");
          }
      } catch (error) {
        console.warn('Error cleaning up audio listener:', error);
      }
    };
    // Ensure dependencies cover all sounds and necessary objects
  }, [audioListener, camera, pickSound, dropSound, snapSound, victorySound, soundEnabled]);
  // --- End Sound Management ---

  // Configuración del puzzle
  const puzzleWidth = 4;
  const puzzleHeight = 3;
  const gapSize = 0.2; // Aumentado el espacio entre piezas
  
  // Dimensiones de cada pieza (2x3 grid)
  const pieceWidth = (puzzleWidth - gapSize) / 3;
  const pieceHeight = (puzzleHeight - gapSize) / 2;
  
  // Posición central de la caja del puzzle
  const puzzleBoxPos = useMemo(() => new Vector3(-3, 0, 0), []);
  const puzzleBoxDim = useMemo(() => ({ width: puzzleWidth, height: puzzleHeight }), [puzzleWidth, puzzleHeight]);
  
  // Posiciones correctas de las piezas en la caja (izquierda)
  const correctPositions = useMemo(() => {
    return [
      new Vector3(puzzleBoxPos.x - pieceWidth, 0.101, puzzleBoxPos.z - pieceHeight / 2), // Pieza 0 (Top-Left)
      new Vector3(puzzleBoxPos.x, 0.101, puzzleBoxPos.z - pieceHeight / 2),             // Pieza 1 (Top-Center)
      new Vector3(puzzleBoxPos.x + pieceWidth, 0.101, puzzleBoxPos.z - pieceHeight / 2), // Pieza 2 (Top-Right)
      
      // Fila inferior (de izquierda a derecha)
      new Vector3(puzzleBoxPos.x - pieceWidth, 0.101, puzzleBoxPos.z + pieceHeight / 2), // Pieza 3 (Bottom-Left)
      new Vector3(puzzleBoxPos.x, 0.101, puzzleBoxPos.z + pieceHeight / 2),             // Pieza 4 (Bottom-Center)
      new Vector3(puzzleBoxPos.x + pieceWidth, 0.101, puzzleBoxPos.z + pieceHeight / 2)  // Pieza 5 (Bottom-Right)
    ];
  }, [pieceWidth, pieceHeight, puzzleBoxPos]);
  
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
  
  // Definir la matriz de vecinos legítimos (qué piezas van juntas en el puzzle completo)
  // Esta matriz define qué piezas deben estar adyacentes en el puzzle completo
  const pieceNeighborsMap = [
    // Para cada pieza, definimos sus vecinos legítimos por índice
    { right: 1, bottom: 3 },      // Pieza 0: a su derecha va la pieza 1, abajo la pieza 3
    { left: 0, right: 2, bottom: 4 }, // Pieza 1: a su izquierda va la 0, a su derecha la 2, abajo la 4
    { left: 1, bottom: 5 },       // Pieza 2: a su izquierda va la 1, abajo la 5
    { top: 0, right: 4 },         // Pieza 3: arriba va la 0, a su derecha la 4
    { top: 1, left: 3, right: 5 }, // Pieza 4: arriba va la 1, a su izquierda la 3, a su derecha la 5
    { top: 2, left: 4 }           // Pieza 5: arriba va la 2, a su izquierda la 4
  ];

  // Función para comprobar si las piezas encajan entre sí
  const checkPiecesConnection = useCallback((pieceAIndex, pieceBIndex) => {
    // Si algún índice no es válido, no encajan
    if (pieceAIndex === undefined || pieceBIndex === undefined || 
        pieceAIndex < 0 || pieceBIndex < 0 || 
        pieceAIndex >= pieceNeighborsMap.length || pieceBIndex >= pieceNeighborsMap.length) {
      return null;
    }
    
    // Obtener los vecinos permitidos para la pieza A
    const neighborsOfA = pieceNeighborsMap[pieceAIndex];
    // Obtener los vecinos permitidos para la pieza B
    const neighborsOfB = pieceNeighborsMap[pieceBIndex];
    
    console.log(`Checking connection between pieces ${pieceAIndex} and ${pieceBIndex}`);
    console.log(`Neighbors of A (${pieceAIndex}):`, neighborsOfA);
    console.log(`Neighbors of B (${pieceBIndex}):`, neighborsOfB);
    
    // Comprobar si B es un vecino legítimo de A
    if (neighborsOfA.right === pieceBIndex) {
      console.log(`Piece ${pieceBIndex} is to the RIGHT of ${pieceAIndex}`);
      return 'horizontal'; // B debe estar a la derecha de A
    }
    if (neighborsOfA.left === pieceBIndex) {
      console.log(`Piece ${pieceBIndex} is to the LEFT of ${pieceAIndex}`);
      return 'horizontal'; // B debe estar a la izquierda de A
    }
    if (neighborsOfA.bottom === pieceBIndex) {
      console.log(`Piece ${pieceBIndex} is BELOW ${pieceAIndex}`);
      return 'vertical'; // B debe estar abajo de A
    }
    if (neighborsOfA.top === pieceBIndex) {
      console.log(`Piece ${pieceBIndex} is ABOVE ${pieceAIndex}`);
      return 'vertical'; // B debe estar arriba de A
    }
    
    // También comprobamos el caso inverso: si A es vecino de B
    if (neighborsOfB.right === pieceAIndex) {
      console.log(`Piece ${pieceAIndex} is to the RIGHT of ${pieceBIndex}`);
      return 'horizontal'; // A debe estar a la derecha de B
    }
    if (neighborsOfB.left === pieceAIndex) {
      console.log(`Piece ${pieceAIndex} is to the LEFT of ${pieceBIndex}`);
      return 'horizontal'; // A debe estar a la izquierda de B
    }
    if (neighborsOfB.bottom === pieceAIndex) {
      console.log(`Piece ${pieceAIndex} is BELOW ${pieceBIndex}`);
      return 'vertical'; // A debe estar abajo de B
    }
    if (neighborsOfB.top === pieceAIndex) {
      console.log(`Piece ${pieceAIndex} is ABOVE ${pieceBIndex}`);
      return 'vertical'; // A debe estar arriba de B
    }
    
    console.log(`No valid connection found between ${pieceAIndex} and ${pieceBIndex}`);
    // Si llegamos aquí, las piezas no son vecinas legítimas
    return null;
  }, []);
  
  // Inicializar las piezas si es necesario
  useEffect(() => {
    // Check if pieces need initialization (e.g., empty or after reset)
    if (pieces.length === 0 && !puzzleCompleted) { // Added !puzzleCompleted check to avoid re-init after win
      // Crear las piezas con posiciones aleatorias
      const initialPieces = Array.from({ length: 6 }).map((_, i) => {
         const randomPos = { x: Math.random() * 2 - 1, z: Math.random() * 2 - 1 };
         const isTopRow = i < 3;
         const colIndex = i % 3;
         const rowIndex = isTopRow ? 0 : 1;
         
         // Determine initial spawn position (example logic, adjust as needed)
         const spawnX = 3 + colIndex * 1.5 + randomPos.x * 0.5;
         const spawnZ = -1 + rowIndex * 2 + randomPos.z * 0.5;

         return {
            // Keep original props
            textureOffset: new Vector2(colIndex / 3, rowIndex / 2),
            textureSize: new Vector2(1/3, 1/2),
            size: {x: pieceWidth, y: pieceHeight},
            color: colors[i],
            connections: connectionsMap[i],
            // Add new state props
            position: new Vector3(spawnX, 0.101, spawnZ), // Store the initial position
            isSnapped: false,
            isPlacedInBox: false, 
            groupId: i // Each piece starts in its own group
         };
      });
      
      setPieces(initialPieces);
      setSnappedPieces({}); // Reset snapped pieces count
    }
  }, [pieces.length, colors, connectionsMap, pieceWidth, pieceHeight, puzzleCompleted]); // Added puzzleCompleted dependency
  
  // --- Group Merging Logic ---
  const mergeGroups = useCallback((groupAId, groupBId) => {
    if (groupAId === groupBId || groupAId === null || groupBId === null) return; // Already same group or invalid IDs

    setPieces(currentPieces => {
      // Determine which group ID to keep (e.g., the smaller one, or based on piece count, etc.)
      // Here, we'll just keep groupBId for simplicity
      const targetGroupId = groupBId;
      const sourceGroupId = groupAId;
      
      console.log(`Merging group ${sourceGroupId} into ${targetGroupId}`);

      return currentPieces.map(p => 
        p.groupId === sourceGroupId ? { ...p, groupId: targetGroupId } : p
      );
    });
  }, []); // No dependencies needed directly

  // --- Snapping and Placement Logic (Called by onGroupDragEnd) ---
  const handlePiecePlacement = useCallback((droppedPieceIndex, finalDropPosition) => {
    const droppedPiece = pieces[droppedPieceIndex];
    if (!droppedPiece) return;

    // Márgenes de tolerancia para considerar piezas cercanas
    const horizontalTolerance = pieceWidth * 1.2;
    const verticalTolerance = pieceHeight * 1.2;
    
    // Distancias mínimas para evitar que se consideren piezas superpuestas
    const minHorizontalDistance = pieceWidth * 0.6;
    const minVerticalDistance = pieceHeight * 0.6;

    const puzzleBoxBounds = {
        minX: puzzleBoxPos.x - puzzleBoxDim.width / 2,
        maxX: puzzleBoxPos.x + puzzleBoxDim.width / 2,
        minZ: puzzleBoxPos.z - puzzleBoxDim.height / 2,
        maxZ: puzzleBoxPos.z + puzzleBoxDim.height / 2,
    };

    let targetPosition = finalDropPosition.clone();
    targetPosition.y = 0.101; // Ensure correct height
    let didSnap = false;
    let neighborToSnapTo = null;

    // 1. Verificar si la pieza está dentro de la caja
    const isInsideBox = 
        finalDropPosition.x >= puzzleBoxBounds.minX &&
        finalDropPosition.x <= puzzleBoxBounds.maxX &&
        finalDropPosition.z >= puzzleBoxBounds.minZ &&
        finalDropPosition.z <= puzzleBoxBounds.maxZ;

    if (isInsideBox) {
        // 2. Buscar snap con vecinos ya colocados en la caja
        // Buscaremos el vecino más cercano que sea hermano legítimo
        let bestNeighbor = null;
        let bestDistance = Infinity;
        let bestSnapPosition = null;

        // Vecinos legítimos de la pieza según la matriz
        const neighbors = pieceNeighborsMap[droppedPieceIndex];
        console.log(`Legitimate neighbors for piece ${droppedPieceIndex}:`, neighbors);

        // Para cada vecino posible, verificar si está colocado y calcular distancia
        Object.entries(neighbors).forEach(([direction, neighborIndex]) => {
            const neighborPiece = pieces[neighborIndex];
            
            // Verificar que el vecino existe, está colocado y es de otro grupo
            if (!neighborPiece || !neighborPiece.isPlacedInBox || 
                neighborPiece.groupId === droppedPiece.groupId) {
                return;
            }

            // Calcular vector desde el centro del vecino al centro de la pieza
            const vecToPiece = new Vector3().subVectors(finalDropPosition, neighborPiece.position);
            
            // Para conexiones horizontales (left/right)
            if (direction === 'left' || direction === 'right') {
                // Verificar que la separación en Z (vertical) es pequeña
                if (Math.abs(vecToPiece.z) < verticalTolerance) {
                    // Calcular la distancia real en X (horizontal)
                    const horizontalDistance = Math.abs(vecToPiece.x);
                    
                    console.log(`Horizontal check with piece ${neighborIndex} (${direction}): distance=${horizontalDistance}, tolerance=${horizontalTolerance}, minDistance=${minHorizontalDistance}`);
                    
                    // Si está dentro de la tolerancia, no demasiado cerca y es mejor que la anterior
                    if (horizontalDistance < horizontalTolerance && 
                        horizontalDistance > minHorizontalDistance &&
                        horizontalDistance < bestDistance) {
                        bestDistance = horizontalDistance;
                        bestNeighbor = neighborPiece;
                        
                        // Calcular posición exacta de snap
                        bestSnapPosition = new Vector3().copy(neighborPiece.position);
                        
                        // Ajustar X según dirección
                        if (direction === 'left') { // Si el vecino debe estar a la izquierda
                            bestSnapPosition.x += pieceWidth;
                        } else { // Si el vecino debe estar a la derecha
                            bestSnapPosition.x -= pieceWidth;
                        }
                        
                        console.log(`Found potential horizontal snap at ${bestSnapPosition.x}, ${bestSnapPosition.z}`);
                    }
                }
            }
            // Para conexiones verticales (top/bottom)
            else if (direction === 'top' || direction === 'bottom') {
                // Verificar que la separación en X (horizontal) es pequeña
                if (Math.abs(vecToPiece.x) < horizontalTolerance) {
                    // Calcular la distancia real en Z (vertical)
                    const verticalDistance = Math.abs(vecToPiece.z);
                    
                    console.log(`Vertical check with piece ${neighborIndex} (${direction}): distance=${verticalDistance}, tolerance=${verticalTolerance}, minDistance=${minVerticalDistance}`);
                    
                    // Si está dentro de la tolerancia, no demasiado cerca y es mejor que la anterior
                    if (verticalDistance < verticalTolerance && 
                        verticalDistance > minVerticalDistance &&
                        verticalDistance < bestDistance) {
                        bestDistance = verticalDistance;
                        bestNeighbor = neighborPiece;
                        
                        // Calcular posición exacta de snap
                        bestSnapPosition = new Vector3().copy(neighborPiece.position);
                        
                        // CORRECCIÓN INVERTIDA COMPLETAMENTE: Ajustar Z según dirección
                        if (direction === 'top') { // Si el vecino debe estar arriba
                            // La pieza debe ir ARRIBA (z menor)
                            bestSnapPosition.z -= pieceHeight; // RESTAR para mover hacia arriba
                            console.log(`FIXED: Piece should go ABOVE neighbor (${direction}) - Z decreased to ${bestSnapPosition.z}`);
                        } else if (direction === 'bottom') { // Si el vecino debe estar abajo
                            // La pieza debe ir ABAJO (z mayor)
                            bestSnapPosition.z += pieceHeight; // SUMAR para mover hacia abajo
                            console.log(`FIXED: Piece should go BELOW neighbor (${direction}) - Z increased to ${bestSnapPosition.z}`);
                        }
                        
                        console.log(`Found potential vertical snap at ${bestSnapPosition.x}, ${bestSnapPosition.z}`);
                    }
                }
            }
        });

        // También considerar el caso inverso (la pieza vecina busca a esta)
        pieces.forEach((otherPiece, otherIndex) => {
            if (!otherPiece.isPlacedInBox || otherPiece.groupId === droppedPiece.groupId) {
                return;
            }
            
            const otherNeighbors = pieceNeighborsMap[otherIndex];
            
            // Verificar si la pieza actual es vecina legítima de la otra pieza
            let connectionDirection = null;
            Object.entries(otherNeighbors).forEach(([dir, idx]) => {
                if (idx === droppedPieceIndex) {
                    connectionDirection = dir;
                }
            });
            
            if (!connectionDirection) return;
            
            // Calcular vector desde el centro de la otra pieza al centro de esta
            const vecToPiece = new Vector3().subVectors(finalDropPosition, otherPiece.position);
            
            // Para conexiones horizontales (left/right)
            if (connectionDirection === 'left' || connectionDirection === 'right') {
                // Verificar que la separación en Z (vertical) es pequeña
                if (Math.abs(vecToPiece.z) < verticalTolerance) {
                    const horizontalDistance = Math.abs(vecToPiece.x);
                    
                    console.log(`Reverse horizontal check with piece ${otherIndex} (${connectionDirection}): distance=${horizontalDistance}, tolerance=${horizontalTolerance}, minDistance=${minHorizontalDistance}`);
                    
                    // Añadir verificación de distancia mínima
                    if (horizontalDistance < horizontalTolerance && 
                        horizontalDistance > minHorizontalDistance && 
                        horizontalDistance < bestDistance) {
                        bestDistance = horizontalDistance;
                        bestNeighbor = otherPiece;
                        
                        bestSnapPosition = new Vector3().copy(otherPiece.position);
                        if (connectionDirection === 'right') { // Si esta pieza debe estar a la derecha
                            bestSnapPosition.x += pieceWidth;
                        } else { // Si esta pieza debe estar a la izquierda
                            bestSnapPosition.x -= pieceWidth;
                        }
                        
                        console.log(`Found potential reverse horizontal snap at ${bestSnapPosition.x}, ${bestSnapPosition.z}`);
                    }
                }
            }
            // Para conexiones verticales (top/bottom)
            else if (connectionDirection === 'top' || connectionDirection === 'bottom') {
                // Verificar que la separación en X (horizontal) es pequeña
                if (Math.abs(vecToPiece.x) < horizontalTolerance) {
                    const verticalDistance = Math.abs(vecToPiece.z);
                    
                    console.log(`Reverse vertical check with piece ${otherIndex} (${connectionDirection}): distance=${verticalDistance}, tolerance=${verticalTolerance}, minDistance=${minVerticalDistance}`);
                    
                    // Añadir verificación de distancia mínima
                    if (verticalDistance < verticalTolerance && 
                        verticalDistance > minVerticalDistance && 
                        verticalDistance < bestDistance) {
                        bestDistance = verticalDistance;
                        bestNeighbor = otherPiece;
                        
                        bestSnapPosition = new Vector3().copy(otherPiece.position);
                        
                        // CORRECCIÓN INVERTIDA COMPLETAMENTE: Ajustar Z según dirección
                        if (connectionDirection === 'bottom') { // Si la pieza actual debe estar abajo del vecino
                            // La pieza debe ir ABAJO (z mayor)
                            bestSnapPosition.z += pieceHeight; // SUMAR para mover hacia abajo
                            console.log(`FIXED: Piece should go BELOW neighbor (reverse-${connectionDirection}) - Z increased to ${bestSnapPosition.z}`);
                        } else if (connectionDirection === 'top') { // Si la pieza actual debe estar arriba del vecino
                            // La pieza debe ir ARRIBA (z menor) 
                            bestSnapPosition.z -= pieceHeight; // RESTAR para mover hacia arriba
                            console.log(`FIXED: Piece should go ABOVE neighbor (reverse-${connectionDirection}) - Z decreased to ${bestSnapPosition.z}`);
                        }
                        
                        console.log(`Found potential reverse vertical snap at ${bestSnapPosition.x}, ${bestSnapPosition.z}`);
                    }
                }
            }
        });

        // Aplicar el mejor snap encontrado
        if (bestNeighbor && bestSnapPosition) {
            targetPosition.copy(bestSnapPosition);
            didSnap = true;
            neighborToSnapTo = bestNeighbor;
            console.log(`Piece ${droppedPieceIndex} snapped to neighbor ${pieces.indexOf(bestNeighbor)} at position ${targetPosition.x}, ${targetPosition.z}`);
        }
    }

    // 3. Actualizar estado para la pieza/grupo
    if (isInsideBox) {
        const droppedGroupId = droppedPiece.groupId;
        
        setPieces(currentPieces => {
            // Encontrar todos los índices del grupo
            const groupIndices = currentPieces.reduce((acc, p, idx) => {
                if (p.groupId === droppedGroupId) acc.push(idx);
                return acc;
            }, []);
            
            if (groupIndices.length === 0) return currentPieces;
            
            // Crear copia mutable para esta actualización
            const newPieces = currentPieces.map(p => ({...p}));
            
            // Si hubo snap, calcular y aplicar offset
            if (didSnap) {
                const basePieceOffset = new Vector3().subVectors(targetPosition, finalDropPosition);
                basePieceOffset.y = 0; // Solo movimiento planar
                
                // Aplicar nueva posición y estado a todas las piezas del grupo
                groupIndices.forEach(idx => {
                    const pieceToUpdate = newPieces[idx];
                    const newPosition = new Vector3().addVectors(pieceToUpdate.position, basePieceOffset);
                    newPosition.y = 0.101; // Asegurar altura correcta
                    
                    newPieces[idx] = {
                        ...pieceToUpdate,
                        position: newPosition,
                        isPlacedInBox: true,
                        // Ya no usamos isSnapped para posición final
                    };
                });
                
                // Manejar fusión de grupos si se hizo snap a un grupo diferente
                if (neighborToSnapTo && neighborToSnapTo.groupId !== droppedGroupId) {
                    // Asignar todas las piezas al mismo grupo ahora mismo
                    // (esto reemplaza a la llamada externa a mergeGroups)
                    groupIndices.forEach(idx => {
                        newPieces[idx].groupId = neighborToSnapTo.groupId;
                    });
                }
            } else {
                // Si no hubo snap pero está en la caja, solo actualizar isPlacedInBox
                groupIndices.forEach(idx => {
                    newPieces[idx] = {
                        ...newPieces[idx],
                        isPlacedInBox: true
                    };
                });
            }
            
            return newPieces;
        });
    }

    // 4. Reproducir sonido CORREGIDO
    if (didSnap && neighborToSnapTo) {
        // Solo reproducir sonido si realmente hizo snap a un vecino
        playSoundSafely(snapSound);
    } else if (isInsideBox) {
        // Solo colocada dentro de la caja sin snap
        playSoundSafely(dropSound);
    }

    // 5. Comprobar si el puzzle está completado (todas las piezas conectadas en un solo grupo)
    if (didSnap || isInsideBox) {
        setTimeout(() => {
            // Usar setTimeout para asegurar que el estado ya está actualizado
            const firstPiece = pieces[0];
            if (firstPiece) {
                const firstGroupId = firstPiece.groupId;
                const allInSameGroup = pieces.every(piece => piece.groupId === firstGroupId);
                const allInBox = pieces.every(piece => piece.isPlacedInBox);
                
                console.log("Comprobando victoria:", { 
                    allInSameGroup, 
                    allInBox, 
                    puzzleCompleted,
                    piecesGroups: pieces.map(p => p.groupId)
                });
                
                if (allInSameGroup && allInBox && !puzzleCompleted) {
                    console.log("¡PUZZLE COMPLETADO desde useEffect! Mostrando animación");
                    setSnappedPieces({0: true, 1: true, 2: true, 3: true, 4: true, 5: true});
                    // Usar audio con un pequeño retraso para un mejor efecto
                    playSoundSafely(victorySound, 300);
                }
            }
        }, 300); // Aumentar el tiempo para asegurar que el estado esté actualizado
    }

}, [pieces, puzzleBoxPos, puzzleBoxDim, pieceWidth, pieceHeight, snapSound, dropSound, playSoundSafely, pieceNeighborsMap, puzzleCompleted]);

  // --- Drag Handlers ---
  const handleGroupDragStart = useCallback((startIndex, startGroupId, pointerIntersection) => {
     const basePiece = pieces[startIndex];
     // Prevent starting a new drag if one is active, or if the piece/group is invalid
     if (!basePiece || startGroupId === null || draggedGroupInfo.isActive) return; 

     const groupMemberOffsets = {};
     const initialTargetPositions = {};
     const currentGroupMembers = pieces.reduce((acc, p, idx) => {
        if (p.groupId === startGroupId) acc.push({ piece: p, index: idx });
        return acc;
     }, []);

     // Calculate offset from pointer to the base piece's origin (on the drag plane)
     const pointerOffset = new Vector3().subVectors(pointerIntersection, basePiece.position);
     pointerOffset.y = 0; // Ignore Y offset for planar dragging

     // Calculate relative offsets of all group members from the base piece
     currentGroupMembers.forEach(({ piece, index }) => {
        const offset = new Vector3().subVectors(piece.position, basePiece.position);
        groupMemberOffsets[index] = offset;
        initialTargetPositions[index] = piece.position.clone(); // Start targets at current positions
     });
     
     console.log(`Starting drag for group ${startGroupId} with base piece ${startIndex}`);
     // Set state to start the drag
     setDraggedGroupInfo({
        groupId: startGroupId,
        basePieceIndex: startIndex,
        pointerOffset: pointerOffset,
        offsets: groupMemberOffsets,
        targetPositions: initialTargetPositions, // Set initial targets
        isActive: true
     });

  }, [pieces, draggedGroupInfo.isActive]); // Dependencies: pieces state and current drag status

  const handleGroupDrag = useCallback((pointerIntersection) => {
     // Update target positions based on mouse movement during an active drag
     if (!draggedGroupInfo.isActive || draggedGroupInfo.groupId === null || !pieces[draggedGroupInfo.basePieceIndex]) return;

     const { basePieceIndex, pointerOffset, offsets, groupId } = draggedGroupInfo;
     const newTargetPositions = {};

     // Calculate new base position based on pointer, elevated during drag
     const basePieceOriginalY = pieces[basePieceIndex].position.y; // Maintain original Y as base
     const newBasePosX = pointerIntersection.x - pointerOffset.x;
     const newBasePosZ = pointerIntersection.z - pointerOffset.z;
     // Keep the group elevated slightly while dragging for visual clarity
     const dragElevation = 0.3; 
     const newBasePos = new Vector3(newBasePosX, dragElevation, newBasePosZ);

     // Calculate target positions for all members based on the new base position and relative offsets
     Object.keys(offsets).forEach(indexStr => {
        const index = parseInt(indexStr, 10);
        const relativeOffset = offsets[index];
        // Ensure the offset doesn't affect the elevation during drag
        const targetPos = new Vector3().addVectors(newBasePos, relativeOffset);
        targetPos.y = dragElevation; // Maintain consistent elevation for all pieces in the group
        newTargetPositions[index] = targetPos;
     });

     // Update the state with new target positions
     setDraggedGroupInfo(prev => ({
        ...prev,
        targetPositions: newTargetPositions
     }));

  }, [draggedGroupInfo, pieces]); // Dependencies: drag info and pieces state (for base piece Y)

   // Add a useFrame hook within Cube to call handleGroupDrag
   useFrame(() => {
      if (draggedGroupInfo.isActive) {
         raycaster.setFromCamera(mouse, camera);
         const plane = new ThreePlane(new Vector3(0, 1, 0), 0); // Drag plane at Y=0
         const intersection = new Vector3();
         // Update target positions if the ray intersects the plane
         if (raycaster.ray.intersectPlane(plane, intersection)) {
            handleGroupDrag(intersection); 
         }
      }
   });

  const handleGroupDragEnd = useCallback((droppedPieceIndex, finalPointerIntersection, isCancel = false) => {
     if (!draggedGroupInfo.isActive) return;

     console.log(`Drag end triggered for group ${draggedGroupInfo.groupId}. Cancel: ${isCancel}`);

     // Calculate the final drop position on the board plane (Y=0.101)
     // IMPORTANTE: Usar siempre la última posición de arrastre como punto de referencia
     const lastTargetPos = draggedGroupInfo.targetPositions[droppedPieceIndex];
     
     // Si no tenemos lastTargetPos (poco probable), fallback a la intersección del puntero
     const finalDropPosition = new Vector3(
         lastTargetPos ? lastTargetPos.x : finalPointerIntersection.x,
         0.101, // Ensure final position is on the board plane
         lastTargetPos ? lastTargetPos.z : finalPointerIntersection.z
     );

     // Store essential info before resetting state
     const previousDragInfo = { ...draggedGroupInfo }; 
     const droppedGroupId = previousDragInfo.groupId;
     
     // Guardar todas las posiciones target actuales antes de resetear
     const finalPositions = { ...previousDragInfo.targetPositions };

     // Reset drag state FIRST to stop useFrame updates
     setDraggedGroupInfo({ 
        groupId: null, 
        basePieceIndex: null, 
        pointerOffset: new Vector3(), 
        offsets: {}, 
        targetPositions: {}, 
        isActive: false 
     });

     // Then, handle placement and snapping only if it wasn't a cancel action
     if (!isCancel && droppedGroupId !== null) {
        // MODIFICACIÓN: Aplicar directamente las posiciones finales al estado
        setPieces(currentPieces => {
           const newPieces = [...currentPieces];
           
           // Identificar todas las piezas del grupo
           const groupIndices = currentPieces.reduce((acc, p, idx) => {
              if (p.groupId === droppedGroupId) acc.push(idx);
              return acc;
           }, []);
           
           // Aplicar las posiciones finales a todas las piezas del grupo
           groupIndices.forEach(idx => {
              if (finalPositions[idx]) {
                 // Usar la posición final del arrastre, con altura correcta
                 const pos = finalPositions[idx];
                 newPieces[idx] = {
                    ...newPieces[idx],
                    position: new Vector3(pos.x, 0.101, pos.z)
                 };
              }
           });
           
           return newPieces;
        });
        
        // DESPUÉS de aplicar las posiciones, ahora hacer el snapping y el resto de la lógica
        handlePiecePlacement(droppedPieceIndex, finalDropPosition); 
     } else {
         // Si es cancelación, no necesitamos hacer nada, las piezas volverán a su posición original
         console.log(`Drag cancelled for group ${droppedGroupId}. Pieces should return.`);
     }
}, [draggedGroupInfo, handlePiecePlacement]);
  
  // Manejar el movimiento de una pieza (Legacy - Keeping for potential non-drag updates)
  const handlePieceMoved = useCallback((index, newPosition, isSnapped, isPlacedInBox) => {
    // This might become redundant if handlePiecePlacement handles all state updates post-drag
    // Keep for now in case of non-drag movements? (Currently none)
    setPieces(prev => {
      // ... (previous logic) ...
    });
    
    if (isSnapped) {
      // ... (previous logic) ...
    }
  }, []); 
  
  // Reiniciar el juego
  const handleRestart = useCallback(() => {
    setPuzzleCompleted(false);
    setSnappedPieces({});
    setPieces([]); // Clear pieces, useEffect will re-initialize
    setDraggedGroupInfo({ isActive: false, groupId: null, basePieceIndex: null, pointerOffset: new Vector3(), offsets: {}, targetPositions: {} }); // Reset drag state
  }, []);

  // Función para alternar el sonido
  const toggleSound = useCallback((e) => {
    e.stopPropagation();
    setSoundEnabled(prev => !prev);
  }, []);

  // Comprobar si el puzzle está completo
  useEffect(() => {
    const totalSnappedPieces = Object.keys(snappedPieces).length;
    console.log(`Snapped pieces count: ${totalSnappedPieces}`, snappedPieces);
    
    if (totalSnappedPieces === 6 && !puzzleCompleted) {
      console.log("¡PUZZLE COMPLETADO desde useEffect! Mostrando animación");
      setPuzzleCompleted(true);
      
      // Usar audio con un pequeño retraso para un mejor efecto
      playSoundSafely(victorySound, 300);
    }
  }, [snappedPieces, puzzleCompleted, victorySound, playSoundSafely]);

  return (
    <group>
      {/* Caja del puzzle (posicionada a la izquierda) */}
      <PuzzleBox 
        width={puzzleWidth} 
        height={puzzleHeight} 
        depth={0.3} 
        wallHeight={0.3} 
        wallThickness={0.1} 
        position={puzzleBoxPos}
      />
      
      {/* Piezas del puzzle */}
      {pieces.map((piece, index) => (
        <PuzzlePiece 
          key={`${piece.groupId}-${index}`} // Key needs to be stable but unique if pieces array shuffles - include groupId?
          index={index}
          initialPosition={piece.position} // Pass the *static* state position
          position={piece.position} // Pass the same for initial spring setup
          textureOffset={piece.textureOffset}
          textureSize={piece.textureSize}
          size={piece.size}
          color={piece.color}
          connections={piece.connections}
          isSnapped={piece.isSnapped}
          isPlacedInBox={piece.isPlacedInBox}
          correctPosition={correctPositions[index]}
          // onPieceMoved={handlePieceMoved} // Replaced by group handlers
          soundEnabled={soundEnabled}
          // Pass additional props
          allPieces={pieces} // Pass current pieces state
          pieceWidth={pieceWidth}
          pieceHeight={pieceHeight}
          checkPiecesConnection={checkPiecesConnection}
          puzzleBoxPosition={puzzleBoxPos}
          puzzleBoxSize={puzzleBoxDim}
          // Group Drag Props
          onGroupDragStart={handleGroupDragStart}
          onGroupDragEnd={handleGroupDragEnd}
          draggedGroupInfo={draggedGroupInfo} // Pass down the drag state
          // Pass Sound Props
          pickSound={pickSound} // Pass the sound object
          playSoundSafely={playSoundSafely} // Pass the function
        />
      ))}
      
      {/* Mensaje de victoria */}
      <VictoryMessage 
        visible={puzzleCompleted} 
        onRestart={handleRestart}
      />
      
      {/* Botón para activar/desactivar sonido - con mejor visibilidad */}
      <group position={[4.5, 2, -1]} onClick={toggleSound}>
        <mesh>
          <planeGeometry args={[1.2, 0.5]} />
          <meshBasicMaterial color={soundEnabled ? 0x00aa00 : 0xff0000} transparent opacity={0.9} />
        </mesh>
        <TextPlane
          text={soundEnabled ? "Sonido: ON" : "Sonido: OFF"}
          position={[0, 0, 0.01]}
          scale={[1, 0.4, 1]}
          fontSize={20}
          textColor={soundEnabled ? "#ffffff" : "#ffffff"}
          bgColor={null}
        />
      </group>
    </group>
  );
}

export default Cube; 