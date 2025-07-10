import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { 
  Vector2, 
  Vector3,
  Plane,
  AudioListener
} from 'three';
import PuzzlePiece from './PuzzlePiece';
import PuzzleBox from './PuzzleBox';
import useSound from './useSound';

// Sonidos (como URLs relativas desde la carpeta public)
const SOUNDS = {
  PICK: '/sounds/cartoon-jump-6462.mp3',
  DROP: '',
  SNAP: '/sounds/coin-recieved-230517.mp3',
  VICTORY: '/sounds/energy-drink-effect-230559.mp3'
};

// Objetos estáticos para reutilizar (mejora rendimiento)
const ZERO_VECTOR = new Vector3(0, 0, 0);
const TEMP_VECTOR1 = new Vector3(); // Para uso en handleGroupDragStart
const TEMP_VECTOR2 = new Vector3(); // Para uso en handleGroupDrag
const TEMP_VECTOR3 = new Vector3(); // Para uso en otras funciones
const DRAG_PLANE = new Plane(new Vector3(0, 1, 0), 0);

// Mapa de vecinos: define qué piezas son vecinas legítimas
const pieceNeighborsMap = {
  // Primera fila (0-3)
  0: { right: 1, bottom: 4 },
  1: { left: 0, right: 2, bottom: 5 },
  2: { left: 1, right: 3, bottom: 6 },
  3: { left: 2, bottom: 7 },
  
  // Segunda fila (4-7)
  4: { top: 0, right: 5, bottom: 8 },
  5: { top: 1, left: 4, right: 6, bottom: 9 },
  6: { top: 2, left: 5, right: 7, bottom: 10 },
  7: { top: 3, left: 6, bottom: 11 },
  
  // Tercera fila (8-11)
  8: { top: 4, right: 9 },
  9: { top: 5, left: 8, right: 10 },
  10: { top: 6, left: 9, right: 11 },
  11: { top: 7, left: 10 }
};

// Función para verificar si dos piezas son vecinas legítimas
const checkPiecesConnection = (piece1Index, piece2Index) => {
  const piece1Neighbors = pieceNeighborsMap[piece1Index];
  if (!piece1Neighbors) return false;
  
  // Comprueba si piece2Index aparece como vecino de piece1Index
  return Object.values(piece1Neighbors).includes(piece2Index);
};

// Función auxiliar para verificar si un punto está dentro de un rectángulo
const isPointInBox = (point, boxCenter, boxDimensions) => {
  const halfWidth = boxDimensions.width / 2;
  const halfHeight = boxDimensions.height / 2;
  
  return (
    point.x >= boxCenter.x - halfWidth &&
    point.x <= boxCenter.x + halfWidth &&
    point.z >= boxCenter.z - halfHeight &&
    point.z <= boxCenter.z + halfHeight
  );
};

