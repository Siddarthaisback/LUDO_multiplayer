import React, { useState, useEffect, useRef } from 'react';
import { PlayerConfig, AnimationSpeed } from '../../../types/game';
import { PokerEngine, PokerState } from '../engine/PokerEngine';
import { PokerEvaluator } from '../engine/PokerEvaluator';
import { NO_LIMIT_HOLDEM_RULES, PokerRuleConfig } from '../engine/PokerRules';
import { PokerAI } from '../ai/PokerAI';
import { PlayingCard } from '../../card-game/PlayingCard';
import { DraggableHand } from '../../card-game/DraggableHand';
import { DealerDealingOverlay } from '../../card-game/DealerDealingOverlay';
import { PokerChip } from '../../card-game/PokerChip';
import { Card } from '../../../core/cards/Card';
import { SettingsBar } from '../../../components/UI/SettingsBar';
import { soundEffects } from '../../../engine/soundEffects';
import { Trophy } from 'lucide-react';

interface PokerTableProps {
  initialPlayers: PlayerConfig[];
  onHome: () => void;
  onOpenRules?: () => void;
  onOpenSetup?: () => void;
  rulesConfig?: PokerRuleConfig;
}

export const PokerTable: React.FC<PokerTableProps> = ({
  initialPlayers,
  onHome,
  onOpenRules,
  onOpenSetup,
  rulesConfig = NO_LIMIT_HOLDEM_RULES,
}) => {
  const [gameState, setGameState] = useState<PokerState>(() =>
    PokerEngine.createHand(initialPlayers, rulesConfig)
  );

  const [isDealing, setIsDealing] = useState(true);
  const [speed, setSpeed] = useState<AnimationSpeed>('normal');
  const botTimerRef = useRef<any>(null);

  const userIndex = 0;
  const activeIndex = gameState.turnIndex;
  const activePlayer = gameState.players[activeIndex];
  const isUserTurn = !isDealing && activeIndex === userIndex && gameState.street !== 'hand_over';

  const userPlayer = gameState.players[userIndex];
  const callAmount = Math.max(0, gameState.currentHighBet - userPlayer.currentStreetBet);
  const canCheck = callAmount === 0;

  // Bot Turn Automation
  useEffect(() => {
    if (gameState.street === 'hand_over' || isDealing) return;

    if (!isUserTurn) {
      const botDelay = speed === 'turbo' ? 350 : speed === 'fast' ? 700 : 1200;

      botTimerRef.current = setTimeout(() => {
        const decision = PokerAI.makeDecision(gameState, activeIndex, activePlayer.config.difficulty);

        if (decision.action === 'fold') {
          setGameState((prev) => PokerEngine.applyFold(prev, activeIndex));
        } else if (decision.action === 'check' || decision.action === 'call') {
          soundEffects.playChipClink();
          setGameState((prev) => PokerEngine.applyCallOrCheck(prev, activeIndex));
        } else if (decision.action === 'bet' || decision.action === 'raise') {
          soundEffects.playChipClink();
          const targetBet = decision.amount || gameState.currentHighBet + gameState.minRaise;
          setGameState((prev) => PokerEngine.applyBetOrRaise(prev, activeIndex, targetBet));
        }
      }, botDelay);
    }

    return () => {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
    };
  }, [gameState, isUserTurn, speed, activeIndex, isDealing]);

  const handleUserFold = () => {
    if (!isUserTurn) return;
    setGameState((prev) => PokerEngine.applyFold(prev, userIndex));
  };

  const handleUserCallOrCheck = () => {
    if (!isUserTurn) return;
    soundEffects.playChipClink();
    setGameState((prev) => PokerEngine.applyCallOrCheck(prev, userIndex));
  };

  const handleUserBetOrRaise = () => {
    if (!isUserTurn) return;
    soundEffects.playChipClink();
    const minTarget = gameState.currentHighBet + gameState.minRaise;
    setGameState((prev) => PokerEngine.applyBetOrRaise(prev, userIndex, minTarget));
  };

  const handleReorderUserCards = (reordered: Card[]) => {
    setGameState((prev) => ({
      ...prev,
      players: prev.players.map((p, idx) => (idx === userIndex ? { ...p, hand: reordered } : p)),
    }));
  };

  const handleNextHand = () => {
    setIsDealing(true);
    const chipStacks = gameState.players.map((p) => Math.max(100, p.chips));
    const nextDealer = (gameState.dealerIndex + 1) % initialPlayers.length;
    setGameState(PokerEngine.createHand(initialPlayers, rulesConfig, chipStacks, nextDealer));
  };

  const userEvaluation =
    !userPlayer.isFolded && (gameState.communityCards.length > 0 || gameState.street === 'hand_over')
      ? PokerEvaluator.evaluate7CardHand([...userPlayer.hand, ...gameState.communityCards])
      : null;

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
          totalCardsToDeal={8}
          onDealComplete={() => setIsDealing(false)}
        />
      )}

      {/* Top Header & Settings */}
      <div className="w-full flex items-center justify-between mb-2">
        <SettingsBar
          onHome={onHome}
          onRestart={() => {
            setIsDealing(true);
            setGameState(PokerEngine.createHand(initialPlayers, rulesConfig));
          }}
          onOpenRules={onOpenRules || (() => {})}
          onOpenSetup={onOpenSetup}
          gameTitle="Texas Hold'em Poker (No-Limit)"
          speed={speed}
          onSpeedChange={setSpeed}
        />
      </div>

      {/* Main Felt Casino Table */}
      <div className="relative w-full h-[580px] sm:h-[620px] rounded-[40px] border-4 border-amber-600/40 bg-gradient-to-b from-[#14532d] via-[#166534] to-[#052e16] shadow-[0_20px_60px_rgba(0,0,0,0.8)] p-4 flex flex-col justify-between overflow-hidden">
        {/* Table Felt Glow & Center Rings */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,197,94,0.12),transparent_70%)] pointer-events-none" />
        <div className="absolute inset-8 rounded-[32px] border border-emerald-400/20 pointer-events-none" />

        {/* Header Indicator */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2 bg-slate-950/80 border border-emerald-400/30 rounded-2xl px-3 py-1.5 backdrop-blur-md">
            <span className="text-xs font-black uppercase text-emerald-300">
              Street: {gameState.street.toUpperCase()}
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs font-bold text-white">
              Blinds: ${gameState.rules.smallBlind}/${gameState.rules.bigBlind}
            </span>
          </div>

          <span className="bg-slate-950/80 text-emerald-300 text-xs font-black px-3 py-1.5 rounded-xl border border-emerald-400/30">
            NO-LIMIT TEXAS HOLD'EM
          </span>
        </div>

        {/* 1. TOP PLAYER (Player 3) */}
        <div className="relative z-10 flex flex-col items-center gap-1">
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-2xl border backdrop-blur-md transition-all ${
              gameState.players[2]?.isFolded
                ? 'opacity-40 bg-slate-900 border-slate-800'
                : gameState.turnIndex === 2
                ? 'bg-amber-500/25 border-amber-400 ring-2 ring-amber-400/50'
                : 'bg-slate-950/80 border-slate-700'
            }`}
          >
            <span className="text-lg">{gameState.players[2]?.config.avatar}</span>
            <span className="text-xs font-bold text-white">{gameState.players[2]?.config.name}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-emerald-300 font-bold">
              ${gameState.players[2]?.chips} {gameState.players[2]?.currentStreetBet > 0 ? `(Bet: $${gameState.players[2]?.currentStreetBet})` : ''}
            </span>
            {gameState.dealerIndex === 2 && (
              <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black flex items-center justify-center shadow">
                D
              </span>
            )}
          </div>
          <div className="flex items-center -space-x-4 mt-1">
            {gameState.players[2]?.hand.map((c, idx) => (
              <PlayingCard
                key={idx}
                card={formatCardData(c, gameState.street === 'hand_over' && !gameState.players[2]?.isFolded)}
                size="sm"
              />
            ))}
          </div>
        </div>

        {/* 2. MIDDLE ROW: LEFT (P2), CENTER (COMMUNITY & POT), RIGHT (P4) */}
        <div className="relative z-10 flex items-center justify-between my-auto px-1 sm:px-4">
          {/* Left Player (Player 2) */}
          <div className="flex flex-col items-start gap-1">
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-2xl border backdrop-blur-md transition-all ${
                gameState.players[1]?.isFolded
                  ? 'opacity-40 bg-slate-900 border-slate-800'
                  : gameState.turnIndex === 1
                  ? 'bg-amber-500/25 border-amber-400 ring-2 ring-amber-400/50'
                  : 'bg-slate-950/80 border-slate-700'
              }`}
            >
              <span className="text-lg">{gameState.players[1]?.config.avatar}</span>
              <div>
                <span className="text-xs font-bold text-white block">{gameState.players[1]?.config.name}</span>
                <span className="text-[10px] text-amber-300 font-bold">
                  ${gameState.players[1]?.chips} {gameState.players[1]?.currentStreetBet > 0 ? `(Bet: $${gameState.players[1]?.currentStreetBet})` : ''}
                </span>
              </div>
            </div>
            <div className="flex items-center -space-x-4">
              {gameState.players[1]?.hand.map((c, idx) => (
                <PlayingCard
                  key={idx}
                  card={formatCardData(c, gameState.street === 'hand_over' && !gameState.players[1]?.isFolded)}
                  size="sm"
                />
              ))}
            </div>
          </div>

          {/* CENTER COMMUNITY CARDS & POT */}
          <div className="flex flex-col items-center gap-3 bg-slate-950/75 border-2 border-emerald-400/50 rounded-3xl p-4 shadow-2xl backdrop-blur-md">
            {/* Total Pot */}
            <div className="flex items-center gap-2">
              <PokerChip value={100} size={28} />
              <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                POT: <span className="text-xl font-mono text-white">${gameState.pot}</span>
              </span>
              <PokerChip value={500} size={28} />
            </div>

            {/* 5 Community Card Slots */}
            <div className="flex items-center gap-2">
              {[0, 1, 2, 3, 4].map((slotIdx) => {
                const card = gameState.communityCards[slotIdx];
                return card ? (
                  <div key={card.id} className="animate-card-deal">
                    <PlayingCard card={formatCardData(card, true)} size="md" />
                  </div>
                ) : (
                  <div
                    key={slotIdx}
                    className="w-16 h-24 sm:w-20 sm:h-28 rounded-xl border-2 border-dashed border-emerald-500/30 bg-emerald-950/30 flex items-center justify-center text-xs text-emerald-600/50 font-bold"
                  >
                    {slotIdx < 3 ? 'FLOP' : slotIdx === 3 ? 'TURN' : 'RIVER'}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Player (Player 4) */}
          <div className="flex flex-col items-end gap-1">
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-2xl border backdrop-blur-md transition-all ${
                gameState.players[3]?.isFolded
                  ? 'opacity-40 bg-slate-900 border-slate-800'
                  : gameState.turnIndex === 3
                  ? 'bg-amber-500/25 border-amber-400 ring-2 ring-amber-400/50'
                  : 'bg-slate-950/80 border-slate-700'
              }`}
            >
              <div>
                <span className="text-xs font-bold text-white block text-right">
                  {gameState.players[3]?.config.name}
                </span>
                <span className="text-[10px] text-amber-300 font-bold">
                  ${gameState.players[3]?.chips} {gameState.players[3]?.currentStreetBet > 0 ? `(Bet: $${gameState.players[3]?.currentStreetBet})` : ''}
                </span>
              </div>
              <span className="text-lg">{gameState.players[3]?.config.avatar}</span>
            </div>
            <div className="flex items-center -space-x-4">
              {gameState.players[3]?.hand.map((c, idx) => (
                <PlayingCard
                  key={idx}
                  card={formatCardData(c, gameState.street === 'hand_over' && !gameState.players[3]?.isFolded)}
                  size="sm"
                />
              ))}
            </div>
          </div>
        </div>

        {/* 3. BOTTOM SECTION: USER HOLE CARDS & BETTING CONTROLS */}
        <div className="relative z-10 flex flex-col items-center gap-2 bg-slate-950/85 border border-slate-700/80 rounded-3xl p-3.5 pb-5 backdrop-blur-md shadow-2xl overflow-visible">
          <div className="w-full flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{userPlayer.config.avatar}</span>
              <div>
                <span className="text-xs font-black text-white">{userPlayer.config.name} (You)</span>
                <span className="text-[11px] font-bold text-emerald-300 block">
                  Stack: ${userPlayer.chips} &bull; Bet: ${userPlayer.currentStreetBet}
                </span>
              </div>
            </div>

            {userEvaluation && (
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs font-black">
                {userEvaluation.name}
              </span>
            )}
          </div>

          {/* User Hole Cards with In-Hand Drag Reordering */}
          <DraggableHand
            cards={userPlayer.hand}
            isUserTurn={isUserTurn}
            size="lg"
            onPlayCard={() => {
              if (isUserTurn && !userPlayer.isFolded) {
                handleUserCallOrCheck();
              }
            }}
            onReorderCards={handleReorderUserCards}
          />

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {isUserTurn && !userPlayer.isFolded && (
              <>
                <button
                  onClick={handleUserFold}
                  className="px-4 py-2.5 rounded-xl font-bold bg-rose-900/80 hover:bg-rose-800 text-rose-200 border border-rose-600/40 shadow-lg active:scale-95 transition-all text-xs"
                >
                  FOLD
                </button>

                <button
                  onClick={handleUserCallOrCheck}
                  className="px-5 py-2.5 rounded-xl font-black bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg active:scale-95 transition-all text-xs uppercase tracking-wider"
                >
                  {canCheck ? 'CHECK' : `CALL ($${callAmount})`}
                </button>

                <button
                  onClick={handleUserBetOrRaise}
                  className="px-5 py-2.5 rounded-xl font-black bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-slate-950 shadow-lg active:scale-95 transition-all text-xs uppercase tracking-wider"
                >
                  {gameState.currentHighBet === 0 ? 'BET' : 'RAISE'} TO $
                  {gameState.currentHighBet + gameState.minRaise}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Showdown Modal */}
        {gameState.street === 'hand_over' && (
          <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-emerald-400/60 rounded-3xl p-6 max-w-md w-full shadow-2xl text-center">
              <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-2 animate-bounce" />
              <h3 className="text-2xl font-black text-white mb-1">HAND COMPLETE</h3>
              <p className="text-sm text-emerald-300 font-bold mb-4">{gameState.winningMessage}</p>

              <button
                onClick={handleNextHand}
                className="px-6 py-2.5 rounded-xl font-black bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-xs uppercase tracking-wider"
              >
                Deal Next Hand ➔
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
