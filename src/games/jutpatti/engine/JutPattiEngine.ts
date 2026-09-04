import { Card, CardId, Rank } from '../../../core/cards/Card';
import { Deck } from '../../../core/cards/Deck';
import { JutPattiRuleConfig, NEPAL_CLASSIC_JUTPATTI_RULES, getJokerRankFromExposedCard } from './JutPattiRules';
import { PlayerConfig } from '../../../types/game';

export interface CardPair {
  card1: Card;
  card2: Card;
  isJokerPair: boolean;
}

export interface JutPattiPlayerState {
  readonly config: PlayerConfig;
  readonly hand: Card[];
  readonly wins: number;
}

export interface JutPattiState {
  readonly rules: JutPattiRuleConfig;
  readonly players: JutPattiPlayerState[];
  readonly exposedJokerCard: Card;
  readonly jokerRank: Rank;
  readonly drawPile: Card[];
  readonly discardPile: Card[];
  readonly turnIndex: number;
  readonly turnPhase: 'draw' | 'discard';
  readonly phase: 'playing' | 'round_end';
  readonly winnerIndex?: number | null;
  readonly winningPairs?: CardPair[];
}

export class JutPattiEngine {
  /**
   * Pure mathematically correct pair partition algorithm
   * Tests if the cards can be completely partitioned into pairs using the given wild Joker rank
   */
  public static canPartitionIntoPairs(
    cards: Card[],
    jokerRank: Rank
  ): { canPair: boolean; pairs: CardPair[]; unpaired: Card[] } {
    if (cards.length % 2 !== 0) {
      return { canPair: false, pairs: [], unpaired: [...cards] };
    }

    const jokers: Card[] = [];
    const nonJokers: Card[] = [];

    cards.forEach((c) => {
      if (c.rank === jokerRank) {
        jokers.push(c);
      } else {
        nonJokers.push(c);
      }
    });

    // Group non-jokers by rank
    const byRank = new Map<number, Card[]>();
    nonJokers.forEach((c) => {
      const g = byRank.get(c.rank) || [];
      g.push(c);
      byRank.set(c.rank, g);
    });

    const pairs: CardPair[] = [];
    const unpairedSingles: Card[] = [];

    byRank.forEach((group) => {
      while (group.length >= 2) {
        const c1 = group.shift()!;
        const c2 = group.shift()!;
        pairs.push({ card1: c1, card2: c2, isJokerPair: false });
      }
      if (group.length === 1) {
        unpairedSingles.push(group[0]);
      }
    });

    const remainingJokers = [...jokers];

    // Match singles with jokers
    while (unpairedSingles.length > 0 && remainingJokers.length > 0) {
      const single = unpairedSingles.shift()!;
      const joker = remainingJokers.shift()!;
      pairs.push({ card1: single, card2: joker, isJokerPair: true });
    }

    // Pair any remaining jokers together in pairs
    while (remainingJokers.length >= 2) {
      const j1 = remainingJokers.shift()!;
      const j2 = remainingJokers.shift()!;
      pairs.push({ card1: j1, card2: j2, isJokerPair: true });
    }

    const allUnpaired = [...unpairedSingles, ...remainingJokers];
    const canPair = allUnpaired.length === 0;

    return {
      canPair,
      pairs: canPair ? pairs : [],
      unpaired: allUnpaired,
    };
  }

  /**
   * Initializes a fresh Jut Patti match
   */
  public static createMatch(
    players: PlayerConfig[],
    rules: JutPattiRuleConfig = NEPAL_CLASSIC_JUTPATTI_RULES,
    seed?: number
  ): JutPattiState {
    const deck = new Deck().shuffle(seed);
    const hands = deck.deal(players.length, rules.startingHandSize);

    // Expose 1 card to determine Joker Rank
    const exposedJokerCard = deck.draw(1)[0];
    const jokerRank = getJokerRankFromExposedCard(exposedJokerCard.rank);

    // Flip 1 card for discard pile
    const initialDiscard = deck.draw(1);
    const drawPile = deck.getCards();

    const initialPlayers: JutPattiPlayerState[] = players.map((p, idx) => ({
      config: p,
      hand: hands[idx],
      wins: 0,
    }));

    return {
      rules,
      players: initialPlayers,
      exposedJokerCard,
      jokerRank,
      drawPile,
      discardPile: initialDiscard,
      turnIndex: 0,
      turnPhase: 'draw',
      phase: 'playing',
    };
  }

