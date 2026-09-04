import React, { useState, useEffect, useRef } from 'react';
import { PlayerConfig, AnimationSpeed } from '../../../types/game';
import { DhumbalEngine, DhumbalState } from '../engine/DhumbalEngine';
import { NEPAL_CLASSIC_DHUMBAL_RULES, DhumbalRuleConfig } from '../engine/DhumbalRules';
import { DhumbalAI } from '../ai/DhumbalAI';
import { PlayingCard } from '../../card-game/PlayingCard';
import { DraggableHand } from '../../card-game/DraggableHand';
import { DealerDealingOverlay } from '../../card-game/DealerDealingOverlay';
import { Card, CardId } from '../../../core/cards/Card';
import { SettingsBar } from '../../../components/UI/SettingsBar';
import { soundEffects } from '../../../engine/soundEffects';
import { fireCelebrationBurst, fireConfetti } from '../../../engine/confetti';
import { Flame, Trophy, AlertTriangle, ShieldCheck, ArrowDown, RotateCcw } from 'lucide-react';

interface DhumbalTableProps {
  initialPlayers: PlayerConfig[];
  onHome: () => void;
  onOpenRules?: () => void;
  onOpenSetup?: () => void;
  rulesConfig?: DhumbalRuleConfig;
}

export const DhumbalTable: React.FC<DhumbalTableProps> = ({
  initialPlayers,
  onHome,
  onOpenRules,
  onOpenSetup,
  rulesConfig = NEPAL_CLASSIC_DHUMBAL_RULES,
}) => {
  const [gameState, setGameState] = useState<DhumbalState>(() =>
    DhumbalEngine.createMatch(initialPlayers, rulesConfig)
  );

  const [isDealing, setIsDealing] = useState(true);
  const [speed, setSpeed] = useState<AnimationSpeed>('normal');
  const [selectedCardIds, setSelectedCardIds] = useState<CardId[]>([]);
  const botTimerRef = useRef<any>(null);

  const userIndex = 0;
  const activeIndex = gameState.turnIndex;
  const activePlayer = gameState.players[activeIndex];
  const isUserTurn = !isDealing && activeIndex === userIndex && gameState.phase === 'turn_action';

  // Bot Turn Automation
  useEffect(() => {
    if (gameState.phase !== 'turn_action' || isDealing) return;

    if (!isUserTurn) {
      const botDelay = speed === 'turbo' ? 300 : speed === 'fast' ? 600 : 1000;

      botTimerRef.current = setTimeout(() => {
        const decision = DhumbalAI.makeDecision(gameState, activeIndex, activePlayer.config.difficulty);

        if (decision.shouldCallDhumbal) {
          soundEffects.playWinChips();
          setGameState((prev) => DhumbalEngine.declareDhumbal(prev, activeIndex));
        } else {
          soundEffects.playCardDeal();
          setGameState((prev) =>
            DhumbalEngine.applyDiscardAndDraw(
              prev,
              activeIndex,
              decision.cardsToDiscard,
              decision.drawSource
            )
          );
        }
      }, botDelay);
    }

    return () => {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
    };
  }, [gameState, isUserTurn, speed, activeIndex, isDealing]);

  // Toggle user card selection
  const handleToggleCardSelection = (cardId: CardId) => {
    if (!isUserTurn) return;
    setSelectedCardIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
  };

  // Reorder cards in user hand
  const handleReorderUserCards = (reordered: Card[]) => {
    setGameState((prev) => ({
      ...prev,
      players: prev.players.map((p, idx) => (idx === userIndex ? { ...p, hand: reordered } : p)),
    }));
  };

  // User Discard & Draw Action
  const handleUserDiscardAndDraw = (drawSource: 'draw_pile' | 'discard_pile') => {
    if (!isUserTurn || selectedCardIds.length === 0) return;

    try {
      soundEffects.playCardDeal();
      setGameState((prev) =>
        DhumbalEngine.applyDiscardAndDraw(prev, userIndex, selectedCardIds, drawSource)
      );
      setSelectedCardIds([]);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // User Declare Dhumbal
  const handleUserDeclareDhumbal = () => {
    if (!isUserTurn) return;

    try {
      soundEffects.playWinChips();
      const updated = DhumbalEngine.declareDhumbal(gameState, userIndex);
      setGameState(updated);

      if (updated.lastResult && !updated.lastResult.isUndercut) {
        fireCelebrationBurst();
        fireConfetti();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Start Next Round
  const handleNextRound = () => {
    setIsDealing(true);
    setSelectedCardIds([]);
    setGameState((prev) => DhumbalEngine.nextRound(prev));
  };

  const userPlayer = gameState.players[userIndex];
  const userHandPoints = DhumbalEngine.calculateHandPoints(userPlayer.hand, gameState.rules);
  const isSelectionValid =
    selectedCardIds.length > 0 &&
    DhumbalEngine.isValidDiscard(
      userPlayer.hand.filter((c) => selectedCardIds.includes(c.id))
    );

  const canDeclareDhumbal =
    isUserTurn && userHandPoints <= gameState.rules.callThreshold;

  const topDiscard = gameState.discardPile[gameState.discardPile.length - 1];

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

      {/* Top Header Bar & Settings */}
      <div className="w-full flex items-center justify-between mb-2">
        <SettingsBar
          onHome={onHome}
          onRestart={() => {
            setIsDealing(true);
            setSelectedCardIds([]);
            setGameState(DhumbalEngine.createMatch(initialPlayers, rulesConfig));
          }}
          onOpenRules={onOpenRules || (() => {})}
          onOpenSetup={onOpenSetup}
          gameTitle="Dhumbal / Jhyap (≤ 5 Pts)"
          speed={speed}
          onSpeedChange={setSpeed}
        />
      </div>

      {/* Main Felt Casino Table */}
      <div className="relative w-full h-[580px] sm:h-[620px] rounded-[40px] border-4 border-emerald-600/40 bg-gradient-to-b from-[#064e3b] via-[#065f46] to-[#022c22] shadow-[0_20px_60px_rgba(0,0,0,0.8)] p-4 flex flex-col justify-between overflow-hidden">
        {/* Table Felt Glow & Center Rings */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(52,211,153,0.12),transparent_70%)] pointer-events-none" />
        <div className="absolute inset-8 rounded-[32px] border border-emerald-400/20 pointer-events-none" />

        {/* Header Indicator */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2 bg-slate-950/80 border border-emerald-400/30 rounded-2xl px-3 py-1.5 backdrop-blur-md">
            <span className="text-xs font-black uppercase text-emerald-300">
              Round {gameState.currentRound}
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs font-bold text-white">
              Target Elimination: {gameState.rules.targetScore} pts
            </span>
          </div>

          <span className="bg-slate-950/80 text-emerald-300 text-xs font-black px-3 py-1.5 rounded-xl border border-emerald-400/30">
            DHUMBAL / JHYAP &bull; Hand Reduction
          </span>
        </div>

        {/* 1. TOP PLAYER (Player 3) */}
        <div className="relative z-10 flex flex-col items-center gap-1">
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-2xl border backdrop-blur-md transition-all ${
              gameState.turnIndex === 2
                ? 'bg-emerald-500/25 border-emerald-400 ring-2 ring-emerald-400/50'
                : 'bg-slate-950/80 border-slate-700'
            }`}
          >
            <span className="text-lg">{gameState.players[2]?.config.avatar}</span>
            <span className="text-xs font-bold text-white">{gameState.players[2]?.config.name}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-emerald-300 font-bold">
              Score: {gameState.players[2]?.cumulativeScore} pts
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
                  ? 'bg-emerald-500/25 border-emerald-400 ring-2 ring-emerald-400/50'
                  : 'bg-slate-950/80 border-slate-700'
              }`}
            >
              <span className="text-lg">{gameState.players[1]?.config.avatar}</span>
              <div>
                <span className="text-xs font-bold text-white block">{gameState.players[1]?.config.name}</span>
                <span className="text-[10px] text-emerald-300 font-bold">
                  Score: {gameState.players[1]?.cumulativeScore} pts
                </span>
              </div>
            </div>
            <div className="flex items-center -space-x-4">
              {gameState.players[1]?.hand.map((_, idx) => (
                <PlayingCard key={idx} card={{ id: `p2-${idx}`, suit: 'hearts', rank: 2, label: '', isFaceUp: false }} size="sm" />
              ))}
            </div>
          </div>

          {/* CENTER STOCK & DISCARD PILES */}
          <div className="flex items-center gap-4 sm:gap-6 bg-slate-950/70 border-2 border-emerald-400/40 rounded-3xl p-3 sm:p-4 shadow-2xl backdrop-blur-md">
            {/* Draw Pile (Blind) */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Stock Pile ({gameState.drawPile.length})
              </span>
              <div
                onClick={() => isUserTurn && isSelectionValid && handleUserDiscardAndDraw('draw_pile')}
                className={`transition-all ${
                  isUserTurn && isSelectionValid
                    ? 'cursor-pointer hover:scale-105 ring-4 ring-emerald-400/80 shadow-2xl animate-pulse'
                    : 'opacity-90'
                }`}
              >
                <PlayingCard
                  card={{ id: 'stock', suit: 'spades', rank: 2, label: '', isFaceUp: false }}
                  size="md"
                />
              </div>
              {isUserTurn && isSelectionValid && (
                <span className="text-[9px] font-black text-emerald-300 animate-pulse">
                  Draw Stock ➔
                </span>
              )}
            </div>

            {/* Discard Pile (Open) */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Discard Pile
              </span>
              <div
                onClick={() =>
                  isUserTurn &&
                  isSelectionValid &&
                  topDiscard &&
                  handleUserDiscardAndDraw('discard_pile')
                }
                className={`transition-all ${
                  isUserTurn && isSelectionValid && topDiscard
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
              {isUserTurn && isSelectionValid && topDiscard && (
                <span className="text-[9px] font-black text-amber-300 animate-pulse">
                  Take Discard ➔
                </span>
              )}
            </div>
          </div>

          {/* Right Player (Player 4) */}
          <div className="flex flex-col items-end gap-1">
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-2xl border backdrop-blur-md transition-all ${
                gameState.turnIndex === 3
                  ? 'bg-emerald-500/25 border-emerald-400 ring-2 ring-emerald-400/50'
                  : 'bg-slate-950/80 border-slate-700'
              }`}
            >
              <div>
                <span className="text-xs font-bold text-white block text-right">{gameState.players[3]?.config.name}</span>
                <span className="text-[10px] text-emerald-300 font-bold">
                  Score: {gameState.players[3]?.cumulativeScore} pts
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
                <span className="text-[11px] font-bold text-emerald-300 block">
                  Hand Total: {userHandPoints} pts &bull; Cumulative Score: {userPlayer.cumulativeScore} pts
                </span>
              </div>
            </div>

            {/* Dhumbal Call Button */}
            {canDeclareDhumbal && (
              <button
                onClick={handleUserDeclareDhumbal}
                className="px-5 py-2 rounded-2xl font-black bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 text-slate-950 shadow-xl shadow-emerald-500/30 active:scale-95 transition-all text-xs uppercase tracking-wider animate-bounce flex items-center gap-1.5"
              >
                <Flame className="w-4 h-4" /> Declare DHUMBAL ({userHandPoints} pts)!
              </button>
            )}
          </div>

          {/* User Hand with In-Hand Drag Reordering and Multi-Selection */}
          <DraggableHand
            cards={userPlayer.hand}
            isUserTurn={isUserTurn}
            isSelectedCard={(card) => selectedCardIds.includes(card.id)}
            size="lg"
            onCardClick={(card) => handleToggleCardSelection(card.id)}
            onPlayCard={(card) => {
              if (!selectedCardIds.includes(card.id)) {
                setSelectedCardIds([card.id]);
              }
              handleUserDiscardAndDraw('draw_pile');
            }}
            onReorderCards={handleReorderUserCards}
          />

          {/* Action Helper / Discard Prompt */}
          {isUserTurn && (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              {selectedCardIds.length === 0 ? (
                <span className="text-amber-300">
                  Select card(s) to discard (or drag sideways to reorder your hand)
                </span>
              ) : isSelectionValid ? (
                <span className="text-emerald-300 flex items-center gap-1">
                  ✓ Valid Selection ({selectedCardIds.length} cards) — Click Stock or Discard pile above to draw!
                </span>
              ) : (
                <span className="text-rose-400 flex items-center gap-1">
                  ⚠️ Invalid combination (must be same rank or consecutive same suit)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Round End Modal / Undercut Summary */}
        {(gameState.phase === 'round_end' || gameState.phase === 'game_over') && gameState.lastResult && (
          <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-emerald-400/60 rounded-3xl p-6 max-w-md w-full shadow-2xl text-center">
              <Trophy className="w-12 h-12 text-emerald-400 mx-auto mb-2 animate-bounce" />
              <h3 className="text-2xl font-black text-white mb-1">
                {gameState.lastResult.isUndercut ? '⚡ UNDERCUT (JHYAP)!' : '🎉 DHUMBAL CALL SUCCESSFUL!'}
              </h3>
              <p className="text-xs text-emerald-300 font-bold mb-4">
                Caller: {gameState.players[gameState.lastResult.callerIndex]?.config.name} ({gameState.lastResult.callerTotal} pts)
              </p>

              {gameState.lastResult.isUndercut && (
                <div className="bg-rose-500/20 border border-rose-400/40 rounded-2xl p-3 mb-4 text-xs text-rose-200">
                  Undercut by {gameState.players[gameState.lastResult.lowestPlayerIndex]?.config.name} ({gameState.lastResult.lowestTotal} pts)!
                  Caller receives +25 penalty points.
                </div>
              )}

              <div className="space-y-1.5 mb-6">
                {gameState.players.map((p, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-2 rounded-xl border text-xs ${
                      idx === userIndex ? 'bg-emerald-500/20 border-emerald-400' : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span>{p.config.avatar}</span> {p.config.name}
                    </span>
                    <span className="font-mono text-emerald-300">
                      +{p.lastRoundScore} pts &bull; Total: {p.cumulativeScore} pts
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleNextRound}
                className="px-6 py-2.5 rounded-xl font-black bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-xs uppercase tracking-wider"
              >
                Start Next Round ➔
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
