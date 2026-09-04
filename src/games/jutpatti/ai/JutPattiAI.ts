import { Card, CardId } from '../../../core/cards/Card';
import { JutPattiEngine, JutPattiState } from '../engine/JutPattiEngine';
import { BotDifficulty } from '../../../types/game';

export class JutPattiAI {
  /**
   * Chooses whether to draw from stock or discard pile
   */
  public static chooseDrawSource(state: JutPattiState, playerIndex: number): 'draw_pile' | 'discard_pile' {
    if (state.discardPile.length === 0) return 'draw_pile';

    const player = state.players[playerIndex];
    const topDiscard = state.discardPile[state.discardPile.length - 1];

    // If top discard is a wild Joker, always pick it up!
    if (topDiscard.rank === state.jokerRank) {
      return 'discard_pile';
    }

    // If top discard matches any single card in hand (making a pair), pick it up!
    const hasMatch = player.hand.some((c) => c.rank === topDiscard.rank);
    if (hasMatch) {
      return 'discard_pile';
    }

    return 'draw_pile';
  }

  /**
   * Decides whether to declare win or which card to discard
   */
  public static chooseDiscardOrWin(
    state: JutPattiState,
    playerIndex: number,
    _difficulty: BotDifficulty = 'medium'
  ): { shouldDeclareWin: boolean; cardToDiscard?: CardId } {
    const player = state.players[playerIndex];
    const hand = player.hand;
    const jokerRank = state.jokerRank;

    // 1. Check if we have complete pairs to win
    const partition = JutPattiEngine.canPartitionIntoPairs(hand, jokerRank);
    if (partition.canPair) {
      return { shouldDeclareWin: true };
    }

    // 2. Select card to discard that least hurts pair potential (never discard a Joker if avoidable)
    const nonJokers = hand.filter((c) => c.rank !== jokerRank);
    if (nonJokers.length === 0) {
      return { shouldDeclareWin: false, cardToDiscard: hand[0].id };
    }

    // Find unpaired singles
    const byRank = new Map<number, Card[]>();
    nonJokers.forEach((c) => {
      const g = byRank.get(c.rank) || [];
      g.push(c);
      byRank.set(c.rank, g);
    });

    const singles: Card[] = [];
    byRank.forEach((group) => {
      if (group.length % 2 === 1) {
        singles.push(group[0]);
      }
    });

    if (singles.length > 0) {
      // Discard a single card
      return { shouldDeclareWin: false, cardToDiscard: singles[0].id };
    }

    return { shouldDeclareWin: false, cardToDiscard: nonJokers[0].id };
  }
}
