import React from 'react';
import { LudoTokenState } from '../../types/ludo';
import { PlayerColor } from '../../types/game';
import { Crown, Home, Shield, Zap } from 'lucide-react';

interface PlayerStatusPillsProps {
  tokens: LudoTokenState[];
  color: PlayerColor;
}

export const PlayerStatusPills: React.FC<PlayerStatusPillsProps> = ({ tokens, color }) => {
  const colorThemes = {
    red: { bg: 'bg-red-500', glow: 'shadow-red-500/50' },
    green: { bg: 'bg-emerald-500', glow: 'shadow-emerald-500/50' },
    yellow: { bg: 'bg-amber-500', glow: 'shadow-amber-500/50' },
    blue: { bg: 'bg-blue-500', glow: 'shadow-blue-500/50' },
  }[color];

  return (
    <div className="flex items-center gap-1 mt-1">
      {tokens.map((token) => {
        let label = 'Yard';
        let badgeStyle = 'bg-slate-800 text-slate-400 border-slate-700';
        let icon = <Home className="w-2.5 h-2.5" />;

        if (token.status === 'home' || token.step >= 56) {
          label = 'Home';
          badgeStyle = 'bg-amber-500 text-slate-950 border-amber-300 font-bold shadow-sm shadow-amber-400/50';
          icon = <Crown className="w-2.5 h-2.5" fill="#020617" />;
        } else if (token.status === 'runway' || token.step >= 51) {
          label = `R${token.step - 50}`;
          badgeStyle = `${colorThemes.bg} text-white border-white/50 font-bold animate-pulse`;
          icon = <Zap className="w-2.5 h-2.5" />;
        } else if (token.status === 'track' && token.step >= 0) {
          label = `${token.step}`;
          badgeStyle = `${colorThemes.bg}/30 text-slate-200 border-${color}-400/40`;
          icon = <Shield className="w-2.5 h-2.5" />;
        }

        return (
          <div
            key={token.id}
            title={`Pawn #${token.id + 1}: ${label}`}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border text-[9px] transition-all ${badgeStyle}`}
          >
            {icon}
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
};
