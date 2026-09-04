import React from 'react';
import { PlayerConfig } from '../../types/game';
import { LudoTokenState } from '../../types/ludo';
import { PlayerStatusPills } from '../../games/ludo/PlayerStatusPills';
import { COLOR_MAP } from '../../utils/constants';
import { Bot, User, Trophy, Shield, Zap } from 'lucide-react';

interface PlayerCardProps {
  player: PlayerConfig;
  isActive: boolean;
  scoreLabel?: string;
  scoreValue?: string | number;
  rank?: number;
  hasShield?: boolean;
  isFrozen?: boolean;
  consecutiveSixes?: number;
  tokens?: LudoTokenState[];
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  isActive,
  scoreLabel = 'Progress',
  scoreValue = 0,
  rank,
  hasShield = false,
  isFrozen = false,
  consecutiveSixes = 0,
  tokens,
}) => {
  const colorInfo = COLOR_MAP[player.color];

  return (
    <div
      className={`relative p-3 rounded-2xl transition-all duration-300 border ${
        isActive
          ? `bg-[#24130c] shadow-xl ring-2 ${colorInfo.border} scale-[1.02] z-10 border-amber-500/40`
          : 'bg-[#180c07]/90 border-amber-900/30 hover:border-amber-700/40 opacity-90'
      }`}
      style={{
        boxShadow: isActive ? `0 0 20px -2px ${colorInfo.primary}33` : undefined,
      }}
    >
      {/* Active turn badge */}
      {isActive && (
        <span
          className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-white shadow-md animate-pulse"
          style={{ backgroundColor: colorInfo.primary }}
        >
          Turn
        </span>
      )}

      {/* Rank Crown if finished */}
      {rank && (
        <div className="absolute -top-3 -left-2 bg-gradient-to-r from-amber-400 to-yellow-600 text-slate-950 px-2 py-0.5 rounded-full text-xs font-black flex items-center gap-1 shadow-lg border border-yellow-300">
          <Trophy className="w-3.5 h-3.5" />
          #{rank}
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* Avatar with color ring */}
        <div className="relative">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shadow-inner border-2"
            style={{
              borderColor: colorInfo.primary,
              backgroundColor: `${colorInfo.primary}20`,
            }}
          >
            {player.avatar}
          </div>
          <span
            className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow"
            style={{ backgroundColor: colorInfo.primary }}
          >
            {player.type === 'bot' ? <Bot className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-bold text-slate-100 truncate">{player.name}</h4>
          </div>
          
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[11px] font-semibold ${colorInfo.text}`}>
              {colorInfo.name}
            </span>
            {player.type === 'bot' && player.difficulty && (
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {player.difficulty}
              </span>
            )}
          </div>
        </div>

        {/* Progress / Status */}
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
            {scoreLabel}
          </div>
          <div className="text-base font-black text-slate-100">{scoreValue}</div>
        </div>
      </div>

      {/* 4 Mini Pawn Status Tracker */}
      {tokens && tokens.length > 0 && (
        <div className="mt-2 pt-1.5 border-t border-slate-800/60">
          <PlayerStatusPills tokens={tokens} color={player.color} />
        </div>
      )}

      {/* Buffs & Statuses */}
      {(hasShield || isFrozen || consecutiveSixes > 0) && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800/80">
          {hasShield && (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
              <Shield className="w-3 h-3" /> Shielded
            </span>
          )}
          {isFrozen && (
            <span className="inline-flex items-center gap-1 text-[11px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30">
              ❄️ Frozen
            </span>
          )}
          {consecutiveSixes > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
              <Zap className="w-3 h-3" /> 6s: {consecutiveSixes}/3
            </span>
          )}
        </div>
      )}
    </div>
  );
};