  /**
   * Applies Draw action at the start of turn (from stock or discard)
   */
  public static applyDraw(
    state: JutPattiState,
    playerIndex: number,
    source: 'draw_pile' | 'discard_pile'
  ): JutPattiState {
    if (state.phase !== 'playing' || state.turnPhase !== 'draw') {
      throw new Error('Not in draw phase');
    }
    if (state.turnIndex !== playerIndex) {
      throw new Error(`Not player ${playerIndex}'s turn`);
    }

    let drawPile = [...state.drawPile];
    let discardPile = [...state.discardPile];
    let drawnCard: Card;

    if (source === 'discard_pile') {
      if (discardPile.length === 0) throw new Error('Discard pile is empty');
      drawnCard = discardPile.pop()!;
    } else {
      if (drawPile.length === 0) {
        // Reshuffle discard pile except top card
        if (discardPile.length <= 1) throw new Error('No cards remaining in stock');
        const topDiscard = discardPile.pop()!;
        const newDeck = new Deck(discardPile).shuffle();
        drawPile = newDeck.getCards();
        discardPile = [topDiscard];
      }
      drawnCard = drawPile.shift()!;
    }

    const player = state.players[playerIndex];
    const updatedHand = [...player.hand, drawnCard];

    const updatedPlayers = state.players.map((p, idx) =>
      idx === playerIndex ? { ...p, hand: updatedHand } : p
    );

    return {
      ...state,
      players: updatedPlayers,
      drawPile,
      discardPile,
      turnPhase: 'discard',
    };
  }

  /**
   * Applies Discard action (returning hand to odd size and advancing turn)
   */
  public static applyDiscard(state: JutPattiState, playerIndex: number, cardId: CardId): JutPattiState {
    if (state.phase !== 'playing' || state.turnPhase !== 'discard') {
      throw new Error('Not in discard phase');
    }
    if (state.turnIndex !== playerIndex) {
      throw new Error(`Not player ${playerIndex}'s turn`);
    }

    const player = state.players[playerIndex];
    const cardToDiscard = player.hand.find((c) => c.id === cardId);
    if (!cardToDiscard) {
      throw new Error(`Player does not have card ${cardId}`);
    }

    const remainingHand = player.hand.filter((c) => c.id !== cardId);
    const updatedDiscardPile = [...state.discardPile, cardToDiscard];

    const updatedPlayers = state.players.map((p, idx) =>
      idx === playerIndex ? { ...p, hand: remainingHand } : p
    );

    const nextTurn = (playerIndex + 1) % state.players.length;

    return {
      ...state,
      players: updatedPlayers,
      discardPile: updatedDiscardPile,
      turnIndex: nextTurn,
      turnPhase: 'draw',
    };
  }

  /**
   * Declares Win if post-draw hand completely partitions into pairs
   */
  public static declareWin(state: JutPattiState, playerIndex: number): JutPattiState {
    if (state.phase !== 'playing' || state.turnPhase !== 'discard') {
      throw new Error('Must draw a card before declaring win');
    }
    if (state.turnIndex !== playerIndex) {
      throw new Error(`Not player ${playerIndex}'s turn to win`);
    }

    const player = state.players[playerIndex];
    const partition = JutPattiEngine.canPartitionIntoPairs(player.hand, state.jokerRank);

    if (!partition.canPair) {
      throw new Error('Cannot declare win: hand does not form complete pairs');
    }

    const updatedPlayers = state.players.map((p, idx) =>
      idx === playerIndex ? { ...p, wins: p.wins + 1 } : p
    );

    return {
      ...state,
      players: updatedPlayers,
      phase: 'round_end',
      winnerIndex: playerIndex,
      winningPairs: partition.pairs,
    };
  }
}
