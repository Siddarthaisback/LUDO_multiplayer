import React, { useState, useEffect, useRef } from 'react';
import { PlayerConfig, AnimationSpeed } from '../../../types/game';
import { TeenPattiEngine, TeenPattiState } from '../engine/TeenPattiEngine';
import { TeenPattiEvaluator } from '../engine/TeenPattiEvaluator';
import { CLASSIC_TEEN_PATTI_RULES, TeenPattiRuleConfig } from '../engine/TeenPattiRules';
import { TeenPattiAI } from '../ai/TeenPattiAI';
import { PlayingCard } from '../../card-game/PlayingCard';
import { DraggableHand } from '../../card-game/DraggableHand';
import { DealerDealingOverlay } from '../../card-game/DealerDealingOverlay';
import { PokerChip } from '../../card-game/PokerChip';
import { Card } from '../../../core/cards/Card';
import { SettingsBar } from '../../../components/UI/SettingsBar';
import { soundEffects } from '../../../engine/soundEffects';
import { fireCelebrationBurst, fireConfetti } from '../../../engine/confetti';
import { Trophy, Eye, EyeOff, DollarSign, Flame, Sparkles } from 'lucide-react';

interface TeenPattiTableProps {
  initialPlayers: PlayerConfig[];
  onHome: () => void;
  onOpenRules?: () => void;
  onOpenSetup?: () => void;
  rulesConfig?: TeenPattiRuleConfig;
}