function Cube({ puzzleCompleted, setPuzzleCompleted, soundEnabled }) {
  // Estado para rastrear las piezas
  const [pieces, setPieces] = useState([]);
  const [snappedPieces, setSnappedPieces] = useState({});

  // Detectar si es un dispositivo móvil (movido al inicio del componente)
  const isMobileDevice = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    
    // Incluir detección más específica para iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    const result = isIOS || 
            /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
            
    console.log("Device detection:", { isIOS, isMobile: result, userAgent: navigator.userAgent });
    return result;
  }, []);

  // State for managing group dragging
  const [draggedGroupInfo, setDraggedGroupInfo] = useState({
     groupId: null,
     basePieceIndex: null, // Which piece in the group was initially clicked
     pointerOffset: new Vector3(), // Offset from the clicked piece's origin to the pointer intersection
     offsets: {}, // Relative offsets of each piece_index in the group from the basePieceIndex origin { index: Vector3, ... }
     targetPositions: {}, // Calculated target positions during drag { index: Vector3, ... }
     isActive: false
  });
  
  // State for managing piece selection
  const [selectedPieceInfo, setSelectedPieceInfo] = useState({
    isActive: false,
    basePieceIndex: -1,
    groupId: -1,
    offsets: {}, // Relative offsets of each piece from the base piece
    sourcePositions: {}, // Original positions before selection
    isAnimating: false // Whether pieces are currently animating
  });
  
  // Get necessary three.js elements from the hook at the top level
  const { camera, raycaster, mouse } = useThree();

  // --- Sound Management ---
  const audioListener = useMemo(() => new AudioListener(), []);
  const pickSound = useSound(SOUNDS.PICK, 0.5, audioListener);
  const dropSound = useSound(SOUNDS.DROP, 0.5, audioListener);
  const snapSound = useSound(SOUNDS.SNAP, 0.5, audioListener);
  const victorySound = useSound(SOUNDS.VICTORY, 0.5, audioListener);
  
  // Función auxiliar para reproducir sonidos de forma segura (mejorada para iOS)
  const playSoundSafely = useCallback((sound, delay = 0) => {
    if (!sound || !soundEnabled) return;
    
    // Helper to actually play
    const play = () => {
    try {
        if (!sound || !sound.buffer) {
          console.warn('Sound buffer not ready for:', sound);
        return;
      }
      
        // Para iOS, necesitamos desvincular el sonido del audio context y recrearlo cada vez
        if (isMobileDevice) {
          console.log('Playing sound on iOS device');
          
          // Crear un elemento HTML Audio (compatible con iOS)
          const audioElement = new Audio();
          
          // Determinar qué archivo de sonido reproducir basado en el sonido pasado
          let soundFile = SOUNDS.PICK; // Default
          if (sound === snapSound) soundFile = SOUNDS.SNAP;
          if (sound === dropSound) soundFile = SOUNDS.DROP;
          if (sound === victorySound) soundFile = SOUNDS.VICTORY;
          
          audioElement.src = soundFile;
          audioElement.volume = 0.5;
          
          // En iOS necesitamos una promesa para reproducir después de la interacción del usuario
          const playPromise = audioElement.play();
          
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              console.warn('Error playing audio on iOS:', error);
            });
          }
        } else {
          // Método original para navegadores de escritorio
      if (sound.isPlaying) {
        sound.stop();
      }
      sound.play();
        }
    } catch (error) {
      console.warn('Error playing sound:', error);
    }
  };
  
    if (delay > 0) {
      setTimeout(play, delay);
    } else {
      play();
    }
  }, [soundEnabled, isMobileDevice, pickSound, snapSound, dropSound, victorySound]);

  // Ensure listener is added to the camera
  useEffect(() => {
    if (!soundEnabled) return;
    
    // Para iOS, precargamos todos los sonidos
    if (isMobileDevice) {
      console.log('Preloading audio for iOS device');
      // Cargar los archivos de audio en un arreglo para inicializar el contexto de audio
      const audioFiles = Object.values(SOUNDS);
      audioFiles.forEach(file => {
        const audio = new Audio();
        audio.src = file;
        // Establecer el atributo preload
        audio.preload = 'auto';
        // Cargar el audio (pero no reproducirlo)
        audio.load();
      });
      
      // Inicializar audio con un toque del usuario en iOS
      const initAudio = () => {
        // Crear y reproducir un sonido silencioso para inicializar el audio
        const silentSound = new Audio();
        silentSound.src = 'data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
        silentSound.play().catch(e => console.log('Silent sound failed to play:', e));
        
        // Eliminar el listener después de la inicialización
        document.removeEventListener('touchstart', initAudio);
        document.removeEventListener('mousedown', initAudio);
      };
      
      // Inicializar con el primer toque o clic
      document.addEventListener('touchstart', initAudio, false);
      document.addEventListener('mousedown', initAudio, false);
    } else {
      // Comportamiento original para desktop
      const currentCamera = camera;
      try {
        if (!currentCamera.children.includes(audioListener)) {
          currentCamera.add(audioListener);
          console.log("AudioListener added to camera.");
        }
    } catch (error) {
      console.warn('Error adding audio listener to camera:', error);
      }
    }
    
    // Cleanup function
    return () => {
      if (!isMobileDevice) {
      try {
          if (camera && camera.children.includes(audioListener)) {
        camera.remove(audioListener);
            console.log("AudioListener removed from camera.");
          }
      } catch (error) {
          console.warn('Error cleaning up audio listener:', error);
        }
      }
    };
  }, [audioListener, camera, soundEnabled, isMobileDevice]);
  // --- End Sound Management ---

  // Configuración del puzzle
  const puzzleWidth = 6;  // Aumentado para 4 columnas
  const puzzleHeight = 4.5;  // Aumentado para 3 filas
  const gapSize = 0.2; // Espacio entre piezas
  
  // Dimensiones de cada pieza (4x3 grid)
  const pieceWidth = (puzzleWidth - gapSize) / 4;
  const pieceHeight = (puzzleHeight - gapSize) / 3;
  
  // Posición central de la caja del puzzle
  const puzzleBoxPos = useMemo(() => new Vector3(0, 0, 0), []);
  const puzzleBoxDim = useMemo(() => ({ width: puzzleWidth, height: puzzleHeight }), [puzzleWidth, puzzleHeight]);
  
  // Posiciones correctas de las piezas en la caja
  const correctPositions = useMemo(() => {
    // Calculamos el ancho y alto total del puzzle
    const puzzleTotalWidth = pieceWidth * 4;
    const puzzleTotalHeight = pieceHeight * 3;
    
    // Posición inicial (esquina superior izquierda)
    const startX = puzzleBoxPos.x - puzzleTotalWidth/2 + pieceWidth/2;
    const startZ = puzzleBoxPos.z - puzzleTotalHeight/2 + pieceHeight/2;
    
    // Array para las 12 posiciones (4x3 grid)
    const positions = [];
    
    // Generamos las posiciones en un grid de 4x3
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const x = startX + col * pieceWidth;
        const z = startZ + row * pieceHeight;
        positions.push(new Vector3(x, 0.101, z));
      }
    }
    
    return positions;
  }, [pieceWidth, pieceHeight, puzzleBoxPos]);
  
  // Colores para las piezas (caras laterales)
  const colors = [
    0xff0000, // rojo
    0x00ff00, // verde
    0x0000ff, // azul
    0xffff00, // amarillo
    0xff00ff, // magenta
    0x00ffff, // cian
    0xff8000, // naranja
    0x8000ff, // púrpura
    0x00ff80, // verde menta
    0x0080ff, // azul celeste
    0x808080, // gris
    0xffffff  // blanco
  ];
  
  // Definir las conexiones entre piezas
  // 1 = protuberancia, -1 = hendidura, 0 = borde recto
  const connectionsMap = [
    // Primera fila (0-3)
    { left: 0, right: -1, top: 0, bottom: 1 },    // Pieza 0
    { left: 1, right: -1, top: 0, bottom: -1 },   // Pieza 1
    { left: 1, right: -1, top: 0, bottom: 1 },    // Pieza 2
    { left: 1, right: 0, top: 0, bottom: -1 },    // Pieza 3
    
    // Segunda fila (4-7)
    { left: 0, right: 1, top: -1, bottom: 1 },    // Pieza 4
    { left: -1, right: 1, top: 1, bottom: -1 },   // Pieza 5
    { left: -1, right: 1, top: -1, bottom: 1 },   // Pieza 6
    { left: -1, right: 0, top: 1, bottom: -1 },   // Pieza 7
    
    // Tercera fila (8-11)
    { left: 0, right: -1, top: -1, bottom: 0 },   // Pieza 8
    { left: 1, right: -1, top: 1, bottom: 0 },    // Pieza 9
    { left: 1, right: -1, top: -1, bottom: 0 },   // Pieza 10
    { left: 1, right: 0, top: 1, bottom: 0 }      // Pieza 11
  ];
  
  // Inicializar las piezas si es necesario
  useEffect(() => {
    // Check if pieces need initialization (e.g., empty or after reset)
    if (pieces.length === 0 && !puzzleCompleted) { // Added !puzzleCompleted check to avoid re-init after win
      console.log("Inicializando piezas del puzzle");
      // Crear las piezas con posiciones aleatorias
      const initialPieces = Array.from({ length: 12 }).map((_, i) => {
         // Crear una distribución circular alrededor del tablero
         const angle = (i * Math.PI / 6) + (Math.random() * 0.5); // 12 piezas = 2π/12 = π/6 por pieza
         const radius = 5 + Math.random() * 1.5; // Distancia desde el centro
         
         // Calcular posición en coordenadas cartesianas
         const spawnX = Math.cos(angle) * radius;
         const spawnZ = Math.sin(angle) * radius;
         
         // Calcular fila y columna para la textura
         const rowIndex = Math.floor(i / 4); // 0, 1 o 2 para las tres filas
         const colIndex = i % 4; // 0, 1, 2 o 3 para las cuatro columnas

         return {
            // Keep original props
            textureOffset: new Vector2(colIndex / 4, rowIndex / 3),
            textureSize: new Vector2(1/4, 1/3),
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
  }, [pieces.length, colors, connectionsMap, pieceWidth, pieceHeight, puzzleCompleted]);
  
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
    if (!droppedPiece) return; // Early return if piece doesn't exist
    
    // 1. Determinar si la pieza está dentro de la caja del puzzle (si es así, marcarla como isPlacedInBox)
    const isInsideBox = isPointInBox(
        finalDropPosition, 
        puzzleBoxPos, 
        { width: puzzleBoxDim.width, height: puzzleBoxDim.height }
    );
    
    // 2. Comprobar si debe hacer "snap" con una pieza vecina (si es así, moverla a una posición exacta)
    let bestDistance = Infinity;
    let bestNeighbor = null;
    let bestSnapPosition = null;
    let neighborToSnapTo = null;
    let didSnap = false; // Inicializar explícitamente a false
    
    // Si no está dentro de la caja, no verificamos snap (early return)
    if (!isInsideBox) {
        setPieces(currentPieces => {
            const newPieces = [...currentPieces];
            
            // Actualizar estado de la pieza
            newPieces[droppedPieceIndex] = {
                ...newPieces[droppedPieceIndex],
                position: finalDropPosition, // Actualizar la posición
                isPlacedInBox: false // Marcar como fuera de la caja
            };
            
            return newPieces;
        });
        return;
    }
    
    // 3. Buscar piezas vecinas a las que podría hacer snap
    // 2A. Primero, comprobar si la pieza puede hacer snap con alguna de sus piezas vecinas válidas
    // según la matriz de relaciones del puzzle (solo dentro de la caja del puzzle)
    const currentPiece = pieces[droppedPieceIndex];
    const currentPieceGroupId = currentPiece.groupId;
    
    // Tolerancias para snap
    const horizontalTolerance = pieceWidth * 1.2; // Aumentado para mayor tolerancia
    const verticalTolerance = pieceHeight * 1.2; // Aumentado para mayor tolerancia
    const minHorizontalDistance = pieceWidth * 0.05; // Reducido para permitir piezas más cercanas
    const minVerticalDistance = pieceHeight * 0.05; // Reducido para permitir piezas más cercanas
    
    // Verificar piezas vecinas según el diseño del puzzle (Estrategia: buscar piezas a las que
    // debería conectarse según el diseño)
    const neighbors = pieceNeighborsMap[droppedPieceIndex];
    if (neighbors) {
        console.log(`Checking snap for piece ${droppedPieceIndex}, neighbors:`, neighbors);
        const directionChecks = Object.entries(neighbors);
        
        for (const [direction, neighborIndex] of directionChecks) {
            const neighborPiece = pieces[neighborIndex];
            
            // Descartar caso si el vecino no existe o es del mismo grupo ya
            if (!neighborPiece || neighborPiece.groupId === currentPieceGroupId) {
                console.log(`Skipping neighbor ${neighborIndex}: ${!neighborPiece ? 'does not exist' : 'already in same group'}`);
                continue;
            }
            
            // Solo considerar vecinos que estén en la caja del puzzle
            if (!neighborPiece.isPlacedInBox) {
                console.log(`Skipping neighbor ${neighborIndex}: not in box`);
                continue;
            }
            
            // Crear un nuevo vector para evitar interferencias con otros cálculos
            const vecToPiece = new Vector3().subVectors(finalDropPosition, neighborPiece.position);
            
            console.log(`Checking neighbor ${neighborIndex} in direction ${direction}, vector: [${vecToPiece.x.toFixed(2)}, ${vecToPiece.z.toFixed(2)}]`);
            
            // Para conexiones horizontales (left/right)
            if (direction === 'left' || direction === 'right') {
                // Verificar que la separación en Z (vertical) es pequeña
                if (Math.abs(vecToPiece.z) > verticalTolerance) {
                    console.log(`Vertical separation too large: ${Math.abs(vecToPiece.z).toFixed(2)} > ${verticalTolerance.toFixed(2)}`);
                    continue;
                }
                
                // Calcular la distancia real en X (horizontal)
                const horizontalDistance = Math.abs(vecToPiece.x);
                
                console.log(`Horizontal check with piece ${neighborIndex} (${direction}): distance=${horizontalDistance.toFixed(2)}, tolerance=${horizontalTolerance.toFixed(2)}, minDistance=${minHorizontalDistance.toFixed(2)}`);
                
                // Verificar que la pieza esté en el lado correcto según la matriz
                // Si direction es 'left', el vecino debe estar a la izquierda, por lo que el vector debe apuntar a la derecha (x positivo)
                // Si direction es 'right', el vecino debe estar a la derecha, por lo que el vector debe apuntar a la izquierda (x negativo)
                const isCorrectSide = (direction === 'left' && vecToPiece.x > 0) || 
                                      (direction === 'right' && vecToPiece.x < 0);
                
                if (!isCorrectSide) {
                    console.log(`Skipping snap: piece ${droppedPieceIndex} is not on the correct side (${direction}) of piece ${neighborIndex}. x=${vecToPiece.x.toFixed(2)}`);
                    continue; // Usar continue en lugar de return para seguir verificando otras piezas
                }
                
                // Si está dentro de la tolerancia, no demasiado cerca y es mejor que la anterior
                if (horizontalDistance < horizontalTolerance && 
                    horizontalDistance > minHorizontalDistance &&
                    horizontalDistance < bestDistance) {
                    bestDistance = horizontalDistance;
                    bestNeighbor = neighborPiece;
                    neighborToSnapTo = neighborIndex;
                    
                    // Calcular posición exacta de snap
                    bestSnapPosition = new Vector3().copy(neighborPiece.position);
                    
                    // Ajustar X según dirección
                    if (direction === 'left') { // Si el vecino debe estar a la izquierda
                        bestSnapPosition.x += pieceWidth;
                    } else { // Si el vecino debe estar a la derecha
                        bestSnapPosition.x -= pieceWidth;
                    }
                    
                    console.log(`Found potential horizontal snap at ${bestSnapPosition.x.toFixed(2)}, ${bestSnapPosition.z.toFixed(2)}`);
                }
            }
            // Para conexiones verticales (top/bottom)
            else if (direction === 'top' || direction === 'bottom') {
                // Verificar que la separación en X (horizontal) es pequeña
                if (Math.abs(vecToPiece.x) > horizontalTolerance) {
                    console.log(`Horizontal separation too large: ${Math.abs(vecToPiece.x).toFixed(2)} > ${horizontalTolerance.toFixed(2)}`);
                    continue;
                }
                
                // Calcular la distancia real en Z (vertical)
                const verticalDistance = Math.abs(vecToPiece.z);
                
                console.log(`Vertical check with piece ${neighborIndex} (${direction}): distance=${verticalDistance.toFixed(2)}, tolerance=${verticalTolerance.toFixed(2)}, minDistance=${minVerticalDistance.toFixed(2)}`);
                
                // Verificar que la pieza esté en el lado correcto según la matriz
                // La relación es desde la perspectiva del vecino, no de la pieza que estamos moviendo
                // Si direction es 'top', significa que el vecino considera a nuestra pieza como "arriba",
                // por lo que debemos estar por encima (z menor, vector negativo)
                // Si direction es 'bottom', significa que el vecino considera a nuestra pieza como "abajo",
                // por lo que debemos estar por debajo (z mayor, vector positivo)
                const isCorrectSide = (direction === 'top' && vecToPiece.z < 0) || 
                                      (direction === 'bottom' && vecToPiece.z > 0);
                
                if (!isCorrectSide) {
                    console.log(`Skipping snap: piece ${droppedPieceIndex} is not on the correct side (${direction}) of piece ${neighborIndex}. z=${vecToPiece.z.toFixed(2)}`);
                    continue; // Usar continue en lugar de return para seguir verificando
                }
                
                // Si está dentro de la tolerancia, no demasiado cerca y es mejor que la anterior
                if (verticalDistance < verticalTolerance && 
                    verticalDistance > minVerticalDistance &&
                    verticalDistance < bestDistance) {
                    bestDistance = verticalDistance;
                    bestNeighbor = neighborPiece;
                    neighborToSnapTo = neighborIndex;
                    
                    // Calcular posición exacta de snap
                    bestSnapPosition = new Vector3().copy(neighborPiece.position);
                    
                    // Ajustar Z según dirección - CORREGIDO
                    if (direction === 'top') { // Si el vecino está en dirección 'top', significa que debe ir ARRIBA de él
                        // Si la pieza vecina dice que somos "top", significa que somos su vecino SUPERIOR
                        // Por lo tanto, debemos colocarnos ARRIBA del vecino (z menor)
                        bestSnapPosition.z -= pieceHeight; // RESTAR para mover hacia arriba
                        console.log(`FIXED: Piece should go ABOVE neighbor (${direction}) - Z decreased to ${bestSnapPosition.z.toFixed(2)}`);
                    } else if (direction === 'bottom') { // Si el vecino está en dirección 'bottom', significa que debe ir DEBAJO de él
                        // Si la pieza vecina dice que somos "bottom", significa que somos su vecino INFERIOR
                        // Por lo tanto, debemos colocarnos DEBAJO del vecino (z mayor)
                        bestSnapPosition.z += pieceHeight; // SUMAR para mover hacia abajo
                        console.log(`FIXED: Piece should go BELOW neighbor (${direction}) - Z increased to ${bestSnapPosition.z.toFixed(2)}`);
                    }
                    
                    console.log(`Found potential vertical snap at ${bestSnapPosition.x.toFixed(2)}, ${bestSnapPosition.z.toFixed(2)}`);
                }
            }
        }
    }

    // Comprobar si se encontró un snap válido
    if (bestNeighbor && bestSnapPosition) {
        didSnap = true;
        console.log(`Piece ${droppedPieceIndex} will snap to neighbor ${pieces.indexOf(bestNeighbor)} at position ${bestSnapPosition.x.toFixed(2)}, ${bestSnapPosition.z.toFixed(2)}`);
    } else {
        console.log(`No valid snap found for piece ${droppedPieceIndex}`);
    }

    // 4. Actualizar estado para la pieza/grupo
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
                const basePieceOffset = new Vector3().subVectors(bestSnapPosition, finalDropPosition);
                basePieceOffset.y = 0; // Solo movimiento planar
                
                console.log(`Applying snap offset: ${basePieceOffset.x.toFixed(2)}, ${basePieceOffset.z.toFixed(2)} to group ${droppedGroupId}`);
                
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
                if (neighborToSnapTo !== null && bestNeighbor && bestNeighbor.groupId !== droppedGroupId) {
                    console.log(`Merging group ${droppedGroupId} into group ${bestNeighbor.groupId}`);
                    const targetGroupId = bestNeighbor.groupId;
                    // Asignar todas las piezas al mismo grupo ahora mismo
                    groupIndices.forEach(idx => {
                        newPieces[idx].groupId = targetGroupId;
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
            
            // Verificar inmediatamente si el puzzle está completado
            if (newPieces[droppedPieceIndex].isPlacedInBox) {
                // Contar cuántas piezas están en el grupo principal y están en la caja
                const groupId = newPieces[droppedPieceIndex].groupId;
                if (groupId !== undefined) {
                    const piecesInMainGroup = newPieces.filter(p => 
                        p.groupId === groupId && p.isPlacedInBox
                    ).length;
                    
                    console.log(`Verificación inmediata: ${piecesInMainGroup}/${newPieces.length} piezas en grupo principal`);
                    
                    // Si todas las piezas están en el mismo grupo, activar victoria inmediatamente
                    if (piecesInMainGroup === newPieces.length && !puzzleCompleted) {
                        console.log("¡PUZZLE COMPLETADO INMEDIATAMENTE!");
                        // No podemos llamar a setPuzzleCompleted aquí directamente
                        // Lo haremos en un setTimeout para evitar conflictos de estado
                        setTimeout(() => {
                            setPuzzleCompleted(true);
                            playSoundSafely(victorySound);
                        }, 10);
                    }
                }
            }
            
            return newPieces;
        });
    }

    // 5. Reproducir sonido cuando hay snap
    if (didSnap && bestNeighbor) {
        console.log(`Playing snap sound for piece ${droppedPieceIndex}`);
        playSoundSafely(snapSound);
    } else {
        // Si no hubo snap pero se soltó la pieza, NO reproducir ningún sonido
        console.log(`No snap detected, piece ${droppedPieceIndex} dropped silently`);
        // Eliminada la reproducción del sonido de caída (dropSound)
    }

  }, [pieces, puzzleBoxPos, puzzleBoxDim, pieceWidth, pieceHeight, snapSound, playSoundSafely, puzzleCompleted, victorySound, soundEnabled]);

  // --- Drag Handlers ---
  const handleGroupDragStart = useCallback((index, groupId, pointerPosition) => {
    // Verificar que el índice sea válido
    if (index < 0 || index >= pieces.length) {
      console.error(`Invalid piece index: ${index}`);
      return;
    }
    
    console.log(`iOS Debug - Starting drag for piece ${index} at position:`, pointerPosition);
    
    const basePiece = pieces[index];
    if (!basePiece) {
      console.error(`Piece at index ${index} does not exist`);
      return;
    }
    
    // Calculate offset del puntero desde la base de la pieza
    // Esto se usará para mantener la posición relativa mientras se arrastra
    const pointerOffset = new Vector3().subVectors(pointerPosition, basePiece.position);
    
    // Importante: pointerOffset.y debe ser 0 para mantener el movimiento planar
    pointerOffset.y = 0;
    
    console.log(`Drag offset from piece:`, { x: pointerOffset.x, z: pointerOffset.z });
    
    // Rastrear todos los miembros del grupo y sus offsets relativos a la pieza base
    const groupMemberOffsets = {};
    const initialTargetPositions = {};
    
    // Encontrar todas las piezas del mismo grupo
    pieces.forEach((p, i) => {
      if (p.groupId === groupId) {
        // Calcular offset de cada pieza relativo a la pieza base
        // offset = posición_base - posición_pieza  
        const offset = new Vector3().subVectors(p.position, basePiece.position);
        groupMemberOffsets[i] = offset;
        initialTargetPositions[i] = p.position.clone(); // Iniciar targets en posiciones actuales
        
        console.log(`Group member ${i} offset:`, { x: offset.x.toFixed(2), z: offset.z.toFixed(2) });
      }
    });
    
    // Establecer estado para iniciar el arrastre
    setDraggedGroupInfo({
      groupId: groupId,
      basePieceIndex: index,
      pointerOffset: pointerOffset,
      offsets: groupMemberOffsets,
      targetPositions: initialTargetPositions,
      isActive: true
    });
    
    console.log(`Drag started for group ${groupId} with base piece ${index}`);
  }, [pieces]);

  // Función para manejar el movimiento durante el arrastre de un grupo
  const handleGroupDrag = useCallback((pointerIntersection) => {
    if (!draggedGroupInfo.isActive) return;
    
    const { groupId, basePieceIndex, pointerOffset, offsets } = draggedGroupInfo;
    
    // Calculate donde debería estar la pieza base al restar el offset del puntero
    const targetBasePiecePosition = new Vector3()
      .copy(pointerIntersection)
      .sub(pointerOffset);
    
    // Fijar Y a 0.101 (altura del tablero + 0.001)
    targetBasePiecePosition.y = 0.101; 
    
    // Actualizar las posiciones objetivo para todas las piezas del grupo
    const newTargetPositions = { ...draggedGroupInfo.targetPositions };
    
    // Para cada miembro del grupo, calcular su nueva posición basada en el offset desde la base
    Object.entries(offsets).forEach(([pieceIndex, offset]) => {
      const targetPos = new Vector3()
        .copy(targetBasePiecePosition)
        .add(offset);
      
      // Asegurarnos de que Y siempre es 0.101 (justo encima del tablero)
      targetPos.y = 0.101;
      
      // Almacenar la posición objetivo
      newTargetPositions[pieceIndex] = targetPos;
    });
    
    // Actualizar el estado con las nuevas posiciones objetivo
    setDraggedGroupInfo(current => ({
      ...current,
      targetPositions: newTargetPositions
    }));
  }, [draggedGroupInfo]);

  // Add a useFrame hook within Cube to call handleGroupDrag
  useFrame(() => {
    if (draggedGroupInfo.isActive) {
      raycaster.setFromCamera(mouse, camera);
      const intersection = new Vector3();
      // Update target positions if the ray intersects the plane
      if (raycaster.ray.intersectPlane(DRAG_PLANE, intersection)) {
        handleGroupDrag(intersection);
      }
    }
  });

  const audioRefs = useRef({
    pick: pickSound,
    drop: dropSound,
    snap: snapSound,
    victory: victorySound
  });
  
  // Actualizar las referencias cuando cambian
  useEffect(() => {
    audioRefs.current = {
      pick: pickSound,
      drop: dropSound,
      snap: snapSound,
      victory: victorySound
    };
  }, [pickSound, dropSound, snapSound, victorySound]);

  // Manejar fin del arrastre de un grupo
  const handleGroupDragEnd = useCallback((basePieceIndex, pointerPosition) => {
    setDraggedGroupInfo(prev => {
      if (!prev.isActive) return prev;
      
      console.log("Group drag end, basePieceIndex:", basePieceIndex, "in group:", prev.groupId);
      
      // Asegurarse de que este fin de arrastre corresponde al grupo actualmente arrastrado
      if (prev.basePieceIndex !== basePieceIndex) {
        console.log("Ignoring drag end for non-active piece");
        return prev;
      }
      
      const finalPositions = { ...prev.targetPositions };
      
      // Verificar si la pieza puede conectarse con algún vecino
      let didSnap = false;
      if (pointerPosition) {
        didSnap = checkPiecesConnection(
          basePieceIndex, 
          pieces,
          prev.groupId, 
          pointerPosition, 
          audioRefs.current
        );
      }
      
      // Si no hubo snap, restaurar posiciones originales
      if (!didSnap) {
        console.log("No snap detected, returning to original positions");
        playSoundSafely(dropSound);
      }
      
      // Limpiar el estado de arrastre por completo
      // Importante: esto debe hacerse al final del arrastre para evitar estados inconsistentes
      setTimeout(() => {
        setDraggedGroupInfo({
          isActive: false,
          basePieceIndex: -1,
          groupId: -1,
          pointerOffset: { x: 0, z: 0 },
          targetPositions: {},
          offsets: {}
        });
      }, 10); // Un pequeño timeout para asegurar que todo el proceso de fin de arrastre se complete
      
      return {
        ...prev,
        isActive: false, // Marcar inmediatamente como inactivo para evitar interferencias
      };
    });
  }, [pieces, setDraggedGroupInfo, playSoundSafely, checkPiecesConnection]);
  
  // Efecto para asegurarse de que el estado de arrastre se limpia si la ventana pierde el foco
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && draggedGroupInfo.isActive) {
        console.log("Page visibility changed, forcing drag end");
        setDraggedGroupInfo({
          isActive: false,
          basePieceIndex: -1,
          groupId: -1,
          pointerOffset: { x: 0, z: 0 },
          targetPositions: {},
          offsets: {}
        });
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [draggedGroupInfo]);
  
  // Reiniciar el juego
  const handleRestart = useCallback(() => {
    console.log("Ejecutando handleRestart en Cube");
    
    // Primero resetear flags de estado
    setPuzzleCompleted(false);
    setSnappedPieces({});
    
    // Luego, en el siguiente ciclo, limpiar las piezas para forzar reinicialización
    setTimeout(() => {
      setPieces([]); // Clear pieces, useEffect will re-initialize
      // Reset drag info to default state
      setDraggedGroupInfo({ 
        isActive: false, 
        groupId: null, 
        basePieceIndex: null, 
        pointerOffset: new Vector3(), 
        offsets: {}, 
        targetPositions: {} 
      });
    }, 10);
  }, [setPuzzleCompleted]);
  
  // Comprobar si el puzzle está completo
  useEffect(() => {
    // Solo verificar cuando hay piezas colocadas, y el puzzle no está completado aún
    if (pieces.length > 0 && !puzzleCompleted) {
      // Verificar si todas las piezas están en el mismo grupo
      const firstPiece = pieces[0];
      if (firstPiece && firstPiece.groupId !== undefined) {
        const firstGroupId = firstPiece.groupId;
        
        // Contar cuántas piezas están en el grupo principal y están en la caja
        const piecesInMainGroup = pieces.filter(p => 
            p.groupId === firstGroupId && p.isPlacedInBox
        ).length;
        
        console.log(`Comprobando estado puzzle: ${piecesInMainGroup}/${pieces.length} piezas en grupo principal`);
        
        // Si todas las piezas están en el mismo grupo, activar victoria
        if (piecesInMainGroup === pieces.length) {
          console.log("¡PUZZLE COMPLETADO desde useEffect!");
          setPuzzleCompleted(true);
          setSnappedPieces({0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true, 9: true, 10: true, 11: true});
          playSoundSafely(victorySound);
        }
      }
    }
  }, [pieces, puzzleCompleted, victorySound, playSoundSafely, setPuzzleCompleted]);

  // Referencia para funciones estables
  const stableCallbacks = useRef({
    handleRestart: null
  }).current;
  
  // Actualizar referencias de funciones estables cuando cambien
  useEffect(() => {
    stableCallbacks.handleRestart = handleRestart;
  }, [handleRestart]);
  
  // Escuchar evento externo de reseteo del puzzle usando referencias estables
  useEffect(() => {
    const handleResetEvent = () => {
      console.log("Recibido evento de reseteo del puzzle");
      stableCallbacks.handleRestart();
    };
    
    // Agregar el event listener
    window.addEventListener('resetPuzzle', handleResetEvent);
    
    // Limpiar al desmontar
    return () => {
      window.removeEventListener('resetPuzzle', handleResetEvent);
    };
  }, []); // Sin dependencias - usamos referencias estables

  // Función para seleccionar una pieza/grupo
  const handlePieceSelect = useCallback((index, groupId) => {
    // Si ya hay una pieza seleccionada o una animación en curso, ignorar
    if (selectedPieceInfo.isActive || selectedPieceInfo.isAnimating) {
      console.log("Ya hay una pieza seleccionada o animándose, ignorando selección");
          return;
        }
        
    console.log(`Seleccionando pieza ${index} en grupo ${groupId}`);
    
    const basePiece = pieces[index];
    if (!basePiece) {
      console.error(`La pieza con índice ${index} no existe`);
      return;
    }
    
    // Registrar todos los miembros del grupo y sus posiciones
    const groupMemberOffsets = {};
    const sourcePositions = {};
    
    // Encontrar todas las piezas del mismo grupo
    pieces.forEach((p, i) => {
      if (p.groupId === groupId) {
        // Calcular offset desde la pieza base
        const offset = new Vector3().subVectors(p.position, basePiece.position);
        groupMemberOffsets[i] = offset;
        sourcePositions[i] = p.position.clone();
      }
    });
    
    // Elevar todas las piezas del grupo
    const elevatedPositions = {};
    Object.entries(sourcePositions).forEach(([pieceIdx, originalPos]) => {
      elevatedPositions[pieceIdx] = new Vector3(
        originalPos.x,
        0.5, // Elevar 0.5 unidades sobre el tablero
        originalPos.z
      );
    });
    
    // Actualizar el estado de selección
    setSelectedPieceInfo({
      isActive: true,
      basePieceIndex: index,
      groupId: groupId,
      offsets: groupMemberOffsets,
      sourcePositions: sourcePositions,
      targetPositions: elevatedPositions,
      isAnimating: false
    });
    
    // Reproducir sonido de selección
    playSoundSafely(pickSound);
  }, [pieces, selectedPieceInfo, playSoundSafely, pickSound]);

  // Función para manejar el lugar donde se soltará la pieza/grupo
  const handlePlacementPoint = useCallback((pointerPosition) => {
    if (!selectedPieceInfo.isActive || selectedPieceInfo.isAnimating) {
      console.log("No hay pieza seleccionada o hay una animación en curso");
      return;
    }
    
    const { basePieceIndex, groupId, offsets, sourcePositions } = selectedPieceInfo;
    
    console.log(`Colocando pieza ${basePieceIndex} en posición:`, pointerPosition);
    
    // Calcular las posiciones finales para todas las piezas del grupo
    const finalPositions = {};
    
    // La pieza base irá al punto donde se hizo clic
    finalPositions[basePieceIndex] = new Vector3(
      pointerPosition.x,
      0.101, // Altura sobre el tablero
      pointerPosition.z
    );
    
    // El resto de piezas mantendrán su offset respecto a la base
    Object.entries(offsets).forEach(([pieceIdx, offset]) => {
      if (parseInt(pieceIdx) !== basePieceIndex) {
        finalPositions[pieceIdx] = new Vector3()
          .copy(finalPositions[basePieceIndex])
          .add(offset);
        
        // Asegurarse de que la altura es correcta
        finalPositions[pieceIdx].y = 0.101;
      }
    });
    
    // Iniciar la animación de las piezas a sus posiciones finales
    setSelectedPieceInfo(prev => ({
      ...prev,
      targetPositions: finalPositions,
      isAnimating: true,
      animationStartTime: Date.now()
    }));
    
    // IMPORTANTE: Actualizar el estado de las piezas con las nuevas posiciones
    setPieces(currentPieces => {
      const newPieces = [...currentPieces];
      
      // Recorrer todas las piezas del grupo y actualizar sus posiciones
      Object.entries(finalPositions).forEach(([pieceIdx, newPos]) => {
        const idx = parseInt(pieceIdx);
        newPieces[idx] = {
          ...newPieces[idx],
          position: newPos.clone()
        };
      });
      
      return newPieces;
    });
    
    // Verificar snap y conexiones después de que la animación termine
    setTimeout(() => {
      // Verificar si la pieza puede conectarse con algún vecino
      let didSnap = false;
      
      if (pointerPosition) {
        // Comprobar si la pieza debe hacer snap con alguna otra
        const isInsideBox = isPointInBox(
          pointerPosition, 
          puzzleBoxPos, 
          { width: puzzleBoxDim.width, height: puzzleBoxDim.height }
        );
        
        if (isInsideBox) {
          // Si está dentro de la caja, actualizar el estado de las piezas
          setPieces(currentPieces => {
            const newPieces = [...currentPieces];
            
            // Recorrer todas las piezas del grupo
            Object.keys(finalPositions).forEach(pieceIdx => {
              const idx = parseInt(pieceIdx);
              newPieces[idx] = {
                ...newPieces[idx],
                isPlacedInBox: true
              };
            });
            
            return newPieces;
          });
          
          // Intentar conectar con piezas vecinas
          const snapCheck = handlePiecePlacement(basePieceIndex, pointerPosition);
          
          // Si no hubo snap, reproducir sonido de soltar
          if (!snapCheck) {
            playSoundSafely(dropSound);
          }
        } else {
          // Si está fuera de la caja, simplemente reproducir sonido de soltar
          playSoundSafely(dropSound);
        }
      }
      
      // Limpiar el estado de selección
      setSelectedPieceInfo({
        isActive: false,
        basePieceIndex: -1,
        groupId: -1,
        offsets: {},
        sourcePositions: {},
        targetPositions: {},
        isAnimating: false
      });
    }, 500); // Tiempo suficiente para que termine la animación
  }, [selectedPieceInfo, puzzleBoxPos, puzzleBoxDim, setPieces, handlePiecePlacement, playSoundSafely, dropSound, isPointInBox]);

  // Plano para detectar clics en el tablero
  const clickPlane = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), []);

  // Manejador de clic global para determinar el punto de colocación
  const handleBoardClick = useCallback((event) => {
    // Solo procesar si hay una pieza seleccionada y no hay animación en curso
    if (!selectedPieceInfo.isActive || selectedPieceInfo.isAnimating) return;
    
    // Evitar que el clic se propague
    event.stopPropagation();
    
    // Calcular la intersección del rayo con el plano
    raycaster.setFromCamera(mouse, camera);
    const intersection = new Vector3();
    
    if (raycaster.ray.intersectPlane(clickPlane, intersection)) {
      handlePlacementPoint(intersection);
    }
  }, [selectedPieceInfo, raycaster, mouse, camera, clickPlane, handlePlacementPoint]);

  // Registrar listener de clic global
  useEffect(() => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.addEventListener('click', handleBoardClick);
      canvas.addEventListener('touchend', (e) => {
        // Para eventos táctiles, convertimos a coordenadas normalizadas
        if (!selectedPieceInfo.isActive || selectedPieceInfo.isAnimating) return;
        
        const touch = e.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        const x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
        
        raycaster.setFromCamera({x, y}, camera);
        const intersection = new Vector3();
        
        if (raycaster.ray.intersectPlane(clickPlane, intersection)) {
          handlePlacementPoint(intersection);
        }
      });
    }
    
    return () => {
      if (canvas) {
        canvas.removeEventListener('click', handleBoardClick);
        canvas.removeEventListener('touchend', handleBoardClick);
      }
    };
  }, [handleBoardClick, selectedPieceInfo, raycaster, camera, clickPlane]);

  // Actualizar las piezas durante la animación
  useFrame(() => {
    if (selectedPieceInfo.isAnimating) {
      // Aquí la animación ya está manejada por react-spring en el componente PuzzlePiece
      // No necesitamos hacer nada específico aquí
    }
  });

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
          key={`${piece.groupId}-${index}`}
          index={index}
          initialPosition={piece.position}
          position={piece.position}
          textureOffset={piece.textureOffset}
          textureSize={piece.textureSize}
          size={piece.size}
          color={piece.color}
          connections={piece.connections}
          isSnapped={piece.isSnapped}
          isPlacedInBox={piece.isPlacedInBox}
          correctPosition={correctPositions[index]}
          soundEnabled={soundEnabled}
          allPieces={pieces}
          pieceWidth={pieceWidth}
          pieceHeight={pieceHeight}
          checkPiecesConnection={checkPiecesConnection}
          puzzleBoxPosition={puzzleBoxPos}
          puzzleBoxSize={puzzleBoxDim}
          onPieceSelect={handlePieceSelect}
          selectedPieceInfo={selectedPieceInfo}
          pickSound={pickSound}
          playSoundSafely={playSoundSafely}
        />
      ))}
    </group>
  );
}

export default Cube; 