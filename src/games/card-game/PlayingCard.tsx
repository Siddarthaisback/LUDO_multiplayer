import React, { useState, useRef } from 'react';
import { PlayingCardData, CardSuit } from '../../types/cardGame';

interface PlayingCardProps {
  card: PlayingCardData;
  isFaceUp?: boolean;
  size?: 'sm' | 'md' | 'lg';
  isSelectable?: boolean;
  isSelected?: boolean;
  isDraggable?: boolean;
  disableTransform?: boolean;
  onClick?: () => void;
  onDragPlay?: (card: PlayingCardData) => void;
  className?: string;
  tiltAngle?: number;
  dealDelayIndex?: number;
}

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  isFaceUp = card.isFaceUp,
  size = 'md',
  isSelectable = false,
  isSelected = card.isSelected,
  isDraggable = false,
  disableTransform = false,
  onClick,
  onDragPlay,
  className = '',
  tiltAngle = 0,
  dealDelayIndex = 0,
}) => {
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const isDragging = dragOffset !== null;
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const suitSymbols: Record<CardSuit, string> = {
    spades: '♠',
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
  };

  const suitColors: Record<CardSuit, string> = {
    spades: '#0f172a',
    hearts: '#ef4444',
    diamonds: '#dc2626',
    clubs: '#1e293b',
  };

  const sizeClasses = {
    sm: 'w-12 h-16 text-[10px]',
    md: 'w-16 h-24 sm:w-20 sm:h-28 text-xs sm:text-sm',
    lg: 'w-24 h-36 sm:w-28 sm:h-40 text-base sm:text-lg',
  }[size];

  const symbol = suitSymbols[card.suit];
  const color = suitColors[card.suit];

  // Pointer Drag Handlers (Works on Mouse, Touch, Stylus)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isDraggable && !isSelectable) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    startPosRef.current = { x: e.clientX, y: e.clientY };
    setDragOffset({ x: 0, y: 0 });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    setDragOffset({ x: dx, y: dy });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dy = e.clientY - startPosRef.current.y;
    const dx = e.clientX - startPosRef.current.x;
    const distanceMoved = Math.sqrt(dx * dx + dy * dy);

    // If dragged upwards significantly (> 45px), trigger onDragPlay
    if (dy < -45 && onDragPlay) {
      onDragPlay(card);
    } else if (distanceMoved < 6 && onClick) {
      // Considered a tap/click
      onClick();
    }

    setDragOffset(null);
  };

  const handlePointerCancel = () => {
    setDragOffset(null);
  };

  const dragStyle = isDragging
    ? {
        transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) scale(1.15) rotate(${
          tiltAngle + dragOffset.x * 0.08
        }deg)`,
        zIndex: 100,
        transition: 'none',
        cursor: 'grabbing',
        boxShadow: '0 25px 35px rgba(0,0,0,0.6), 0 0 20px rgba(251,191,36,0.5)',
      }
    : disableTransform
    ? {}
    : {
        transform: `rotate(${tiltAngle}deg) ${isSelected ? 'translateY(-10px)' : ''}`,
        animationDelay: `${dealDelayIndex * 40}ms`,
      };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={() => {
        if (!isDraggable && onClick) onClick();
      }}
      className={`relative inline-block rounded-xl select-none transition-all duration-200 ${
        !disableTransform && (isDraggable || isSelectable) ? 'cursor-grab active:cursor-grabbing hover:-translate-y-2' : ''
      } ${sizeClasses} ${
        isSelected
          ? 'ring-2 ring-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.7)]'
          : 'shadow-lg hover:shadow-xl'
      } ${className}`}
      style={dragStyle}
    >
      {isFaceUp ? (
        /* Card Face (Front) */
        <div className="w-full h-full bg-gradient-to-br from-white via-[#fafaf9] to-[#f5f5f4] rounded-xl border border-slate-300 p-1.5 sm:p-2 flex flex-col justify-between overflow-hidden shadow-inner relative">
          {/* Subtle watermark in center */}
          <div
            className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none text-4xl sm:text-6xl font-serif font-black"
            style={{ color }}
          >
            {symbol}
          </div>

          {/* Top-Left Corner Pip */}
          <div className="flex flex-col items-center leading-none z-10" style={{ color }}>
            <span className="font-black font-mono tracking-tighter">{card.label}</span>
            <span className="text-[10px] sm:text-xs">{symbol}</span>
          </div>

          {/* Center Graphic */}
          <div className="my-auto text-center z-10" style={{ color }}>
            {card.rank >= 11 && card.rank <= 13 ? (
              <div className="flex flex-col items-center">
                <span className="text-xl sm:text-2xl font-black">
                  {card.rank === 13 ? '♔' : card.rank === 12 ? '♕' : '⚔️'}
                </span>
                <span className="text-[8px] font-extrabold uppercase tracking-widest opacity-60">
                  {card.rank === 13 ? 'KING' : card.rank === 12 ? 'QUEEN' : 'JACK'}
                </span>
              </div>
            ) : card.rank === 14 ? (
              <div className="flex flex-col items-center">
                <span className="text-2xl sm:text-3xl font-black">{symbol}</span>
                <span className="text-[8px] font-black uppercase tracking-widest opacity-80">ACE</span>
              </div>
            ) : (
              <span className="text-lg sm:text-2xl font-black">{symbol}</span>
            )}
          </div>

          {/* Bottom-Right Inverted Corner Pip */}
          <div
            className="flex flex-col items-center leading-none rotate-180 z-10 self-end"
            style={{ color }}
          >
            <span className="font-black font-mono tracking-tighter">{card.label}</span>
            <span className="text-[10px] sm:text-xs">{symbol}</span>
          </div>
        </div>
      ) : (
        /* Card Back (Reverse) - Luxury Gold Dragon & Velvet Texture */
        <div className="w-full h-full rounded-xl bg-gradient-to-br from-[#7f1d1d] via-[#991b1b] to-[#450a0a] border-2 border-amber-400 p-1 flex items-center justify-center shadow-xl overflow-hidden relative">
          <div className="w-full h-full rounded-lg border border-amber-300/60 bg-[#5b0a0a] flex flex-col items-center justify-center p-1 relative">
            <div className="text-amber-400 text-lg sm:text-2xl filter drop-shadow">🐉</div>
            <div className="text-[7px] font-black text-amber-300/80 tracking-widest uppercase mt-0.5">
              ROYALE
            </div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.15),transparent_70%)] pointer-events-none" />
          </div>
        </div>
      )}
    </div>
  );
};
