
import React, { useState, useEffect } from 'react';

interface HammerCursorProps {
  // No skin prop needed anymore, using default hammer
}

// Default hammer configuration
const DEFAULT_HAMMER = { emoji: '🔨', shadow: 'rgba(0,0,0,0.3)', effect: '' };

export const HammerCursor: React.FC<HammerCursorProps> = () => {
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [isClicking, setIsClicking] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div
      className={`fixed pointer-events-none z-[9999] transition-transform duration-75 flex items-center justify-center ${DEFAULT_HAMMER.effect}`}
      style={{
        left: position.x,
        top: position.y,
        transform: `translate(-30%, -70%) rotate(${isClicking ? '-45deg' : '0deg'}) scale(2.5)`,
        filter: `drop-shadow(0 0 10px ${DEFAULT_HAMMER.shadow})`,
      }}
    >
      <span className="select-none">{DEFAULT_HAMMER.emoji}</span>
    </div>
  );
};
