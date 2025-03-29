import { useEffect, useState, useMemo } from 'react';
import { AudioLoader, Audio } from 'three';

// Hook para cargar y manejar sonidos de manera limpia
const useSound = (url, volume = 1.0, listener) => {
  const [sound, setSound] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Crear un audio loader una vez por instancia del hook
  const audioLoader = useMemo(() => new AudioLoader(), []);
  
  useEffect(() => {
    if (!url || !listener) {
      console.warn('No URL or listener provided to useSound hook');
      return;
    }
    
    let isMounted = true;
    const sound = new Audio(listener);
    
    // Set initial volume
    sound.setVolume(volume);
    
    // Para mejora de compatibilidad con iOS - agregar un modo de retorno fallback
    sound.ios_url = url; // Guardar URL para uso con Audio() en iOS
    
    // Load the sound asynchronously
    setIsLoading(true);
    audioLoader.load(
      url,
      // onLoad callback
      (buffer) => {
        // If component is still mounted, set the buffer
        if (isMounted) {
          sound.setBuffer(buffer);
          setSound(sound);
          setIsLoading(false);
          console.log(`Sound loaded: ${url}`);
        }
      },
      // onProgress callback (not really used for audio)
      (xhr) => {
        //console.log(`${( xhr.loaded / xhr.total * 100 )}% loaded`);
      },
      // onError callback
      (err) => {
        if (isMounted) {
          console.error(`Error loading sound: ${url}`, err);
          setError(err);
          setIsLoading(false);
        }
      }
    );
    
    // Clean up to prevent memory leaks
    return () => {
      isMounted = false;
      if (sound) {
        // Stop sound if playing
        if (sound.isPlaying) {
          sound.stop();
        }
        // Dispose buffer to free memory
        if (sound.buffer) {
          sound.buffer = null;
        }
      }
    };
  }, [url, volume, listener, audioLoader]);
  
  return sound;
};

export default useSound; 