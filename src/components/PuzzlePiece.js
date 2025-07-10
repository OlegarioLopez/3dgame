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
  onPieceSelect,
  selectedPieceInfo,
  // Sound props from Cube
  pickSound,
  playSoundSafely 
}) {
  const meshRef = useRef();
  const { camera, raycaster, mouse } = useThree();
  
  // Carga la textura desde public/4.jpg
  const texture = useLoader(TextureLoader, '/4.jpg');
  
  // Configuramos la textura para mostrar solo una porción
  const clonedTexture = texture.clone();
  clonedTexture.wrapS = RepeatWrapping;
  clonedTexture.wrapT = RepeatWrapping;
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
  
  // Función para verificar si esta pieza está seleccionada
  const isSelected = useMemo(() => {
    if (!selectedPieceInfo.isActive) return false;
    
    // Verificar si esta pieza es la base seleccionada o parte del grupo seleccionado
    const pieceData = allPieces[index];
    return pieceData && 
           pieceData.groupId === selectedPieceInfo.groupId;
  }, [selectedPieceInfo, allPieces, index]);
  
  // Calcular la posición actual basada en el estado de selección
  const currentPosition = useMemo(() => {
    if (isSelected && selectedPieceInfo.targetPositions && selectedPieceInfo.targetPositions[index]) {
      return selectedPieceInfo.targetPositions[index];
    }
    return position;
  }, [isSelected, selectedPieceInfo, index, position]);
  
  // Preparar hooks y animaciones
  const [spring, api] = useSpring(() => ({
    position: [position.x, position.y, position.z],
    rotation: [Math.PI/2, 0, 0],
    scale: [1, 1, 1],
    config: { mass: 1, tension: 170, friction: 26 }
  }));
  
  // Actualizar spring basado en el estado de selección
  useEffect(() => {
    if (isSelected) {
      const targetPos = selectedPieceInfo.targetPositions[index];
      if (targetPos) {
        api.start({ 
          position: [targetPos.x, targetPos.y, targetPos.z],
          scale: [1.05, 1.05, 1.05],
          config: { mass: 0.8, tension: 300, friction: 28 } 
        });
      }
    } else {
      api.start({ 
        position: [position.x, position.y, position.z],
        scale: [1, 1, 1],
        config: { mass: 1, tension: 170, friction: 26 } 
      });
    }
  }, [isSelected, selectedPieceInfo, index, position, api]);
  
  // Detectar si es un dispositivo móvil
  const isMobileDevice = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    return isIOS || 
           /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
  }, []);
  
  // Manejador de clic/toque para seleccionar la pieza
  const handleSelect = useCallback((e) => {
    e.stopPropagation(); // Detener propagación para evitar que se active el canvas
    
    // Verificar si ya está seleccionada o está en animación
    if (isSelected || (selectedPieceInfo.isActive && selectedPieceInfo.isAnimating)) {
      console.log("Pieza ya seleccionada o animándose");
      return;
    }
    
    console.log(`Seleccionando pieza ${index}`);
    
    // Llamar a la función de selección en el componente padre
    const pieceData = allPieces[index];
    if (pieceData) {
      onPieceSelect(index, pieceData.groupId);
    }
  }, [index, isSelected, selectedPieceInfo, allPieces, onPieceSelect]);

  return (
    <animated.mesh 
      ref={meshRef} 
      position={spring.position}
      rotation={spring.rotation}
      scale={spring.scale}
      geometry={puzzleGeometry}
      userData={{ type: 'puzzlePiece', index, groupId: allPieces[index]?.groupId }}
      // Usar eventos de clic y toque para selección
      onClick={handleSelect}
      onPointerDown={handleSelect}
      onTouchStart={(e) => {
        e.preventDefault();
        handleSelect(e);
      }}
    >
      <primitive object={materials} attach="material" />
    </animated.mesh>
  );
}

// Envolvemos el componente con React.memo para evitar renderizados innecesarios
export default React.memo(PuzzlePiece); 