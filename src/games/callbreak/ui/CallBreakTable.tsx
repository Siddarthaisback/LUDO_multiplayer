import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PlayerConfig, AnimationSpeed } from '../../../types/game';
import { CallBreakEngine, CallBreakState, TrickCard } from '../engine/CallBreakEngine';
import { NEPAL_CLASSIC_CALLBREAK_RULES, CallBreakRuleConfig } from '../engine/CallBreakRules';
import { CallBreakAI } from '../ai/CallBreakAI';
import { PlayingCard } from '../../card-game/PlayingCard';
import { DraggableHand } from '../../card-game/DraggableHand';
import { CallBreakScorecardModal } from './CallBreakScorecardModal';
import { LastTrickModal } from './LastTrickModal';
import { Card, CardId } from '../../../core/cards/Card';
import { SettingsBar } from '../../../components/UI/SettingsBar';
import { soundEffects } from '../../../engine/soundEffects';
import { 
  Trophy, 
  Sparkles, 
  Crown, 
  Flame, 
  Award,
  History,
  Smile,
  Zap
} from 'lucide-react';

interface CallBreakTableProps {
  initialPlayers: PlayerConfig[];
  onHome: () => void;
  onOpenRules?: () => void;
  onOpenSetup?: () => void;
  rulesConfig?: CallBreakRuleConfig;
}

type DealPhase = 'shuffling' | 'dealing' | 'ready';

