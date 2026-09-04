import React, { useState } from 'react';
import { X, BookOpen, Sparkles, Award, Flame, Shield, HelpCircle } from 'lucide-react';

export type TaasGameId = 'callbreak' | 'dhumbal' | 'jutpatti' | 'teenpatti' | 'poker' | 'ludo' | 'snakes';

interface CardRulesModalProps {
  initialGame?: TaasGameId;
  onClose: () => void;
}

export const CardRulesModal: React.FC<CardRulesModalProps> = ({ initialGame = 'callbreak', onClose }) => {
  const [selectedGame, setSelectedGame] = useState<TaasGameId>(initialGame);

  const gameRules: Record<TaasGameId, { title: string; subtitle: string; icon: string; sections: { heading: string; body: string }[] }> = {
    callbreak: {
      title: 'Call Break (Nepali Canonical)',
      subtitle: '4 Players • 52 Cards • Spades Permanent Trump • 5 Rounds',
      icon: '♠️',
      sections: [
        {
          heading: 'Objective & Deal',
          body: 'Call Break is a strategic trick-taking card game played by 4 players with a standard 52-card deck. All 52 cards are dealt (13 cards per player). A match typically lasts 5 rounds.',
        },
        {
          heading: 'Bidding (Call)',
          body: 'Before playing each round, each player declares a "bid" (between 1 and 13) predicting the minimum number of tricks they will win.',
        },
        {
          heading: 'Strict Nepali Trick Rules',
          body: '1. Follow Suit: You MUST play the lead suit if you have one. If you can beat the current winning card in that suit, strict rules require playing a higher card.\n2. Trump with Spade: If you have no cards of the lead suit, you MUST play a Spade (trump).\n3. Overtrump: If a Spade was already played and you are void in the lead suit, you must play a higher Spade if you have one.\n4. Discard: If you have neither the lead suit nor Spades, you may discard any card.',
        },
        {
          heading: 'Scoring Formula',
          body: '• Bid Success: If you win equal to or more than your bid, score = Bid + (Overtricks × 0.1). Example: Bid 4, won 6 tricks = +4.2 points.\n• Bid Failure: If you win fewer tricks than your bid, score = -Bid. Example: Bid 4, won 3 tricks = -4.0 points.',
        },
      ],
    },
    dhumbal: {
      title: 'Dhumbal / Jhyap (Nepali Hand Reduction)',
      subtitle: '2–5 Players • Hand Reduction • Sets & Pure Runs • Dhumbal ≤ 5 pts',
      icon: '🔥',
      sections: [
        {
          heading: 'Objective & Card Values',
          body: 'Reduce your hand points to 5 or less. Card point values:\n• Ace = 1 point\n• 2 to 10 = Face value (2–10 points)\n• Jack = 10 points\n• Queen = 10 points\n• King = 10 points',
        },
        {
          heading: 'Legal Discards on Turn',
          body: 'On your turn, you may discard:\n1. A Single Card (e.g. King)\n2. A Set of 2, 3, or 4 cards of identical rank (e.g. 7♠ + 7♥)\n3. A Pure Run of 3+ consecutive cards in the SAME SUIT (e.g. 8♥ 9♥ 10♥ J♥). No K-A-2 wrapping.\n\nAfter discarding, draw exactly ONE card from the Stock or from the top of the Discard pile.',
        },
        {
          heading: 'Declaring DHUMBAL & Undercut (Jhyap) Penalty',
          body: '• When your hand sum is 5 or less at the start of your turn, you may declare DHUMBAL!\n• Strict Winner: If you have strictly the lowest total, you score 0 points, and opponents add their hand points to their cumulative scores.\n• Undercut (Jhyap): If any opponent ties or has lower points than you, your call fails! You receive your hand total + 25 penalty points.',
        },
      ],
    },
    jutpatti: {
      title: 'Jut Patti / Jutpatti (Nepali Pair Game)',
      subtitle: '2–4 Players • 9-Card Deal • Dynamic Wild Joker (+1 Rank)',
      icon: '✨',
      sections: [
        {
          heading: 'Objective & Joker Selection',
          body: 'Each player receives 9 cards (odd count). 1 card is flipped from the deck to designate the JOKER RANK: every card exactly ONE rank above the exposed card becomes a Wild Joker!\n• Example: 9 exposed -> 10s are Jokers.\n• Queen exposed -> Kings are Jokers.\n• King exposed -> Aces are Jokers (Wrap).',
        },
        {
          heading: 'Turn Flow & Winning Hand',
          body: '1. At the start of your turn, DRAW 1 card from Stock or Discard pile (hand temporarily becomes 10 cards).\n2. Win Declaration: If your 10 cards can be partitioned into EXACTLY 5 VALID PAIRS (natural pairs or paired with Wild Jokers), declare WIN!\n3. Otherwise: Discard 1 card to pass your turn (hand returns to 9 cards).',
        },
      ],
    },
    teenpatti: {
      title: 'Teen Patti (3-Card Poker)',
      subtitle: '3–6 Players • 3 Hole Cards • Blind vs Seen • Virtual Simulated Chips',
      icon: '👑',
      sections: [
        {
          heading: 'Hand Rankings (Highest to Lowest)',
          body: '1. Trail / Trio: 3 of same rank (AAA highest)\n2. Pure Sequence: 3 consecutive same suit (A-K-Q / A-2-3)\n3. Sequence: 3 consecutive mixed suits\n4. Color (Flush): 3 of same suit\n5. Pair: 2 of same rank + 1 kicker\n6. High Card',
        },
        {
          heading: 'Betting & Stakes',
          body: '• Boot: Ante collected from all players to start pot.\n• Blind: Bet at base stake ($1×).\n• Seen: Players who peek at cards bet at 2× stake ($2×).\n• Chaal / Raise / Pack: Call current bet, increase stakes, or fold.\n• Show: When 2 players remain, call Showdown to reveal hands and award the pot.',
        },
      ],
    },
    poker: {
      title: "Texas Hold'em Poker",
      subtitle: '2–9 Players • 2 Hole Cards • 5 Community Cards • No-Limit Side Pots',
      icon: '🎯',
      sections: [
        {
          heading: 'Gameplay Flow',
          body: '1. Preflop: 2 hole cards dealt per player -> Betting round.\n2. Flop: 3 community cards dealt face up -> Betting round.\n3. Turn: 4th community card dealt -> Betting round.\n4. River: 5th community card dealt -> Final betting round.\n5. Showdown: Best 5-card combination from 7 available cards wins the pot!',
        },
        {
          heading: 'Hand Rankings',
          body: 'Royal Flush > Straight Flush > Four of a Kind > Full House > Flush > Straight > Three of a Kind > Two Pair > One Pair > High Card.',
        },
      ],
    },
    ludo: {
      title: 'Royal Ludo',
      subtitle: '2–4 Players • 4 Pawns • Star Safe Havens • Full Track Journey',
      icon: '🎲',
      sections: [
        {
          heading: 'Objective',
          body: 'Race all 4 of your pawns clockwise around the 52-cell track and up your home runway into the center goal triangle.',
        },
        {
          heading: 'Yard Exit & Rolling a 6',
          body: '• Roll a 6 on the 3D dice to release a pawn from your yard onto your colored Start square.\n• Rolling a 6 grants a bonus roll! Three consecutive 6s forfeit your turn.',
        },
        {
          heading: 'Captures & Safe Stars',
          body: '• Landing on an opponent pawn captures it, sending it flying back to its yard and granting you an immediate bonus roll!\n• Squares marked with golden Stars (and Start squares) are safe sanctuaries where pawns cannot be captured.',
        },
        {
          heading: 'Exact Home Entry',
          body: 'Pawns must enter the home goal with an exact roll (overshooting is not allowed). The first player to bring all 4 pawns home wins!',
        },
      ],
    },
    snakes: {
      title: 'Snakes & Ladders Royale',
      subtitle: '2–4 Players • 100 Squares • Ascending Ladders • Perilous Snakes',
      icon: '🐍',
      sections: [
        {
          heading: 'Objective',
          body: 'Be the first player to navigate your pawn from square 1 to square 100 on the 10x10 board.',
        },
        {
          heading: 'Ladders & Snakes',
          body: '• Landing on a ladder base immediately climbs you up to the ladder top!\n• Landing on a snake head slides you down to its tail.\n• Exact roll required to reach square 100.',
        },
      ],
    },
  };

  const active = gameRules[selectedGame] || gameRules.callbreak;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 animate-fade-in select-none">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Official Rulebook</h2>
              <p className="text-xs text-slate-400">Master the rules of all games</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Game Tab Selector */}
        <div className="flex items-center gap-1.5 p-3 bg-slate-950/80 border-b border-slate-800/80 overflow-x-auto">
          {(
            [
              { id: 'callbreak', label: 'Call Break', icon: '♠️' },
              { id: 'dhumbal', label: 'Dhumbal / Jhyap', icon: '🔥' },
              { id: 'jutpatti', label: 'Jut Patti', icon: '✨' },
              { id: 'teenpatti', label: 'Teen Patti', icon: '👑' },
              { id: 'poker', label: "Texas Hold'em", icon: '🎯' },
              { id: 'ludo', label: 'Royal Ludo', icon: '🎲' },
              { id: 'snakes', label: 'Snakes & Ladders', icon: '🐍' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedGame(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all whitespace-nowrap flex items-center gap-1.5 ${
                selectedGame === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-slate-300">
          <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3">
            <span className="text-3xl">{active.icon}</span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">{active.title}</h3>
              <p className="text-xs text-amber-300 font-semibold">{active.subtitle}</p>
            </div>
          </div>

          <div className="space-y-3">
            {active.sections.map((sec, idx) => (
              <div key={idx} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                <h4 className="text-xs uppercase font-black tracking-wider text-amber-400 mb-1.5">
                  {sec.heading}
                </h4>
                <p className="text-xs sm:text-sm leading-relaxed text-slate-300 whitespace-pre-line">
                  {sec.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl font-bold bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs uppercase tracking-wider"
          >
            Close Rulebook
          </button>
        </div>
      </div>
    </div>
  );
};
