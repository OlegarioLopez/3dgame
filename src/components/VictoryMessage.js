import React from 'react';
import { useSpring, animated } from '@react-spring/web';
import './VictoryMessage.css';

const VictoryMessage = ({ visible, onRestart }) => {
  // Animación para la aparición/desaparición
  const springProps = useSpring({
    opacity: visible ? 1 : 0,
    transform: visible ? 'scale(1)' : 'scale(0.8)',
    config: { tension: 300, friction: 20 }
  });

  if (!visible) return null;

  return (
    <animated.div className="victory-message-container" style={springProps}>
      <div className="victory-message">
        <h2>¡Puzzle Completado!</h2>
        <p>Has conseguido resolver el puzzle. ¡Felicidades!</p>
        <button className="restart-button" onClick={onRestart}>
          Jugar de nuevo
        </button>
      </div>
    </animated.div>
  );
};

export default VictoryMessage; 