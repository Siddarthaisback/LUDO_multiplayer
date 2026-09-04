import { Card } from '../../../core/cards/Card';

export type PokerHandTier =
  | 'ROYAL_FLUSH'
  | 'STRAIGHT_FLUSH'
  | 'FOUR_OF_A_KIND'
  | 'FULL_HOUSE'
  | 'FLUSH'
  | 'STRAIGHT'
  | 'THREE_OF_A_KIND'
  | 'TWO_PAIR'
  | 'ONE_PAIR'
  | 'HIGH_CARD';

export interface PokerEvaluation {
  tier: PokerHandTier;
  tierScore: number; // 10=Royal Flush down to 1=High Card
  name: string;
  bestFiveCards: Card[];
  scoreVector: number[]; // Array of numbers for exact tie-breaking
}

export class PokerEvaluator {
  /**
   * Evaluates the best 5-card poker hand from 7 available cards (2 hole + 5 community)
   */
  public static evaluate7CardHand(cards: Card[]): PokerEvaluation {
    if (cards.length < 5) {
      throw new Error(`Need at least 5 cards to evaluate poker hand, received ${cards.length}`);
    }

    const combinations = PokerEvaluator.getCombinations(cards, 5);
    let bestEval = PokerEvaluator.evaluate5CardHand(combinations[0]);

    for (let i = 1; i < combinations.length; i++) {
      const currentEval = PokerEvaluator.evaluate5CardHand(combinations[i]);
      if (PokerEvaluator.compareScoreVectors(currentEval.scoreVector, bestEval.scoreVector) > 0) {
        bestEval = currentEval;
      }
    }

    return bestEval;
  }

  /**
   * Pure evaluation of an exact 5-card poker hand
   */
  public static evaluate5CardHand(cards: Card[]): PokerEvaluation {
    const sorted = [...cards].sort((a, b) => b.rank - a.rank);
    const ranks = sorted.map((c) => c.rank);
    const suits = sorted.map((c) => c.suit);

    const isFlush = suits.every((s) => s === suits[0]);

    // Check Straight (including A-2-3-4-5 wheel)
    const { isStraight, straightHighRank } = PokerEvaluator.checkStraight(ranks);

    // Rank counts
    const rankCounts = new Map<number, number>();
    ranks.forEach((r) => rankCounts.set(r, (rankCounts.get(r) || 0) + 1));

    const countPairs = Array.from(rankCounts.entries()).sort(
      (a, b) => b[1] - a[1] || b[0] - a[0]
    );

    // 1. Royal Flush & Straight Flush
    if (isFlush && isStraight) {
      if (straightHighRank === 14) {
        return {
          tier: 'ROYAL_FLUSH',
          tierScore: 10,
          name: '👑 Royal Flush',
          bestFiveCards: sorted,
          scoreVector: [10],
        };
      }
      return {
        tier: 'STRAIGHT_FLUSH',
        tierScore: 9,
        name: `⚡ Straight Flush (${straightHighRank} High)`,
        bestFiveCards: sorted,
        scoreVector: [9, straightHighRank],
      };
    }

    // 2. Four of a Kind
    if (countPairs[0][1] === 4) {
      const quadRank = countPairs[0][0];
      const kicker = countPairs[1][0];
      return {
        tier: 'FOUR_OF_A_KIND',
        tierScore: 8,
        name: `🔥 Four of a Kind (${quadRank}s)`,
        bestFiveCards: sorted,
        scoreVector: [8, quadRank, kicker],
      };
    }

    // 3. Full House
    if (countPairs[0][1] === 3 && countPairs[1][1] === 2) {
      const tripRank = countPairs[0][0];
      const pairRank = countPairs[1][0];
      return {
        tier: 'FULL_HOUSE',
        tierScore: 7,
        name: `🏠 Full House (${tripRank}s full of ${pairRank}s)`,
        bestFiveCards: sorted,
        scoreVector: [7, tripRank, pairRank],
      };
    }

    // 4. Flush
    if (isFlush) {
      return {
        tier: 'FLUSH',
        tierScore: 6,
        name: `💎 Flush (${ranks[0]} High)`,
        bestFiveCards: sorted,
        scoreVector: [6, ...ranks],
      };
    }

    // 5. Straight
    if (isStraight) {
      return {
        tier: 'STRAIGHT',
        tierScore: 5,
        name: `🎯 Straight (${straightHighRank} High)`,
        bestFiveCards: sorted,
        scoreVector: [5, straightHighRank],
      };
    }

    // 6. Three of a Kind
    if (countPairs[0][1] === 3) {
      const tripRank = countPairs[0][0];
      const kickers = [countPairs[1][0], countPairs[2][0]].sort((a, b) => b - a);
      return {
        tier: 'THREE_OF_A_KIND',
        tierScore: 4,
        name: `✨ Three of a Kind (${tripRank}s)`,
        bestFiveCards: sorted,
        scoreVector: [4, tripRank, ...kickers],
      };
    }

    // 7. Two Pair
    if (countPairs[0][1] === 2 && countPairs[1][1] === 2) {
      const highPair = Math.max(countPairs[0][0], countPairs[1][0]);
      const lowPair = Math.min(countPairs[0][0], countPairs[1][0]);
      const kicker = countPairs[2][0];
      return {
        tier: 'TWO_PAIR',
        tierScore: 3,
        name: `✌️ Two Pair (${highPair}s and ${lowPair}s)`,
        bestFiveCards: sorted,
        scoreVector: [3, highPair, lowPair, kicker],
      };
    }

    // 8. One Pair
    if (countPairs[0][1] === 2) {
      const pairRank = countPairs[0][0];
      const kickers = countPairs.slice(1).map((c) => c[0]).sort((a, b) => b - a);
      return {
        tier: 'ONE_PAIR',
        tierScore: 2,
        name: `Pair of ${pairRank}s`,
        bestFiveCards: sorted,
        scoreVector: [2, pairRank, ...kickers],
      };
    }

    // 9. High Card
    return {
      tier: 'HIGH_CARD',
      tierScore: 1,
      name: `High Card ${ranks[0]}`,
      bestFiveCards: sorted,
      scoreVector: [1, ...ranks],
    };
  }

