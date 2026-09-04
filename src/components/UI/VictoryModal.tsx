import React, { useEffect } from 'react';
import { PlayerConfig } from '../../types/game';
import { COLOR_MAP } from '../../utils/constants';
import { fireConfetti } from '../../engine/confetti';
import { soundEffects } from '../../engine/soundEffects';
import { Trophy, RotateCcw, Home, Sparkles, Award } from 'lucide-react';

interface VictoryModalProps {
  winner: PlayerConfig;
  rankings: { player: PlayerConfig; rank: number; stats?: string }[];
  onRematch: () => void;
  onHome: () => void;
  isAutoPlay?: boolean;
  onToggleAutoPlay?: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  winner,
  rankings,
  onRematch,
  onHome,
  isAutoPlay = false,
  onToggleAutoPlay,
}) => {
  const winnerColor = COLOR_MAP[winner.color];
  const [countdown, setCountdown] = React.useState<number>(5);
  const [isPaused, setIsPaused] = React.useState<boolean>(false);
  const rematchCalledRef = React.useRef<boolean>(false);

  useEffect(() => {
    fireConfetti(4);
    soundEffects.playVictory();
  }, []);

  useEffect(() => {
    if (!isAutoPlay || isPaused) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!rematchCalledRef.current) {
            rematchCalledRef.current = true;
            onRematch();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isAutoPlay, isPaused, onRematch]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 animate-fade-in select-none">
      <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center overflow-hidden">
        {/* Glow ambient background */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ backgroundColor: winnerColor.primary }}
        />

        {/* Trophy / Winner Crown presentation */}
        <div className="relative inline-block mb-3">
          <div className="w-20 h-20 mx-auto rounded-3xl border-2 border-amber-400/60 shadow-[0_0_25px_rgba(245,158,11,0.35)] bg-gradient-to-tr from-amber-500/20 via-slate-900 to-amber-500/10 flex items-center justify-center">
            <Trophy className="w-10 h-10 text-amber-400 fill-amber-400/20 filter drop-shadow animate-pulse" />
          </div>
          <span className="absolute -top-2 -right-2 text-2xl animate-bounce">👑</span>
        </div>

        <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 mb-1">
          ROYAL VICTORY!
        </h2>
        <p className="text-slate-300 text-sm mb-6">
          <span className="font-bold text-white text-base">{winner.name}</span> has conquered the board!
        </p>

        {/* Podium Standings */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 mb-6 space-y-2.5">
          <div className="text-xs uppercase font-extrabold tracking-wider text-slate-400 mb-2 flex items-center justify-center gap-1">
            <Award className="w-3.5 h-3.5 text-amber-400" /> Match Podium
          </div>

          {rankings.map(({ player, rank, stats }) => {
            const pColor = COLOR_MAP[player.color];
            return (
              <div
                key={player.id}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                  rank === 1
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-black w-6 text-center">
                    {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                  </span>
                  <span className="text-lg">{player.avatar}</span>
                  <div className="text-left">
                    <span className="text-xs font-bold block">{player.name}</span>
                    {stats && <span className="text-[10px] text-slate-400">{stats}</span>}
                  </div>
                </div>

                <div
                  className="w-3.5 h-3.5 rounded-full shadow"
                  style={{ backgroundColor: pColor.primary }}
                />
              </div>
            );
          })}
        </div>

        {/* Auto-Play Rematch Countdown Banner */}
        {isAutoPlay && (
          <div className="mb-4 p-3 rounded-2xl bg-amber-950/60 border border-amber-500/40 flex items-center justify-between text-xs shadow-inner">
            <span className="text-amber-300 font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
              {isPaused ? 'Auto-Rematch Paused' : `Auto-Rematch in ${countdown}s...`}
            </span>
            <button
              onClick={() => {
                setIsPaused((prev) => !prev);
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-amber-800/70 hover:bg-amber-700 text-amber-100 border border-amber-500/60 transition-all cursor-pointer"
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              rematchCalledRef.current = true;
              onHome();
            }}
            className="flex-1 py-3 px-4 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center justify-center gap-2 active:scale-95 text-xs cursor-pointer"
          >
            <Home className="w-4 h-4" /> Menu
          </button>
          <button
            onClick={() => {
              rematchCalledRef.current = true;
              onRematch();
            }}
            className="flex-1 py-3 px-4 rounded-xl font-bold bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 text-xs font-black cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> Rematch
          </button>
        </div>
      </div>
    </div>
  );
};
