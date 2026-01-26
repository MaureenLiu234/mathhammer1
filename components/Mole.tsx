
import React from 'react';
import { MoleType } from '../types';

interface MoleProps {
  id: number;
  isActive: boolean;
  value: number | null;
  type: MoleType;
  hitsRequired: number;
  isHinted?: boolean;
  onClick: (id: number) => void;
}

export const Mole: React.FC<MoleProps> = ({ id, isActive, value, type, hitsRequired, isHinted, onClick }) => {
  const isHardened = type === MoleType.HARDENED;
  const isBomb = type === MoleType.BOMB;

  return (
    <div 
      className={`relative w-full h-24 md:h-32 bg-amber-900 rounded-full shadow-inner overflow-hidden border-4 border-amber-950 flex items-center justify-center cursor-none ${isHinted && isActive ? 'ring-4 ring-yellow-400 ring-offset-4 ring-offset-amber-900' : ''}`}
      onClick={() => onClick(id)}
    >
      <div className="absolute inset-0 bg-black/40 rounded-full"></div>
      
      <div
        className={`absolute bottom-0 w-4/5 h-4/5 rounded-t-full flex flex-col items-center justify-center transition-all duration-300 ease-out border-b-0 border-4 shadow-lg ${
          isActive ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-full opacity-0 scale-90'
        } ${isBomb ? 'bg-zinc-800 border-zinc-900' : 'bg-orange-400 border-orange-500'} ${isHinted && isActive ? 'brightness-125' : ''}`}
      >
        {/* Face */}
        {!isBomb && (
          <>
            <div className="flex gap-2 mb-1">
              <div className="w-2 h-2 bg-black rounded-full"></div>
              <div className="w-2 h-2 bg-black rounded-full"></div>
            </div>
            <div className="w-4 h-1 bg-pink-400 rounded-full mb-1"></div>
          </>
        )}

        {/* Bomb Graphics */}
        {isBomb && (
          <div className="relative flex flex-col items-center">
            <div className="w-2 h-4 bg-orange-600 rounded-t-md -mt-4 animate-pulse"></div>
            <span className="text-3xl mt-1">💣</span>
          </div>
        )}

        {/* Helmet for Hardened Mole */}
        {isHardened && (
          <div className={`absolute -top-3 w-full flex justify-center z-10 ${hitsRequired === 1 ? 'opacity-50 grayscale' : ''}`}>
            <div className="bg-gray-600 w-16 h-8 rounded-t-full border-2 border-gray-400 flex items-center justify-center shadow-md helmet-hit">
              <div className="w-8 h-1 bg-gray-400 rounded-full"></div>
            </div>
          </div>
        )}
        
        {/* Value Label */}
        {isActive && value !== null && !isBomb && (
          <div className={`bg-white px-3 py-0.5 rounded-full shadow-md transform -rotate-3 border-2 animate-bounce ${isHardened ? 'border-gray-500' : (isHinted ? 'border-yellow-500' : 'border-blue-500')}`}>
            <span className={`text-lg md:text-xl font-black leading-none ${isHardened ? 'text-gray-700' : (isHinted ? 'text-yellow-600' : 'text-blue-600')}`}>
              {value}
            </span>
          </div>
        )}

        {/* Glow for Hint */}
        {isHinted && isActive && !isBomb && (
            <div className="absolute inset-0 bg-yellow-400/20 animate-pulse rounded-t-full"></div>
        )}
      </div>
    </div>
  );
};
