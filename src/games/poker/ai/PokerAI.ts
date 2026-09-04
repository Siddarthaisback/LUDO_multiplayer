import { PokerState } from '../engine/PokerEngine';
import { PokerEvaluator } from '../engine/PokerEvaluator';
import { BotDifficulty } from '../../../types/game';

export interface PokerBotDecision {
  action: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in';
  amount?: number;
}

export class PokerAI {
  /**
   * Evaluates strategic betting decision for Texas Hold'em bot
   */
  public static makeDecision(
    state: PokerState,
    playerIndex: number,
    _difficulty: BotDifficulty = 'medium'
  ): PokerBotDecision {
    const player = state.players[playerIndex];
    const callAmount = state.currentHighBet - player.currentStreetBet;
    const canCheck = callAmount === 0;

    // PREFLOP ACTION
    if (state.street === 'preflop') {
      const [c1, c2] = player.hand;
      const isPair = c1.rank === c2.rank;
      const isSuited = c1.suit === c2.suit;
      const maxRank = Math.max(c1.rank, c2.rank);
      const minRank = Math.min(c1.rank, c2.rank);

      // Premium Hands (Pocket Aces/Kings/Queens/Jacks, AK suited)
      if (isPair && maxRank >= 11) {
        return { action: 'raise', amount: state.currentHighBet + state.minRaise * 2 };
      }
      if (maxRank === 14 && minRank >= 12) {
        return { action: 'raise', amount: state.currentHighBet + state.minRaise };
      }

      // Playable Hands (Medium pairs, suited connectors, broadways)
      if (isPair || (isSuited && maxRank >= 10) || (maxRank >= 12 && minRank >= 10)) {
        return canCheck ? { action: 'check' } : { action: 'call' };
      }

      // Weak hands
      if (canCheck) return { action: 'check' };
      if (callAmount <= state.rules.bigBlind) return { action: 'call' };
      return { action: 'fold' };
    }

    // POSTFLOP / TURN / RIVER ACTION
    const availableCards = [...player.hand, ...state.communityCards];
    const evaluation = PokerEvaluator.evaluate7CardHand(availableCards);
    const tier = evaluation.tierScore; // 10=Royal Flush down to 1=High Card

    // Very Strong Hands (Two Pair, Three of a Kind, Straight, Flush, Full House+)
    if (tier >= 3) {
      if (canCheck) {
        return { action: 'bet', amount: Math.max(state.rules.bigBlind, state.minRaise) };
      } else {
        return Math.random() < 0.5
          ? { action: 'raise', amount: state.currentHighBet + state.minRaise }
          : { action: 'call' };
      }
    }

    // Medium Hands (One Pair)
    if (tier === 2) {
      if (canCheck) return { action: 'check' };
      if (callAmount <= state.pot * 0.4) return { action: 'call' };
      return { action: 'fold' };
    }

    // Weak Hands (High Card)
    if (canCheck) return { action: 'check' };
    return { action: 'fold' };
  }
}
