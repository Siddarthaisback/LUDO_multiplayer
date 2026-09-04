import React from 'react';
import { GameType } from '../../types/game';
import { Users, Globe, Sparkles, BookOpen, Crown, Play, Trophy } from 'lucide-react';
import { LuxuryToken } from '../UI/LuxuryToken';

interface MainMenuProps {
  onSelectGame: (game: GameType, mode: 'local' | 'online') => void;
  onOpenRules: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onSelectGame, onOpenRules }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full p-4 sm:p-6 animate-fade-in">
      {/* Visual Hero Banner Card */}
      <div className="relative w-full max-w-4xl rounded-3xl overflow-hidden mb-8 border-2 border-amber-500/40 shadow-2xl bg-slate-950">
        <div className="h-48 sm:h-60 w-full relative overflow-hidden bg-gradient-to-br from-amber-600/30 via-slate-900 to-indigo-900/40">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/65 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-slate-950/80" />
        </div>

        <div className="absolute bottom-4 left-4 right-4 sm:left-8 sm:right-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/25 border border-amber-400/50 text-amber-300 text-xs font-black uppercase tracking-wider mb-1.5 shadow-lg backdrop-blur-md">
              <Crown className="w-3.5 h-3.5 text-amber-400" /> Royal Master Edition
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-none drop-shadow-md">
              LUDO & SNAKES ROYALE
            </h1>
          </div>

          {/* 4 Luxury Tokens Row */}
          <div className="flex items-center gap-2.5 bg-slate-900/85 px-3.5 py-2 rounded-2xl border border-amber-500/40 backdrop-blur-md shadow-xl">
            <LuxuryToken color="red" size={26} />
            <LuxuryToken color="green" size={26} />
            <LuxuryToken color="yellow" size={26} />
            <LuxuryToken color="blue" size={26} />
          </div>
        </div>
      </div>

      {/* Game Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mb-8">
        {/* Game 1: Ludo Royale */}
        <div className="group relative bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-indigo-500/40 hover:border-indigo-400 rounded-3xl p-5 sm:p-6 shadow-2xl transition-all duration-300 hover:shadow-indigo-500/25 hover:-translate-y-1 flex flex-col justify-between overflow-hidden">
          <div className="absolute top-4 right-4 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] uppercase font-black px-2.5 py-1 rounded-full">
            Classic 15x15
          </div>

          <div>
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-2xl mb-3 shadow-inner">
              🎲
            </div>
            <h3 className="text-xl font-black text-white mb-2 group-hover:text-indigo-300 transition-colors">
              Ludo Royale
            </h3>
            <p className="text-slate-400 text-xs leading-relaxed mb-6">
              Handcrafted luxury board experience! Race 4 royal pawns around safe star zones into the center.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => onSelectGame('ludo', 'local')}
              className="w-full py-2.5 px-3 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5 text-xs"
            >
              <Users className="w-3.5 h-3.5" /> Play Local / Bots
            </button>
            <button
              onClick={() => onSelectGame('ludo', 'online')}
              className="w-full py-2 px-3 rounded-xl font-bold bg-slate-800/80 hover:bg-slate-700 text-indigo-200 border border-indigo-500/30 transition-all flex items-center justify-center gap-1.5 active:scale-95 text-[11px]"
            >
              <Globe className="w-3 h-3" /> Online Room
            </button>
          </div>
        </div>

        {/* Game 2: Snakes & Ladders */}
        <div className="group relative bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-emerald-500/40 hover:border-emerald-400 rounded-3xl p-5 sm:p-6 shadow-2xl transition-all duration-300 hover:shadow-emerald-500/25 hover:-translate-y-1 flex flex-col justify-between overflow-hidden">
          <div className="absolute top-4 right-4 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] uppercase font-black px-2.5 py-1 rounded-full">
            100 Tiles
          </div>

          <div>
            <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-2xl mb-3 shadow-inner">
              🐍
            </div>
            <h3 className="text-xl font-black text-white mb-2 group-hover:text-emerald-300 transition-colors">
              Snakes & Ladders
            </h3>
            <p className="text-slate-400 text-xs leading-relaxed mb-6">
              Ascend across 100 tiles! Climb golden ladders, dodge serpents, and unlock shields and speed boosts.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => onSelectGame('snakes', 'local')}
              className="w-full py-2.5 px-3 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5 text-xs"
            >
              <Users className="w-3.5 h-3.5" /> Play Local / Bots
            </button>
            <button
              onClick={() => onSelectGame('snakes', 'online')}
              className="w-full py-2 px-3 rounded-xl font-bold bg-slate-800/80 hover:bg-slate-700 text-emerald-200 border border-emerald-500/30 transition-all flex items-center justify-center gap-1.5 active:scale-95 text-[11px]"
            >
              <Globe className="w-3 h-3" /> Online Room
            </button>
          </div>
        </div>

        {/* Game 3: VIP Card Games (Blackjack / Poker) */}
        <div className="group relative bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/40 hover:border-amber-400 rounded-3xl p-5 sm:p-6 shadow-2xl transition-all duration-300 hover:shadow-amber-500/25 hover:-translate-y-1 flex flex-col justify-between overflow-hidden">
          <div className="absolute top-4 right-4 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] uppercase font-black px-2.5 py-1 rounded-full">
            VIP 52-Card
          </div>

          <div>
            <div className="w-14 h-14 rounded-2xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-2xl mb-3 shadow-inner">
              ♠️
            </div>
            <h3 className="text-xl font-black text-white mb-2 group-hover:text-amber-300 transition-colors">
              Card Games Royale
            </h3>
            <p className="text-slate-400 text-xs leading-relaxed mb-6">
              VIP Casino Lounge! Play Blackjack 21, 3-Card Poker, and Spades on rich emerald felt with 3D chips.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => onSelectGame('cards', 'local')}
              className="w-full py-2.5 px-3 rounded-xl font-bold bg-amber-600 hover:bg-amber-500 text-slate-950 font-black shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5 text-xs"
            >
              <Users className="w-3.5 h-3.5" /> Play VIP Table
            </button>
            <button
              onClick={() => onSelectGame('cards', 'online')}
              className="w-full py-2 px-3 rounded-xl font-bold bg-slate-800/80 hover:bg-slate-700 text-amber-200 border border-amber-500/30 transition-all flex items-center justify-center gap-1.5 active:scale-95 text-[11px]"
            >
              <Globe className="w-3 h-3" /> Online Multiplayer
            </button>
          </div>
        </div>
      </div>

      {/* Rules & Help button */}
      <button
        onClick={onOpenRules}
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition-all shadow-md active:scale-95 text-xs font-semibold"
      >
        <BookOpen className="w-4 h-4 text-amber-400" />
        <span>How to Play & Official Rules</span>
      </button>
    </div>
  );
};
