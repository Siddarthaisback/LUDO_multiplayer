import React from 'react';
import { X, User, Trophy, Flame, Award, Volume2, VolumeX, Sparkles, DollarSign } from 'lucide-react';
import { soundEffects } from '../../engine/soundEffects';

interface PlayerProfileModalProps {
  onClose: () => void;
}

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({ onClose }) => {
  const soundEnabled = soundEffects.getSoundEnabled();

  const handleToggleSound = () => {
    soundEffects.setSoundEnabled(!soundEnabled);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in select-none">
      <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/40 rounded-3xl max-w-md w-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <User className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-lg font-black text-white leading-none">PLAYER PROFILE & STATS</h2>
              <span className="text-[10px] uppercase font-bold text-amber-300">Taas Arena Record</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Card */}
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-4 bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-3xl shadow-inner">
              👑
            </div>
            <div>
              <h3 className="text-base font-black text-white">Royale Master</h3>
              <span className="text-xs text-amber-400 font-bold">VIP Card Club Member</span>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-400 font-mono font-bold">
                <DollarSign className="w-3.5 h-3.5" /> 5,420 Virtual Chips
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2.5 text-slate-300">
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Call Break Success
              </span>
              <span className="text-lg font-black text-amber-300 mt-0.5">88.4%</span>
              <span className="text-[9px] text-slate-500">Avg Bid: 3.4</span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Dhumbal Wins
              </span>
              <span className="text-lg font-black text-emerald-400 mt-0.5">24 Matches</span>
              <span className="text-[9px] text-slate-500">Undercuts: 1</span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Jut Patti 5-Pairs
              </span>
              <span className="text-lg font-black text-indigo-300 mt-0.5">18 Wins</span>
              <span className="text-[9px] text-slate-500">Quickest: 3 turns</span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Poker / Teen Patti
              </span>
              <span className="text-lg font-black text-yellow-400 mt-0.5">$14,800 Pot</span>
              <span className="text-[9px] text-slate-500">Showdowns: 42</span>
            </div>
          </div>

          {/* Audio Setting Toggle */}
          <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
              <span>Web Audio & Card SFX</span>
            </div>
            <button
              onClick={handleToggleSound}
              className={`px-3 py-1 rounded-xl text-xs font-black transition-all ${
                soundEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}
            >
              {soundEnabled ? 'ENABLED' : 'MUTED'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl font-bold bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs uppercase tracking-wider"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
