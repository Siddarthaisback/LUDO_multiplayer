import { Card, SUITS, RANKS, createCard, CardId } from './Card';

export class Deck {
  private cards: Card[];

  constructor(cards?: Card[]) {
    this.cards = cards ? [...cards] : Deck.generate52();
  }

  /**
   * Generates a standard, sorted 52-card deck
   */
  public static generate52(): Card[] {
    const deck: Card[] = [];
    for (const suit of SUITS) {
      for (const { rank } of RANKS) {
        deck.push(createCard(rank, suit));
      }
    }
    return deck;
  }

  /**
   * Returns current count of cards remaining in deck
   */
  public get size(): number {
    return this.cards.length;
  }

  /**
   * Returns copy of cards
   */
  public getCards(): Card[] {
    return [...this.cards];
  }

  /**
   * Fisher-Yates shuffle with optional deterministic pseudo-random seed generator
   */
  public shuffle(seed?: number): this {
    const arr = [...this.cards];
    let rng = Math.random;

    if (seed !== undefined) {
      // Linear Congruential Generator for reproducible test seeds
      let s = seed % 2147483647;
      if (s <= 0) s += 2147483646;
      rng = () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
      };
    }

    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    this.cards = arr;
    return this;
  }

  /**
   * Deals `count` cards from the top of the deck
   */
  public draw(count: number = 1): Card[] {
    if (count > this.cards.length) {
      throw new Error(`Cannot draw ${count} cards from deck of size ${this.cards.length}`);
    }
    return this.cards.splice(0, count);
  }

  /**
   * Deals evenly across N players (e.g. 13 cards each for 4 players in Call Break)
   */
  public deal(numPlayers: number, cardsPerPlayer: number): Card[][] {
    const totalRequired = numPlayers * cardsPerPlayer;
    if (totalRequired > this.cards.length) {
      throw new Error(`Cannot deal ${totalRequired} cards from deck of size ${this.cards.length}`);
    }

    const hands: Card[][] = Array.from({ length: numPlayers }, () => []);
    for (let round = 0; round < cardsPerPlayer; round++) {
      for (let p = 0; p < numPlayers; p++) {
        hands[p].push(this.cards.shift()!);
      }
    }
    return hands;
  }

  /**
   * Verifies the fundamental card conservation invariant:
   * 1. No card is duplicated
   * 2. Exactly 52 unique valid cards exist across all game zones combined
   */
  public static verifyInvariants(allZones: Card[][], expectedTotal: number = 52): boolean {
    const seenIds = new Set<CardId>();
    let totalCards = 0;

    for (const zone of allZones) {
      for (const card of zone) {
        if (!card || !card.id) return false;
        if (seenIds.has(card.id)) {
          console.error(`INVARIANT VIOLATION: Duplicate card detected: ${card.id}`);
          return false;
        }
        seenIds.add(card.id);
        totalCards++;
      }
    }

    if (totalCards !== expectedTotal) {
      console.error(`INVARIANT VIOLATION: Total cards ${totalCards} != expected ${expectedTotal}`);
      return false;
    }

    return true;
  }
}
