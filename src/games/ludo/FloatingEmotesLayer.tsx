import React from 'react';
import { PlayerColor } from '../../types/game';
import { COLOR_MAP } from '../../utils/constants';

export interface FloatingEmoteItem {
  id: string;
  seatIndex: number;
  senderName: string;
  emoji?: string;
  message?: string;
  color: PlayerColor;
}

interface FloatingEmotesLayerProps {
  emotes: FloatingEmoteItem[];
}

export const FloatingEmotesLayer: React.FC<FloatingEmotesLayerProps> = ({ emotes }) => {
  if (emotes.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {emotes.map((item) => {
        const color = COLOR_MAP[item.color] || COLOR_MAP.red;

        return (
          <div
            key={item.id}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center animate-emote-float"
            style={{
              animationDuration: '2.5s',
              animationTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
              animationFillMode: 'forwards',
            }}
          >
            {item.emoji && (
              <div className="text-5xl sm:text-6xl filter drop-shadow-lg transform transition-transform hover:scale-110 select-none animate-bounce">
                {item.emoji}
              </div>
            )}
            {item.message && (
              <div
                className="mt-1 px-4 py-1.5 rounded-full text-xs sm:text-sm font-black text-white shadow-2xl border-2 border-white/60 select-none max-w-[240px] text-center backdrop-blur-md"
                style={{
                  backgroundColor: `${color.primary}ee`,
                  boxShadow: `0 8px 24px -4px ${color.primary}aa`,
                }}
              >
                <div className="text-[10px] uppercase tracking-wider text-white/80 font-bold leading-tight">
                  {item.senderName}
                </div>
                <div className="leading-snug">{item.message}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
