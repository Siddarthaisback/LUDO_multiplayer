import { Card, CardId } from '../../../core/cards/Card';
import { DhumbalEngine, DhumbalState } from '../engine/DhumbalEngine';
import { BotDifficulty } from '../../../types/game';

export interface DhumbalDecision {
  shouldCallDhumbal: boolean;
  cardsToDiscard: CardId[];
  drawSource: 'draw_pile' | 'discard_pile';
}

export class DhumbalAI {
  /**
   * Evaluates best action for the current turn in Dhumbal
   */
  public static makeDecision(
    state: DhumbalState,
    playerIndex: number,
    difficulty: BotDifficulty = 'medium'
  ): DhumbalDecision {
    const player = state.players[playerIndex];
    const hand = player.hand;
    const rules = state.rules;
    const handTotal = DhumbalEngine.calculateHandPoints(hand, rules);

    // 1. Check if eligible to call Dhumbal (<= threshold)
    if (handTotal <= rules.callThreshold) {
      if (difficulty === 'easy') {
        // Easy bot calls whenever eligible
        return { shouldCallDhumbal: true, cardsToDiscard: [], drawSource: 'draw_pile' };
      }

      // Hard/Medium bot evaluates risk: if total is 1-3, call 100%; if 4-5, call with 80% confidence
      if (handTotal <= 3 || Math.random() < 0.8) {
        return { shouldCallDhumbal: true, cardsToDiscard: [], drawSource: 'draw_pile' };
      }
    }

    // 2. Identify all possible valid discard combinations (single, sets, runs)
    const validDiscards: Card[][] = [];

    // All single cards
    hand.forEach((c) => validDiscards.push([c]));

    // Check sets (2, 3, 4 cards of same rank)
    const byRank = new Map<number, Card[]>();
    hand.forEach((c) => {
      const g = byRank.get(c.rank) || [];
      g.push(c);
      byRank.set(c.rank, g);
    });

    byRank.forEach((cards) => {
      if (cards.length >= 2) {
        validDiscards.push(cards);
      }
      if (cards.length >= 3) {
        // Also add pairs within the trio
        validDiscards.push([cards[0], cards[1]]);
        validDiscards.push([cards[1], cards[2]]);
        validDiscards.push([cards[0], cards[2]]);
      }
    });

    // Check pure same-suit runs (3+ consecutive cards)
    const bySuit = new Map<string, Card[]>();
    hand.forEach((c) => {
      const g = bySuit.get(c.suit) || [];
      g.push(c);
      bySuit.set(c.suit, g);
    });

    bySuit.forEach((cards) => {
      if (cards.length >= 3) {
        const sorted = [...cards].sort((a, b) => a.rank - b.rank);
        for (let i = 0; i <= sorted.length - 3; i++) {
          for (let len = 3; len <= sorted.length - i; len++) {
            const sub = sorted.slice(i, i + len);
            if (DhumbalEngine.isValidDiscard(sub)) {
              validDiscards.push(sub);
            }
          }
        }
      }
    });

    // Pick discard that sheds the MAXIMUM point value
    let bestDiscard = validDiscards[0];
    let maxPointsShed = -1;

    validDiscards.forEach((comb) => {
      const points = DhumbalEngine.calculateHandPoints(comb, rules);
      if (points > maxPointsShed) {
        maxPointsShed = points;
        bestDiscard = comb;
      }
    });

    // 3. Decide draw source (stock vs top discard)
    let drawSource: 'draw_pile' | 'discard_pile' = 'draw_pile';
    if (state.discardPile.length > 0 && rules.allowDiscardPickup) {
      const topDiscard = state.discardPile[state.discardPile.length - 1];
      const discardVal = DhumbalEngine.getCardPointValue(topDiscard, rules);

      // Pick up discard if it's very low value (e.g. Ace=1, 2) or forms a set/run with remaining hand
      if (discardVal <= 2) {
        drawSource = 'discard_pile';
      }
    }

    return {
      shouldCallDhumbal: false,
      cardsToDiscard: bestDiscard.map((c) => c.id),
      drawSource,
    };
  }
}
