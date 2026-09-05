import React, { useState } from 'react';
import { PlayerConfig, PlayerColor, BotDifficulty } from '../../types/game';
import { LudoGameOptions, LudoMode } from '../../types/ludo';
import { Users, Bot, Globe, Play, Sparkles, ArrowLeft, Shield, ChevronRight, Settings } from 'lucide-react';
import { COLOR_MAP, DEFAULT_AVATARS } from '../../utils/constants';

interface LudoModeMenuProps {
  isNative: boolean;
  onStartOfflineGame: (players: PlayerConfig[], options: LudoGameOptions) => void;
  onOpenOnlineMultiplayer: () => void;
  onBackToHub?: () => void;
  onResumeGame?: () => void;
}

const LUDO_COLORS: { color: PlayerColor; defaultName: string; defaultAvatar: string }[] = [
  { color: 'red', defaultName: 'Player 1', defaultAvatar: '🦁' },
  { color: 'green', defaultName: 'Player 2', defaultAvatar: '🐼' },
  { color: 'yellow', defaultName: 'Player 3', defaultAvatar: '🦊' },
  { color: 'blue', defaultName: 'Player 4', defaultAvatar: '🐯' },
];

export function createPassAndPlayPlayers(
  count: 2 | 3 | 4,
  twoPlayerPair: 'red-blue' | 'green-yellow' = 'red-blue',
  customNames?: string[],
  customAvatars?: string[]
): PlayerConfig[] {
  if (count === 2) {
    const pairColors: [PlayerColor, PlayerColor] =
      twoPlayerPair === 'green-yellow' ? ['green', 'yellow'] : ['red', 'blue'];

    return pairColors.map((color, idx) => {
      const def = LUDO_COLORS.find((c) => c.color === color) || LUDO_COLORS[idx];
      return {
        id: `local-p-${color}`,
        name: customNames?.[idx] || (idx === 0 ? 'Player 1' : 'Player 2'),
        color,
        type: 'human',
        avatar: customAvatars?.[idx] || def.defaultAvatar,
      };
    });
  }

  const selectedDefs = count === 3 ? LUDO_COLORS.slice(0, 3) : LUDO_COLORS;
  return selectedDefs.map((def, idx) => ({
    id: `local-p-${def.color}`,
    name: customNames?.[idx] || `Player ${idx + 1}`,
    color: def.color,
    type: 'human',
    avatar: customAvatars?.[idx] || def.defaultAvatar,
  }));
}

export function createSoloVsBotPlayers(
  count: 2 | 3 | 4,
  difficulty: BotDifficulty = 'medium',
  twoPlayerPair: 'red-blue' | 'green-yellow' = 'red-blue',
  humanName: string = 'You',
  humanAvatar: string = '🦁'
): PlayerConfig[] {
  const BOT_NAMES = ['Bot Ramesh', 'Bot Sita', 'Bot Bikram'];
  const BOT_AVATARS = ['🤖', '🐲', '⚡'];

  if (count === 2) {
    const [humanColor, botColor]: [PlayerColor, PlayerColor] =
      twoPlayerPair === 'green-yellow' ? ['green', 'yellow'] : ['red', 'blue'];

    return [
      {
        id: `human-${humanColor}`,
        name: humanName,
        color: humanColor,
        type: 'human',
        avatar: humanAvatar,
      },
      {
        id: `bot-${botColor}`,
        name: BOT_NAMES[0],
        color: botColor,
        type: 'bot',
        difficulty,
        avatar: BOT_AVATARS[0],
      },
    ];
  }

  const selectedDefs = count === 3 ? LUDO_COLORS.slice(0, 3) : LUDO_COLORS;
  return selectedDefs.map((def, idx) => {
    if (idx === 0) {
      return {
        id: `human-${def.color}`,
        name: humanName,
        color: def.color,
        type: 'human',
        avatar: humanAvatar,
      };
    }
    const botIdx = idx - 1;
    return {
      id: `bot-${def.color}`,
      name: BOT_NAMES[botIdx] || `Bot ${idx}`,
      color: def.color,
      type: 'bot',
      difficulty,
      avatar: BOT_AVATARS[botIdx] || '🤖',
    };
  });
}

