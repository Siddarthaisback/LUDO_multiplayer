import { Card, CardId } from '../../../core/cards/Card';
import { Deck } from '../../../core/cards/Deck';
import { DhumbalRuleConfig, NEPAL_CLASSIC_DHUMBAL_RULES } from './DhumbalRules';
import { PlayerConfig } from '../../../types/game';

export interface DhumbalPlayerState {
  readonly config: PlayerConfig;
  readonly hand: Card[];
  readonly cumulativeScore: number;
  readonly isEliminated: boolean;
  readonly lastRoundScore?: number;
}

export interface DhumbalRoundResult {
  readonly callerIndex: number;
  readonly callerTotal: number;
  readonly isUndercut: boolean;
  readonly lowestPlayerIndex: number;
  readonly lowestTotal: number;
  readonly roundScores: number[];
}

export interface DhumbalState {
  readonly rules: DhumbalRuleConfig;
  readonly players: DhumbalPlayerState[];
  readonly drawPile: Card[];
  readonly discardPile: Card[];
  readonly currentRound: number;
  readonly turnIndex: number;
  readonly phase: 'turn_action' | 'round_end' | 'game_over';
  readonly lastResult?: DhumbalRoundResult;
}

export class DhumbalEngine {
  /**
   * Calculates the point value of a single card under given Dhumbal rules
   */
  public static getCardPointValue(card: Card, rules: DhumbalRuleConfig = NEPAL_CLASSIC_DHUMBAL_RULES): number {
    if (card.rank === 14) return rules.aceValue;
    if (card.rank === 13) return rules.kingValue;
    if (card.rank === 12) return rules.queenValue;
    if (card.rank === 11) return rules.jackValue;
    return card.rank;
  }

  /**
   * Calculates total point sum for a hand
   */
  public static calculateHandPoints(hand: Card[], rules: DhumbalRuleConfig = NEPAL_CLASSIC_DHUMBAL_RULES): number {
    return hand.reduce((sum, c) => sum + DhumbalEngine.getCardPointValue(c, rules), 0);
  }

