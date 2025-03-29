import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Vector3, TextureLoader, RepeatWrapping, MeshStandardMaterial, BufferAttribute, Matrix4, Plane, Vector2, Shape, ExtrudeGeometry } from 'three';
import { useThree, useFrame, useLoader } from '@react-three/fiber';
import { useSpring, animated } from '@react-spring/three';

// Objetos estáticos compartidos para mejorar el rendimiento
const TEMP_VECTOR_PIECE = new Vector3();
const DRAG_PLANE = new Plane(new Vector3(0, 1, 0), 0);

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
  
  // Preparar hooks y animaciones
  const [spring, api] = useSpring(() => ({
    position: [position.x, position.y, position.z],
    rotation: [Math.PI/2, 0, 0],
    scale: [1, 1, 1],
    config: { mass: 1, tension: 170, friction: 26 }
  }));
  
  // Actualizar spring basado en el estado de arrastre del grupo
  useEffect(() => {
    if (draggedGroupInfo.isActive && draggedGroupInfo.targetPositions[index]) {
      const targetPos = draggedGroupInfo.targetPositions[index];
      api.start({ 
        position: [targetPos.x, targetPos.y, targetPos.z],
        config: { mass: 0.5, tension: 500, friction: 40 } 
      });
    } else {
      api.start({ 
        position: [position.x, position.y, position.z]
      });
    }
  }, [draggedGroupInfo, index, position, api]);
  
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
  
  // Detectar si es un dispositivo móvil
  const isMobileDevice = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    
    // Incluir detección más específica para iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    return isIOS || 
           /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
  }, []);
  
  // Referencia para rastrear si ya comenzó el arrastre en móvil
  const touchDragActive = useRef(false);
  
  // Calcular la intersección del rayo con el plano para eventos táctiles
  const getTouchIntersection = useCallback((e) => {
    // Calcular la posición normalizada del touch
    const touch = e.touches?.[0] || e.changedTouches?.[0];
    const container = document.querySelector('canvas');
    if (!touch || !container) return null;
    
    console.log("Touch detected:", {
      clientX: touch.clientX,
      clientY: touch.clientY,
      container: container.getBoundingClientRect()
    });
    
    const rect = container.getBoundingClientRect();
    
    // Asegurarse de que las coordenadas estén dentro del canvas
    if (touch.clientX < rect.left || touch.clientX > rect.right || 
        touch.clientY < rect.top || touch.clientY > rect.bottom) {
      console.log("Touch outside canvas boundaries");
      return null;
    }
    
    const x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
    
    console.log("Normalized touch coords:", { x, y });
    
    // Configurar el raycaster con la posición táctil
    raycaster.setFromCamera({x, y}, camera);
    
    // Calcular la intersección con el plano
    const intersection = new Vector3();
    const didIntersect = raycaster.ray.intersectPlane(DRAG_PLANE, intersection);
    
    console.log("Ray intersection:", { didIntersect, point: didIntersect ? intersection.toArray() : null });
    
    if (didIntersect) {
      return intersection;
    }
    return null;
  }, [raycaster, camera]);
  
  // Manejadores de eventos para dispositivos móviles
  const onTouchStart = useCallback((e) => {
    console.log("iOS Debug - Touch Start:", { isMobile: isMobileDevice, pieceIndex: index });
    // Importante: usar siempre el manejo táctil en iOS/móviles, sin hacer la verificación
    // if (!isMobileDevice) return;
    
    e.stopPropagation();
    e.preventDefault(); // Prevenir comportamiento predeterminado (scrolling, etc)
    
    const intersection = getTouchIntersection(e);
    console.log("Touch intersection result:", intersection);
    
    if (!intersection) {
      console.log("No intersection found for touch");
      return;
    }
    
    const pieceData = allPieces[index];
    if (pieceData) {
      touchDragActive.current = true;
      setIsDraggingThisPiece(true);
      
      // Iniciar arrastre inmediatamente en móviles
      onGroupDragStart(index, pieceData.groupId, intersection);
      
      // Efecto visual de selección
      api.start({ 
        scale: [1.05, 1.05, 1.05],
        config: { mass: 0.5, tension: 500, friction: 40 } 
      });
      
      // Reproducir sonido
      playSoundSafely(pickSound);
    }
  }, [index, allPieces, onGroupDragStart, api, playSoundSafely, pickSound, getTouchIntersection]);
  
  // Manejar movimiento táctil - necesario para actualizar la posición del puntero
  const onTouchMove = useCallback((e) => {
    if (!touchDragActive.current) return;
    
    e.stopPropagation();
    e.preventDefault(); // Prevenir comportamiento predeterminado (scrolling, etc)
    
    console.log("iOS Debug - Touch Move");
    
    // Forzar la actualización de la posición del mouse
    const intersection = getTouchIntersection(e);
    if (intersection) {
      // Simular el movimiento del mouse actualizando su posición
      const container = document.querySelector('canvas');
      if (container) {
        const rect = container.getBoundingClientRect();
        const touch = e.touches[0] || e.changedTouches[0];
        const mouseX = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Actualizar la posición del mouse en el contexto de ThreeJS
        if (mouse) {
          mouse.x = mouseX;
          mouse.y = mouseY;
        }
      }
    }
  }, [getTouchIntersection, mouse]);
  
  const onTouchEnd = useCallback((e) => {
    if (!touchDragActive.current) return;
    
    e.stopPropagation();
    e.preventDefault(); // Prevenir comportamiento predeterminado
    
    console.log("iOS Debug - Touch End");
    
    touchDragActive.current = false;
    setIsDraggingThisPiece(false);
    
    // Finalizar el arrastre - usar la última posición conocida
    let finalIntersection;
    
    // Intentar obtener la intersección actual si hay touches disponibles
    if (e.changedTouches && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      const container = document.querySelector('canvas');
      if (container) {
        const rect = container.getBoundingClientRect();
        const x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
        
        raycaster.setFromCamera({x, y}, camera);
        finalIntersection = new Vector3();
        const didIntersect = raycaster.ray.intersectPlane(DRAG_PLANE, finalIntersection);
        console.log("Touch end intersection:", { didIntersect, point: didIntersect ? finalIntersection.toArray() : null });
      }
    }
    
    // Si no obtuvimos la intersección desde el touch, intentar con el mouse actual
    if (!finalIntersection) {
      finalIntersection = new Vector3();
      raycaster.setFromCamera(mouse, camera);
      if (!raycaster.ray.intersectPlane(DRAG_PLANE, finalIntersection)) {
        // Si falla, usar la posición actual como fallback
        const lastPos = spring.position.get();
        finalIntersection = new Vector3(lastPos[0], 0.101, lastPos[2]);
        console.log("Using fallback position for touch end:", finalIntersection.toArray());
      }
    }
    
    // Finalizar el arrastre con la intersección calculada
    onGroupDragEnd(index, finalIntersection);
    
    // Restaurar escala normal
    api.start({ 
      scale: [1, 1, 1],
      config: { mass: 1, tension: 170, friction: 26 }
    });
  }, [
    index, 
    onGroupDragEnd, 
    api, 
    raycaster, 
    camera, 
    mouse, 
    spring.position
  ]);

  // Manejadores de eventos simplificados para desktop
  const onPointerDown = useCallback((e) => {
    e.stopPropagation();
    console.log("onPointerDown", index); // Debug
    const pieceData = allPieces[index];
    if (pieceData) {
      console.log("Setting isDraggingThisPiece to true for", index); // Debug
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
      const finalIntersection = new Vector3();
      if (raycaster.ray.intersectPlane(DRAG_PLANE, finalIntersection)) {
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

  return (
    <animated.mesh 
      ref={meshRef} 
      position={spring.position}
      rotation={spring.rotation}
      scale={spring.scale}
      geometry={puzzleGeometry}
      userData={{ type: 'puzzlePiece', index, groupId: allPieces[index]?.groupId }}
      // Usar AMBOS sistemas de eventos para máxima compatibilidad
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      // Agregar eventos táctiles específicos para móviles
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onClick={(e) => {
        console.log("Click on piece", index);
        e.stopPropagation();
      }}
    >
      <primitive object={materials} attach="material" />
    </animated.mesh>
  );
}

// Envolvemos el componente con React.memo para evitar renderizados innecesarios
export default React.memo(PuzzlePiece); 