import React from 'react';
import { soundEffects } from '../../engine/soundEffects';

export type ChipDenomination = 5 | 25 | 100 | 500 | 1000;

interface PokerChipProps {
  value: ChipDenomination;
  size?: number;
  count?: number;
  onClick?: () => void;
  disabled?: boolean;
}

export const PokerChip: React.FC<PokerChipProps> = ({
  value,
  size = 46,
  count,
  onClick,
  disabled = false,
}) => {
  const chipStyles: Record<ChipDenomination, { bg: string; border: string; text: string; rim: string }> = {
    5: { bg: 'from-slate-100 via-white to-slate-200', border: '#cbd5e1', text: '#0f172a', rim: '#94a3b8' },
    25: { bg: 'from-red-600 via-rose-500 to-red-700', border: '#fda4af', text: '#ffffff', rim: '#e11d48' },
    100: { bg: 'from-blue-600 via-sky-500 to-blue-700', border: '#bae6fd', text: '#ffffff', rim: '#0284c7' },
    500: { bg: 'from-emerald-600 via-green-500 to-emerald-700', border: '#a7f3d0', text: '#ffffff', rim: '#059669' },
    1000: { bg: 'from-slate-900 via-zinc-800 to-slate-950', border: '#fbbf24', text: '#fbbf24', rim: '#d97706' },
  };

  const style = chipStyles[value];

  const handleClick = () => {
    if (!disabled && onClick) {
      soundEffects.playChipClink();
      onClick();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`relative inline-flex items-center justify-center rounded-full select-none transition-all duration-200 ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:scale-110 active:scale-95 cursor-pointer shadow-lg hover:shadow-2xl'
      }`}
      style={{ width: size, height: size }}
    >
      {/* 3D Chip Outer Rim */}
      <div
        className={`w-full h-full rounded-full bg-gradient-to-br ${style.bg} border-2 flex items-center justify-center shadow-inner relative overflow-hidden`}
        style={{ borderColor: style.border }}
      >
        {/* Striped Edge Markings */}
        <div className="absolute inset-0 rounded-full border-4 border-dashed opacity-40" style={{ borderColor: style.rim }} />

        {/* Inner Circle Inset */}
        <div
          className="w-3/4 h-3/4 rounded-full border flex flex-col items-center justify-center bg-black/15 backdrop-blur-xs"
          style={{ borderColor: style.border }}
        >
          <span className="text-[8px] font-black uppercase tracking-widest opacity-70 leading-none" style={{ color: style.text }}>
            $
          </span>
          <span className="text-xs sm:text-sm font-black font-mono leading-none" style={{ color: style.text }}>
            {value >= 1000 ? `${value / 1000}k` : value}
          </span>
        </div>
      </div>

      {/* Chip count badge */}
      {count !== undefined && count > 1 && (
        <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-slate-950 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-md border border-white">
          {count}
        </span>
      )}
    </div>
  );
};
