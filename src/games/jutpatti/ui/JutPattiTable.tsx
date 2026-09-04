import React, { useState, useEffect, useRef } from 'react';
import { PlayerConfig, AnimationSpeed } from '../../../types/game';
import { JutPattiEngine, JutPattiState } from '../engine/JutPattiEngine';
import { NEPAL_CLASSIC_JUTPATTI_RULES, JutPattiRuleConfig } from '../engine/JutPattiRules';
import { JutPattiAI } from '../ai/JutPattiAI';
import { PlayingCard } from '../../card-game/PlayingCard';
import { DraggableHand } from '../../card-game/DraggableHand';
import { DealerDealingOverlay } from '../../card-game/DealerDealingOverlay';
import { Card, CardId, RANKS } from '../../../core/cards/Card';
import { SettingsBar } from '../../../components/UI/SettingsBar';
import { soundEffects } from '../../../engine/soundEffects';
import { fireCelebrationBurst, fireConfetti } from '../../../engine/confetti';
import { Sparkles, Trophy } from 'lucide-react';

interface JutPattiTableProps {
  initialPlayers: PlayerConfig[];
  onHome: () => void;
  onOpenRules?: () => void;
  onOpenSetup?: () => void;
  rulesConfig?: JutPattiRuleConfig;
}

