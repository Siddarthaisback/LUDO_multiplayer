import React from 'react';
import { X, History, Crown } from 'lucide-react';
import { TrickCard, CallBreakPlayerState } from '../engine/CallBreakEngine';
import { PlayingCard } from '../../card-game/PlayingCard';
import { Card } from '../../../core/cards/Card';

interface LastTrickModalProps {
  lastTrick: TrickCard[];
  winningCardId?: string;
  winnerIndex?: number;
  players: CallBreakPlayerState[];
  onClose: () => void;
}

export const LastTrickModal: React.FC<LastTrickModalProps> = ({
  lastTrick,
  winningCardId,
  winnerIndex,
  players,
  onClose,
}) => {
  const formatCardData = (c: Card) => {
    const suitMap: Record<string, any> = {
      S: 'spades',
      H: 'hearts',
      D: 'diamonds',
      C: 'clubs',
    };
    return {
      id: c.id,
      suit: suitMap[c.suit] || 'spades',
      rank: c.rank,
      label: c.label,
      isFaceUp: true,
    };
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-400/50 rounded-3xl max-w-lg w-full p-5 shadow-2xl flex flex-col items-center gap-4 text-center relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-amber-400" />
          <h3 className="text-base sm:text-lg font-black uppercase text-white">PREVIOUS TRICK (HAND)</h3>
        </div>

        {lastTrick.length === 0 ? (
          <p className="text-sm text-slate-400 py-6">No previous tricks played in this round yet.</p>
        ) : (
          <div className="w-full flex flex-col items-center gap-4">
            {winnerIndex !== undefined && players[winnerIndex] && (
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-xs font-black text-amber-300">
                <Crown className="w-4 h-4 text-amber-400" />
                <span>Winner: {players[winnerIndex].config.name} {winnerIndex === 0 ? '(You)' : ''}</span>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full justify-items-center">
              {lastTrick.map((t) => {
                const player = players[t.playerIndex];
                const isWinner = t.card.id === winningCardId;

                return (
                  <div key={t.card.id} className="flex flex-col items-center gap-1.5">
                    <div
                      className={`relative rounded-xl transition-all ${
                        isWinner ? 'ring-4 ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.8)] scale-105' : ''
                      }`}
                    >
                      <PlayingCard card={formatCardData(t.card)} size="md" />
                      {isWinner && (
                        <div className="absolute -top-3 -right-3 bg-amber-400 text-slate-950 p-1 rounded-full shadow-lg">
                          <Crown className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-bold text-white flex items-center gap-1">
                      <span>{player?.config.avatar}</span>
                      <span>{player?.config.name}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-2 px-6 py-2 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs uppercase tracking-wider"
        >
          Back to Game
        </button>
      </div>
    </div>
  );
};