  /**
   * Validates if a group of cards is a legal Dhumbal discard:
   * 1. Single card (length 1)
   * 2. Set of identical ranks (length 2, 3, or 4)
   * 3. Pure consecutive run in the SAME SUIT (length >= 3, no K-A-2 wrap)
   */
  public static isValidDiscard(cards: Card[]): boolean {
    if (cards.length === 0) return false;
    if (cards.length === 1) return true;

    // Option 2: Set of identical ranks
    const firstRank = cards[0].rank;
    const isSet = cards.every((c) => c.rank === firstRank);
    if (isSet && cards.length >= 2 && cards.length <= 4) {
      return true;
    }

    // Option 3: Pure consecutive run of the same suit (length >= 3)
    if (cards.length >= 3) {
      const firstSuit = cards[0].suit;
      const isSameSuit = cards.every((c) => c.suit === firstSuit);
      if (!isSameSuit) return false;

      // Sort by rank ascending
      const sorted = [...cards].sort((a, b) => a.rank - b.rank);
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i + 1].rank - sorted[i].rank !== 1) {
          return false;
        }
      }
      return true;
    }

    return false;
  }

  /**
   * Initializes a fresh Dhumbal match
   */
  public static createMatch(
    players: PlayerConfig[],
    rules: DhumbalRuleConfig = NEPAL_CLASSIC_DHUMBAL_RULES,
    seed?: number
  ): DhumbalState {
    const deck = new Deck().shuffle(seed);
    const hands = deck.deal(players.length, 5); // 5 cards each in Nepali Dhumbal

    // Flip 1 card to start discard pile
    const initialDiscard = deck.draw(1);
    const drawPile = deck.getCards();

    const initialPlayers: DhumbalPlayerState[] = players.map((p, idx) => ({
      config: p,
      hand: hands[idx],
      cumulativeScore: 0,
      isEliminated: false,
    }));

    return {
      rules,
      players: initialPlayers,
      drawPile,
      discardPile: initialDiscard,
      currentRound: 1,
      turnIndex: 0,
      phase: 'turn_action',
    };
  }

  /**
   * Discards selected card(s) and draws 1 card from either the draw pile or the top of the discard pile
   */
  public static applyDiscardAndDraw(
    state: DhumbalState,
    playerIndex: number,
    discardIds: CardId[],
    drawSource: 'draw_pile' | 'discard_pile'
  ): DhumbalState {
    if (state.phase !== 'turn_action') {
      throw new Error('Game is not in turn action phase');
    }
    if (state.turnIndex !== playerIndex) {
      throw new Error(`Not player ${playerIndex}'s turn`);
    }

    const player = state.players[playerIndex];
    const cardsToDiscard = player.hand.filter((c) => discardIds.includes(c.id));

    if (cardsToDiscard.length !== discardIds.length) {
      throw new Error('Invalid discard selection: cards not in hand');
    }
    if (!DhumbalEngine.isValidDiscard(cardsToDiscard)) {
      throw new Error('Discard selection is not a legal single card, set, or pure same-suit run');
    }

    let drawPile = [...state.drawPile];
    let discardPile = [...state.discardPile];
    let drawnCard: Card;

    if (drawSource === 'discard_pile') {
      if (discardPile.length === 0 || !state.rules.allowDiscardPickup) {
        throw new Error('Cannot draw from empty discard pile');
      }
      drawnCard = discardPile.pop()!;
    } else {
      // Draw from stock pile
      if (drawPile.length === 0) {
        // Reshuffle discard pile except top card
        if (discardPile.length <= 1) {
          throw new Error('No cards remaining to draw');
        }
        const topDiscard = discardPile.pop()!;
        const newDeck = new Deck(discardPile).shuffle();
        drawPile = newDeck.getCards();
        discardPile = [topDiscard];
      }
      drawnCard = drawPile.shift()!;
    }

    // Add discarded cards to top of discard pile
    discardPile.push(...cardsToDiscard);

    // Update player hand
    const remainingHand = player.hand.filter((c) => !discardIds.includes(c.id));
    remainingHand.push(drawnCard);

    const updatedPlayers = state.players.map((p, idx) =>
      idx === playerIndex ? { ...p, hand: remainingHand } : p
    );

    // Advance to next active player
    let nextTurn = (playerIndex + 1) % state.players.length;
    while (updatedPlayers[nextTurn].isEliminated) {
      nextTurn = (nextTurn + 1) % state.players.length;
    }

    return {
      ...state,
      players: updatedPlayers,
      drawPile,
      discardPile,
      turnIndex: nextTurn,
    };
  }

  /**
   * Declares DHUMBAL / JHYAP at the start of player's turn
   */
  public static declareDhumbal(state: DhumbalState, playerIndex: number): DhumbalState {
    if (state.phase !== 'turn_action') {
      throw new Error('Cannot declare Dhumbal outside turn action phase');
    }
    if (state.turnIndex !== playerIndex) {
      throw new Error(`Not player ${playerIndex}'s turn to declare Dhumbal`);
    }

    const caller = state.players[playerIndex];
    const callerTotal = DhumbalEngine.calculateHandPoints(caller.hand, state.rules);

    if (callerTotal > state.rules.callThreshold) {
      throw new Error(
        `Cannot declare Dhumbal: hand total ${callerTotal} exceeds threshold ${state.rules.callThreshold}`
      );
    }

    // Calculate totals for all active players
    const playerTotals = state.players.map((p) =>
      p.isEliminated ? 999 : DhumbalEngine.calculateHandPoints(p.hand, state.rules)
    );

    // Find strictly lowest total across all active opponents
    let lowestTotal = callerTotal;
    let lowestPlayerIndex = playerIndex;
    let isUndercut = false;

    for (let i = 0; i < state.players.length; i++) {
      if (i !== playerIndex && !state.players[i].isEliminated) {
        const total = playerTotals[i];
        if (total <= callerTotal) {
          isUndercut = true;
        }
        if (total < lowestTotal) {
          lowestTotal = total;
          lowestPlayerIndex = i;
        }
      }
    }

    const roundScores = state.players.map((p, idx) => {
      if (p.isEliminated) return 0;
      if (idx === playerIndex) {
        if (isUndercut) {
          // Penalty: caller gets own points + penalty
          return callerTotal + state.rules.failedCallPenalty;
        }
        // Successful call: 0 points
        return 0;
      }
      return playerTotals[idx];
    });

    const updatedPlayers = state.players.map((p, idx) => {
      const rScore = roundScores[idx];
      const newCumulative = p.cumulativeScore + rScore;
      const isEliminated = p.isEliminated || newCumulative >= state.rules.targetScore;
      return {
        ...p,
        cumulativeScore: newCumulative,
        isEliminated,
        lastRoundScore: rScore,
      };
    });

    const activeCount = updatedPlayers.filter((p) => !p.isEliminated).length;
    const isGameOver = activeCount <= 1;

    const result: DhumbalRoundResult = {
      callerIndex: playerIndex,
      callerTotal,
      isUndercut,
      lowestPlayerIndex,
      lowestTotal,
      roundScores,
    };

    return {
      ...state,
      players: updatedPlayers,
      phase: isGameOver ? 'game_over' : 'round_end',
      lastResult: result,
    };
  }

  /**
   * Resets and deals for the next Dhumbal round
   */
  public static nextRound(state: DhumbalState, seed?: number): DhumbalState {
    if (state.phase !== 'round_end') {
      throw new Error('Can only start next round when round has ended');
    }

    const deck = new Deck().shuffle(seed);
    const activePlayers = state.players.filter((p) => !p.isEliminated);
    const hands = deck.deal(activePlayers.length, 5);

    let handIdx = 0;
    const resetPlayers = state.players.map((p) => {
      if (p.isEliminated) return p;
      return {
        ...p,
        hand: hands[handIdx++],
      };
    });

    const initialDiscard = deck.draw(1);
    const drawPile = deck.getCards();

    // Start turn with previous caller or next active player
    let nextTurn = state.lastResult ? (state.lastResult.callerIndex + 1) % state.players.length : 0;
    while (resetPlayers[nextTurn].isEliminated) {
      nextTurn = (nextTurn + 1) % state.players.length;
    }

    return {
      ...state,
      players: resetPlayers,
      drawPile,
      discardPile: initialDiscard,
      currentRound: state.currentRound + 1,
      turnIndex: nextTurn,
      phase: 'turn_action',
      lastResult: undefined,
    };
  }
}
