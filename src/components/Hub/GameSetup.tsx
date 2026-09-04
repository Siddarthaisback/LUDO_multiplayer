import React, { useState } from 'react';
import { PlayerConfig, PlayerColor, BotDifficulty } from '../../types/game';
import { TaasGameId } from './CardRulesModal';
import { SnakesBoardTheme, SnakesGameOptions } from '../../types/snakes';
import { LudoGameOptions } from '../../types/ludo';
import { DEFAULT_AVATARS, COLOR_MAP } from '../../utils/constants';
import { ArrowLeft, Play, Users, Bot, User, Sparkles } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

interface GameSetupProps {
  gameType: TaasGameId;
  initialPlayers?: PlayerConfig[];
  onBack: () => void;
  onStartGame: (players: PlayerConfig[], options?: any) => void;
  onOpenOnlineMultiplayer?: () => void;
}

const GAME_METADATA: Record<TaasGameId, {
  title: string;
  icon: string;
  badge: string;
  description: string;
  allowedPlayerCounts: number[];
  defaultPlayerCount: number;
}> = {
  ludo: {
    title: 'Royal Ludo',
    icon: '🎲',
    badge: '👑 Royal Board',
    description: 'Roll 6 to launch from yard! Experience step-by-step block hopping and safe stars!',
    allowedPlayerCounts: [2, 3, 4],
    defaultPlayerCount: 4,
  },
  snakes: {
    title: 'Snakes & Ladders',
    icon: '🐍',
    badge: 'Classic Board',
    description: 'Climb ladders, avoid sneaky snakes, and race to tile 100!',
    allowedPlayerCounts: [2, 3, 4],
    defaultPlayerCount: 4,
  },
  callbreak: {
    title: 'Call Break',
    icon: '♠️',
    badge: 'Nepali Classic',
    description: 'Predict your tricks, follow suit, and overtrump with Spades in 5 rounds!',
    allowedPlayerCounts: [4],
    defaultPlayerCount: 4,
  },
  dhumbal: {
    title: 'Dhumbal / Jhyap',
    icon: '🔥',
    badge: 'Hand Reduction',
    description: 'Discard sets & runs, reduce hand to ≤ 5 points, and declare Dhumbal!',
    allowedPlayerCounts: [2, 3, 4, 5],
    defaultPlayerCount: 4,
  },
  jutpatti: {
    title: 'Jut Patti',
    icon: '✨',
    badge: 'Dynamic Pairs',
    description: '9-card deal with dynamic +1 Wild Joker rank! Form 5 complete pairs to win!',
    allowedPlayerCounts: [2, 3, 4],
    defaultPlayerCount: 2,
  },
  teenpatti: {
    title: 'Teen Patti Royale',
    icon: '👑',
    badge: '3-Card Poker',
    description: 'Play Seen or Blind, raise stakes, request Side Shows, and claim the pot!',
    allowedPlayerCounts: [3, 4, 5, 6],
    defaultPlayerCount: 4,
  },
  poker: {
    title: 'Texas Hold\'em Poker',
    icon: '🃏',
    badge: 'No-Limit Chips',
    description: 'Preflop, Flop, Turn, and River with full side-pot math and hand evaluations!',
    allowedPlayerCounts: [2, 3, 4, 5, 6],
    defaultPlayerCount: 4,
  },
};