  private static checkStraight(ranks: number[]): { isStraight: boolean; straightHighRank: number } {
    // Distinct sorted ranks
    const unique = Array.from(new Set(ranks)).sort((a, b) => b - a);
    if (unique.length < 5) return { isStraight: false, straightHighRank: 0 };

    for (let i = 0; i <= unique.length - 5; i++) {
      if (
        unique[i] - unique[i + 1] === 1 &&
        unique[i + 1] - unique[i + 2] === 1 &&
        unique[i + 2] - unique[i + 3] === 1 &&
        unique[i + 3] - unique[i + 4] === 1
      ) {
        return { isStraight: true, straightHighRank: unique[i] };
      }
    }

    // Special Wheel Straight: A-2-3-4-5
    if (
      unique.includes(14) &&
      unique.includes(5) &&
      unique.includes(4) &&
      unique.includes(3) &&
      unique.includes(2)
    ) {
      return { isStraight: true, straightHighRank: 5 }; // In 5-high wheel straight, 5 is the high card
    }

    return { isStraight: false, straightHighRank: 0 };
  }

  private static getCombinations<T>(array: T[], k: number): T[][] {
    if (k === 0) return [[]];
    if (array.length === 0) return [];
    const head = array[0];
    const tail = array.slice(1);
    const withHead = PokerEvaluator.getCombinations(tail, k - 1).map((c) => [head, ...c]);
    const withoutHead = PokerEvaluator.getCombinations(tail, k);
    return [...withHead, ...withoutHead];
  }

  public static compareScoreVectors(vecA: number[], vecB: number[]): number {
    const len = Math.max(vecA.length, vecB.length);
    for (let i = 0; i < len; i++) {
      const a = vecA[i] ?? 0;
      const b = vecB[i] ?? 0;
      if (a !== b) return a - b;
    }
    return 0;
  }
}
