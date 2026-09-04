import React, { useState } from 'react';
import { PlayerConfig, PlayerColor, BotDifficulty } from '../../../types/game';
import { LudoGameOptions } from '../../../types/ludo';
import { Users, Bot, User, Play, Sparkles, X, Shield, Zap, Settings2 } from 'lucide-react';
import { HUMAN_NAME_POOL } from '../../../utils/constants';

interface LudoSetupModalProps {
  isOpen: boolean;
  onStartGame: (players: PlayerConfig[], options: LudoGameOptions) => void;
  onClose: () => void;
}

const COLOR_DEFAULTS: { color: PlayerColor; name: string; avatar: string; bg: string; border: string }[] = [
  { color: 'red', name: HUMAN_NAME_POOL[0], avatar: '🦁', bg: 'bg-red-500', border: 'border-red-400' },
  { color: 'green', name: HUMAN_NAME_POOL[1], avatar: '🐼', bg: 'bg-emerald-500', border: 'border-emerald-400' },
  { color: 'yellow', name: HUMAN_NAME_POOL[2], avatar: '🦊', bg: 'bg-amber-500', border: 'border-amber-400' },
  { color: 'blue', name: HUMAN_NAME_POOL[3], avatar: '🐯', bg: 'bg-blue-500', border: 'border-blue-400' },
];

