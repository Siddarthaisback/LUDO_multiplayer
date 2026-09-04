import React from 'react';
import { PlayerColor } from '../../types/game';
import { COLOR_MAP } from '../../utils/constants';
import { Dices } from 'lucide-react';

interface Dice3DProps {
  value: number; // 1 to 6
  isRolling: boolean;
  disabled?: boolean;
  activeColor: PlayerColor;
  onRoll: () => void;
  canRoll: boolean;
  size?: number; // size in px
  showButton?: boolean;
}

export const Dice3D: React.FC<Dice3DProps> = ({
  value,
  isRolling,
  disabled = false,
  activeColor,
  onRoll,
  canRoll,
  size = 72,
  showButton = true,
}) => {
  const colorInfo = COLOR_MAP[activeColor];

  const handleRollClick = () => {
    if (!disabled && canRoll && !isRolling) {
      onRoll();
    }
  };

  const getFaceClass = (num: number) => {
    return `show-${num}`;
  };

  // Render dice face pips with crisp round dots
  const renderPips = (count: number) => {
    const dot = (key: number, isCenterRed = false) => (
      <div
        key={key}
        className="w-3.5 h-3.5 rounded-full shadow-inner"
        style={{
          boxShadow: 'inset 0 1.5px 3px rgba(0,0,0,0.7)',
          backgroundColor: isCenterRed ? '#ef4444' : '#0f172a',
        }}
      />
    );

    if (count === 1) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div
            className="w-5 h-5 rounded-full shadow-inner animate-pulse"
            style={{
              backgroundColor: '#ef4444',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
            }}
          />
        </div>
      );
    }

    if (count === 2) {
      return (
        <div className="w-full h-full flex flex-col justify-between p-2.5">
          <div className="flex justify-start">{dot(1)}</div>
          <div className="flex justify-end">{dot(2)}</div>
        </div>
      );
    }

    if (count === 3) {
      return (
        <div className="w-full h-full flex flex-col justify-between p-2.5">
          <div className="flex justify-start">{dot(1)}</div>
          <div className="flex justify-center">{dot(2)}</div>
          <div className="flex justify-end">{dot(3)}</div>
        </div>
      );
    }

    if (count === 4) {
      return (
        <div className="w-full h-full grid grid-cols-2 grid-rows-2 p-2.5 place-items-center">
          {dot(1)}{dot(2)}{dot(3)}{dot(4)}
        </div>
      );
    }

    if (count === 5) {
      return (
        <div className="w-full h-full relative p-2.5">
          <div className="absolute top-2.5 left-2.5">{dot(1)}</div>
          <div className="absolute top-2.5 right-2.5">{dot(2)}</div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">{dot(3, true)}</div>
          <div className="absolute bottom-2.5 left-2.5">{dot(4)}</div>
          <div className="absolute bottom-2.5 right-2.5">{dot(5)}</div>
        </div>
      );
    }

    return (
      <div className="w-full h-full grid grid-cols-2 grid-rows-3 p-2 gap-1.5 place-items-center">
        {dot(1)}{dot(2)}{dot(3)}{dot(4)}{dot(5)}{dot(6)}
      </div>
    );
  };

  const faceStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    border: '2px solid #e2e8f0',
    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.2)',
  };

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <div
        onClick={handleRollClick}
        className={`dice-scene relative transition-all duration-300 ${
          canRoll && !disabled
            ? 'hover:scale-110 active:scale-95 cursor-pointer filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.5)]'
            : 'opacity-90 cursor-not-allowed filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.3)]'
        }`}
        style={{ width: size, height: size }}
      >
        {/* Pulsing Aura Ring when available */}
        {canRoll && !disabled && (
          <div
            className="absolute -inset-3 rounded-3xl opacity-80 blur-lg animate-pulse pointer-events-none"
            style={{ backgroundColor: colorInfo.primary }}
          />
        )}

        <div
          className={`dice-cube ${isRolling ? 'rolling' : getFaceClass(value)}`}
          style={{ width: size, height: size }}
        >
          <div className="dice-face front" style={faceStyle}>{renderPips(1)}</div>
          <div className="dice-face back" style={faceStyle}>{renderPips(6)}</div>
          <div className="dice-face right" style={faceStyle}>{renderPips(4)}</div>
          <div className="dice-face left" style={faceStyle}>{renderPips(3)}</div>
          <div className="dice-face top" style={faceStyle}>{renderPips(2)}</div>
          <div className="dice-face bottom" style={faceStyle}>{renderPips(5)}</div>
        </div>
      </div>

      {/* Tactile Roll Button */}
      {showButton && (
        <button
          onClick={handleRollClick}
          disabled={disabled || !canRoll || isRolling}
          className={`px-5 py-2 rounded-2xl text-xs font-black uppercase tracking-widest transition-all duration-200 shadow-xl flex items-center gap-1.5 ${
            canRoll && !disabled && !isRolling
              ? 'text-white hover:brightness-110 shadow-lg active:scale-95 animate-bounce ring-2 ring-white/40'
              : 'bg-slate-800 text-slate-400 opacity-70 cursor-not-allowed'
          }`}
          style={{
            backgroundColor: canRoll && !disabled && !isRolling ? colorInfo.primary : undefined,
          }}
        >
          <Dices className="w-4 h-4" />
          {isRolling ? 'Rolling...' : canRoll ? 'Tap to Roll' : `Rolled ${value}`}
        </button>
      )}
    </div>
  );
};
