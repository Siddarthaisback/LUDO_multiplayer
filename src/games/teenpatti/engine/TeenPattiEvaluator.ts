import { Card } from '../../../core/cards/Card';
import { TeenPattiRuleConfig, CLASSIC_TEEN_PATTI_RULES } from './TeenPattiRules';

export type TeenPattiHandCategory =
  | 'TRAIL'
  | 'PURE_SEQUENCE'
  | 'SEQUENCE'
  | 'COLOR'
  | 'PAIR'
  | 'HIGH_CARD';

export interface TeenPattiEvaluation {
  category: TeenPattiHandCategory;
  categoryRank: number; // 6=Trail, 5=PureSeq, 4=Seq, 3=Color, 2=Pair, 1=HighCard
  name: string;
  tieBreakers: number[]; // Array of numbers for lexicographical comparison
}

export class TeenPattiEvaluator {
  /**
   * Pure evaluation function for a 3-card Teen Patti hand
   */
  public static evaluateHand(
    cards: Card[],
    rules: TeenPattiRuleConfig = CLASSIC_TEEN_PATTI_RULES
  ): TeenPattiEvaluation {
    if (cards.length !== 3) {
      throw new Error(`Teen Patti hand must have exactly 3 cards, received ${cards.length}`);
    }

    const sorted = [...cards].sort((a, b) => b.rank - a.rank);
    const r1 = sorted[0].rank;
    const r2 = sorted[1].rank;
    const r3 = sorted[2].rank;

    const isFlush = cards[0].suit === cards[1].suit && cards[1].suit === cards[2].suit;
    const isTrio = r1 === r2 && r2 === r3;

    // Check Sequence (A-K-Q, K-Q-J... 4-3-2, or A-2-3). K-A-2 is INVALID.
    let isStraight = false;
    let straightRankScore = 0;

    if (r1 - r2 === 1 && r2 - r3 === 1) {
      // Standard consecutive sequence (e.g. K-Q-J, 5-4-3)
      isStraight = true;
      straightRankScore = r1; // High card of sequence
    } else if (r1 === 14 && r2 === 3 && r3 === 2) {
      // A-2-3 special straight
      isStraight = true;
      if (rules.sequenceRanking === 'A23_HIGH') {
        straightRankScore = 15; // Higher than A-K-Q (14)
      } else {
        straightRankScore = 13.5; // In AKQ_HIGH, A-2-3 is second highest (13.5), directly above K-Q-J (13)
      }
    }

    // 1. TRAIL / TRIO
    if (isTrio) {
      return {
        category: 'TRAIL',
        categoryRank: 6,
        name: `🔥 Trail of ${sorted[0].label}s`,
        tieBreakers: [6, r1],
      };
    }

    // 2. PURE SEQUENCE (Straight Flush)
    if (isFlush && isStraight) {
      return {
        category: 'PURE_SEQUENCE',
        categoryRank: 5,
        name: `👑 Pure Sequence (${sorted.map((c) => c.label).join('-')})`,
        tieBreakers: [5, straightRankScore],
      };
    }

    // 3. SEQUENCE (Straight)
    if (isStraight) {
      return {
        category: 'SEQUENCE',
        categoryRank: 4,
        name: `⚡ Sequence (${sorted.map((c) => c.label).join('-')})`,
        tieBreakers: [4, straightRankScore],
      };
    }

    // 4. COLOR (Flush)
    if (isFlush) {
      return {
        category: 'COLOR',
        categoryRank: 3,
        name: `💎 Color (${sorted[0].label} high)`,
        tieBreakers: [3, r1, r2, r3],
      };
    }

    // 5. PAIR
    const isPair = r1 === r2 || r2 === r3 || r1 === r3;
    if (isPair) {
      let pairRank = r1 === r2 ? r1 : r2 === r3 ? r2 : r1;
      let kickerRank = r1 === r2 ? r3 : r2 === r3 ? r1 : r2;
      return {
        category: 'PAIR',
        categoryRank: 2,
        name: `✨ Pair of ${RANKS.find((r) => r.rank === pairRank)?.label || pairRank}s`,
        tieBreakers: [2, pairRank, kickerRank],
      };
    }

    // 6. HIGH CARD
    return {
      category: 'HIGH_CARD',
      categoryRank: 1,
      name: `High Card ${sorted[0].label}`,
      tieBreakers: [1, r1, r2, r3],
    };
  }

  /**
   * Compares two 3-card hands: returns >0 if Hand A wins, <0 if Hand B wins, 0 if exact tie
   */
  public static compareHands(
    cardsA: Card[],
    cardsB: Card[],
    rules: TeenPattiRuleConfig = CLASSIC_TEEN_PATTI_RULES
  ): number {
    const evalA = TeenPattiEvaluator.evaluateHand(cardsA, rules);
    const evalB = TeenPattiEvaluator.evaluateHand(cardsB, rules);

    const maxLen = Math.max(evalA.tieBreakers.length, evalB.tieBreakers.length);
    for (let i = 0; i < maxLen; i++) {
      const valA = evalA.tieBreakers[i] ?? 0;
      const valB = evalB.tieBreakers[i] ?? 0;
      if (valA !== valB) {
        return valA - valB;
      }
    }
    return 0;
  }
}
const RANKS = [
  { rank: 2, label: '2' },
  { rank: 3, label: '3' },
  { rank: 4, label: '4' },
  { rank: 5, label: '5' },
  { rank: 6, label: '6' },
  { rank: 7, label: '7' },
  { rank: 8, label: '8' },
  { rank: 9, label: '9' },
  { rank: 10, label: '10' },
  { rank: 11, label: 'J' },
  { rank: 12, label: 'Q' },
  { rank: 13, label: 'K' },
  { rank: 14, label: 'A' },
];