export const LudoSetupModal: React.FC<LudoSetupModalProps> = ({
  isOpen,
  onStartGame,
  onClose,
}) => {
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(4);
  const [playerTypes, setPlayerTypes] = useState<('human' | 'bot')[]>(['human', 'bot', 'bot', 'bot']);
  const [playerNames, setPlayerNames] = useState<string[]>([
    `${HUMAN_NAME_POOL[0]} (You)`,
    HUMAN_NAME_POOL[1],
    HUMAN_NAME_POOL[2],
    HUMAN_NAME_POOL[3],
  ]);
  const [playerDifficulties, setPlayerDifficulties] = useState<BotDifficulty[]>(['medium', 'medium', 'medium', 'medium']);

  type TwoPlayerLudoPair = 'red-blue' | 'blue-red' | 'green-yellow' | 'yellow-green';
  const [twoPlayerMode, setTwoPlayerMode] = useState<TwoPlayerLudoPair>('red-blue');

  const colorMap = {
    red: COLOR_DEFAULTS[0],
    green: COLOR_DEFAULTS[1],
    yellow: COLOR_DEFAULTS[2],
    blue: COLOR_DEFAULTS[3],
  };
  const pairs: Record<TwoPlayerLudoPair, [typeof COLOR_DEFAULTS[0], typeof COLOR_DEFAULTS[0]]> = {
    'red-blue': [colorMap.red, colorMap.blue],
    'blue-red': [colorMap.blue, colorMap.red],
    'green-yellow': [colorMap.green, colorMap.yellow],
    'yellow-green': [colorMap.yellow, colorMap.green],
  };

  if (!isOpen) return null;

  const handleStart = () => {
    let activeColors: typeof COLOR_DEFAULTS = [];

    if (playerCount === 2) {
      activeColors = pairs[twoPlayerMode] || [colorMap.red, colorMap.blue];
    } else if (playerCount === 3) {
      activeColors = [COLOR_DEFAULTS[0], COLOR_DEFAULTS[1], COLOR_DEFAULTS[2]];
    } else {
      activeColors = COLOR_DEFAULTS;
    }

    const configuredPlayers: PlayerConfig[] = activeColors.map((col, idx) => ({
      id: `p-${col.color}`,
      name: playerNames[idx] || col.name,
      avatar: col.avatar,
      color: col.color,
      type: playerTypes[idx] || (idx === 0 ? 'human' : 'bot'),
      difficulty: playerTypes[idx] === 'bot' ? playerDifficulties[idx] : undefined,
    }));

    const options: LudoGameOptions = {
      requireSixToStart: true,
      bonusTurnOnSix: true,
      bonusTurnOnCapture: true,
      bonusTurnOnHome: true,
      maxConsecutiveSixes: 3,
    };

    onStartGame(configuredPlayers, options);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 animate-fade-in select-none">
      <div className="relative w-full max-w-xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/50 rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-2xl">
              🎲
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white">Ludo Match Setup</h2>
              <p className="text-xs text-amber-400 font-semibold">Customize players, bots & mode</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Player Count Selector */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-amber-400" />
            <span>Select Number of Players</span>
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {([2, 3, 4] as const).map((count) => (
              <button
                key={count}
                onClick={() => setPlayerCount(count)}
                className={`py-2.5 px-3 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 border-2 ${
                  playerCount === count
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/30 scale-102'
                    : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                <span>{count} Players</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. 2-Player Board Configuration */}
        {playerCount === 2 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300">2-Player Color & Diagonal Matchup:</span>
              <span className="text-[10px] text-amber-400 font-semibold">Opposite Diagonals</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTwoPlayerMode('red-blue')}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all border ${
                  twoPlayerMode === 'red-blue'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                🔴 Red vs 🔵 Blue
              </button>
              <button
                onClick={() => setTwoPlayerMode('blue-red')}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all border ${
                  twoPlayerMode === 'blue-red'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                🔵 Blue vs 🔴 Red
              </button>
              <button
                onClick={() => setTwoPlayerMode('green-yellow')}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all border ${
                  twoPlayerMode === 'green-yellow'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                🟢 Green vs 🟡 Yellow
              </button>
              <button
                onClick={() => setTwoPlayerMode('yellow-green')}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all border ${
                  twoPlayerMode === 'yellow-green'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                🟡 Yellow vs 🟢 Green
              </button>
            </div>
          </div>
        )}

        {/* 3. Player Slot Configuration (Human vs Bot) */}
        <div className="flex flex-col gap-2.5">
          <label className="text-xs font-black uppercase tracking-wider text-slate-300">
            Player Slot Settings
          </label>
          <div className="space-y-2.5">
            {Array.from({ length: playerCount }).map((_, idx) => {
              const colorInfo =
                playerCount === 2
                  ? (pairs[twoPlayerMode] || [colorMap.red, colorMap.blue])[idx]
                  : COLOR_DEFAULTS[idx];

              const currentType = playerTypes[idx] || (idx === 0 ? 'human' : 'bot');
              const currentDiff = playerDifficulties[idx] || 'medium';

              return (
                <div
                  key={idx}
                  className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-xl ${colorInfo.bg} flex items-center justify-center text-base font-black text-white shadow-md`}
                    >
                      {colorInfo.avatar}
                    </div>
                    <div>
                      <input
                        type="text"
                        value={playerNames[idx] || (idx === 0 ? 'Player 1 (You)' : `Bot ${idx + 1}`)}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPlayerNames((prev) => {
                            const next = [...prev];
                            next[idx] = val;
                            return next;
                          });
                        }}
                        className="bg-transparent text-white font-bold text-xs sm:text-sm focus:outline-none border-b border-transparent focus:border-amber-400 w-32 sm:w-36"
                      />
                      <span className="block text-[10px] text-slate-400 uppercase font-semibold">
                        {colorInfo.color} Quadrant
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Human vs Bot Toggle */}
                    <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5">
                      <button
                        onClick={() => {
                          setPlayerTypes((prev) => {
                            const next = [...prev];
                            next[idx] = 'human';
                            return next;
                          });
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                          currentType === 'human'
                            ? 'bg-amber-500 text-slate-950 font-black shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <User className="w-3 h-3" />
                        <span>Human</span>
                      </button>
                      <button
                        onClick={() => {
                          setPlayerTypes((prev) => {
                            const next = [...prev];
                            next[idx] = 'bot';
                            return next;
                          });
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                          currentType === 'bot'
                            ? 'bg-indigo-600 text-white font-black shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Bot className="w-3 h-3" />
                        <span>Bot</span>
                      </button>
                    </div>

                    {/* Bot Difficulty Selector (Only if Bot) */}
                    {currentType === 'bot' && (
                      <select
                        value={currentDiff}
                        onChange={(e) => {
                          const val = e.target.value as BotDifficulty;
                          setPlayerDifficulties((prev) => {
                            const next = [...prev];
                            next[idx] = val;
                            return next;
                          });
                        }}
                        className="bg-slate-900 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl px-2 py-1 focus:outline-none"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="master">Master</option>
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Start Game Action Button */}
        <button
          onClick={handleStart}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2"
        >
          <Play className="w-4 h-4 fill-slate-950" />
          <span>Launch Ludo Game</span>
        </button>
      </div>
    </div>
  );
};