export const LudoModeMenu: React.FC<LudoModeMenuProps> = ({
  isNative,
  onStartOfflineGame,
  onOpenOnlineMultiplayer,
  onBackToHub,
  onResumeGame,
}) => {
  const [selectedTab, setSelectedTab] = useState<'pass_and_play' | 'solo_vs_bots'>('pass_and_play');
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(4);
  const [twoPlayerPair, setTwoPlayerPair] = useState<'red-blue' | 'green-yellow'>('red-blue');
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('medium');
  const [showCustomization, setShowCustomization] = useState(false);

  // Custom player names & avatars for Pass & Play
  const [customNames, setCustomNames] = useState<string[]>(['Player 1', 'Player 2', 'Player 3', 'Player 4']);
  const [customAvatars, setCustomAvatars] = useState<string[]>(['🦁', '🐼', '🦊', '🐯']);

  const handleStartPassAndPlay = () => {
    const players = createPassAndPlayPlayers(playerCount, twoPlayerPair, customNames, customAvatars);
    const options: LudoGameOptions = {
      requireSixToStart: true,
      bonusTurnOnSix: true,
      bonusTurnOnCapture: true,
      bonusTurnOnHome: true,
      maxConsecutiveSixes: 3,
    };
    onStartOfflineGame(players, options);
  };

  const handleStartSoloVsBots = () => {
    const players = createSoloVsBotPlayers(playerCount, botDifficulty, twoPlayerPair, customNames[0] || 'You', customAvatars[0] || '🦁');
    const options: LudoGameOptions = {
      requireSixToStart: true,
      bonusTurnOnSix: true,
      bonusTurnOnCapture: true,
      bonusTurnOnHome: true,
      maxConsecutiveSixes: 3,
    };
    onStartOfflineGame(players, options);
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center max-w-xl mx-auto w-full p-4 sm:p-6 animate-fade-in select-none text-[#f6ead7]">
      {/* Top Header Navigation */}
      <div className="w-full flex items-center justify-between pb-3 mb-4 border-b border-[#4d2c16]">
        <div className="flex items-center gap-2">
          {!isNative && onBackToHub && (
            <button
              type="button"
              onClick={onBackToHub}
              className="px-3 py-1.5 rounded-xl bg-[#23140a] hover:bg-[#341b0e] text-[#cdb99d] hover:text-[#f6ead7] transition-all flex items-center gap-1.5 text-xs font-bold border border-[#4d2c16] cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Hub
            </button>
          )}
          {onResumeGame && (
            <button
              type="button"
              onClick={onResumeGame}
              className="px-3 py-1.5 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 hover:text-amber-100 transition-all flex items-center gap-1.5 text-xs font-bold border border-amber-500/40 cursor-pointer active:scale-95"
            >
              ▶ Resume Match
            </button>
          )}
          {!(!isNative && onBackToHub) && !onResumeGame && (
            <div className="flex items-center gap-2">
              <span className="text-xl">🎲</span>
              <span className="text-xs font-black uppercase tracking-widest text-[#d6a85f]">
                Royal Ludo • Offline & Online
              </span>
            </div>
          )}
        </div>

        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40">
          Royal Edition
        </span>
      </div>

      {/* Hero Title */}
      <div className="text-center mb-5">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 via-yellow-500 to-amber-700 shadow-xl border border-amber-300/40 text-3xl mb-2">
          🎲
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#f6ead7] tracking-tight">
          Choose Game Mode
        </h1>
        <p className="text-xs text-[#cdb99d] mt-1 max-w-sm mx-auto">
          Play offline with friends on this device, challenge computer bots, or host an online room!
        </p>
      </div>

      {/* Mode Tabs: Pass & Play vs Solo Bots */}
      <div className="w-full grid grid-cols-2 gap-2 p-1 bg-[#1a0e06] border border-[#3f2210] rounded-2xl mb-4">
        <button
          type="button"
          onClick={() => setSelectedTab('pass_and_play')}
          className={`py-3 px-3 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            selectedTab === 'pass_and_play'
              ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-slate-950 shadow-lg shadow-amber-500/25 scale-[1.02]'
              : 'text-[#cdb99d] hover:text-white hover:bg-[#28150a]'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span>👥 Pass & Play</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedTab('solo_vs_bots')}
          className={`py-3 px-3 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            selectedTab === 'solo_vs_bots'
              ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-slate-950 shadow-lg shadow-amber-500/25 scale-[1.02]'
              : 'text-[#cdb99d] hover:text-white hover:bg-[#28150a]'
          }`}
        >
          <Bot className="w-4 h-4 shrink-0" />
          <span>🤖 Vs Computer</span>
        </button>
      </div>

      {/* Main Mode Configuration Box */}
      <div className="w-full bg-[#241309]/95 border-2 border-[#542f17] rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col gap-4 mb-4">
        {/* Mode Description Banner */}
        <div className="flex items-center justify-between pb-3 border-b border-[#3f2210]">
          <div>
            <span className="text-xs font-black text-[#f6ead7] block">
              {selectedTab === 'pass_and_play' ? '👥 Offline Pass & Play' : '🤖 Solo vs AI Bots'}
            </span>
            <span className="text-[11px] text-[#cdb99d]">
              {selectedTab === 'pass_and_play'
                ? 'All players are human. Pass this phone around to roll!'
                : 'Play as Player 1 against intelligent AI opponents.'}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-lg bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
            100% Offline
          </span>
        </div>

        {/* Player Count Selector: 2P / 3P / 4P */}
        <div>
          <label className="text-xs font-black uppercase tracking-wider text-[#cdb99d] block mb-2">
            Select Number of Players:
          </label>
          <div className="grid grid-cols-3 gap-2">
            {([2, 3, 4] as const).map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setPlayerCount(count)}
                className={`py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm transition-all border cursor-pointer ${
                  playerCount === count
                    ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-md scale-[1.02]'
                    : 'bg-[#1a0e06] border-[#3f2210] text-[#cdb99d] hover:text-white hover:border-[#542f17]'
                }`}
              >
                {count} Players
              </button>
            ))}
          </div>
        </div>

        {/* 2-Player Diagonal Matching */}
        {playerCount === 2 && (
          <div className="p-3 rounded-2xl bg-[#1a0e06] border border-[#3f2210] flex flex-col gap-2">
            <span className="text-[11px] font-bold text-[#cdb99d]">
              2-Player Colors (Opposite Diagonals):
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTwoPlayerPair('red-blue')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  twoPlayerPair === 'red-blue'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow'
                    : 'bg-[#241309] border-[#3f2210] text-[#cdb99d]'
                }`}
              >
                🔴 Red vs 🔵 Blue
              </button>
              <button
                type="button"
                onClick={() => setTwoPlayerPair('green-yellow')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  twoPlayerPair === 'green-yellow'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow'
                    : 'bg-[#241309] border-[#3f2210] text-[#cdb99d]'
                }`}
              >
                🟢 Green vs 🟡 Yellow
              </button>
            </div>
          </div>
        )}

        {/* Bot Difficulty Selector (Only in Solo Mode) */}
        {selectedTab === 'solo_vs_bots' && (
          <div className="p-3 rounded-2xl bg-[#1a0e06] border border-[#3f2210] flex flex-col gap-2">
            <span className="text-[11px] font-bold text-[#cdb99d]">
              Computer Bot Difficulty:
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(['easy', 'medium', 'master'] as const).map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setBotDifficulty(diff)}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold capitalize border transition-all cursor-pointer ${
                    botDifficulty === diff
                      ? 'bg-emerald-600 text-white border-emerald-400 shadow font-black'
                      : 'bg-[#241309] border-[#3f2210] text-[#cdb99d]'
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Player Customization Toggle */}
        <div className="border-t border-[#3f2210] pt-2">
          <button
            type="button"
            onClick={() => setShowCustomization((prev) => !prev)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#1a0e06] hover:bg-[#28150a] border border-[#3f2210] text-[#cdb99d] hover:text-[#f6ead7] text-xs font-bold transition-all cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              <span>Customize Names & Avatars</span>
            </span>
            <span className="text-[10px] text-amber-400/80 uppercase tracking-wider font-mono">
              {showCustomization ? '▲ Hide' : '▼ Edit'}
            </span>
          </button>

          {showCustomization && (
            <div className="mt-3 p-3 rounded-2xl bg-[#1a0e06] border border-[#3f2210] flex flex-col gap-3">
              <span className="text-[11px] font-bold text-[#cdb99d]">
                {selectedTab === 'pass_and_play' ? 'Player Profiles (Pass & Play):' : 'Your Profile (Player 1):'}
              </span>
              {(selectedTab === 'pass_and_play'
                ? Array.from({ length: playerCount })
                : [0]
              ).map((_, idx) => {
                const colorDef =
                  playerCount === 2 && selectedTab === 'pass_and_play'
                    ? (twoPlayerPair === 'green-yellow' ? [LUDO_COLORS[1], LUDO_COLORS[2]] : [LUDO_COLORS[0], LUDO_COLORS[3]])[idx]
                    : playerCount === 2 && selectedTab === 'solo_vs_bots'
                    ? (twoPlayerPair === 'green-yellow' ? LUDO_COLORS[1] : LUDO_COLORS[0])
                    : LUDO_COLORS[idx];

                return (
                  <div key={idx} className="p-2.5 rounded-xl bg-[#241309] border border-[#3f2210] flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full border border-black/40"
                          style={{ backgroundColor: COLOR_MAP[colorDef.color]?.primary || colorDef.color }}
                        />
                        <span className="text-xs font-black capitalize text-[#f6ead7]">
                          {selectedTab === 'pass_and_play' ? `Player ${idx + 1} (${colorDef.color})` : `Your Profile (${colorDef.color})`}
                        </span>
                      </div>
                      <span className="text-lg">{customAvatars[idx] || colorDef.defaultAvatar}</span>
                    </div>

                    <input
                      type="text"
                      maxLength={14}
                      value={customNames[idx] || ''}
                      onChange={(e) => {
                        const updated = [...customNames];
                        updated[idx] = e.target.value;
                        setCustomNames(updated);
                      }}
                      placeholder={`Player ${idx + 1} Name`}
                      className="bg-[#150a04] border border-[#4d2c16] rounded-xl px-3 py-1.5 text-xs text-[#f6ead7] placeholder-[#6d5138] focus:outline-none focus:border-amber-400"
                    />

                    {/* Quick Avatar Picker */}
                    <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                      {DEFAULT_AVATARS.slice(0, 8).map((av) => (
                        <button
                          key={av}
                          type="button"
                          onClick={() => {
                            const updated = [...customAvatars];
                            updated[idx] = av;
                            setCustomAvatars(updated);
                          }}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm border transition-all cursor-pointer ${
                            customAvatars[idx] === av
                              ? 'bg-amber-500/30 border-amber-400 scale-110'
                              : 'bg-[#150a04] border-[#3f2210] hover:border-amber-500/40'
                          }`}
                        >
                          {av}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Start Offline Match Button */}
        <button
          type="button"
          onClick={selectedTab === 'pass_and_play' ? handleStartPassAndPlay : handleStartSoloVsBots}
          className="w-full py-3.5 px-6 rounded-2xl font-black text-sm sm:text-base text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 shadow-xl hover:shadow-amber-500/30 transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
        >
          <Play className="w-5 h-5 fill-slate-950" />
          <span>
            {selectedTab === 'pass_and_play'
              ? `Start Pass & Play (${playerCount} Players)`
              : `Play vs ${playerCount - 1} Computer Bot${playerCount > 2 ? 's' : ''}`}
          </span>
        </button>
      </div>

      {/* Online Multiplayer Divider / Card */}
      <div className="w-full bg-[#1b0f07] border border-[#4d2915] rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3 text-left">
          <div className="w-11 h-11 rounded-2xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-2xl shadow">
            🌐
          </div>
          <div>
            <div className="text-sm font-black text-white flex items-center gap-1.5">
              <span>Play Online With Friends</span>
              <span className="px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded">
                2P-4P
              </span>
            </div>
            <p className="text-[11px] text-[#cdb99d]">
              Create a room, share the invite link, and play in real-time!
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenOnlineMultiplayer}
          className="w-full sm:w-auto shrink-0 px-5 py-3 rounded-2xl font-black text-xs sm:text-sm text-cyan-200 bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-500/60 shadow-lg hover:shadow-cyan-500/25 transition-all flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
        >
          <span>🌐</span>
          <span>Open Online Lobby</span>
        </button>
      </div>
    </div>
  );
};
