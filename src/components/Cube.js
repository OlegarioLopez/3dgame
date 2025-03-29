import React, { useMemo, useState, useCallback, useEffect } from 'react';
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
  DROP: '/sounds/falled-sound-effect-278635.mp3',
  SNAP: '/sounds/coin-recieved-230517.mp3',
  VICTORY: '/sounds/energy-drink-effect-230559.mp3'
};

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

function Cube({ puzzleCompleted, setPuzzleCompleted, soundEnabled }) {
  // Estado para rastrear las piezas
  const [pieces, setPieces] = useState([]);
  const [snappedPieces, setSnappedPieces] = useState({});

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

  // --- Sound Management ---
  const audioListener = useMemo(() => new AudioListener(), []);
  const pickSound = useSound(SOUNDS.PICK, 0.5, audioListener);
  const dropSound = useSound(SOUNDS.DROP, 0.5, audioListener);
  const snapSound = useSound(SOUNDS.SNAP, 0.5, audioListener);
  const victorySound = useSound(SOUNDS.VICTORY, 0.5, audioListener);
  
  // Función auxiliar para reproducir sonidos de forma segura
  const playSoundSafely = useCallback((sound, delay = 0) => {
    if (!sound || !soundEnabled) return;
    
    // Helper to actually play
    const play = () => {
        try {
            if (!sound || !sound.buffer) {
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
  }, [soundEnabled]);

  // Ensure listener is added to the camera
  useEffect(() => {
    if (!soundEnabled) return;
    
    const currentCamera = camera;
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
          if (currentCamera && currentCamera.children.includes(audioListener)) {
            currentCamera.remove(audioListener);
            console.log("AudioListener removed from camera.");
          }
      } catch (error) {
        console.warn('Error cleaning up audio listener:', error);
      }
    };
  }, [audioListener, camera, soundEnabled]);
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
                    
                    // Verificar que la pieza esté en el lado correcto según la matriz
                    const isCorrectSide = (direction === 'left' && vecToPiece.x > 0) || 
                                         (direction === 'right' && vecToPiece.x < 0);
                    
                    if (!isCorrectSide) {
                        console.log(`Skipping snap: piece ${droppedPieceIndex} is not on the correct side (${direction}) of piece ${neighborIndex}`);
                        return;
                    }
                    
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
                    
                    // Verificar que la pieza esté en el lado correcto según la matriz
                    const isCorrectSide = (direction === 'top' && vecToPiece.z < 0) || 
                                         (direction === 'bottom' && vecToPiece.z > 0);
                    
                    if (!isCorrectSide) {
                        console.log(`Skipping snap: piece ${droppedPieceIndex} is not on the correct side (${direction}) of piece ${neighborIndex}`);
                        return;
                    }
                    
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
                    
                    // Verificar que la pieza esté en el lado correcto según la matriz
                    const isCorrectSide = (connectionDirection === 'left' && vecToPiece.x < 0) || 
                                         (connectionDirection === 'right' && vecToPiece.x > 0);
                    
                    if (!isCorrectSide) {
                        console.log(`Skipping reverse snap: piece ${droppedPieceIndex} is not on the correct side (${connectionDirection}) of piece ${otherIndex}`);
                        return;
                    }
                    
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
                    
                    // Verificar que la pieza esté en el lado correcto según la matriz
                    const isCorrectSide = (connectionDirection === 'top' && vecToPiece.z > 0) || 
                                         (connectionDirection === 'bottom' && vecToPiece.z < 0);
                    
                    if (!isCorrectSide) {
                        console.log(`Skipping reverse snap: piece ${droppedPieceIndex} is not on the correct side (${connectionDirection}) of piece ${otherIndex}`);
                        return;
                    }
                    
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

    // 4. Reproducir sonido CORREGIDO
    if (didSnap && neighborToSnapTo) {
        // Solo reproducir sonido si realmente hizo snap a un vecino
        playSoundSafely(snapSound);
    }

  }, [pieces, puzzleBoxPos, puzzleBoxDim, pieceWidth, pieceHeight, snapSound, playSoundSafely, puzzleCompleted, victorySound]);

  // --- Drag Handlers ---
  const handleGroupDragStart = useCallback((index, groupId, pointerIntersection) => {
     const basePiece = pieces[index];
     // Prevent starting a new drag if one is active, or if the piece/group is invalid
     if (!basePiece || groupId === null || draggedGroupInfo.isActive) return;

     // Calculate offset from pointer to the base piece's origin (on the drag plane)
     const pointerOffset = new Vector3().subVectors(pointerIntersection, basePiece.position);
     pointerOffset.y = 0; // Ignore Y offset for planar dragging

     const groupMemberOffsets = {};
     const initialTargetPositions = {};
     
     // Find all pieces in the same group
     pieces.forEach((p, i) => {
       if (p.groupId === groupId) {
         // Calculate offset de cada pieza relativo a la pieza base
         // Offset = posición_base - posición_pieza
         // Esto representa cuánto hay que mover desde la pieza actual para llegar a la base
         const offset = new Vector3().subVectors(p.position, basePiece.position);
         groupMemberOffsets[i] = offset;
         initialTargetPositions[i] = p.position.clone(); // Start targets at current positions
       }
     });
     
     console.log(`Starting drag for group ${groupId} with base piece ${index}`);
     // Set state to start the drag
     setDraggedGroupInfo({
        groupId: groupId,
        basePieceIndex: index,
        pointerOffset: pointerOffset,
        offsets: groupMemberOffsets,
        targetPositions: initialTargetPositions, // Set initial targets
        isActive: true
     });
  }, [pieces, draggedGroupInfo.isActive]);

  const handleGroupDrag = useCallback((pointerIntersection) => {
     // Update target positions based on mouse movement during an active drag
     if (!draggedGroupInfo.isActive || draggedGroupInfo.groupId === null || !pieces[draggedGroupInfo.basePieceIndex]) return;

     const { basePieceIndex, pointerOffset, offsets, groupId } = draggedGroupInfo;
     const newTargetPositions = {};

     // Calculate new base position based on pointer, elevated during drag
     const newBasePosX = pointerIntersection.x - pointerOffset.x;
     const newBasePosZ = pointerIntersection.z - pointerOffset.z;
     // Keep the group elevated slightly while dragging for visual clarity
     const dragElevation = 0.3; 
     const newBasePos = new Vector3(newBasePosX, dragElevation, newBasePosZ);

     // Primero establecemos la posición de la pieza base
     newTargetPositions[basePieceIndex] = newBasePos.clone();

     // Luego calculamos las posiciones de las demás piezas usando los offsets relativos
     Object.keys(offsets).forEach(indexStr => {
        const index = parseInt(indexStr, 10);
        if (index === basePieceIndex) return; // Ya establecimos la pieza base arriba
         
        const relativeOffset = offsets[index];
        // Añadimos el offset a la posición base - las piezas mantienen su posición relativa
        const targetPos = new Vector3().addVectors(newBasePos, relativeOffset);
        targetPos.y = dragElevation; // Mantener misma elevación para todas las piezas
        newTargetPositions[index] = targetPos;
     });

     // Update the state with new target positions
     setDraggedGroupInfo(prev => ({
        ...prev,
        targetPositions: newTargetPositions
     }));
  }, [draggedGroupInfo, pieces]);

   // Add a useFrame hook within Cube to call handleGroupDrag
   useFrame(() => {
      if (draggedGroupInfo.isActive) {
         raycaster.setFromCamera(mouse, camera);
         const plane = new Plane(new Vector3(0, 1, 0), 0); // Drag plane at Y=0
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

  // Escuchar evento externo de reseteo del puzzle
  useEffect(() => {
    const handleResetEvent = () => {
      console.log("Recibido evento de reseteo del puzzle");
      handleRestart();
    };
    
    // Agregar el event listener
    window.addEventListener('resetPuzzle', handleResetEvent);
    
    // Limpiar al desmontar
    return () => {
      window.removeEventListener('resetPuzzle', handleResetEvent);
    };
  }, [handleRestart]);

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
          onGroupDragStart={handleGroupDragStart}
          onGroupDragEnd={handleGroupDragEnd}
          draggedGroupInfo={draggedGroupInfo}
          pickSound={pickSound}
          playSoundSafely={playSoundSafely}
        />
      ))}
    </group>
  );
}

export default Cube; 