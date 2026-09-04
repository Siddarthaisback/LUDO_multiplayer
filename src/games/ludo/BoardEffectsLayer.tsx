import React from 'react';
import { BoardEffectItem } from './ludoAnimationTypes';
import { Sparkles, Crown, Zap, Flame } from 'lucide-react';

interface BoardEffectsLayerProps {
  effects: BoardEffectItem[];
}

export const BoardEffectsLayer: React.FC<BoardEffectsLayerProps> = ({ effects }) => {
  return (
    <div className="absolute inset-0 pointer-events-none z-35 overflow-hidden">
      {effects.map((effect) => {
        const leftPercent = `${effect.point.x * 100}%`;
        const topPercent = `${effect.point.y * 100}%`;

        switch (effect.type) {
          case 'hop_ripple': {
            const rippleColors = {
              red: 'border-red-400 bg-red-500/20',
              green: 'border-emerald-400 bg-emerald-500/20',
              yellow: 'border-amber-400 bg-amber-500/20',
              blue: 'border-blue-400 bg-blue-500/20',
            }[effect.color || 'yellow'];

            return (
              <div
                key={effect.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none"
                style={{ left: leftPercent, top: topPercent }}
              >
                <div
                  className={`w-8 h-8 rounded-full border-2 ${rippleColors} animate-ludo-ripple shadow-[0_0_15px_rgba(251,191,36,0.6)]`}
                />
              </div>
            );
          }

          case 'combat_explosion': {
            return (
              <div
                key={effect.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-45"
                style={{ left: leftPercent, top: topPercent }}
              >
                {/* Shockwave Blast */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-amber-400 bg-gradient-to-r from-red-500/60 via-amber-400/80 to-yellow-300/90 animate-ludo-strike shadow-[0_0_35px_rgba(239,68,68,1)] flex items-center justify-center">
                  <Flame className="w-8 h-8 text-white animate-bounce" />
                </div>
              </div>
            );
          }

          case 'yard_launch': {
            return (
              <div
                key={effect.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-40"
                style={{ left: leftPercent, top: topPercent }}
              >
                <div className="w-12 h-12 rounded-full border-2 border-amber-300 bg-amber-400/40 animate-ludo-launch shadow-[0_0_25px_rgba(251,191,36,0.9)] flex items-center justify-center">
                  <Zap className="w-6 h-6 text-amber-200 animate-spin" />
                </div>
              </div>
            );
          }

          case 'capture_dust': {
            return (
              <div
                key={effect.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-40"
                style={{ left: leftPercent, top: topPercent }}
              >
                <div className="w-8 h-8 rounded-full bg-amber-200/50 blur-sm animate-ping" />
              </div>
            );
          }

          case 'capture_banner': {
            return (
              <div
                key={effect.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-50 animate-bounce"
                style={{ left: leftPercent, top: `${effect.point.y * 100 - 8}%` }}
              >
                <div className="px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 text-white font-black text-xs sm:text-sm shadow-2xl border-2 border-white flex items-center gap-1.5 scale-110">
                  <Flame className="w-4 h-4 text-yellow-300" />
                  <span>{effect.text || '💥 CAPTURE!'}</span>
                </div>
              </div>
            );
          }

          case 'home_crown': {
            return (
              <div
                key={effect.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-50 animate-ludo-crown"
                style={{ left: leftPercent, top: topPercent }}
              >
                <div className="flex flex-col items-center gap-1">
                  <Crown className="w-10 h-10 text-amber-300 filter drop-shadow-[0_0_20px_rgba(251,191,36,1)]" fill="#fde047" />
                  <span className="text-[10px] font-black text-yellow-300 uppercase tracking-widest bg-slate-950/80 px-2 py-0.5 rounded-full border border-amber-400">
                    Home!
                  </span>
                </div>
              </div>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
};
