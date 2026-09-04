import React, { useState } from 'react';
import { X, GraduationCap, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { TaasGameId } from './CardRulesModal';

interface TutorialModalProps {
  initialGame?: TaasGameId;
  onClose: () => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ initialGame = 'ludo', onClose }) => {
  const [selectedGame, setSelectedGame] = useState<TaasGameId>(initialGame);
  const [stepIndex, setStepIndex] = useState(0);

  const tutorials: Record<TaasGameId, { title: string; steps: { stepTitle: string; explanation: string; tip: string }[] }> = {
    ludo: {
      title: 'Royal Ludo Tutorial',
      steps: [
        {
          stepTitle: '1. Rolling a 6 to Launch from Yard',
          explanation: 'Tap the 3D dice. Rolling a 6 unlocks one of your pawns from the yard onto your colored Start cell with a launch beam!',
          tip: 'Tip: Rolling a 6 grants a bonus turn! But rolling three 6s in a row forfeits your turn.',
        },
        {
          stepTitle: '2. 3D Step-by-Step Hopping Physics',
          explanation: 'Pawns hop cell by cell along the track. Hovering or tapping a pawn reveals an illuminated path with target indicators.',
          tip: 'Tip: Hover any movable pawn to preview whether it lands on a safe star, strikes an enemy, or enters home!',
        },
        {
          stepTitle: '3. Combat Captures & Defeated Flight',
          explanation: 'Land on an opponent’s square to capture it! The defeated pawn flies along a Bézier arc spinning back to its yard, granting you a bonus roll.',
          tip: 'Tip: Star tiles and starting tiles are safe sanctuaries where pawns cannot be captured.',
        },
        {
          stepTitle: '4. Finishing at Home Goal',
          explanation: 'Enter your colored finishing runway and reach the center home goal triangle with an exact roll. All 4 pawns home wins!',
          tip: 'Tip: Overshooting is not permitted — calculate exact rolls needed for your final steps.',
        },
      ],
    },
    callbreak: {
      title: 'Call Break Tutorial',
      steps: [
        {
          stepTitle: '1. Hand Inspection & Bidding',
          explanation: 'You are dealt 13 cards. Count your high cards (Aces & Kings) and Spades. Predict how many tricks you expect to win (e.g. 3).',
          tip: 'Tip: Aces are near guaranteed tricks. Extra spades beyond 3 can cut side suits!',
        },
        {
          stepTitle: '2. Following Lead Suit',
          explanation: 'When another player leads a suit (e.g. Hearts), you MUST play a Heart. If you can beat their card, play a higher Heart!',
          tip: 'Tip: Conserve your highest cards for when you actually need to secure your bid.',
        },
        {
          stepTitle: '3. Trumping with Spades (Hukum)',
          explanation: 'When you are void in the lead suit, you MUST play a Spade to trump the trick.',
          tip: 'Tip: Overtrump rule applies — if a Spade was already played, play a higher Spade if you have one!',
        },
        {
          stepTitle: '4. Scoring & Winning the 5 Rounds',
          explanation: 'Reach your bid for positive decimal points (+3.2 for bid 3, won 5). Miss your bid and get -3.0 points! Highest cumulative score wins.',
          tip: 'Tip: Prevent opponents from making their high bids by forcing them to trump early.',
        },
      ],
    },
    dhumbal: {
      title: 'Dhumbal / Jhyap Tutorial',
      steps: [
        {
          stepTitle: '1. The Goal: Lowest Hand Points',
          explanation: 'You hold 5 cards. Your goal is to reduce your point total (A=1, 2-10=Face value, J/Q/K=10) to 5 or less.',
          tip: 'Tip: High cards like Kings, Queens, and Jacks are dangerous — discard them early!',
        },
        {
          stepTitle: '2. Discarding Sets & Runs',
          explanation: 'Discard multiple cards at once if they form a Set (same rank) or a Pure Run (3+ consecutive cards in the same suit).',
          tip: 'Tip: Discarding a set of 3 Queens instantly dumps 30 points in one single turn!',
        },
        {
          stepTitle: '3. Drawing from Stock or Discard Pile',
          explanation: 'After discarding 1 or more cards, draw exactly ONE card from the blind stock or the top open discard.',
          tip: 'Tip: Pick up the discard only if it is low value (1 or 2 pts) or completes a set in your hand.',
        },
        {
          stepTitle: '4. Calling DHUMBAL & Avoiding Undercuts',
          explanation: 'When your total is 5 or less at turn start, declare DHUMBAL! If you have the strictly lowest hand, you get 0 points. If an opponent beats you, you get +25 penalty!',
          tip: 'Tip: If your total is 1-3, calling is very safe. At 4-5, evaluate how many rounds have passed!',
        },
      ],
    },
    jutpatti: {
      title: 'Jut Patti Tutorial',
      steps: [
        {
          stepTitle: '1. 9-Card Deal & +1 Wild Joker Rank',
          explanation: 'Each player receives 9 cards. The cut card revealed sets the Wild Joker rank to the NEXT (+1) rank (e.g. 7 flipped -> 8s are Wild Jokers!).',
          tip: 'Tip: Wild Jokers can pair with ANY card in the entire deck!',
        },
        {
          stepTitle: '2. Draw & Search for 5 Pairs',
          explanation: 'At the start of your turn, draw 1 card (giving you 10 cards). If your 10 cards form 5 complete pairs, declare WIN!',
          tip: 'Tip: Pairs can be natural (e.g. 9-9) or Joker-assisted (e.g. King + Joker).',
        },
        {
          stepTitle: '3. Discarding to Pass',
          explanation: 'If you do not have 5 pairs, discard 1 unwanted card to return your hand to 9 cards and pass turn.',
          tip: 'Tip: Always keep wild jokers and hold cards that are closest to forming pairs.',
        },
      ],
    },
    teenpatti: {
      title: 'Teen Patti Tutorial',
      steps: [
        {
          stepTitle: '1. Blind vs Seen Betting',
          explanation: 'Bet Blind (without looking at your cards) at $1× stake, or look at your 3 cards (Seen) and bet at $2× stake.',
          tip: 'Tip: Blind play applies heavy pressure to seen players because they must bet double your amount!',
        },
        {
          stepTitle: '2. Hand Rankings & Hierarchies',
          explanation: 'Trio / Trail (AAA) > Pure Sequence (Straight Flush) > Sequence (Straight) > Color (Flush) > Pair > High Card.',
          tip: 'Tip: A Pure Sequence like A-K-Q or A-2-3 of the same suit beats any standard Sequence.',
        },
        {
          stepTitle: '3. Side Shows & Showdowns',
          explanation: 'Seen players can request a private Side Show with the previous seen player. When only 2 players remain, call Showdown to reveal hands and award the pot.',
          tip: 'Tip: Use Side Shows strategically to eliminate medium-strength opponents.',
        },
      ],
    },
    poker: {
      title: "Texas Hold'em Poker Tutorial",
      steps: [
        {
          stepTitle: '1. Hole Cards & Preflop',
          explanation: 'Receive 2 secret hole cards. Determine whether to Fold, Call the big blind, or Raise to build the pot.',
          tip: 'Tip: Premium starting hands include pocket Aces, Kings, Queens, and suited connectors like AK.',
        },
        {
          stepTitle: '2. Flop, Turn & River',
          explanation: '5 community cards are dealt across 3 rounds. Combine your 2 hole cards with the 5 shared cards to make the strongest 5-card hand.',
          tip: 'Tip: Bet when you have a strong hand or draw, and check when pot control is needed.',
        },
        {
          stepTitle: '3. Side Pots & Showdown',
          explanation: 'When short-stacked players go all-in, the pot splits into Main and Side pots. Best hand at showdown sweeps the chips!',
          tip: 'Tip: You can only win side pots from players you have covered with your bet.',
        },
      ],
    },
    snakes: {
      title: 'Snakes & Ladders Tutorial',
      steps: [
        {
          stepTitle: '1. Rolling the Dice',
          explanation: 'Roll the 3D dice to advance your pawn across the 100-cell grid.',
          tip: 'Tip: Exact roll is required to reach square 100.',
        },
        {
          stepTitle: '2. Climbing Ladders & Evading Snakes',
          explanation: 'Land on a ladder base to climb high up! Avoid landing on snake heads that slide you down.',
          tip: 'Tip: Look ahead at the next 6 squares to anticipate upcoming ladders and hazards.',
        },
      ],
    },
  };

  const activeTutorial = tutorials[selectedGame] || tutorials.ludo;
  const currentStep = activeTutorial.steps[stepIndex] || activeTutorial.steps[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">{activeTutorial.title}</h2>
              <p className="text-xs text-slate-400">Step-by-step masterclass</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Game Tabs */}
        <div className="flex items-center gap-1.5 p-3 bg-slate-950/80 border-b border-slate-800/80 overflow-x-auto">
          {(
            [
              { id: 'ludo', label: 'Royal Ludo' },
              { id: 'callbreak', label: 'Call Break' },
              { id: 'dhumbal', label: 'Dhumbal' },
              { id: 'jutpatti', label: 'Jut Patti' },
              { id: 'teenpatti', label: 'Teen Patti' },
              { id: 'poker', label: "Texas Hold'em" },
              { id: 'snakes', label: 'Snakes & Ladders' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setSelectedGame(tab.id);
                setStepIndex(0);
              }}
              className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all whitespace-nowrap ${
                selectedGame === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Step Card Content */}
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400">
              Step {stepIndex + 1} of {activeTutorial.steps.length}
            </span>
            <div className="flex items-center gap-1">
              {activeTutorial.steps.map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i === stepIndex ? 'bg-amber-400 w-6' : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-base sm:text-lg font-black text-white">{currentStep.stepTitle}</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {currentStep.explanation}
            </p>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{currentStep.tip}</span>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
              disabled={stepIndex === 0}
              className="px-4 py-2 rounded-xl font-bold bg-slate-800 text-slate-300 disabled:opacity-40 text-xs flex items-center gap-1.5 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Previous
            </button>

            {stepIndex < activeTutorial.steps.length - 1 ? (
              <button
                onClick={() => setStepIndex((prev) => prev + 1)}
                className="px-5 py-2 rounded-xl font-black bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs flex items-center gap-1.5 transition-all"
              >
                Next Step <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs flex items-center gap-1.5 transition-all"
              >
                Ready to Play! ➔
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
