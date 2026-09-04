import React, { useState } from 'react';
import { Sparkles, Users, Globe, BookOpen, GraduationCap, User, Trophy, Flame, Crown, Zap, Dices } from 'lucide-react';
import { CardRulesModal, TaasGameId } from './CardRulesModal';
import { TutorialModal } from './TutorialModal';
import { PlayerProfileModal } from './PlayerProfileModal';

interface TaasArenaHubProps {
  onSelectGame: (gameId: TaasGameId) => void;
  onOpenOnlineMultiplayer?: () => void;
}

type HubCategory = 'all' | 'cards' | 'board';

export const TaasArenaHub: React.FC<TaasArenaHubProps> = ({
  onSelectGame,
  onOpenOnlineMultiplayer,
}) => {
  const [showRules, setShowRules] = useState(false);
  const [selectedRuleGame, setSelectedRuleGame] = useState<TaasGameId>('callbreak');
  const [showTutorial, setShowTutorial] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<HubCategory>('all');

  const handleOpenGameRules = (gameId: TaasGameId, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedRuleGame(gameId);
    setShowRules(true);
  };

  const allGames: {
    id: TaasGameId;
    category: 'cards' | 'board';
    title: string;
    tagline: string;
    desc: string;
    players: string;
    icon: string;
    badge: string;
    themeColor: string;
    borderHover: string;
    accentGlow: string;
  }[] = [
    {
      id: 'ludo',
      category: 'board',
      title: 'Royal Ludo',
      tagline: '3D Hop Physics & Epic Captures',
      desc: 'Roll 6 to launch from yard! Experience step-by-step block hopping, parabolic flight capture knockouts, and star safe havens!',
      players: '2–4 Players',
      icon: '🎲',
      badge: '👑 Royal Board',
      themeColor: 'from-amber-600/30 via-slate-900 to-slate-950',
      borderHover: 'hover:border-amber-400 hover:shadow-amber-500/30',
      accentGlow: 'bg-amber-500',
    },
    {
      id: 'callbreak',
      category: 'cards',
      title: 'Call Break',
      tagline: 'Nepali 5-Round Spades Trump',
      desc: 'Predict your tricks, follow suit, overtrump with Spades, and score decimal overtricks across 5 classic rounds!',
      players: '4 Players',
      icon: '♠️',
      badge: 'Nepali Classic',
      themeColor: 'from-amber-600/20 via-slate-900 to-slate-950',
      borderHover: 'hover:border-amber-400 hover:shadow-amber-500/20',
      accentGlow: 'bg-amber-500',
    },
    {
      id: 'dhumbal',
      category: 'cards',
      title: 'Dhumbal / Jhyap',
      tagline: 'Nepali Hand Reduction & Undercut',
      desc: 'Discard sets & pure same-suit runs, reduce your hand to ≤ 5 points, and declare Dhumbal without getting undercut!',
      players: '2–5 Players',
      icon: '🔥',
      badge: 'Hand Reduction',
      themeColor: 'from-emerald-600/20 via-slate-900 to-slate-950',
      borderHover: 'hover:border-emerald-400 hover:shadow-emerald-500/20',
      accentGlow: 'bg-emerald-500',
    },
    {
      id: 'jutpatti',
      category: 'cards',
      title: 'Jut Patti',
      tagline: 'Nepali Dynamic Wild Joker Pairs',
      desc: '9-card deal with dynamic +1 Wild Joker rank! Draw from stock/discard and partition your entire hand into 5 complete pairs to win!',
      players: '2–4 Players',
      icon: '✨',
      badge: 'Pair Game',
      themeColor: 'from-indigo-600/20 via-slate-900 to-slate-950',
      borderHover: 'hover:border-indigo-400 hover:shadow-indigo-500/20',
      accentGlow: 'bg-indigo-500',
    },
    {
      id: 'teenpatti',
      category: 'cards',
      title: 'Teen Patti',
      tagline: '3-Card Poker Royale',
      desc: 'Play Blind or Seen, raise stakes, request Side Shows, and conquer the pot with Trails, Pure Sequences, and Flushes!',
      players: '3–6 Players',
      icon: '👑',
      badge: 'Virtual Chips',
      themeColor: 'from-yellow-600/20 via-slate-900 to-slate-950',
      borderHover: 'hover:border-yellow-400 hover:shadow-yellow-500/20',
      accentGlow: 'bg-yellow-500',
    },
    {
      id: 'poker',
      category: 'cards',
      title: "Texas Hold'em",
      tagline: 'No-Limit Poker with Side Pots',
      desc: '2 hole cards + 5 community cards! Master preflop raises, flop textures, multi-stack all-in side pots, and showdowns!',
      players: '2–9 Players',
      icon: '🎯',
      badge: 'No-Limit',
      themeColor: 'from-rose-600/20 via-slate-900 to-slate-950',
      borderHover: 'hover:border-rose-400 hover:shadow-rose-500/20',
      accentGlow: 'bg-rose-500',
    },
    {
      id: 'snakes',
      category: 'board',
      title: 'Snakes & Ladders',
      tagline: 'Royale 100-Square Race',
      desc: 'Ascend triumphant ladders, evade venomous snakes, and race your 3D luxury pawn to square 100!',
      players: '2–4 Players',
      icon: '🐍',
      badge: 'Classic 100',
      themeColor: 'from-cyan-600/20 via-slate-900 to-slate-950',
      borderHover: 'hover:border-cyan-400 hover:shadow-cyan-500/20',
      accentGlow: 'bg-cyan-500',
    },
  ];

  const filteredGames = allGames.filter((g) => {
    if (selectedCategory === 'all') return true;
    return g.category === selectedCategory;
  });

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 max-w-6xl mx-auto w-full select-none animate-fade-in">
      {/* Top Action Bar */}
      <div className="w-full flex items-center justify-between mb-6 px-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTutorial(true)}
            className="text-xs font-bold text-slate-300 hover:text-white px-3.5 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 transition-all flex items-center gap-1.5 shadow-md"
          >
            <GraduationCap className="w-4 h-4 text-amber-400" />
            <span>Tutorials</span>
          </button>

          <button
            onClick={() => {
              setSelectedRuleGame('ludo');
              setShowRules(true);
            }}
            className="text-xs font-bold text-slate-300 hover:text-white px-3.5 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 transition-all flex items-center gap-1.5 shadow-md"
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span>Rulebook</span>
          </button>
        </div>

        <button
          onClick={() => setShowProfile(true)}
          className="text-xs font-bold text-amber-300 hover:text-white px-3.5 py-1.5 rounded-xl bg-slate-900/80 border border-amber-500/40 hover:border-amber-400 transition-all flex items-center gap-1.5 shadow-md"
        >
          <User className="w-4 h-4 text-amber-400" />
          <span>Profile & Stats</span>
        </button>
      </div>

      {/* Hero Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-black uppercase tracking-wider mb-3 shadow-inner">
          <Sparkles className="w-3.5 h-3.5" /> Authentic Nepali, South-Asian & Classic Arena
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
          TAAS <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500">ARENA</span>
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm max-w-xl mx-auto mt-2 leading-relaxed">
          The definitive gaming platform featuring full rule engines, intelligent bots, luxury 3D boards, and VIP tables.
        </p>

        {/* Category Pills */}
        <div className="flex items-center justify-center gap-2 mt-5">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              selectedCategory === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 scale-105'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> All Games ({allGames.length})
          </button>
          <button
            onClick={() => setSelectedCategory('cards')}
            className={`px-4 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              selectedCategory === 'cards'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 scale-105'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <span>♠️</span> Card Games (5)
          </button>
          <button
            onClick={() => setSelectedCategory('board')}
            className={`px-4 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              selectedCategory === 'board'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 scale-105'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Dices className="w-3.5 h-3.5" /> Board Games (2)
          </button>
        </div>
      </div>

      {/* Games Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full mb-8">
        {filteredGames.map((game) => (
          <div
            key={game.id}
            onClick={() => onSelectGame(game.id)}
            className={`group relative bg-gradient-to-b ${game.themeColor} border-2 border-slate-800 ${game.borderHover} rounded-3xl p-5 shadow-2xl transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between cursor-pointer overflow-hidden`}
          >
            {/* Top Badges */}
            <div className="flex items-center justify-between mb-4">
              <span className="bg-slate-950/80 text-amber-300 border border-amber-400/30 text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                {game.badge}
              </span>
              <span className="text-slate-400 text-xs font-semibold flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                {game.players}
              </span>
            </div>

            {/* Game Info */}
            <div className="flex items-start gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-950/90 border border-slate-700/80 flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 group-hover:border-amber-400 transition-all">
                {game.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-black text-white group-hover:text-amber-300 transition-colors">
                  {game.title}
                </h3>
                <p className="text-xs font-bold text-amber-400/90">{game.tagline}</p>
                <p className="text-slate-400 text-xs mt-1 line-clamp-2 leading-relaxed">
                  {game.desc}
                </p>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center gap-2 pt-3 border-t border-slate-800/80">
              <button
                onClick={() => onSelectGame(game.id)}
                className="flex-1 py-2 px-3 sm:px-4 rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 hover:brightness-110 shadow-md group-hover:shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Play Table</span>
              </button>

              {game.id === 'ludo' && onOpenOnlineMultiplayer && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenOnlineMultiplayer();
                  }}
                  title="Create or join an online multiplayer room with friends"
                  className="py-2 px-2.5 sm:px-3 rounded-xl font-black text-xs bg-blue-950/80 hover:bg-blue-900 text-blue-300 hover:text-blue-100 border border-blue-500/50 hover:border-blue-400 shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span>🌐</span>
                  <span>Online Room</span>
                </button>
              )}

              <button
                onClick={(e) => handleOpenGameRules(game.id, e)}
                className="py-2 px-3 rounded-xl font-bold text-xs bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-amber-400/40 transition-all cursor-pointer"
              >
                Rules
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Global Modals */}
      {showRules && (
        <CardRulesModal
          initialGame={selectedRuleGame}
          onClose={() => setShowRules(false)}
        />
      )}

      {showTutorial && (
        <TutorialModal
          initialGame={selectedRuleGame}
          onClose={() => setShowTutorial(false)}
        />
      )}

      {showProfile && (
        <PlayerProfileModal onClose={() => setShowProfile(false)} />
      )}
    </div>
  );
};
