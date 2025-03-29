import { useMemo, useEffect } from 'react';
import { Audio, AudioLoader } from 'three';

// Un hook personalizado para cargar y manejar sonidos
function useSound(soundUrl, volume = 0.5, audioListener) {
  // Crear un objeto de audio que se mantiene entre renderizados
  const sound = useMemo(() => {
    // Only create audio if audioListener is provided
    if (audioListener) {
      return new Audio(audioListener);
    }
    return null;
  }, [audioListener]);
  
  // Cargar el sonido cuando el componente se monta
  useEffect(() => {
    if (!soundUrl || !sound) return;
    
    const audioLoader = new AudioLoader();
    
    // Cargar el buffer de audio
    audioLoader.load(
      soundUrl,
      (buffer) => {
        // Configurar el sonido cuando se carga correctamente
        sound.setBuffer(buffer);
        sound.setVolume(volume);
        sound.setLoop(false);
      },
      // Callback de progreso (opcional)
      undefined,
      // Callback de error
      (error) => {
        console.error('Error cargando sonido:', error);
      }
    );
    
    // Limpieza cuando el componente se desmonta
    return () => {
      // Detener la reproducción si está activa
      if (sound.isPlaying) {
        sound.stop();
      }
      // Liberar el buffer si existe
      if (sound.buffer) {
        sound.buffer = null;
      }
    };
  }, [sound, soundUrl, volume]);
  
  // Devolver el objeto de audio para que pueda ser usado por el componente
  return sound;
}

export default useSound; 