import React from 'react';
import { X, Trophy, Award, Crown, CheckCircle2 } from 'lucide-react';
import { CallBreakPlayerState } from '../engine/CallBreakEngine';

interface CallBreakScorecardModalProps {
  players: CallBreakPlayerState[];
  currentRound: number;
  totalRounds: number;
  onClose: () => void;
}

export const CallBreakScorecardModal: React.FC<CallBreakScorecardModalProps> = ({
  players,
  currentRound,
  totalRounds = 5,
  onClose,
}) => {
  // Sort players by totalScore descending for ranking
  const ranked = [...players].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in select-none">
      <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-400/50 rounded-3xl max-w-2xl w-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base sm:text-lg font-black text-white leading-none">CALL BREAK SCORECARD</h2>
              <span className="text-[10px] uppercase font-bold text-amber-300">
                5-Round Official Match Record (Round {currentRound} of {totalRounds})
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scoresheet Table */}
        <div className="p-4 sm:p-6 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-black uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Player</th>
                {[1, 2, 3, 4, 5].slice(0, totalRounds).map((r) => (
                  <th key={r} className="py-2.5 px-2 text-center">
                    R{r}
                  </th>
                ))}
                <th className="py-2.5 px-3 text-right text-amber-400">Total Score</th>
                <th className="py-2.5 px-2 text-center text-amber-300">Rank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-semibold">
              {players.map((p, idx) => {
                const rankIdx = ranked.findIndex((r) => r.config.id === p.config.id) + 1;
                const isLeader = rankIdx === 1;

                return (
                  <tr
                    key={p.config.id}
                    className={`transition-colors ${
                      idx === 0 ? 'bg-amber-500/10' : 'hover:bg-slate-800/30'
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{p.config.avatar}</span>
                        <div>
                          <span className="font-black text-white block">
                            {p.config.name} {idx === 0 ? '(You)' : ''}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Bid: {p.bid || '-'} | Won: {p.tricksWon}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Round-by-Round Scores */}
                    {[0, 1, 2, 3, 4].slice(0, totalRounds).map((rIdx) => {
                      const rScore = p.roundScores[rIdx];
                      const isPlayed = rScore !== undefined;

                      return (
                        <td key={rIdx} className="py-3 px-2 text-center font-mono">
                          {isPlayed ? (
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                rScore > 0
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {rScore > 0 ? `+${rScore.toFixed(1)}` : rScore.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-xs">-</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Total Cumulative Score */}
                    <td className="py-3 px-3 text-right font-mono font-black text-sm">
                      <span className={p.totalScore >= 0 ? 'text-amber-300' : 'text-rose-400'}>
                        {p.totalScore.toFixed(1)} pts
                      </span>
                    </td>

                    {/* Rank Badge */}
                    <td className="py-3 px-2 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                          isLeader
                            ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/40 font-mono'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {rankIdx === 1 ? '👑' : rankIdx}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            Formula: <span className="text-amber-300 font-bold">Bid + (Overtricks × 0.1)</span> | Missed Bid = <span className="text-rose-400 font-bold">-Bid</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs uppercase tracking-wider"
          >
            Close Sheet
          </button>
        </div>
      </div>
    </div>
  );
};
