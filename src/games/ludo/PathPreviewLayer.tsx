import React from 'react';
import { PathPreviewData } from './ludoAnimationTypes';

interface PathPreviewLayerProps {
  preview: PathPreviewData | null;
}

export const PathPreviewLayer: React.FC<PathPreviewLayerProps> = ({ preview }) => {
  if (!preview) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {/* 1. Intermediate Step Dots (Clean, centered in step cells) */}
      {preview.points.slice(1, -1).map((pt, idx) => (
        <div
          key={`path-dot-${idx}`}
          className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center animate-pulse"
          style={{
            left: `${pt.x * 100}%`,
            top: `${pt.y * 100}%`,
            animationDelay: `${idx * 50}ms`,
          }}
        >
          <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-amber-400 border border-white shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
        </div>
      ))}

      {/* 2. Destination Target Square (Perfect 1:1 cell size, exactly inside the grid square!) */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none"
        style={{
          left: `${preview.destinationPoint.x * 100}%`,
          top: `${preview.destinationPoint.y * 100}%`,
          width: '6.4%',
          height: '6.4%',
        }}
      >
        {/* Pulsing inner cell highlight perfectly inside the tile */}
        <div className="w-full h-full rounded-md border-2 border-amber-400 bg-amber-400/25 shadow-[inset_0_0_8px_rgba(251,191,36,0.6)] animate-pulse flex items-center justify-center">
          {preview.destinationType === 'capture' && (
            <span className="text-xs select-none filter drop-shadow">⚔️</span>
          )}
          {preview.destinationType === 'home' && (
            <span className="text-xs select-none filter drop-shadow">👑</span>
          )}
          {preview.destinationType === 'safe' && (
            <span className="text-xs select-none filter drop-shadow">🛡️</span>
          )}
          {preview.destinationType === 'normal' && (
            <div className="w-2 h-2 rounded-full bg-amber-400 shadow-sm" />
          )}
        </div>
      </div>
    </div>
  );
};