export const JutPattiTable: React.FC<JutPattiTableProps> = ({
  initialPlayers,
  onHome,
  onOpenRules,
  onOpenSetup,
  rulesConfig = NEPAL_CLASSIC_JUTPATTI_RULES,
}) => {
  const [gameState, setGameState] = useState<JutPattiState>(() =>
    JutPattiEngine.createMatch(initialPlayers, rulesConfig)
  );
  const [isDealing, setIsDealing] = useState(true);
  const [speed, setSpeed] = useState<AnimationSpeed>('normal');
  const botTimerRef = useRef<any>(null);

  const userIndex = 0;
  const activeIndex = gameState.turnIndex;
  const activePlayer = gameState.players[activeIndex];
  const isUserTurn = !isDealing && activeIndex === userIndex && gameState.phase === 'playing';

  // Bot Turn Automation
  useEffect(() => {
    if (gameState.phase !== 'playing' || isDealing) return;

    if (!isUserTurn) {
      const botDelay = speed === 'turbo' ? 300 : speed === 'fast' ? 600 : 1000;

      botTimerRef.current = setTimeout(() => {
        if (gameState.turnPhase === 'draw') {
          const drawSource = JutPattiAI.chooseDrawSource(gameState, activeIndex);
          soundEffects.playCardDeal();
          setGameState((prev) => JutPattiEngine.applyDraw(prev, activeIndex, drawSource));
        } else if (gameState.turnPhase === 'discard') {
          const { shouldDeclareWin, cardToDiscard } = JutPattiAI.chooseDiscardOrWin(
            gameState,
            activeIndex,
            activePlayer.config.difficulty
          );

          if (shouldDeclareWin) {
            soundEffects.playWinChips();
            setGameState((prev) => JutPattiEngine.declareWin(prev, activeIndex));
          } else if (cardToDiscard) {
            soundEffects.playCardDeal();
            setGameState((prev) => JutPattiEngine.applyDiscard(prev, activeIndex, cardToDiscard));
          }
        }
      }, botDelay);
    }

    return () => {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
    };
  }, [gameState, isUserTurn, speed, activeIndex, isDealing]);

  // User Draw Action
  const handleUserDraw = (source: 'draw_pile' | 'discard_pile') => {
    if (!isUserTurn || gameState.turnPhase !== 'draw') return;
    soundEffects.playCardDeal();
    setGameState((prev) => JutPattiEngine.applyDraw(prev, userIndex, source));
  };

  // User Discard Action
  const handleUserDiscard = (cardId: CardId) => {
    if (!isUserTurn || gameState.turnPhase !== 'discard') return;
    soundEffects.playCardDeal();
    setGameState((prev) => JutPattiEngine.applyDiscard(prev, userIndex, cardId));
  };

  // User Reorder Hand
  const handleReorderUserCards = (reordered: Card[]) => {
    setGameState((prev) => ({
      ...prev,
      players: prev.players.map((p, idx) => (idx === userIndex ? { ...p, hand: reordered } : p)),
    }));
  };

  // User Declare Win
  const handleUserDeclareWin = () => {
    if (!isUserTurn) return;
    soundEffects.playWinChips();
    fireCelebrationBurst();
    fireConfetti();
    setGameState((prev) => JutPattiEngine.declareWin(prev, userIndex));
  };

  // Start Next Round
  const handleNextRound = () => {
    setIsDealing(true);
    setGameState(JutPattiEngine.createMatch(initialPlayers, rulesConfig));
  };

  const userPlayer = gameState.players[userIndex];
  const userPairEval = JutPattiEngine.canPartitionIntoPairs(userPlayer.hand, gameState.jokerRank);
  const canDeclareWin =
    isUserTurn && gameState.turnPhase === 'discard' && userPairEval.canPair;

  const topDiscard = gameState.discardPile[gameState.discardPile.length - 1];
  const exposedJokerCard = gameState.exposedJokerCard;
  const jokerLabel = RANKS[gameState.jokerRank]?.label;

  const formatCardData = (c: Card, faceUp: boolean = true) => {
    const suitMap: Record<string, any> = {
      S: 'spades',
      H: 'hearts',
      D: 'diamonds',
      C: 'clubs',
    };
    return {
      id: c.id,
      suit: suitMap[c.suit] || 'spades',
      rank: c.rank,
      label: c.label,
      isFaceUp: faceUp,
    };
  };

  return (
    <div className="flex-1 flex flex-col justify-between max-w-5xl mx-auto w-full p-2 sm:p-4 select-none animate-fade-in relative">
      {/* Dealing Distribution Animation Overlay */}
      {isDealing && (
        <DealerDealingOverlay
          numPlayers={4}
          totalCardsToDeal={16}
          onDealComplete={() => setIsDealing(false)}
        />
      )}

      {/* Top Header & Settings */}
      <div className="w-full flex items-center justify-between mb-2">
        <SettingsBar
          onHome={onHome}
          onRestart={() => {
            setIsDealing(true);
            setGameState(JutPattiEngine.createMatch(initialPlayers, rulesConfig));
          }}
          onOpenRules={onOpenRules || (() => {})}
          onOpenSetup={onOpenSetup}
          gameTitle="Jut Patti (✨ Wild Joker Pairs)"
          speed={speed}
          onSpeedChange={setSpeed}
        />
      </div>

      {/* Main Felt Casino Table */}
      <div className="relative w-full h-[580px] sm:h-[620px] rounded-[40px] border-4 border-amber-600/40 bg-gradient-to-b from-[#064e3b] via-[#065f46] to-[#022c22] shadow-[0_20px_60px_rgba(0,0,0,0.8)] p-4 flex flex-col justify-between overflow-hidden">
        {/* Table Felt Texture & Rings */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(52,211,153,0.12),transparent_75%)] pointer-events-none" />
        <div className="absolute inset-8 rounded-[32px] border border-emerald-400/20 pointer-events-none" />

        {/* Exposed Joker Indicator Banner */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3 bg-slate-950/80 border-2 border-amber-400/60 rounded-2xl px-4 py-2 shadow-xl backdrop-blur-md">
            {exposedJokerCard && (
              <PlayingCard card={formatCardData(exposedJokerCard, true)} size="sm" />
            )}
            <div>
              <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Wild Joker Rank (+1)
              </span>
              <span className="text-sm sm:text-base font-black text-white">
                ALL <span className="text-amber-400 text-lg">{jokerLabel}s</span> ARE WILD JOKERS!
              </span>
            </div>
          </div>

          <span className="bg-slate-950/80 text-amber-300 text-xs font-black px-3 py-1.5 rounded-xl border border-amber-400/30">
            JUT PATTI &bull; 9-Card (5 Pairs to Win)
          </span>
        </div>

        {/* 1. TOP PLAYER (Player 3) */}
        <div className="relative z-10 flex flex-col items-center gap-1">
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-2xl border backdrop-blur-md transition-all ${
              gameState.turnIndex === 2
                ? 'bg-indigo-500/25 border-indigo-400 ring-2 ring-indigo-400/50'
                : 'bg-slate-950/80 border-slate-700'
            }`}
          >
            <span className="text-lg">{gameState.players[2]?.config.avatar}</span>
            <span className="text-xs font-bold text-white">{gameState.players[2]?.config.name}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">
              Wins: {gameState.players[2]?.wins}
            </span>
          </div>
          <div className="flex items-center -space-x-4">
            {gameState.players[2]?.hand.map((_, idx) => (
              <PlayingCard key={idx} card={{ id: `p3-${idx}`, suit: 'spades', rank: 2, label: '', isFaceUp: false }} size="sm" />
            ))}
          </div>
        </div>

        {/* 2. MIDDLE ROW: LEFT (P2), CENTER (STOCK & DISCARD), RIGHT (P4) */}
        <div className="relative z-10 flex items-center justify-between my-auto px-1 sm:px-4">
          {/* Left Player (Player 2) */}
          <div className="flex flex-col items-start gap-1">
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-2xl border backdrop-blur-md transition-all ${
                gameState.turnIndex === 1
                  ? 'bg-indigo-500/25 border-indigo-400 ring-2 ring-indigo-400/50'
                  : 'bg-slate-950/80 border-slate-700'
              }`}
            >
              <span className="text-lg">{gameState.players[1]?.config.avatar}</span>
              <div>
                <span className="text-xs font-bold text-white block">
                  {gameState.players[1]?.config.name}
                </span>
                <span className="text-[10px] text-slate-300 font-bold">
                  Wins: {gameState.players[1]?.wins}
                </span>
              </div>
            </div>
            <div className="flex items-center -space-x-4">
              {gameState.players[1]?.hand.map((_, idx) => (
                <PlayingCard key={idx} card={{ id: `p2-${idx}`, suit: 'hearts', rank: 2, label: '', isFaceUp: false }} size="sm" />
              ))}
            </div>
          </div>

          {/* CENTER: STOCK & DISCARD PILES */}
          <div className="flex items-center gap-4 sm:gap-6 bg-slate-950/70 border-2 border-emerald-400/40 rounded-3xl p-3 sm:p-4 shadow-2xl backdrop-blur-md">
            {/* Stock Draw Pile */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Stock ({gameState.drawPile.length})
              </span>
              <div
                onClick={() =>
                  isUserTurn &&
                  gameState.turnPhase === 'draw' &&
                  gameState.drawPile.length > 0 &&
                  handleUserDraw('draw_pile')
                }
                className={`transition-all ${
                  isUserTurn && gameState.turnPhase === 'draw'
                    ? 'cursor-pointer hover:scale-105 ring-4 ring-indigo-400/80 shadow-2xl animate-pulse'
                    : 'opacity-90'
                }`}
              >
                <PlayingCard
                  card={{ id: 'stock', suit: 'spades', rank: 2, label: '', isFaceUp: false }}
                  size="md"
                />
              </div>
              {isUserTurn && gameState.turnPhase === 'draw' && (
                <span className="text-[9px] font-black text-indigo-300 animate-pulse">Click to Draw ➔</span>
              )}
            </div>

            {/* Discard Pile */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Discard Pile
              </span>
              <div
                onClick={() =>
                  isUserTurn &&
                  gameState.turnPhase === 'draw' &&
                  topDiscard &&
                  handleUserDraw('discard_pile')
                }
                className={`transition-all ${
                  isUserTurn && gameState.turnPhase === 'draw' && topDiscard
                    ? 'cursor-pointer hover:scale-105 ring-4 ring-amber-400/80 shadow-2xl animate-pulse'
                    : 'opacity-90'
                }`}
              >
                {topDiscard ? (
                  <PlayingCard card={formatCardData(topDiscard, true)} size="md" />
                ) : (
                  <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-xl border border-dashed border-slate-600 flex items-center justify-center text-xs text-slate-500">
                    Empty
                  </div>
                )}
              </div>
              {isUserTurn && gameState.turnPhase === 'draw' && topDiscard && (
                <span className="text-[9px] font-black text-amber-300">Take Discard ➔</span>
              )}
            </div>
          </div>

          {/* Right Player (Player 4) */}
          <div className="flex flex-col items-end gap-1">
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-2xl border backdrop-blur-md transition-all ${
                gameState.turnIndex === 3
                  ? 'bg-indigo-500/25 border-indigo-400 ring-2 ring-indigo-400/50'
                  : 'bg-slate-950/80 border-slate-700'
              }`}
            >
              <div>
                <span className="text-xs font-bold text-white block text-right">
                  {gameState.players[3]?.config.name}
                </span>
                <span className="text-[10px] text-slate-300 font-bold">
                  Wins: {gameState.players[3]?.wins}
                </span>
              </div>
              <span className="text-lg">{gameState.players[3]?.config.avatar}</span>
            </div>
            <div className="flex items-center -space-x-4">
              {gameState.players[3]?.hand.map((_, idx) => (
                <PlayingCard key={idx} card={{ id: `p4-${idx}`, suit: 'diamonds', rank: 2, label: '', isFaceUp: false }} size="sm" />
              ))}
            </div>
          </div>
        </div>

        {/* 3. BOTTOM SECTION: USER HAND & CONTROLS */}
        <div className="relative z-10 flex flex-col items-center gap-2 bg-slate-950/85 border border-slate-700/80 rounded-3xl p-3 pb-5 backdrop-blur-md shadow-2xl overflow-visible">
          <div className="w-full flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{userPlayer.config.avatar}</span>
              <div>
                <span className="text-xs font-black text-white">{userPlayer.config.name} (You)</span>
                <span className="text-[11px] font-bold text-indigo-300 block">
                  Hand: {userPlayer.hand.length} cards &bull; Formed Pairs:{' '}
                  {userPairEval.pairs.length} / {gameState.rules.targetWinningPairs}
                </span>
              </div>
            </div>

            {/* Declare Win Button */}
            {canDeclareWin && (
              <button
                onClick={handleUserDeclareWin}
                className="px-5 py-2 rounded-2xl font-black bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 shadow-xl shadow-amber-500/30 active:scale-95 transition-all text-xs uppercase tracking-wider animate-bounce flex items-center gap-1.5"
              >
                <Trophy className="w-4 h-4" /> Declare WIN (5 Pairs Formed)!
              </button>
            )}
          </div>

          {/* User Hand with In-Hand Drag Reordering & Flick-to-Discard */}
          <DraggableHand
            cards={userPlayer.hand}
            isUserTurn={isUserTurn}
            isPlayableCard={() => isUserTurn && gameState.turnPhase === 'discard'}
            size="lg"
            onCardClick={(card) => {
              if (isUserTurn && gameState.turnPhase === 'discard') {
                handleUserDiscard(card.id);
              }
            }}
            onPlayCard={(card) => {
              if (isUserTurn && gameState.turnPhase === 'discard') {
                handleUserDiscard(card.id);
              }
            }}
            onReorderCards={handleReorderUserCards}
            renderBadge={(card) =>
              card.rank === gameState.jokerRank ? (
                <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-white shadow-md">
                  JOKER
                </span>
              ) : null
            }
          />

          {/* Status Instructions */}
          {isUserTurn && (
            <div className="text-xs font-bold text-amber-300">
              {gameState.turnPhase === 'draw'
                ? '👉 Draw Phase: Click Stock or Discard pile above (or drag cards to rearrange)'
                : '👉 Discard Phase: Drag card up or click to discard & end turn (or drag horizontally to reorder)'}
            </div>
          )}
        </div>

        {/* Win Modal */}
        {gameState.phase === 'round_end' && (
          <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-400/60 rounded-3xl p-6 max-w-md w-full shadow-2xl text-center">
              <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-2 animate-bounce" />
              <h3 className="text-2xl font-black text-white mb-1">
                {gameState.winnerIndex === userIndex ? '🎉 VICTORY!' : 'ROUND OVER'}
              </h3>
              <p className="text-sm text-slate-300 mb-5">
                {gameState.winnerIndex === userIndex
                  ? 'You successfully formed 5 pairs and claimed the victory!'
                  : `${gameState.winnerIndex !== null && gameState.winnerIndex !== undefined ? gameState.players[gameState.winnerIndex]?.config.name : 'Opponent'} formed 5 pairs first!`}
              </p>
              <button
                onClick={handleNextRound}
                className="px-6 py-2.5 rounded-xl font-black bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 text-xs uppercase tracking-wider"
              >
                Deal Next Round ➔
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
