import { Card, CardId } from './Card';

export class Hand {
  private cards: Card[];

  constructor(cards: Card[] = []) {
    this.cards = [...cards];
  }

  public get size(): number {
    return this.cards.length;
  }

  public getCards(): Card[] {
    return [...this.cards];
  }

  public hasCard(id: CardId): boolean {
    return this.cards.some((c) => c.id === id);
  }

  public addCard(card: Card): this {
    this.cards.push(card);
    return this;
  }

  public addCards(cards: Card[]): this {
    this.cards.push(...cards);
    return this;
  }

  public removeCard(id: CardId): Card {
    const idx = this.cards.findIndex((c) => c.id === id);
    if (idx === -1) {
      throw new Error(`Card ${id} not found in hand`);
    }
    const [removed] = this.cards.splice(idx, 1);
    return removed;
  }

  public removeCards(ids: CardId[]): Card[] {
    const idSet = new Set(ids);
    const removed: Card[] = [];
    this.cards = this.cards.filter((c) => {
      if (idSet.has(c.id)) {
        removed.push(c);
        return false;
      }
      return true;
    });
    return removed;
  }

  /**
   * Sorts hand by Suit (Spades, Hearts, Clubs, Diamonds) and descending rank (A, K, Q...)
   */
  public sortBySuit(): this {
    const suitOrder: Record<string, number> = { S: 0, H: 1, C: 2, D: 3 };
    this.cards.sort((a, b) => {
      if (a.suit !== b.suit) {
        return suitOrder[a.suit] - suitOrder[b.suit];
      }
      return b.rank - a.rank;
    });
    return this;
  }

  /**
   * Sorts hand by Rank descending (A -> 2)
   */
  public sortByRank(): this {
    this.cards.sort((a, b) => b.rank - a.rank || a.suit.localeCompare(b.suit));
    return this;
  }

  /**
   * Groups cards by rank (useful for pair/trio detection)
   */
  public groupByRank(): Map<number, Card[]> {
    const map = new Map<number, Card[]>();
    for (const card of this.cards) {
      const group = map.get(card.rank) || [];
      group.push(card);
      map.set(card.rank, group);
    }
    return map;
  }

  /**
   * Groups cards by suit (useful for flush/run detection)
   */
  public groupBySuit(): Map<string, Card[]> {
    const map = new Map<string, Card[]>();
    for (const card of this.cards) {
      const group = map.get(card.suit) || [];
      group.push(card);
      map.set(card.suit, group);
    }
    return map;
  }
}
