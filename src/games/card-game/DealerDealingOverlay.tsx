import React, { useEffect, useState } from 'react';
import { soundEffects } from '../../engine/soundEffects';

interface DealerDealingOverlayProps {
  numPlayers?: number;
  totalCardsToDeal?: number;
  onDealComplete: () => void;
  speedMs?: number;
}

interface FlyingCard {
  id: number;
  targetSeat: number; // 0=Bottom, 1=Left, 2=Top, 3=Right
  delayMs: number;
}

export const DealerDealingOverlay: React.FC<DealerDealingOverlayProps> = ({
  numPlayers = 4,
  totalCardsToDeal = 12,
  onDealComplete,
  speedMs = 80,
}) => {
  const [cards, setCards] = useState<FlyingCard[]>([]);

  useEffect(() => {
    // Generate burst sequence of cards dealt in clockwise order
    const cardList: FlyingCard[] = [];
    const count = Math.min(totalCardsToDeal, 16);

    for (let i = 0; i < count; i++) {
      cardList.push({
        id: i,
        targetSeat: i % numPlayers,
        delayMs: i * speedMs,
      });
    }

    setCards(cardList);

    // Play periodic card deal sound effect
    const soundInterval = setInterval(() => {
      soundEffects.playCardDeal();
    }, speedMs * 1.5);

    const totalDuration = count * speedMs + 500;
    const timer = setTimeout(() => {
      clearInterval(soundInterval);
      onDealComplete();
    }, totalDuration);

    return () => {
      clearInterval(soundInterval);
      clearTimeout(timer);
    };
  }, [numPlayers, totalCardsToDeal, onDealComplete, speedMs]);

  // Target translation offsets from center deck to each seat position (percent or px)
  const seatOffsets: Record<number, { x: string; y: string; rotate: string }> = {
    0: { x: '0px', y: '220px', rotate: '0deg' },     // Bottom (User)
    1: { x: '-260px', y: '0px', rotate: '90deg' },   // Left
    2: { x: '0px', y: '-220px', rotate: '180deg' },  // Top
    3: { x: '260px', y: '0px', rotate: '-90deg' },   // Right
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden flex items-center justify-center">
      {/* Dealer Deck Center Glow */}
      <div className="relative w-16 h-24 rounded-xl border-2 border-amber-400/80 bg-gradient-to-br from-amber-600 to-amber-900 shadow-2xl flex items-center justify-center animate-pulse">
        <span className="text-xl">🂠</span>
      </div>

      {/* Flying Cards */}
      {cards.map((c) => {
        const offset = seatOffsets[c.targetSeat] || seatOffsets[0];

        return (
          <div
            key={c.id}
            className="absolute w-12 h-16 rounded-xl border border-amber-400 bg-gradient-to-br from-[#7f1d1d] via-[#991b1b] to-[#450a0a] shadow-2xl transition-all duration-500 ease-out"
            style={{
              animation: `flyToSeat 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards`,
              animationDelay: `${c.delayMs}ms`,
              opacity: 0,
              ['--target-x' as string]: offset.x,
              ['--target-y' as string]: offset.y,
              ['--target-rot' as string]: offset.rotate,
            }}
          >
            <div className="w-full h-full flex items-center justify-center text-amber-300 text-xs font-black">
              👑
            </div>
          </div>
        );
      })}
    </div>
  );
};
