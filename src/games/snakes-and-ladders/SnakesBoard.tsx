import React from 'react';
import { SnakePlayerState, SnakesBoardTheme } from '../../types/snakes';
import { BoardStyleMode } from '../../types/game';
import { DEFAULT_SNAKES_AND_LADDERS, SPECIAL_TILES } from '../../utils/constants';
import { SnakesEngine } from './SnakesEngine';
import { LuxuryToken } from '../../components/UI/LuxuryToken';

interface SnakesBoardProps {
  players: SnakePlayerState[];
  activePlayerIndex: number;
  theme: SnakesBoardTheme;
  animatingPlayerId?: string;
  displayPositions: Record<string, number>;
  boardStyle?: BoardStyleMode;
}

export const SnakesBoard: React.FC<SnakesBoardProps> = ({
  players,
  activePlayerIndex,
  theme = 'classic',
  animatingPlayerId,
  displayPositions,
  boardStyle = 'luxury',
}) => {
  return (
    <div className="relative w-full aspect-square max-w-[560px] mx-auto rounded-3xl p-1.5 sm:p-2 shadow-2xl border-4 border-amber-700/80 bg-slate-950 select-none overflow-hidden">
      {/* 1. Photorealistic Luxury Board Image */}
      <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-inner bg-slate-950">
        <img
          src="/assets/snakes_board_luxury.jpg"
          alt="Royal Handcrafted Snakes & Ladders Board"
          className="w-full h-full object-cover object-center filter brightness-100 contrast-105 pointer-events-none"
        />

        {/* Calibrated 10x10 Playing Area Inset (7.2% wood border) */}
        <div className="absolute inset-[7.2%] pointer-events-none">
          {/* Pawns Overlay */}
          <div className="absolute inset-0 pointer-events-none z-20">
            {players.map((player, pIdx) => {
              const currentPos = displayPositions[player.config.id] ?? player.position;
              if (currentPos < 1) return null;

              const coords = SnakesEngine.getTileCoordinates(currentPos);
              const isTurn = activePlayerIndex === pIdx;
              const isHopping = animatingPlayerId === player.config.id;

              const sameTilePlayers = players.filter(
                (p) => (displayPositions[p.config.id] ?? p.position) === currentPos
              );
              const shareIndex = sameTilePlayers.findIndex((p) => p.config.id === player.config.id);
              const offsetX = sameTilePlayers.length > 1 ? (shareIndex % 2 === 0 ? -2 : 2) : 0;
              const offsetY = sameTilePlayers.length > 1 ? (shareIndex > 1 ? 2 : -2) : 0;

              return (
                <div
                  key={player.config.id}
                  className="absolute transition-all duration-300 ease-out flex items-center justify-center pointer-events-auto cursor-pointer"
                  style={{
                    left: `${coords.x + offsetX}%`,
                    top: `${coords.y + offsetY}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div className={isHopping ? 'token-hopping scale-125 z-30' : ''}>
                    <LuxuryToken
                      color={player.config.color}
                      isMovable={isTurn}
                      avatar={player.config.avatar}
                      size={sameTilePlayers.length > 1 ? 24 : 32}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
