import React, { useState } from 'react';
import { GameType } from '../../types/game';
import { X, BookOpen, Shield, Zap, Sparkles, CheckCircle2 } from 'lucide-react';

interface RulesModalProps {
  initialGame?: GameType;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ initialGame = 'ludo', onClose }) => {
  const [activeTab, setActiveTab] = useState<GameType>(initialGame);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 animate-fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <h3 className="text-xl font-black text-white">How to Play</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Game Tab Selector */}
        <div className="flex p-1 bg-slate-950/60 rounded-xl my-4 border border-slate-800">
          <button
            onClick={() => setActiveTab('ludo')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'ludo'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🎲 Ludo Royale
          </button>
          <button
            onClick={() => setActiveTab('snakes')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'snakes'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🐍 Snakes & Ladders
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-sm text-slate-300">
          {activeTab === 'ludo' ? (
            <>
              <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80">
                <h4 className="font-bold text-indigo-400 text-base mb-2">🎯 Objective</h4>
                <p>Move all 4 of your colored tokens around the 52-tile board and into your home triangle first.</p>
              </div>

              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">1</div>
                  <div>
                    <h5 className="font-bold text-slate-100">Exiting the Yard</h5>
                    <p className="text-xs text-slate-400">Roll a <strong>6</strong> to release a token from your yard onto your starting square.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">2</div>
                  <div>
                    <h5 className="font-bold text-slate-100">Bonus Turns</h5>
                    <p className="text-xs text-slate-400">Rolling a 6 grants an extra roll! You also earn bonus rolls upon capturing an opponent or reaching Home. (3 consecutive 6s skips your turn).</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">3</div>
                  <div>
                    <h5 className="font-bold text-slate-100">Capturing & Safe Zones</h5>
                    <p className="text-xs text-slate-400">Landing on an opponent's token sends it back to their Yard! However, star squares ⭐ and starting squares are safe zones where tokens cannot be captured.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">4</div>
                  <div>
                    <h5 className="font-bold text-slate-100">Entering Home</h5>
                    <p className="text-xs text-slate-400">After completing a full lap around the board, enter your colored home column. You need an exact roll to enter the central Home!</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80">
                <h4 className="font-bold text-emerald-400 text-base mb-2">🎯 Objective</h4>
                <p>Navigate your pawn from tile 1 to tile 100 on the 10x10 board. First player to reach 100 wins!</p>
              </div>

              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">🪜</div>
                  <div>
                    <h5 className="font-bold text-slate-100">Ladders</h5>
                    <p className="text-xs text-slate-400">Landing on the base of a ladder automatically climbs you up to the top tile!</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">🐍</div>
                  <div>
                    <h5 className="font-bold text-slate-100">Snakes</h5>
                    <p className="text-xs text-slate-400">Landing on a snake's mouth slides your pawn down to its tail tile.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">⚡</div>
                  <div>
                    <h5 className="font-bold text-slate-100">Power-Ups (Special Mode)</h5>
                    <p className="text-xs text-slate-400">Collect Shields 🛡️ to deflect snakes, Boosts ⚡ to surge forward, and Freeze ❄️ to pause rivals!</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">🏁</div>
                  <div>
                    <h5 className="font-bold text-slate-100">Exact 100 Finish</h5>
                    <p className="text-xs text-slate-400">You must reach tile 100 by exact roll. If you roll more than needed, your pawn bounces backwards!</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-800 text-center">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            Got It, Let's Play!
          </button>
        </div>
      </div>
    </div>
  );
};
