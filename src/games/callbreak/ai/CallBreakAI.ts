import { Card, CardId } from '../../../core/cards/Card';
import { CallBreakEngine, CallBreakState } from '../engine/CallBreakEngine';
import { BotDifficulty } from '../../../types/game';

export class CallBreakAI {
  /**
   * Evaluates hand to select an optimal bid (1..13)
   */
  public static calculateBid(hand: Card[], difficulty: BotDifficulty = 'medium', minBid: number = 1): number {
    let estimatedWins = 0;

    const spades = hand.filter((c) => c.suit === 'S');
    const hearts = hand.filter((c) => c.suit === 'H');
    const diamonds = hand.filter((c) => c.suit === 'D');
    const clubs = hand.filter((c) => c.suit === 'C');

    // High Spades are near-guaranteed tricks
    spades.forEach((c) => {
      if (c.rank === 14) estimatedWins += 1.0; // Ace of Spades
      else if (c.rank === 13) estimatedWins += 0.8; // King of Spades
      else if (c.rank === 12) estimatedWins += 0.6; // Queen of Spades
      else if (c.rank >= 10) estimatedWins += 0.3;
    });

    // Trump length bonus (extra spades beyond 3)
    if (spades.length > 3) {
      estimatedWins += (spades.length - 3) * 0.4;
    }

    // Side suit Aces and Kings with protection
    [hearts, diamonds, clubs].forEach((suitCards) => {
      const hasAce = suitCards.some((c) => c.rank === 14);
      const hasKing = suitCards.some((c) => c.rank === 13);
      const hasQueen = suitCards.some((c) => c.rank === 12);

      if (hasAce) estimatedWins += 0.9;
      if (hasKing && suitCards.length >= 2) estimatedWins += 0.6;
      if (hasQueen && suitCards.length >= 3) estimatedWins += 0.3;

      // Void or singleton side suit with spades gives ruff potential
      if (suitCards.length <= 1 && spades.length >= 3) {
        estimatedWins += 0.4;
      }
    });

    let bid = Math.round(estimatedWins);

    // Apply difficulty adjustments
    if (difficulty === 'easy') {
      // Easy bots may occasionally underbid or overbid slightly
      bid = Math.max(1, bid + (Math.random() < 0.3 ? (Math.random() < 0.5 ? -1 : 1) : 0));
    }

    return Math.max(minBid, Math.min(8, bid));
  }

  /**
   * Selects the best legal card to play for the current trick
   */
  public static selectCardToPlay(
    state: CallBreakState,
    playerIndex: number,
    difficulty: BotDifficulty = 'medium'
  ): CardId {
    const player = state.players[playerIndex];
    const legalCards = CallBreakEngine.getLegalCards(player.hand, state.currentTrick, state.rules);

    if (legalCards.length === 0) {
      throw new Error(`No legal cards available for player ${playerIndex}`);
    }
    if (legalCards.length === 1) {
      return legalCards[0].id;
    }

    if (difficulty === 'easy') {
      // Pick random legal card
      const randomCard = legalCards[Math.floor(Math.random() * legalCards.length)];
      return randomCard.id;
    }

    const currentTrick = state.currentTrick;
    const needTricks = player.tricksWon < player.bid;

    // 1. LEADING A TRICK
    if (currentTrick.length === 0) {
      // If we still need tricks, lead an Ace if we have one
      if (needTricks) {
        const nonSpadeAces = legalCards.filter((c) => c.rank === 14 && c.suit !== 'S');
        if (nonSpadeAces.length > 0) return nonSpadeAces[0].id;

        const spadeAce = legalCards.find((c) => c.rank === 14 && c.suit === 'S');
        if (spadeAce && player.hand.filter((c) => c.suit === 'S').length <= 3) return spadeAce.id;
      }

      // Otherwise lead lowest card of longest side suit
      const nonSpades = legalCards.filter((c) => c.suit !== 'S');
      if (nonSpades.length > 0) {
        // Sort ascending to dump low card
        nonSpades.sort((a, b) => a.rank - b.rank);
        return nonSpades[0].id;
      }

      // Only spades left: play lowest spade
      legalCards.sort((a, b) => a.rank - b.rank);
      return legalCards[0].id;
    }

    // 2. FOLLOWING A TRICK
    const winningCard = CallBreakEngine.determineCurrentWinnerCard(currentTrick);

    // Can we win the trick?
    const winningOptions = legalCards.filter((c) => {
      if (c.suit === 'S' && winningCard.suit !== 'S') return true;
      if (c.suit === winningCard.suit && c.rank > winningCard.rank) return true;
      return false;
    });

    if (winningOptions.length > 0 && needTricks) {
      // Play the lowest winning card to conserve high cards
      winningOptions.sort((a, b) => a.rank - b.rank);
      return winningOptions[0].id;
    }

    // Cannot win or already met bid: discard lowest legal card
    legalCards.sort((a, b) => a.rank - b.rank);
    return legalCards[0].id;
  }
}