export const GameSetup: React.FC<GameSetupProps> = ({
  gameType,
  initialPlayers,
  onBack,
  onStartGame,
  onOpenOnlineMultiplayer,
}) => {
  const meta = GAME_METADATA[gameType] || GAME_METADATA.callbreak;

  const [playerCount, setPlayerCount] = useState<number>(() => {
    if (initialPlayers && meta.allowedPlayerCounts.includes(initialPlayers.length)) {
      return initialPlayers.length;
    }
    return meta.defaultPlayerCount;
  });

  type TwoPlayerLudoPair = 'red-blue' | 'blue-red' | 'green-yellow' | 'yellow-green' | 'red-green';
  const [twoPlayerLudoMode, setTwoPlayerLudoMode] = useState<TwoPlayerLudoPair>('red-blue');

  const [players, setPlayers] = useState<PlayerConfig[]>(() => {
    if (initialPlayers && initialPlayers.length >= 2) {
      return initialPlayers;
    }
    return [
      { id: 'p1', name: 'Player 1 (You)', color: 'red', type: 'human', avatar: '🦁' },
      { id: 'p2', name: 'Bot Ramesh', color: 'blue', type: 'bot', difficulty: 'medium', avatar: '🐼' },
      { id: 'p3', name: 'Bot Sita', color: 'yellow', type: 'bot', difficulty: 'medium', avatar: '🤖' },
      { id: 'p4', name: 'Bot Bikram', color: 'green', type: 'bot', difficulty: 'master', avatar: '🐲' },
      { id: 'p5', name: 'Bot Maya', color: 'red', type: 'bot', difficulty: 'medium', avatar: '🦊' },
      { id: 'p6', name: 'Bot Aarav', color: 'green', type: 'bot', difficulty: 'easy', avatar: '🐯' },
    ];
  });

  // Snakes options
  const [snakesTheme, setSnakesTheme] = useState<SnakesBoardTheme>('classic');
  const [enablePowerUps, setEnablePowerUps] = useState(true);

  // Ludo options
  const [ludoBonusTurnOnSix, setLudoBonusTurnOnSix] = useState(true);
  const [ludoBonusTurnOnCapture, setLudoBonusTurnOnCapture] = useState(true);

  // Call Break options
  const [callBreakRounds, setCallBreakRounds] = useState<number>(5);

  const updatePlayer = (index: number, updates: Partial<PlayerConfig>) => {
    setPlayers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleStart = () => {
    let configuredPlayers: PlayerConfig[] = [];

    if (gameType === 'ludo' && playerCount === 2) {
      const colorPairs: Record<TwoPlayerLudoPair, [PlayerColor, PlayerColor]> = {
        'red-blue': ['red', 'blue'],
        'blue-red': ['blue', 'red'],
        'green-yellow': ['green', 'yellow'],
        'yellow-green': ['yellow', 'green'],
        'red-green': ['red', 'green'],
      };
      const [col1, col2] = colorPairs[twoPlayerLudoMode] || ['red', 'blue'];
      configuredPlayers = [
        { ...players[0], color: col1 },
        { ...players[1], color: col2 },
      ];
    } else {
      configuredPlayers = players.slice(0, playerCount);
    }

    if (gameType === 'snakes') {
      const options: SnakesGameOptions = {
        theme: snakesTheme,
        exactRollToWin: true,
        extraTurnOnSix: true,
        enablePowerUps,
      };
      onStartGame(configuredPlayers, options);
    } else if (gameType === 'ludo') {
      const options: LudoGameOptions = {
        requireSixToStart: true,
        bonusTurnOnSix: ludoBonusTurnOnSix,
        bonusTurnOnCapture: ludoBonusTurnOnCapture,
        bonusTurnOnHome: true,
        maxConsecutiveSixes: 3,
      };
      onStartGame(configuredPlayers, options);
    } else if (gameType === 'callbreak') {
      onStartGame(configuredPlayers, { roundCount: callBreakRounds });
    } else {
      onStartGame(configuredPlayers, undefined);
    }
  };

  return (
    <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 sm:p-6 animate-fade-in select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-all flex items-center gap-1.5 text-xs font-bold active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Lobby
        </button>

        <div className="flex items-center gap-2">
          <span className="text-2xl">{meta.icon}</span>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white leading-tight">
              {meta.title} Setup
            </h2>
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
              {meta.badge}
            </span>
          </div>
        </div>

        <div className="w-16" />
      </div>

      {/* Step 1: Number of Players (if selectable) */}
      {meta.allowedPlayerCounts.length > 1 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 sm:p-5 mb-5 shadow-xl">
          <label className="text-xs uppercase font-extrabold tracking-wider text-slate-300 block mb-3 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-amber-400" />
            <span>Select Number of Players</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {meta.allowedPlayerCounts.map((count) => (
              <button
                key={count}
                onClick={() => setPlayerCount(count)}
                className={`py-2.5 px-3 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all border cursor-pointer ${
                  playerCount === count
                    ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 scale-102'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <span>{count} Players</span>
              </button>
            ))}
          </div>

          {/* Ludo 2-Player Diagonals Choice */}
          {gameType === 'ludo' && playerCount === 2 && (
            <div className="mt-3.5 pt-3 border-t border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-bold">2-Player Color & Diagonal Matchup:</span>
                <span className="text-[11px] text-amber-400 font-semibold">Opposite Diagonals</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => setTwoPlayerLudoMode('red-blue')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center justify-center gap-1 ${
                    twoPlayerLudoMode === 'red-blue'
                      ? 'bg-indigo-600 border-indigo-400 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  🔴 Red vs 🔵 Blue
                </button>
                <button
                  onClick={() => setTwoPlayerLudoMode('blue-red')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center justify-center gap-1 ${
                    twoPlayerLudoMode === 'blue-red'
                      ? 'bg-indigo-600 border-indigo-400 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  🔵 Blue vs 🔴 Red
                </button>
                <button
                  onClick={() => setTwoPlayerLudoMode('green-yellow')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center justify-center gap-1 ${
                    twoPlayerLudoMode === 'green-yellow'
                      ? 'bg-indigo-600 border-indigo-400 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  🟢 Green vs 🟡 Yellow
                </button>
                <button
                  onClick={() => setTwoPlayerLudoMode('yellow-green')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center justify-center gap-1 ${
                    twoPlayerLudoMode === 'yellow-green'
                      ? 'bg-indigo-600 border-indigo-400 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  🟡 Yellow vs 🟢 Green
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Player Configurations */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 sm:p-5 mb-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs uppercase font-extrabold tracking-wider text-slate-300 flex items-center gap-1.5">
            <Bot className="w-4 h-4 text-emerald-400" />
            <span>Player Lineup & Bot AI</span>
          </label>
          <span className="text-[10px] text-slate-500 font-mono font-bold">
            {playerCount} Active Seats
          </span>
        </div>

        <div className="space-y-3">
          {players.slice(0, playerCount).map((p, idx) => {
            const colorPairs: Record<TwoPlayerLudoPair, [PlayerColor, PlayerColor]> = {
              'red-blue': ['red', 'blue'],
              'blue-red': ['blue', 'red'],
              'green-yellow': ['green', 'yellow'],
              'yellow-green': ['yellow', 'green'],
              'red-green': ['red', 'green'],
            };
            const effectiveColor: PlayerColor =
              gameType === 'ludo' && playerCount === 2
                ? (colorPairs[twoPlayerLudoMode] || ['red', 'blue'])[idx]
                : p.color;
            const colorInfo = COLOR_MAP[effectiveColor] || COLOR_MAP.red;
            return (
              <div
                key={p.id || idx}
                className="p-3 sm:p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all hover:border-slate-700"
              >
                {/* Avatar & Name */}
                <div className="flex items-center gap-3">
                  <div className="relative group">
                    <select
                      value={p.avatar}
                      onChange={(e) => updatePlayer(idx, { avatar: e.target.value })}
                      className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 text-lg flex items-center justify-center cursor-pointer text-center appearance-none shadow-inner"
                    >
                      {DEFAULT_AVATARS.map((av) => (
                        <option key={av} value={av}>
                          {av}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col">
                    <input
                      type="text"
                      value={p.name}
                      maxLength={16}
                      onChange={(e) => updatePlayer(idx, { name: e.target.value })}
                      className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1 text-xs font-bold text-white focus:outline-none focus:border-amber-400 w-32 sm:w-40 shadow-inner"
                    />
                    <span className={`text-[10px] font-bold ${colorInfo.text} mt-0.5 flex items-center gap-1`}>
                      <span>Seat {idx + 1}:</span>
                      <span>{colorInfo.name}</span>
                    </span>
                  </div>
                </div>

                {/* Human vs Bot Selector & Difficulty */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <div className="flex p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs">
                    <button
                      onClick={() => updatePlayer(idx, { type: 'human' })}
                      className={`px-2.5 py-1 rounded-lg font-black transition-all flex items-center gap-1 cursor-pointer ${
                        p.type === 'human'
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <User className="w-3 h-3" /> You / Human
                    </button>
                    <button
                      onClick={() => updatePlayer(idx, { type: 'bot' })}
                      className={`px-2.5 py-1 rounded-lg font-black transition-all flex items-center gap-1 cursor-pointer ${
                        p.type === 'bot'
                          ? 'bg-amber-500 text-slate-950 shadow font-extrabold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Bot className="w-3 h-3" /> Bot
                    </button>
                  </div>

                  {/* Difficulty selector if Bot */}
                  {p.type === 'bot' && (
                    <select
                      value={p.difficulty || 'medium'}
                      onChange={(e) =>
                        updatePlayer(idx, { difficulty: e.target.value as BotDifficulty })
                      }
                      className="bg-slate-900 border border-slate-700 text-xs font-bold text-slate-200 rounded-xl px-2 py-1.5 focus:outline-none focus:border-amber-400 cursor-pointer shadow"
                    >
                      <option value="easy">Easy (Casual)</option>
                      <option value="medium">Medium (Tactical)</option>
                      <option value="master">Master (Expert)</option>
                    </select>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 3: Game Options (if applicable) */}
      {gameType === 'snakes' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 sm:p-5 mb-5 shadow-xl">
          <label className="text-xs uppercase font-extrabold tracking-wider text-slate-300 block mb-3">
            Board Theme & Power-Ups
          </label>
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['classic', 'jungle', 'cyberpunk', 'royal'] as SnakesBoardTheme[]).map((theme) => (
                <button
                  key={theme}
                  onClick={() => setSnakesTheme(theme)}
                  className={`py-2 rounded-xl text-xs font-bold capitalize transition-all border cursor-pointer ${
                    snakesTheme === theme
                      ? 'bg-emerald-600 border-emerald-400 text-white shadow'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400'
                  }`}
                >
                  {theme}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-300 font-medium">Power-Up Tiles (Shields, Boosts, Freeze)</span>
              <input
                type="checkbox"
                checked={enablePowerUps}
                onChange={(e) => setEnablePowerUps(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {gameType === 'callbreak' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 sm:p-5 mb-5 shadow-xl">
          <label className="text-xs uppercase font-extrabold tracking-wider text-slate-300 block mb-3">
            Match Length
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setCallBreakRounds(5)}
              className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all border cursor-pointer ${
                callBreakRounds === 5
                  ? 'bg-amber-500 border-amber-400 text-slate-950 shadow font-black'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400'
              }`}
            >
              5 Rounds (Standard Nepali Tourney)
            </button>
            <button
              onClick={() => setCallBreakRounds(1)}
              className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all border cursor-pointer ${
                callBreakRounds === 1
                  ? 'bg-amber-500 border-amber-400 text-slate-950 shadow font-black'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400'
              }`}
            >
              1 Round (Quick Blitz)
            </button>
          </div>
        </div>
      )}

      {/* Start Game Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {gameType === 'ludo' && onOpenOnlineMultiplayer && (
          <button
            type="button"
            onClick={onOpenOnlineMultiplayer}
            className="w-full sm:w-auto px-6 py-4 rounded-2xl font-black text-sm text-cyan-200 bg-cyan-950/80 hover:bg-cyan-900/90 border border-cyan-500/50 shadow-lg hover:shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
          >
            <span>🌐</span>
            <span>Play Online With Friends</span>
          </button>
        )}
        <button
          onClick={handleStart}
          className="flex-1 w-full py-4 px-6 rounded-2xl font-black text-base text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 shadow-xl hover:shadow-amber-500/25 transition-all flex items-center justify-center gap-2.5 active:scale-98 cursor-pointer"
        >
          <Play className="w-5 h-5 fill-slate-950" />
          <span>Enter Play &bull; Start Match</span>
        </button>
      </div>
    </div>
  );
};