export const CallBreakTable: React.FC<CallBreakTableProps> = ({
  initialPlayers,
  onHome,
  onOpenRules,
  onOpenSetup,
  rulesConfig = NEPAL_CLASSIC_CALLBREAK_RULES,
}) => {
  const normalizedPlayers = useMemo(() => {
    if (initialPlayers && initialPlayers.length === 4) return initialPlayers;
    return [
      initialPlayers[0] || { id: 'p0', name: 'You', color: 'red', type: 'human', avatar: '🦁', isHost: true },
      initialPlayers[1] || { id: 'p1', name: 'Bot Ramesh', color: 'green', type: 'bot', difficulty: 'medium', avatar: '🐼' },
      initialPlayers[2] || { id: 'p2', name: 'Bot Sita', color: 'yellow', type: 'bot', difficulty: 'master', avatar: '🦊' },
      initialPlayers[3] || { id: 'p3', name: 'Bot Bikram', color: 'blue', type: 'bot', difficulty: 'medium', avatar: '🤖' },
    ] as PlayerConfig[];
  }, [initialPlayers]);

  const [gameState, setGameState] = useState<CallBreakState>(() =>
    CallBreakEngine.createMatch(normalizedPlayers, rulesConfig)
  );

  // Dealing & Animation States
  const [dealPhase, setDealPhase] = useState<DealPhase>('shuffling');
  const [dealtCardsCount, setDealtCardsCount] = useState<number>(0);
  const [speed, setSpeed] = useState<AnimationSpeed>('normal');
  const [botBubble, setBotBubble] = useState<{ playerIndex: number; text: string } | null>(null);
  const [hukumBanner, setHukumBanner] = useState<{ playerName: string; cardLabel: string } | null>(null);
  const [showScorecard, setShowScorecard] = useState(false);
  const [showLastTrick, setShowLastTrick] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [lastCompletedTrick, setLastCompletedTrick] = useState<{
    trick: TrickCard[];
    winnerIndex: number;
    winningCardId: string;
  } | null>(null);

  const [evaluatingTrick, setEvaluatingTrick] = useState<{
    trick: TrickCard[];
    winnerIndex: number;
    winningCardId: CardId;
  } | null>(null);
  const [trickWinnerNotification, setTrickWinnerNotification] = useState<{
    playerIndex: number;
    message: string;
  } | null>(null);
  const [showExtendedBids, setShowExtendedBids] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const activeTimersRef = useRef<Set<any>>(new Set());
  const userIndex = 0;
  const activeIndex = gameState.turnIndex;
  const isUserTurn = dealPhase === 'ready' && !evaluatingTrick && !isProcessingAction && activeIndex === userIndex;

  // Safe timer scheduler
  const registerTimer = (fn: () => void, delayMs: number) => {
    const timerId = setTimeout(() => {
      activeTimersRef.current.delete(timerId);
      fn();
    }, delayMs);
    activeTimersRef.current.add(timerId);
    return timerId;
  };

  const clearAllTimers = () => {
    activeTimersRef.current.forEach((t) => clearTimeout(t));
    activeTimersRef.current.clear();
  };

  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  // Spades Played Count
  const spadesPlayedCount = useMemo(() => {
    let count = 0;
    gameState.completedTricks.forEach((trick) => {
      trick.forEach((t) => {
        if (t.card.suit === 'S') count++;
      });
    });
    gameState.currentTrick.forEach((t) => {
      if (t.card.suit === 'S') count++;
    });
    return count;
  }, [gameState.completedTricks, gameState.currentTrick]);

  // AI Recommended bid for the user's current hand
  const userSuggestedBid = useMemo(() => {
    if (!gameState.players[userIndex]?.hand) return Math.max(1, gameState.rules.minimumBid);
    return CallBreakAI.calculateBid(gameState.players[userIndex].hand, 'master', gameState.rules.minimumBid);
  }, [gameState.players, userIndex, gameState.rules.minimumBid]);

  // ─────────────────────────────────────────────────────────────
  // 1. SHUFFLE & DEALING ANIMATION SEQUENCE
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (dealPhase === 'shuffling') {
      soundEffects.playCardShuffle();
      const shuffleTimer = registerTimer(() => {
        setDealPhase('dealing');
        setDealtCardsCount(0);
      }, 600);
      return () => clearTimeout(shuffleTimer);
    }

    if (dealPhase === 'dealing') {
      const dealIntervalMs = speed === 'turbo' ? 20 : speed === 'fast' ? 35 : 55;
      const interval = setInterval(() => {
        setDealtCardsCount((prev) => {
          const next = prev + 1;
          if (next % 4 === 0) {
            soundEffects.playCardDeal();
          }
          if (next >= 52) {
            clearInterval(interval);
            registerTimer(() => {
              setDealPhase('ready');
            }, 250);
          }
          return next;
        });
      }, dealIntervalMs);

      return () => clearInterval(interval);
    }
  }, [dealPhase, speed]);

  // ─────────────────────────────────────────────────────────────
  // 2. BOT TURN AUTOMATION (BIDDING & PLAYING)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (dealPhase !== 'ready' || evaluatingTrick || isProcessingAction) return;

    // Only run if it's a Bot's turn
    if (activeIndex !== userIndex && (gameState.phase === 'bidding' || gameState.phase === 'playing')) {
      const botConfig = gameState.players[activeIndex].config;
      const botDelay = speed === 'turbo' ? 250 : speed === 'fast' ? 450 : 750;

      const timerId = registerTimer(() => {
        if (gameState.phase === 'bidding') {
          const botHand = gameState.players[activeIndex].hand;
          const bid = CallBreakAI.calculateBid(
            botHand,
            botConfig.difficulty,
            gameState.rules.minimumBid
          );

          soundEffects.playChipClink();
          setBotBubble({
            playerIndex: activeIndex,
            text: `Bid: ${bid}!`,
          });

          registerTimer(() => {
            setGameState((prev) => CallBreakEngine.applyBid(prev, activeIndex, bid));
            setBotBubble(null);
          }, 350);
        } else if (gameState.phase === 'playing') {
          const chosenCardId = CallBreakAI.selectCardToPlay(
            gameState,
            activeIndex,
            botConfig.difficulty
          );

          handleExecutePlayCard(activeIndex, chosenCardId);
        }
      }, botDelay);

      return () => clearTimeout(timerId);
    }
  }, [activeIndex, gameState.phase, dealPhase, evaluatingTrick, speed, isProcessingAction]);

  // ─────────────────────────────────────────────────────────────
  // 3. EXECUTE PLAY CARD (Shared by Human and AI)
  // ─────────────────────────────────────────────────────────────
  const handleExecutePlayCard = (playerIndex: number, cardId: CardId) => {
    const player = gameState.players[playerIndex];
    const card = player.hand.find((c) => c.id === cardId);
    if (!card) return;

    soundEffects.playCardDeal();

    // Check for Hukum / Spade Trump Cut
    const leadCard = gameState.currentTrick[0]?.card;
    if (leadCard && leadCard.suit !== 'S' && card.suit === 'S') {
      soundEffects.playTrumpStrike();
      setHukumBanner({
        playerName: player.config.name,
        cardLabel: card.label,
      });
      registerTimer(() => setHukumBanner(null), 1600);
    }

    const newTrick: TrickCard[] = [...gameState.currentTrick, { playerIndex, card }];
    
    // If trick is NOT complete yet (< 4 cards)
    if (newTrick.length < 4) {
      setGameState((prev) => CallBreakEngine.applyPlayCard(prev, playerIndex, cardId));
      return;
    }

    // 4th card played: determine trick winner for resolution showcase
    const winnerIdx = CallBreakEngine.determineTrickWinner(newTrick);
    const winningCard = CallBreakEngine.determineCurrentWinnerCard(newTrick);

    setEvaluatingTrick({
      trick: newTrick,
      winnerIndex: winnerIdx,
      winningCardId: winningCard.id,
    });

    setLastCompletedTrick({
      trick: newTrick,
      winnerIndex: winnerIdx,
      winningCardId: winningCard.id,
    });

    const winnerName = gameState.players[winnerIdx].config.name;
    setTrickWinnerNotification({
      playerIndex: winnerIdx,
      message: `${winnerName} won the trick! 👑`,
    });

    if (winnerIdx === userIndex) {
      soundEffects.playChipClink();
    }

    registerTimer(() => {
      setGameState((prev) => CallBreakEngine.applyPlayCard(prev, playerIndex, cardId));
      setEvaluatingTrick(null);
      setTrickWinnerNotification(null);
    }, speed === 'turbo' ? 350 : speed === 'fast' ? 650 : 950);
  };

  // User Bidding
  const handleUserBid = (bid: number) => {
    if (!isUserTurn || gameState.phase !== 'bidding') return;
    setIsProcessingAction(true);
    soundEffects.playChipClink();
    setBotBubble({ playerIndex: userIndex, text: `Bid: ${bid}!` });

    registerTimer(() => {
      setGameState((prev) => CallBreakEngine.applyBid(prev, userIndex, bid));
      setBotBubble(null);
      setIsProcessingAction(false);
    }, 200);
  };

  // User Play Card
  const handleUserPlayCard = (cardId: CardId) => {
    if (!isUserTurn || gameState.phase !== 'playing') return;
    handleExecutePlayCard(userIndex, cardId);
  };

  // Start Next Round
  const handleNextRound = () => {
    clearAllTimers();
    setIsProcessingAction(false);
    setDealPhase('shuffling');
    setDealtCardsCount(0);
    setGameState((prev) => CallBreakEngine.nextRound(prev));
  };

  const handleRestart = () => {
    clearAllTimers();
    setIsProcessingAction(false);
    setDealPhase('shuffling');
    setDealtCardsCount(0);
    setGameState(CallBreakEngine.createMatch(normalizedPlayers, rulesConfig));
  };

  // Hand Sorter: By Suit (♠, ♥, ♣, ♦)
  const handleSortBySuit = () => {
    soundEffects.playCardDeal();
    const suitOrder: Record<string, number> = { S: 0, H: 1, C: 2, D: 3 };
    const sorted = [...userPlayer.hand].sort((a, b) => {
      if (suitOrder[a.suit] !== suitOrder[b.suit]) {
        return suitOrder[a.suit] - suitOrder[b.suit];
      }
      return b.rank - a.rank;
    });
    setGameState((prev) => ({
      ...prev,
      players: prev.players.map((p, idx) => (idx === userIndex ? { ...p, hand: sorted } : p)),
    }));
  };

  // Hand Sorter: By Rank (High to Low)
  const handleSortByRank = () => {
    soundEffects.playCardDeal();
    const sorted = [...userPlayer.hand].sort((a, b) => b.rank - a.rank);
    setGameState((prev) => ({
      ...prev,
      players: prev.players.map((p, idx) => (idx === userIndex ? { ...p, hand: sorted } : p)),
    }));
  };

  // Send Emoji Reaction
  const handleSendEmoji = (emoji: string) => {
    setShowEmojiPicker(false);
    setBotBubble({ playerIndex: userIndex, text: emoji });
    registerTimer(() => setBotBubble(null), 2500);

    if (Math.random() < 0.6) {
      const randomBotIdx = Math.floor(Math.random() * 3) + 1;
      const botReplies = ['👏', '🔥', '😅', '👑', '😎', '💪', '♠️'];
      const replyEmoji = botReplies[Math.floor(Math.random() * botReplies.length)];
      registerTimer(() => {
        setBotBubble({ playerIndex: randomBotIdx, text: replyEmoji });
        registerTimer(() => setBotBubble(null), 2200);
      }, 800);
    }
  };

  // Legal cards for User
  const userPlayer = gameState.players[userIndex];
  const userLegalCards = useMemo(() => {
    if (gameState.phase !== 'playing' || !isUserTurn) return [];
    return CallBreakEngine.getLegalCards(userPlayer.hand, gameState.currentTrick, gameState.rules).map((c) => c.id);
  }, [gameState, isUserTurn, userPlayer.hand]);

  // Dealer-relative card count visibility per player during deal phase
  const getVisibleCardCount = (pIdx: number) => {
    if (dealPhase === 'ready') return gameState.players[pIdx]?.hand.length || 0;
    const startSeat = (gameState.dealerIndex + 1) % 4;
    const offsetSeat = (pIdx - startSeat + 4) % 4;
    const roundsDealt = Math.floor(dealtCardsCount / 4);
    const extraCard = (dealtCardsCount % 4) > offsetSeat ? 1 : 0;
    return Math.min(13, roundsDealt + extraCard);
  };

  const formatCardData = (c: Card, faceUp: boolean = true) => ({
    id: c.id,
    suit: (c.suit === 'S' ? 'spades' : c.suit === 'H' ? 'hearts' : c.suit === 'D' ? 'diamonds' : 'clubs') as any,
    rank: c.rank,
    label: c.label,
    isFaceUp: faceUp,
  });

  const minBid = gameState.rules.minimumBid || 1;
  const standardBids = [1, 2, 3, 4, 5, 6, 7, 8].filter((b) => b >= minBid);

  return (
    <div className="flex-1 flex flex-col justify-between max-w-5xl mx-auto w-full p-2 sm:p-4 select-none animate-fade-in relative">
      
      {/* 5-Round Scorecard Modal */}
      {showScorecard && (
        <CallBreakScorecardModal
          players={gameState.players}
          currentRound={gameState.currentRound}
          totalRounds={gameState.rules.roundCount}
          onClose={() => setShowScorecard(false)}
        />
      )}

      {/* Last Trick Modal */}
      {showLastTrick && (
        <LastTrickModal
          lastTrick={lastCompletedTrick?.trick || []}
          winningCardId={lastCompletedTrick?.winningCardId}
          winnerIndex={lastCompletedTrick?.winnerIndex}
          players={gameState.players}
          onClose={() => setShowLastTrick(false)}
        />
      )}

      {/* Top Header & Settings */}
      <div className="w-full flex items-center justify-between mb-2">
        <SettingsBar
          onHome={onHome}
          onRestart={handleRestart}
          onOpenRules={onOpenRules || (() => {})}
          onOpenSetup={onOpenSetup}
          gameTitle="Call Break (♠️ Spades Trump)"
          speed={speed}
          onSpeedChange={setSpeed}
        />
      </div>

      {/* Main Luxury Wooden Felt Casino Arena */}
      <div className="relative w-full h-[580px] sm:h-[620px] rounded-[40px] border-4 border-amber-600/40 bg-gradient-to-b from-[#0f281e] via-[#143e2e] to-[#0a1f16] shadow-[0_20px_60px_rgba(0,0,0,0.8)] p-3 sm:p-4 flex flex-col justify-between overflow-hidden">
        
        {/* Table Felt Ambient Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.12),transparent_70%)] pointer-events-none" />
        <div className="absolute inset-6 rounded-[34px] border border-amber-400/20 pointer-events-none" />

        {/* ── TOP ACTION BAR: Round, Trumps & Utility Controls ── */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-950/85 border border-amber-400/30 rounded-2xl px-3 py-1.5 backdrop-blur-md shadow-md">
              <span className="text-xs font-black uppercase text-amber-300">
                Round {gameState.currentRound} / {gameState.rules.roundCount}
              </span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs font-bold text-white flex items-center gap-1">
                <span>Trump:</span>
                <span className="text-amber-400 font-black text-sm">♠️ Spades</span>
              </span>
            </div>

            {/* Spades Played Counter */}
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-950/80 border border-slate-700/80 rounded-2xl px-3 py-1.5 text-xs font-bold text-slate-300 shadow-md">
              <span className="text-amber-400 font-black">♠</span>
              <span>Spades: {spadesPlayedCount}/13</span>
            </div>
          </div>

          {/* Quick Utility Buttons: Scorecard, Last Trick */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLastTrick(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-950/80 hover:bg-slate-900 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <History className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Last Trick</span>
            </button>

            <button
              onClick={() => setShowScorecard(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-black transition-all shadow-lg active:scale-95"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Scorecard</span>
            </button>
          </div>
        </div>

        {/* ── 1. TOP SEAT: PLAYER 2 (Sita) ── */}
        <div className="relative z-10 flex flex-col items-center gap-1">
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-2xl border backdrop-blur-md transition-all shadow-md ${
              activeIndex === 2 && dealPhase === 'ready'
                ? 'bg-amber-500/30 border-amber-400 ring-4 ring-amber-400/40 scale-105'
                : 'bg-slate-950/80 border-slate-700/80'
            }`}
          >
            <span className="text-lg">{gameState.players[2]?.config.avatar}</span>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-black text-white">{gameState.players[2]?.config.name}</span>
                {gameState.dealerIndex === 2 && (
                  <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1 rounded-full">D</span>
                )}
              </div>
              <span className="text-[10px] text-amber-300 font-bold block">
                🎯 {gameState.players[2]?.bid || '-'} | 🏆 {gameState.players[2]?.tricksWon} | Total: {gameState.players[2]?.totalScore.toFixed(1)}
              </span>
            </div>
          </div>

          {botBubble?.playerIndex === 2 && (
            <span className="text-[11px] font-black px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 animate-bounce shadow-md">
              {botBubble.text}
            </span>
          )}

          {/* Cards (Face-down during deal / round) */}
          <div className="flex items-center -space-x-3 h-9 mt-1">
            {Array.from({ length: getVisibleCardCount(2) }).map((_, idx) => (
              <div
                key={idx}
                className="w-6 h-9 rounded-md border border-amber-400/30 bg-gradient-to-br from-red-800 to-red-950 shadow-md flex items-center justify-center text-[7px] text-amber-300 font-black"
              >
                ♠
              </div>
            ))}
          </div>
        </div>

        {/* ── 2. MIDDLE ROW: LEFT (P1), CENTER TRICK FELT, RIGHT (P3) ── */}
        <div className="relative z-10 flex items-center justify-between my-auto px-1 sm:px-4">
          
          {/* LEFT SEAT: PLAYER 1 (Ramesh) */}
          <div className="flex flex-col items-start gap-1 max-w-[140px]">
            <div
              className={`flex items-center gap-2 px-2.5 py-1 rounded-2xl border backdrop-blur-md transition-all shadow-md ${
                activeIndex === 1 && dealPhase === 'ready'
                  ? 'bg-amber-500/30 border-amber-400 ring-4 ring-amber-400/40 scale-105'
                  : 'bg-slate-950/80 border-slate-700/80'
              }`}
            >
              <span className="text-lg">{gameState.players[1]?.config.avatar}</span>
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-black text-white">{gameState.players[1]?.config.name}</span>
                  {gameState.dealerIndex === 1 && (
                    <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1 rounded-full">D</span>
                  )}
                </div>
                <span className="text-[10px] text-amber-300 font-bold block">
                  🎯 {gameState.players[1]?.bid || '-'} | 🏆 {gameState.players[1]?.tricksWon}
                </span>
              </div>
            </div>

            {botBubble?.playerIndex === 1 && (
              <span className="text-[11px] font-black px-2 py-0.5 rounded-xl bg-amber-400 text-slate-950 animate-bounce shadow-md">
                {botBubble.text}
              </span>
            )}

            <div className="flex items-center -space-x-3 h-9 mt-1">
              {Array.from({ length: getVisibleCardCount(1) }).map((_, idx) => (
                <div
                  key={idx}
                  className="w-6 h-9 rounded-md border border-amber-400/30 bg-gradient-to-br from-red-800 to-red-950 shadow-md flex items-center justify-center text-[7px] text-amber-300 font-black"
                >
                  ♠
                </div>
              ))}
            </div>
          </div>

          {/* ── CENTER FELT: TRICK PLAY AREA & HUKUM STRIKES ── */}
          <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-full border-2 border-dashed border-amber-400/35 bg-slate-950/70 backdrop-blur-md flex items-center justify-center shadow-[inset_0_0_25px_rgba(0,0,0,0.8)]">
            
            {/* Center Deck During Shuffling/Dealing */}
            {dealPhase !== 'ready' ? (
              <div className="flex flex-col items-center gap-2 text-center animate-pulse">
                <div className="relative w-14 h-20 rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-700 via-amber-900 to-slate-950 shadow-2xl flex items-center justify-center text-xl text-amber-300 font-black animate-bounce">
                  🂠
                </div>
                <span className="text-[11px] font-black uppercase text-amber-300 tracking-wider">
                  {dealPhase === 'shuffling' ? 'Shuffling...' : `Dealing (${dealtCardsCount}/52)`}
                </span>
              </div>
            ) : (
              // Active Trick Cards Showcase
              <div className="relative w-full h-full">
                {(evaluatingTrick?.trick || gameState.currentTrick).length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
                    {gameState.phase === 'bidding' ? (
                      <div className="flex flex-col items-center gap-1">
                        <Flame className="w-5 h-5 text-amber-400 animate-bounce" />
                        <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                          Bidding Phase
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Active: {gameState.players[activeIndex]?.config.name}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-slate-400">
                        <span className="text-xs font-bold">
                          Leader: <span className="text-amber-300 font-black">{gameState.players[gameState.leaderIndex]?.config.name}</span>
                        </span>
                        <span className="text-[10px] text-slate-500">Play cards clockwise</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Render Cards in Active Trick (Centered strictly inside felt circle) */}
                {(evaluatingTrick?.trick || gameState.currentTrick).map((t) => {
                  const posStyles = [
                    'top-1/2 left-1/2 -translate-x-1/2 translate-y-[8px]',        // P0 (You - Bottom)
                    'top-1/2 left-1/2 -translate-x-[44px] -translate-y-1/2',     // P1 (Ramesh - Left)
                    'top-1/2 left-1/2 -translate-x-1/2 -translate-y-[46px]',     // P2 (Sita - Top)
                    'top-1/2 left-1/2 translate-x-[6px] -translate-y-1/2',       // P3 (Bikram - Right)
                  ][t.playerIndex];

                  const rotAngle = [0, -8, 0, 8][t.playerIndex];
                  const isWinner = evaluatingTrick?.winningCardId === t.card.id;

                  return (
                    <div
                      key={t.card.id}
                      style={{ transform: `rotate(${rotAngle}deg)` }}
                      className={`absolute ${posStyles} transition-all duration-300 ${
                        isWinner ? 'scale-110 z-30 ring-2 ring-amber-400 rounded-xl shadow-[0_0_25px_rgba(251,191,36,0.9)]' : 'z-10'
                      }`}
                    >
                      <div className="relative">
                        <PlayingCard card={formatCardData(t.card, true)} size="md" disableTransform={true} />
                        {isWinner && (
                          <div className="absolute -top-3 -right-3 bg-amber-400 text-slate-950 p-1 rounded-full shadow-lg animate-bounce">
                            <Crown className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Hukum (Spade Trump Cut) FX Notification Banner */}
                {hukumBanner && (
                  <div className="absolute inset-0 flex items-center justify-center z-40 animate-scale-in pointer-events-none">
                    <div className="bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-500 text-slate-950 px-4 py-2 rounded-2xl font-black text-xs sm:text-sm shadow-2xl flex items-center gap-2 border-2 border-white scale-110">
                      <Zap className="w-4 h-4 text-slate-950 animate-bounce" />
                      <span>♠ HUKUM! ({hukumBanner.playerName})</span>
                    </div>
                  </div>
                )}

                {/* Floating Winner Announcement */}
                {trickWinnerNotification && !hukumBanner && (
                  <div className="absolute inset-0 flex items-center justify-center z-40 animate-fade-in pointer-events-none">
                    <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 px-4 py-2 rounded-2xl font-black text-xs sm:text-sm shadow-2xl flex items-center gap-2 scale-110">
                      <Trophy className="w-4 h-4" />
                      <span>{trickWinnerNotification.message}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT SEAT: PLAYER 3 (Bikram) */}
          <div className="flex flex-col items-end gap-1 max-w-[140px]">
            <div
              className={`flex items-center gap-2 px-2.5 py-1 rounded-2xl border backdrop-blur-md transition-all shadow-md ${
                activeIndex === 3 && dealPhase === 'ready'
                  ? 'bg-amber-500/30 border-amber-400 ring-4 ring-amber-400/40 scale-105'
                  : 'bg-slate-950/80 border-slate-700/80'
              }`}
            >
              <div>
                <div className="flex items-center gap-1 justify-end">
                  <span className="text-xs font-black text-white">{gameState.players[3]?.config.name}</span>
                  {gameState.dealerIndex === 3 && (
                    <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1 rounded-full">D</span>
                  )}
                </div>
                <span className="text-[10px] text-amber-300 font-bold block text-right">
                  🎯 {gameState.players[3]?.bid || '-'} | 🏆 {gameState.players[3]?.tricksWon}
                </span>
              </div>
              <span className="text-lg">{gameState.players[3]?.config.avatar}</span>
            </div>

            {botBubble?.playerIndex === 3 && (
              <span className="text-[11px] font-black px-2 py-0.5 rounded-xl bg-amber-400 text-slate-950 animate-bounce shadow-md">
                {botBubble.text}
              </span>
            )}

            <div className="flex items-center -space-x-3 h-9 mt-1">
              {Array.from({ length: getVisibleCardCount(3) }).map((_, idx) => (
                <div
                  key={idx}
                  className="w-6 h-9 rounded-md border border-amber-400/30 bg-gradient-to-br from-red-800 to-red-950 shadow-md flex items-center justify-center text-[7px] text-amber-300 font-black"
                >
                  ♠
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 3. BOTTOM SECTION: USER HAND & CONTROLS ── */}
        <div className="relative z-20 flex flex-col items-center bg-slate-950/90 border border-slate-700/80 rounded-3xl p-3 pb-4 backdrop-blur-lg shadow-2xl overflow-visible">
          
          {/* User Status & Hand Sorter Controls (Cleanly Separated Header Bar) */}
          <div className="w-full flex items-center justify-between px-2 mb-2.5 pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="text-xl sm:text-2xl">{userPlayer.config.avatar}</span>
                {botBubble?.playerIndex === userIndex && (
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-sm font-black px-2 py-0.5 rounded-xl bg-amber-400 text-slate-950 animate-bounce shadow-md whitespace-nowrap">
                    {botBubble.text}
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-white">{userPlayer.config.name} (You)</span>
                  {gameState.dealerIndex === 0 && (
                    <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1.5 rounded-full">Dealer</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-black">
                  <span className="text-amber-300">🎯 Bid: {userPlayer.bid || '-'}</span>
                  <span className="text-slate-500">•</span>
                  <span className={userPlayer.tricksWon >= (userPlayer.bid || 1) ? 'text-emerald-400' : 'text-slate-300'}>
                    🏆 Won: {userPlayer.tricksWon}
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-yellow-400">Score: {userPlayer.totalScore.toFixed(1)}</span>
                </div>
              </div>
            </div>

            {/* Hand Sorting & Quick Reaction Emojis */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSortBySuit}
                title="Sort Hand by Suit (♠ ♥ ♣ ♦)"
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600 text-[10px] sm:text-xs font-bold transition-all shadow active:scale-95"
              >
                Sort Suit
              </button>

              <button
                onClick={handleSortByRank}
                title="Sort Hand by Rank (High to Low)"
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600 text-[10px] sm:text-xs font-bold transition-all shadow active:scale-95"
              >
                Sort Rank
              </button>

              {/* Emoji Picker Toggle */}
              <div className="relative">
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-600 transition-all shadow active:scale-95"
                  title="Send Quick Emoji Reaction"
                >
                  <Smile className="w-3.5 h-3.5" />
                </button>

                {showEmojiPicker && (
                  <div className="absolute bottom-9 right-0 bg-slate-900 border border-amber-400/40 rounded-2xl p-2 shadow-2xl flex items-center gap-1 z-50 animate-scale-in">
                    {['👏', '🔥', '♠️', '😅', '👑', '🎯'].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleSendEmoji(emoji)}
                        className="p-1 text-base hover:scale-130 transition-transform"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── USER'S CARDS FAN (Click to Play, Drag to Throw, Drag to Move/Reorder) ── */}
          <div className="flex items-center justify-center overflow-visible pt-1 pb-1 w-full px-2">
            {dealPhase !== 'ready' ? (
              <div className="flex items-center justify-center -space-x-3 sm:-space-x-4 overflow-visible py-1 w-full px-2">
                {Array.from({ length: getVisibleCardCount(0) }).map((_, idx) => (
                  <div
                    key={idx}
                    className="w-10 h-14 sm:w-12 sm:h-18 rounded-lg border-2 border-amber-400/60 bg-gradient-to-br from-red-800 to-red-950 shadow-xl flex items-center justify-center text-xs text-amber-300 font-black"
                  >
                    ♠
                  </div>
                ))}
              </div>
            ) : (
              <DraggableHand
                cards={userPlayer.hand}
                isUserTurn={isUserTurn}
                size="md"
                isPlayableCard={(card) => userLegalCards.includes(card.id)}
                onCardClick={(card) => {
                  if (isUserTurn && userLegalCards.includes(card.id)) {
                    handleUserPlayCard(card.id);
                  }
                }}
                onPlayCard={(card) => {
                  if (isUserTurn && userLegalCards.includes(card.id)) {
                    handleUserPlayCard(card.id);
                  }
                }}
                onReorderCards={(reordered) => {
                  setGameState((prev) => ({
                    ...prev,
                    players: prev.players.map((p, idx) => (idx === userIndex ? { ...p, hand: reordered } : p)),
                  }));
                }}
              />
            )}
          </div>
        </div>

        {/* ── 4. DEDICATED CENTER-STAGE USER BIDDING MODAL ── */}
        {gameState.phase === 'bidding' && isUserTurn && (
          <div className="absolute inset-0 z-40 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 animate-scale-in">
            <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border-2 border-amber-400 rounded-3xl p-5 max-w-md w-full shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex flex-col items-center gap-4 text-center">
              
              <div className="flex items-center gap-2">
                <Flame className="w-6 h-6 text-amber-400 animate-bounce" />
                <h3 className="text-lg sm:text-xl font-black uppercase text-white tracking-wide">
                  Your Turn to Bid (Call)
                </h3>
              </div>

              <p className="text-xs text-slate-300">
                Predict how many tricks (hands) you will win this round:
              </p>

              {/* AI Suggestion Highlight */}
              <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-400/40 rounded-2xl px-3.5 py-1.5 text-xs font-black text-amber-300">
                <Sparkles className="w-4 h-4 text-yellow-400 animate-spin" />
                <span>AI Recommended: <strong>{userSuggestedBid} Tricks</strong></span>
              </div>

              {/* Standard Bid Buttons */}
              <div className="grid grid-cols-4 gap-2.5 w-full mt-2">
                {standardBids.map((b) => {
                  const isSuggested = b === userSuggestedBid;
                  return (
                    <button
                      key={b}
                      onClick={() => handleUserBid(b)}
                      className={`py-3 rounded-2xl font-black text-base sm:text-lg transition-all duration-200 shadow-lg active:scale-95 flex flex-col items-center justify-center relative ${
                        isSuggested
                          ? 'bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 text-slate-950 ring-2 ring-yellow-300 shadow-[0_0_15px_rgba(251,191,36,0.6)] scale-105'
                          : 'bg-slate-800/90 hover:bg-slate-700 text-white border border-slate-600'
                      }`}
                    >
                      <span>{b}</span>
                      {isSuggested && (
                        <span className="text-[8px] uppercase tracking-tighter text-slate-950 font-black">
                          BEST
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Higher Bids Toggle (9..13) */}
              <div className="w-full">
                <button
                  onClick={() => setShowExtendedBids(!showExtendedBids)}
                  className="text-xs font-bold text-amber-300 hover:text-amber-200 transition-colors underline"
                >
                  {showExtendedBids ? '▲ Hide High Bids' : '▼ High Bids (9 - 13 Tricks)'}
                </button>

                {showExtendedBids && (
                  <div className="grid grid-cols-5 gap-2 mt-3 animate-fade-in">
                    {[9, 10, 11, 12, 13].map((b) => (
                      <button
                        key={b}
                        onClick={() => handleUserBid(b)}
                        className="py-2.5 rounded-xl font-black text-sm bg-rose-950/80 hover:bg-rose-900 border border-rose-600/40 text-rose-200 shadow-md active:scale-95"
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 5. ROUND END / TOURNAMENT END MODAL ── */}
        {(gameState.phase === 'round_end' || gameState.phase === 'game_over') && (
          <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-scale-in">
            <div className="bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-2 border-amber-400 rounded-3xl p-6 max-w-lg w-full shadow-[0_20px_60px_rgba(0,0,0,0.9)] flex flex-col items-center gap-4 text-center">
              
              <Trophy className="w-12 h-12 text-amber-400 animate-bounce" />
              
              <h2 className="text-xl sm:text-2xl font-black uppercase text-white tracking-wide">
                {gameState.phase === 'game_over' ? '🏆 MATCH CHAMPIONSHIP OVER!' : `ROUND ${gameState.currentRound} COMPLETE`}
              </h2>

              <p className="text-xs text-slate-300">
                {gameState.phase === 'game_over'
                  ? 'All 5 rounds completed! Here is the final tournament standings:'
                  : `Round ${gameState.currentRound} summary and scorecard rankings:`}
              </p>

              {/* Leaderboard Table */}
              <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden text-left">
                <div className="grid grid-cols-12 bg-slate-950 p-2.5 text-[10px] font-black uppercase text-slate-400 border-b border-slate-800">
                  <span className="col-span-6">Player</span>
                  <span className="col-span-2 text-center">Bid</span>
                  <span className="col-span-2 text-center">Won</span>
                  <span className="col-span-2 text-right">Total</span>
                </div>

                <div className="divide-y divide-slate-800/60">
                  {[...gameState.players]
                    .sort((a, b) => b.totalScore - a.totalScore)
                    .map((p, idx) => {
                      const isUser = p.config.id === 'p0';
                      return (
                        <div
                          key={p.config.id}
                          className={`grid grid-cols-12 p-2.5 items-center text-xs font-bold ${
                            isUser ? 'bg-amber-500/15 text-white' : 'text-slate-300'
                          }`}
                        >
                          <div className="col-span-6 flex items-center gap-2">
                            <span className="text-sm">
                              {idx === 0 ? '👑' : `${idx + 1}.`}
                            </span>
                            <span>{p.config.avatar}</span>
                            <span className="font-black truncate">{p.config.name}</span>
                          </div>
                          <span className="col-span-2 text-center text-slate-400">{p.bid}</span>
                          <span className="col-span-2 text-center text-emerald-400">{p.tricksWon}</span>
                          <span className="col-span-2 text-right font-mono text-amber-300 font-black">
                            {p.totalScore.toFixed(1)}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 w-full mt-2">
                <button
                  onClick={() => setShowScorecard(true)}
                  className="flex-1 py-3 rounded-2xl font-bold bg-slate-800 hover:bg-slate-700 text-white text-xs uppercase tracking-wider"
                >
                  View Full Scorecard
                </button>

                {gameState.phase === 'game_over' ? (
                  <button
                    onClick={handleRestart}
                    className="flex-1 py-3 rounded-2xl font-black bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs uppercase tracking-wider shadow-lg active:scale-95"
                  >
                    Play New Match ➔
                  </button>
                ) : (
                  <button
                    onClick={handleNextRound}
                    className="flex-1 py-3 rounded-2xl font-black bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs uppercase tracking-wider shadow-lg active:scale-95"
                  >
                    Start Round {gameState.currentRound + 1} ➔
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
