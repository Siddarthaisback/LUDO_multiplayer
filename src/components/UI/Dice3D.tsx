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

  // Proportional dot diameter and face padding based on size
  const dotPx = Math.max(4, Math.round(size * 0.16));
  const centerDotPx = Math.max(5, Math.round(size * 0.22));
  const padPx = Math.max(2, Math.round(size * 0.08));

  // Render dice face pips with crisp round dots
  const renderPips = (count: number) => {
    const dot = (key: number, isCenterRed = false, isSingleCenter = false) => {
      const dSize = isSingleCenter ? centerDotPx : dotPx;
      return (
        <div
          key={key}
          className="rounded-full shadow-inner shrink-0"
          style={{
            width: `${dSize}px`,
            height: `${dSize}px`,
            boxShadow: 'inset 0 1.5px 3px rgba(0,0,0,0.7)',
            backgroundColor: isCenterRed ? '#ef4444' : '#0f172a',
          }}
        />
      );
    };

    if (count === 1) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          {dot(1, true, true)}
        </div>
      );
    }

    if (count === 2) {
      return (
        <div className="w-full h-full flex flex-col justify-between" style={{ padding: `${padPx}px` }}>
          <div className="flex justify-start">{dot(1)}</div>
          <div className="flex justify-end">{dot(2)}</div>
        </div>
      );
    }

    if (count === 3) {
      return (
        <div className="w-full h-full flex flex-col justify-between" style={{ padding: `${padPx}px` }}>
          <div className="flex justify-start">{dot(1)}</div>
          <div className="flex justify-center">{dot(2)}</div>
          <div className="flex justify-end">{dot(3)}</div>
        </div>
      );
    }

    if (count === 4) {
      return (
        <div className="w-full h-full grid grid-cols-2 grid-rows-2 place-items-center" style={{ padding: `${padPx}px` }}>
          {dot(1)}{dot(2)}{dot(3)}{dot(4)}
        </div>
      );
    }

    if (count === 5) {
      return (
        <div className="w-full h-full relative" style={{ padding: `${padPx}px` }}>
          <div className="absolute" style={{ top: `${padPx}px`, left: `${padPx}px` }}>{dot(1)}</div>
          <div className="absolute" style={{ top: `${padPx}px`, right: `${padPx}px` }}>{dot(2)}</div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">{dot(3, true)}</div>
          <div className="absolute" style={{ bottom: `${padPx}px`, left: `${padPx}px` }}>{dot(4)}</div>
          <div className="absolute" style={{ bottom: `${padPx}px`, right: `${padPx}px` }}>{dot(5)}</div>
        </div>
      );
    }

    return (
      <div className="w-full h-full grid grid-cols-2 grid-rows-3 place-items-center" style={{ padding: `${padPx}px` }}>
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
            ? 'hover:scale-[1.02] active:scale-95 cursor-pointer'
            : 'opacity-90 cursor-not-allowed'
        }`}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          ['--dice-size' as any]: `${size}px`,
          filter: canRoll && !disabled
            ? `drop-shadow(0 0 5px ${colorInfo.primary}99) drop-shadow(0 4px 8px rgba(0,0,0,0.4))`
            : 'drop-shadow(0 2px 5px rgba(0,0,0,0.3))',
        }}
      >
        <div
          className={`dice-cube ${isRolling ? 'rolling' : getFaceClass(value)}`}
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
