import React, { useState, useEffect } from 'react';
import { PlayerConfig, AnimationSpeed, GameLogEntry } from '../../types/game';
import { CardPlayerState, CardGameMode, PlayingCardData } from '../../types/cardGame';
import { CardDeckEngine } from './CardDeckEngine';
import { PlayingCard } from './PlayingCard';
import { PokerChip, ChipDenomination } from './PokerChip';
import { SettingsBar } from '../../components/UI/SettingsBar';
import { GameLog } from '../../components/UI/GameLog';
import { soundEffects } from '../../engine/soundEffects';
import { fireCelebrationBurst, fireConfetti } from '../../engine/confetti';
import { Sparkles, Trophy, Hand, ShieldAlert, ArrowRight, DollarSign, HelpCircle } from 'lucide-react';

interface CardGameTableProps {
  initialPlayers: PlayerConfig[];
  onHome: () => void;
}

export const CardGameTable: React.FC<CardGameTableProps> = ({ initialPlayers, onHome }) => {
  const [gameMode, setGameMode] = useState<CardGameMode>('blackjack');
  const [deck, setDeck] = useState<PlayingCardData[]>([]);
  const [dealerHand, setDealerHand] = useState<PlayingCardData[]>([]);
  const [players, setPlayers] = useState<CardPlayerState[]>(() =>
    initialPlayers.map((p) => ({
      config: p,
      hand: [],
      chips: 1000,
      currentBet: 0,
      status: 'playing',
    }))
  );

  const [activePlayerIndex, setActivePlayerIndex] = useState(0);
  const [pot, setPot] = useState(0);
  const [roundPhase, setRoundPhase] = useState<'betting' | 'playing' | 'dealer_turn' | 'round_over'>('betting');
  const [speed, setSpeed] = useState<AnimationSpeed>('normal');
  const [logs, setLogs] = useState<GameLogEntry[]>([]);
  const [selectedBetChip, setSelectedBetChip] = useState<ChipDenomination>(25);

  const activePlayer = players[activePlayerIndex];
  const isUserTurn = activePlayer?.config.type === 'human' && roundPhase === 'playing';

  const addLog = (text: string, type: GameLogEntry['type'] = 'info') => {
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        text,
        type,
      },
    ]);
  };

  // Start new round / deal initial cards
  const startNewRound = () => {
    const freshDeck = CardDeckEngine.shuffleDeck(CardDeckEngine.createDeck(false));
    let deckIdx = 0;

    // Reset bets & hands
    setPot(0);
    const updatedPlayers = players.map((p) => {
      const initialBet = 25;
      const canBet = p.chips >= initialBet;
      const betAmount = canBet ? initialBet : 0;

      // Deal 2 cards per player
      const c1 = { ...freshDeck[deckIdx++], isFaceUp: true };
      const c2 = { ...freshDeck[deckIdx++], isFaceUp: true };

      return {
        ...p,
        chips: p.chips - betAmount,
        currentBet: betAmount,
        hand: [c1, c2],
        status: 'playing' as const,
      };
    });

    const totalInitialBet = updatedPlayers.reduce((acc, p) => acc + p.currentBet, 0);
    setPot(totalInitialBet);

    // Deal 2 cards to Dealer (1 face up, 1 face down)
    const dealerC1 = { ...freshDeck[deckIdx++], isFaceUp: true };
    const dealerC2 = { ...freshDeck[deckIdx++], isFaceUp: false };
    setDealerHand([dealerC1, dealerC2]);

    setDeck(freshDeck.slice(deckIdx));
    setPlayers(updatedPlayers);
    setActivePlayerIndex(0);
    setRoundPhase('playing');

    soundEffects.playCardDeal();
    addLog(`🃏 New round dealt! Total Pot: $${totalInitialBet}`, 'info');
  };

  useEffect(() => {
    startNewRound();
  }, [gameMode]);

  // Handle Player Action: HIT
  const handleHit = () => {
    if (roundPhase !== 'playing' || deck.length === 0) return;

    soundEffects.playCardDeal();
    const nextCard = { ...deck[0], isFaceUp: true };
    const remainingDeck = deck.slice(1);
    setDeck(remainingDeck);

    setPlayers((prev) =>
      prev.map((p, idx) => {
        if (idx === activePlayerIndex) {
          const newHand = [...p.hand, nextCard];
          const { score, isBusted } = CardDeckEngine.calculateBlackjackScore(newHand);
          const newStatus = isBusted ? 'busted' : 'playing';

          if (isBusted) {
            addLog(`💥 ${p.config.name} Busted with ${score}!`, 'info');
          } else {
            addLog(`👉 ${p.config.name} Hit and received ${nextCard.label}${nextCard.suit} (Score: ${score})`, 'move');
          }

          return {
            ...p,
            hand: newHand,
            status: newStatus,
          };
        }
        return p;
      })
    );

    // Auto-advance if busted or score is 21
    setTimeout(() => {
      const currentPlayer = players[activePlayerIndex];
      const newHand = [...currentPlayer.hand, nextCard];
      const { score, isBusted } = CardDeckEngine.calculateBlackjackScore(newHand);

      if (isBusted || score >= 21) {
        advanceTurn();
      }
    }, 400);
  };

  // Handle Player Action: STAND
  const handleStand = () => {
    if (roundPhase !== 'playing') return;

    const currentPlayer = players[activePlayerIndex];
    const { score } = CardDeckEngine.calculateBlackjackScore(currentPlayer.hand);
    addLog(`✋ ${currentPlayer.config.name} Stands with ${score}.`, 'info');

    setPlayers((prev) =>
      prev.map((p, idx) => (idx === activePlayerIndex ? { ...p, status: 'stand' } : p))
    );

    advanceTurn();
  };

  // Handle Player Action: DOUBLE DOWN
  const handleDoubleDown = () => {
    const currentPlayer = players[activePlayerIndex];
    if (roundPhase !== 'playing' || currentPlayer.chips < currentPlayer.currentBet || deck.length === 0) return;

    soundEffects.playChipClink();
    soundEffects.playCardDeal();

    const additionalBet = currentPlayer.currentBet;
    const nextCard = { ...deck[0], isFaceUp: true };
    const remainingDeck = deck.slice(1);
    setDeck(remainingDeck);
    setPot((prev) => prev + additionalBet);

    setPlayers((prev) =>
      prev.map((p, idx) => {
        if (idx === activePlayerIndex) {
          const newHand = [...p.hand, nextCard];
          const { score, isBusted } = CardDeckEngine.calculateBlackjackScore(newHand);
          return {
            ...p,
            chips: p.chips - additionalBet,
            currentBet: p.currentBet * 2,
            hand: newHand,
            status: isBusted ? 'busted' : 'stand',
          };
        }
        return p;
      })
    );

    addLog(`⚡ ${currentPlayer.config.name} Doubled Down!`, 'info');
    setTimeout(() => advanceTurn(), 400);
  };

  // Advance turn to next player or trigger Dealer round
  const advanceTurn = () => {
    if (activePlayerIndex < players.length - 1) {
      setActivePlayerIndex((prev) => prev + 1);
    } else {
      // Trigger Dealer AI
      triggerDealerTurn();
    }
  };

  // Dealer AI Turn
  const triggerDealerTurn = () => {
    setRoundPhase('dealer_turn');

    // Reveal hidden card
    const revealedDealerHand = dealerHand.map((c) => ({ ...c, isFaceUp: true }));
    setDealerHand(revealedDealerHand);
    soundEffects.playCardDeal();

    let currentDealerHand = [...revealedDealerHand];
    let currentDeck = [...deck];

    const dealerStep = () => {
      const { score, isBusted } = CardDeckEngine.calculateBlackjackScore(currentDealerHand);

      if (score < 17 && !isBusted && currentDeck.length > 0) {
        soundEffects.playCardDeal();
        const nextCard = { ...currentDeck[0], isFaceUp: true };
        currentDeck = currentDeck.slice(1);
        currentDealerHand = [...currentDealerHand, nextCard];
        setDealerHand([...currentDealerHand]);
        setDeck([...currentDeck]);

        setTimeout(dealerStep, 600);
      } else {
        // Resolve Showdown & Payouts
        resolveShowdown(currentDealerHand);
      }
    };

    setTimeout(dealerStep, 700);
  };

  // Showdown Resolution
  const resolveShowdown = (finalDealerHand: PlayingCardData[]) => {
    const { score: dealerScore, isBusted: dealerBusted } =
      CardDeckEngine.calculateBlackjackScore(finalDealerHand);

    let payoutLog: string[] = [];

    setPlayers((prev) =>
      prev.map((p) => {
        const { score: playerScore, isBusted: playerBusted, isBlackjack } =
          CardDeckEngine.calculateBlackjackScore(p.hand);

        if (playerBusted) {
          payoutLog.push(`❌ ${p.config.name} lost (Busted)`);
          return { ...p, status: 'lost' };
        }

        if (dealerBusted || playerScore > dealerScore) {
          const winMultiplier = isBlackjack ? 2.5 : 2.0;
          const winnings = Math.floor(p.currentBet * winMultiplier);
          payoutLog.push(`🎉 ${p.config.name} WON $${winnings}!`);
          return { ...p, chips: p.chips + winnings, status: 'won' };
        } else if (playerScore === dealerScore) {
          payoutLog.push(`🤝 ${p.config.name} Pushed (Tie)`);
          return { ...p, chips: p.chips + p.currentBet, status: 'stand' };
        } else {
          payoutLog.push(`❌ ${p.config.name} lost to Dealer's ${dealerScore}`);
          return { ...p, status: 'lost' };
        }
      })
    );

    soundEffects.playWinChips();
    fireCelebrationBurst();
    payoutLog.forEach((msg) => addLog(msg, 'win'));
    setRoundPhase('round_over');
  };

  // Add chips to bet
  const handleAddBet = (chip: ChipDenomination) => {
    if (roundPhase !== 'betting') return;
    const p1 = players[0];
    if (p1.chips < chip) return;

    soundEffects.playChipClink();
    setPlayers((prev) =>
      prev.map((p, idx) =>
        idx === 0 ? { ...p, chips: p.chips - chip, currentBet: p.currentBet + chip } : p
      )
    );
    setPot((prev) => prev + chip);
  };

  const dealerScoreData = CardDeckEngine.calculateBlackjackScore(
    roundPhase === 'playing' ? dealerHand.slice(0, 1) : dealerHand
  );

  return (
    <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full p-2 sm:p-4 gap-4 animate-fade-in select-none">
      {/* Top Settings Bar */}
      <SettingsBar
        speed={speed}
        onSpeedChange={setSpeed}
        onRestart={startNewRound}
        onHome={onHome}
        onOpenRules={() => {}}
      />

      {/* Main VIP Casino Felt Table */}
      <div className="relative w-full rounded-3xl overflow-hidden shadow-2xl border-4 border-amber-600/80 bg-slate-950 min-h-[480px] sm:min-h-[540px] flex flex-col justify-between p-4 sm:p-6">
        {/* Ambient Felt Backdrop */}
        <img
          src="/assets/cards/card_table_felt.jpg"
          alt="VIP Casino Felt Table"
          className="absolute inset-0 w-full h-full object-cover object-center filter brightness-90 contrast-105 pointer-events-none"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-transparent to-slate-950/80 pointer-events-none" />

        {/* 1. Top Section: Dealer Station */}
        <div className="relative z-10 flex flex-col items-center gap-2">
          <div className="bg-slate-900/80 border border-amber-500/40 rounded-2xl px-4 py-1.5 backdrop-blur-md flex items-center gap-2 shadow-lg">
            <span className="text-xs font-black uppercase tracking-wider text-amber-300">
              🎩 Dealer Station
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200">
              {roundPhase === 'playing' ? `Showing ${dealerScoreData.score}` : `Score: ${dealerScoreData.score}`}
            </span>
          </div>

          {/* Dealer's Cards */}
          <div className="flex items-center gap-2 -space-x-4 hover:space-x-1 transition-all">
            {dealerHand.map((card, idx) => (
              <PlayingCard key={card.id || idx} card={card} size="md" />
            ))}
          </div>
        </div>

        {/* 2. Middle Section: Pot & Chip Deck */}
        <div className="relative z-10 flex flex-col items-center justify-center my-auto gap-2">
          <div className="bg-slate-950/80 border-2 border-amber-400/60 rounded-3xl px-6 py-2 shadow-2xl backdrop-blur-md flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-amber-400 animate-pulse" />
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-300/80">
                CURRENT POT
              </span>
              <span className="text-2xl sm:text-3xl font-black text-white font-mono leading-none">
                ${pot}
              </span>
            </div>
            <PokerChip value={100} size={36} />
          </div>

          {roundPhase === 'round_over' && (
            <button
              onClick={startNewRound}
              className="px-6 py-2.5 rounded-2xl font-black bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-xl shadow-amber-500/20 active:scale-95 transition-all text-xs uppercase tracking-wider"
            >
              Deal Next Round ➔
            </button>
          )}
        </div>

        {/* 3. Bottom Section: Player Station & Controls */}
        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950/85 border border-slate-700/80 rounded-3xl p-4 backdrop-blur-md shadow-2xl">
          {/* User Hand & Status */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 mb-1">
                <span>{players[0]?.config.avatar}</span>
                <span className="text-white font-black">{players[0]?.config.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ${players[0]?.chips}
                </span>
              </div>
              <div className="text-[11px] font-semibold text-amber-300">
                Score: {CardDeckEngine.calculateBlackjackScore(players[0]?.hand || []).score}
              </div>
            </div>

            {/* Hand Cards */}
            <div className="flex items-center -space-x-5 hover:space-x-1 transition-all">
              {players[0]?.hand.map((card, idx) => (
                <PlayingCard key={card.id || idx} card={card} size="md" isSelectable />
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {roundPhase === 'playing' && isUserTurn ? (
              <>
                <button
                  onClick={handleHit}
                  className="px-5 py-2.5 rounded-xl font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center gap-1.5"
                >
                  Hit (+Card)
                </button>
                <button
                  onClick={handleStand}
                  className="px-5 py-2.5 rounded-xl font-black bg-amber-600 hover:bg-amber-500 text-white shadow-lg active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center gap-1.5"
                >
                  Stand
                </button>
                {players[0]?.chips >= players[0]?.currentBet && players[0]?.hand.length === 2 && (
                  <button
                    onClick={handleDoubleDown}
                    className="px-4 py-2.5 rounded-xl font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg active:scale-95 transition-all text-xs uppercase tracking-wider"
                  >
                    Double
                  </button>
                )}
              </>
            ) : roundPhase === 'betting' ? (
              <div className="flex items-center gap-1.5">
                {([5, 25, 100, 500] as ChipDenomination[]).map((val) => (
                  <PokerChip
                    key={val}
                    value={val}
                    size={38}
                    onClick={() => handleAddBet(val)}
                  />
                ))}
              </div>
            ) : (
              <span className="text-xs font-bold text-slate-400">
                {roundPhase === 'dealer_turn' ? 'Dealer is playing...' : 'Round Concluded'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Live Action Game Feed */}
      <GameLog logs={logs} />
    </div>
  );
};
