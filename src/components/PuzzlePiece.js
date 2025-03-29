import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Vector3, TextureLoader, RepeatWrapping, MeshStandardMaterial, BufferAttribute, Matrix4, Plane, Vector2, Shape, ExtrudeGeometry } from 'three';
import { useThree, useFrame, useLoader } from '@react-three/fiber';
import { useSpring, animated } from '@react-spring/three';

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
    
    // Clasificar las caras para aplicar materiales correctamente
    // Esto ayudará a determinar qué partes deberían tener la textura
    const materialGroups = [];
    let currentMaterial = -1;
    
    for (let i = 0; i < count; i++) {
      tempVector.set(
        positionAttribute.getX(i),
        positionAttribute.getY(i),
        positionAttribute.getZ(i)
      );
      
      // Aplicar transformación para simular la rotación final
      tempVector.applyMatrix4(transformMatrix);
      
      // Detectamos la cara frontal (que es la original con y=0 antes de la extrusión)
      // y el bisel asociado a esta cara
      const isFrontFace = Math.abs(tempVector.y) < 0.01; // La cara frontal tiene y ≈ 0
      const isFrontBevel = tempVector.y > -0.02 && tempVector.y < 0.01; // El bisel de la cara frontal
      
      if (isFrontFace || isFrontBevel) {
        // Normalizar las coordenadas al rango 0-1 para esta cara y el bisel
        const normalizedX = (tempVector.x + size.x/2) / size.x;
        const normalizedZ = (tempVector.z + size.y/2) / size.y;
        
        // Asignar UVs directas sin multiplicar por textureSize o sumar textureOffset
        // esos ajustes se harán en la textura directamente
        uvs[i * 2] = normalizedX;
        uvs[i * 2 + 1] = normalizedZ;
        
        // Marcar estos vértices para usar el material 0 (con textura)
        if (currentMaterial !== 0) {
          if (currentMaterial !== -1) {
            // Cerrar el grupo anterior
            materialGroups[materialGroups.length - 1].count = i - materialGroups[materialGroups.length - 1].start;
          }
          // Iniciar nuevo grupo
          materialGroups.push({
            start: i,
            count: 0,
            materialIndex: 0
          });
          currentMaterial = 0;
        }
      } else {
        // Para las demás caras, usar UVs que no mapeen a la textura
        // Estas coordenadas no importan mucho ya que usarán el material sólido
        uvs[i * 2] = 0;
        uvs[i * 2 + 1] = 0;
        
        // Marcar estos vértices para usar el material 1 (gris oscuro)
        if (currentMaterial !== 1) {
          if (currentMaterial !== -1) {
            // Cerrar el grupo anterior
            materialGroups[materialGroups.length - 1].count = i - materialGroups[materialGroups.length - 1].start;
          }
          // Iniciar nuevo grupo
          materialGroups.push({
            start: i,
            count: 0,
            materialIndex: 1
          });
          currentMaterial = 1;
        }
      }
    }
    
    // Cerrar el último grupo
    if (materialGroups.length > 0) {
      materialGroups[materialGroups.length - 1].count = count - materialGroups[materialGroups.length - 1].start;
    }
    
    // Asignar los grupos de materiales a la geometría
    materialGroups.forEach(group => {
      geometry.addGroup(group.start, group.count, group.materialIndex);
    });
    
    // Asignar los UVs a la geometría
    geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
    geometry.attributes.uv.needsUpdate = true;
    
    return geometry;
  }, [puzzleShape, size]);
  
  // Crear materiales
  const materials = useMemo(() => {
    // Material para la cara superior con textura
    const topMaterial = new MeshStandardMaterial({
      color: 0xffffff,
      map: clonedTexture,
      roughness: 0.5,
      metalness: 0.1
    });
    
    // Material para los lados y cara inferior (gris oscuro)
    const sideMaterial = new MeshStandardMaterial({
      color: 0x333333, // Gris oscuro
      roughness: 0.7,
      metalness: 0.1
    });
    
    // Devolver un array con solo los dos materiales necesarios
    return [topMaterial, sideMaterial];
  }, [clonedTexture]);
  
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
      const plane = new Plane(new Vector3(0, 1, 0), 0);
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

export default PuzzlePiece; 