export const TeenPattiTable: React.FC<TeenPattiTableProps> = ({
  initialPlayers,
  onHome,
  onOpenRules,
  onOpenSetup,
  rulesConfig = CLASSIC_TEEN_PATTI_RULES,
}) => {
  const [gameState, setGameState] = useState<TeenPattiState>(() =>
    TeenPattiEngine.createMatch(initialPlayers, rulesConfig, 1000)
  );

  const [isDealing, setIsDealing] = useState(true);
  const [speed, setSpeed] = useState<AnimationSpeed>('normal');
  const botTimerRef = useRef<any>(null);

  const userIndex = 0;
  const activeIndex = gameState.turnIndex;
  const activePlayer = gameState.players[activeIndex];
  const isUserTurn = !isDealing && activeIndex === userIndex && gameState.phase === 'betting';

  const activePlayers = gameState.players.filter((p) => !p.isPacked);
  const canShow = activePlayers.length === 2 && isUserTurn;

  // Bot Turn Automation
  useEffect(() => {
    if (gameState.phase !== 'betting' || isDealing) return;

    if (!isUserTurn) {
      const botDelay = speed === 'turbo' ? 350 : speed === 'fast' ? 700 : 1100;

      botTimerRef.current = setTimeout(() => {
        const action = TeenPattiAI.makeDecision(gameState, activeIndex, activePlayer.config.difficulty);

        if (action === 'see') {
          setGameState((prev) => TeenPattiEngine.seeCards(prev, activeIndex));
        } else if (action === 'chaal') {
          soundEffects.playChipClink();
          setGameState((prev) => TeenPattiEngine.applyChaal(prev, activeIndex));
        } else if (action === 'raise') {
          soundEffects.playChipClink();
          setGameState((prev) => TeenPattiEngine.applyRaise(prev, activeIndex));
        } else if (action === 'pack') {
          setGameState((prev) => TeenPattiEngine.applyPack(prev, activeIndex));
        } else if (action === 'show') {
          soundEffects.playWinChips();
          setGameState((prev) => TeenPattiEngine.applyShow(prev, activeIndex));
        }
      }, botDelay);
    }

    return () => {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
    };
  }, [gameState, isUserTurn, speed, activeIndex, isDealing]);

  const handleUserSeeCards = () => {
    setGameState((prev) => TeenPattiEngine.seeCards(prev, userIndex));
  };

  const handleUserChaal = () => {
    if (!isUserTurn) return;
    soundEffects.playChipClink();
    setGameState((prev) => TeenPattiEngine.applyChaal(prev, userIndex));
  };

  const handleUserRaise = () => {
    if (!isUserTurn) return;
    soundEffects.playChipClink();
    setGameState((prev) => TeenPattiEngine.applyRaise(prev, userIndex));
  };

  const handleUserPack = () => {
    if (!isUserTurn) return;
    setGameState((prev) => TeenPattiEngine.applyPack(prev, userIndex));
  };

  const handleUserShow = () => {
    if (!canShow) return;
    soundEffects.playWinChips();
    setGameState((prev) => TeenPattiEngine.applyShow(prev, userIndex));
  };

  const handleReorderUserCards = (reordered: Card[]) => {
    setGameState((prev) => ({
      ...prev,
      players: prev.players.map((p, idx) => (idx === userIndex ? { ...p, hand: reordered } : p)),
    }));
  };

  const handleNextHand = () => {
    setIsDealing(true);
    setGameState(
      TeenPattiEngine.createMatch(
        initialPlayers,
        rulesConfig,
        gameState.players[userIndex].chips
      )
    );
  };

  const userPlayer = gameState.players[userIndex];
  const chaalCost = TeenPattiEngine.getChaalAmount(gameState, userIndex);
  const userEvaluation =
    !userPlayer.isBlind || gameState.phase === 'hand_over'
      ? TeenPattiEvaluator.evaluateHand(userPlayer.hand, gameState.rules)
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
          totalCardsToDeal={12}
          onDealComplete={() => setIsDealing(false)}
        />
      )}

      {/* Top Header & Settings */}
      <div className="w-full flex items-center justify-between mb-2">
        <SettingsBar
          onHome={onHome}
          onRestart={() => {
            setIsDealing(true);
            setGameState(TeenPattiEngine.createMatch(initialPlayers, rulesConfig, 1000));
          }}
          onOpenRules={onOpenRules || (() => {})}
          onOpenSetup={onOpenSetup}
          gameTitle="Teen Patti (👑 3-Card Royale)"
          speed={speed}
          onSpeedChange={setSpeed}
        />
      </div>

      {/* Main Felt Casino Table */}
      <div className="relative w-full h-[580px] sm:h-[620px] rounded-[40px] border-4 border-amber-500/50 bg-gradient-to-b from-[#450a0a] via-[#7f1d1d] to-[#2a0808] shadow-[0_20px_60px_rgba(0,0,0,0.8)] p-4 flex flex-col justify-between overflow-hidden">
        {/* Table Felt Glow & Center Rings */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.15),transparent_70%)] pointer-events-none" />
        <div className="absolute inset-8 rounded-[32px] border border-amber-400/20 pointer-events-none" />

        {/* Header Indicator */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2 bg-slate-950/80 border border-amber-400/30 rounded-2xl px-3 py-1.5 backdrop-blur-md">
            <span className="text-xs font-black uppercase text-amber-300">
              Current Stake: ${gameState.currentStake}
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs font-bold text-white">
              Boot: ${gameState.rules.bootAmount}
            </span>
          </div>

          <span className="bg-slate-950/80 text-amber-300 text-xs font-black px-3 py-1.5 rounded-xl border border-amber-400/30">
            TEEN PATTI &bull; 3-Card Poker
          </span>
        </div>

        {/* 1. TOP PLAYER (Player 3) */}
        <div className="relative z-10 flex flex-col items-center gap-1">
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-2xl border backdrop-blur-md transition-all ${
              gameState.players[2]?.isPacked
                ? 'opacity-40 bg-slate-900 border-slate-800'
                : gameState.turnIndex === 2
                ? 'bg-amber-500/25 border-amber-400 ring-2 ring-amber-400/50'
                : 'bg-slate-950/80 border-slate-700'
            }`}
          >
            <span className="text-lg">{gameState.players[2]?.config.avatar}</span>
            <span className="text-xs font-bold text-white">{gameState.players[2]?.config.name}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 font-bold">
              ${gameState.players[2]?.chips}
            </span>
            <span className="text-[9px] uppercase font-black text-slate-400">
              {gameState.players[2]?.isPacked ? 'PACKED' : gameState.players[2]?.isBlind ? 'BLIND' : 'SEEN'}
            </span>
          </div>
          <div className="flex items-center -space-x-4 mt-1">
            {gameState.players[2]?.hand.map((c, idx) => (
              <PlayingCard
                key={idx}
                card={formatCardData(c, gameState.phase === 'hand_over' && !gameState.players[2]?.isPacked)}
                size="sm"
              />
            ))}
          </div>
        </div>

        {/* 2. MIDDLE ROW: LEFT (P2), CENTER (POT), RIGHT (P4) */}
        <div className="relative z-10 flex items-center justify-between my-auto px-1 sm:px-4">
          {/* Left Player (Player 2) */}
          <div className="flex flex-col items-start gap-1">
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-2xl border backdrop-blur-md transition-all ${
                gameState.players[1]?.isPacked
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
                  ${gameState.players[1]?.chips} ({gameState.players[1]?.isPacked ? 'PACKED' : gameState.players[1]?.isBlind ? 'BLIND' : 'SEEN'})
                </span>
              </div>
            </div>
            <div className="flex items-center -space-x-4">
              {gameState.players[1]?.hand.map((c, idx) => (
                <PlayingCard
                  key={idx}
                  card={formatCardData(c, gameState.phase === 'hand_over' && !gameState.players[1]?.isPacked)}
                  size="sm"
                />
              ))}
            </div>
          </div>

          {/* CENTER POT & CHIP DECK */}
          <div className="bg-slate-950/85 border-2 border-amber-400/80 rounded-3xl px-8 py-3 shadow-2xl backdrop-blur-md flex flex-col items-center gap-1.5 animate-scale-in">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-300/80">
              TOTAL POT
            </span>
            <div className="flex items-center gap-2">
              <PokerChip value={100} size={32} />
              <span className="text-3xl sm:text-4xl font-black text-white font-mono leading-none">
                ${gameState.pot}
              </span>
              <PokerChip value={500} size={32} />
            </div>
          </div>

          {/* Right Player (Player 4) */}
          <div className="flex flex-col items-end gap-1">
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-2xl border backdrop-blur-md transition-all ${
                gameState.players[3]?.isPacked
                  ? 'opacity-40 bg-slate-900 border-slate-800'
                  : gameState.turnIndex === 3
                  ? 'bg-amber-500/25 border-amber-400 ring-2 ring-amber-400/50'
                  : 'bg-slate-950/80 border-slate-700'
              }`}
            >
              <div>
                <span className="text-xs font-bold text-white block text-right">{gameState.players[3]?.config.name}</span>
                <span className="text-[10px] text-amber-300 font-bold">
                  ${gameState.players[3]?.chips} ({gameState.players[3]?.isPacked ? 'PACKED' : gameState.players[3]?.isBlind ? 'BLIND' : 'SEEN'})
                </span>
              </div>
              <span className="text-lg">{gameState.players[3]?.config.avatar}</span>
            </div>
            <div className="flex items-center -space-x-4">
              {gameState.players[3]?.hand.map((c, idx) => (
                <PlayingCard
                  key={idx}
                  card={formatCardData(c, gameState.phase === 'hand_over' && !gameState.players[3]?.isPacked)}
                  size="sm"
                />
              ))}
            </div>
          </div>
        </div>

        {/* 3. BOTTOM SECTION: USER HAND & CONTROLS */}
        <div className="relative z-10 flex flex-col items-center gap-3 bg-slate-950/85 border border-slate-700/80 rounded-3xl p-3.5 pb-5 backdrop-blur-md shadow-2xl overflow-visible">
          {/* User Info & Hand Ranking */}
          <div className="w-full flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{userPlayer.config.avatar}</span>
              <div>
                <span className="text-xs font-black text-white">{userPlayer.config.name} (You)</span>
                <span className="text-[11px] font-bold text-emerald-300 block">
                  Chips: ${userPlayer.chips} &bull; Mode: {userPlayer.isBlind ? 'BLIND' : 'SEEN'}
                </span>
              </div>
            </div>

            {userEvaluation && (
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs font-black">
                {userEvaluation.name}
              </span>
            )}
          </div>

          {/* User Hand Cards with In-Hand Drag Reordering */}
          <DraggableHand
            cards={userPlayer.hand}
            isUserTurn={isUserTurn}
            size="lg"
            onPlayCard={() => {
              if (isUserTurn && !userPlayer.isPacked) {
                handleUserChaal();
              }
            }}
            onReorderCards={handleReorderUserCards}
          />

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {userPlayer.isBlind && gameState.phase === 'betting' && (
              <button
                onClick={handleUserSeeCards}
                className="px-4 py-2.5 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-400/40 shadow-lg active:scale-95 transition-all text-xs flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" /> SEE CARDS
              </button>
            )}

            {isUserTurn && !userPlayer.isPacked && (
              <>
                <button
                  onClick={handleUserChaal}
                  className="px-5 py-2.5 rounded-xl font-black bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center gap-1.5"
                >
                  CHAAL (${chaalCost})
                </button>

                <button
                  onClick={handleUserRaise}
                  className="px-5 py-2.5 rounded-xl font-black bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-slate-950 shadow-lg active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center gap-1.5"
                >
                  RAISE STAKE
                </button>

                <button
                  onClick={handleUserPack}
                  className="px-4 py-2.5 rounded-xl font-bold bg-rose-900/80 hover:bg-rose-800 text-rose-200 border border-rose-600/40 shadow-lg active:scale-95 transition-all text-xs"
                >
                  PACK (Fold)
                </button>

                {canShow && (
                  <button
                    onClick={handleUserShow}
                    className="px-5 py-2.5 rounded-xl font-black bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 shadow-xl shadow-yellow-500/20 active:scale-95 transition-all text-xs uppercase tracking-wider animate-bounce flex items-center gap-1.5"
                  >
                    <Trophy className="w-3.5 h-3.5" /> SHOWDOWN (${chaalCost})
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Showdown / Hand Over Modal */}
        {gameState.phase === 'hand_over' && (
          <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-400/60 rounded-3xl p-6 max-w-md w-full shadow-2xl text-center">
              <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-2 animate-bounce" />
              <h3 className="text-2xl font-black text-white mb-1">
                {gameState.winnerIndex === userIndex ? '🎉 YOU SCOOPED THE POT!' : 'HAND OVER'}
              </h3>
              <p className="text-sm text-amber-300 font-bold mb-4">{gameState.winningMessage}</p>

              <button
                onClick={handleNextHand}
                className="px-6 py-2.5 rounded-xl font-black bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 text-xs uppercase tracking-wider"
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
