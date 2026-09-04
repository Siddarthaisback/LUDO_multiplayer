import { describe, it, expect } from 'vitest';
import { createCard, parseCardId } from '../Card';
import { Deck } from '../Deck';
import { Hand } from '../Hand';

describe('Core Card Model & Deck Invariants', () => {
  it('creates valid immutable cards and parses card IDs accurately', () => {
    const aceSpades = createCard(14, 'S');
    expect(aceSpades.id).toBe('AS');
    expect(aceSpades.rank).toBe(14);
    expect(aceSpades.suit).toBe('S');

    const tenDiamonds = parseCardId('10D');
    expect(tenDiamonds.rank).toBe(10);
    expect(tenDiamonds.suit).toBe('D');
    expect(tenDiamonds.id).toBe('10D');

    const kingHearts = parseCardId('KH');
    expect(kingHearts.rank).toBe(13);
    expect(kingHearts.suit).toBe('H');
  });

  it('generates a full standard 52-card deck with no duplicates', () => {
    const deck = new Deck();
    expect(deck.size).toBe(52);

    const cards = deck.getCards();
    const uniqueIds = new Set(cards.map((c) => c.id));
    expect(uniqueIds.size).toBe(52);
    expect(Deck.verifyInvariants([cards], 52)).toBe(true);
  });

  it('performs deterministic seeded shuffle reproducibly', () => {
    const deck1 = new Deck().shuffle(12345);
    const deck2 = new Deck().shuffle(12345);
    const deck3 = new Deck().shuffle(99999);

    const ids1 = deck1.getCards().map((c) => c.id);
    const ids2 = deck2.getCards().map((c) => c.id);
    const ids3 = deck3.getCards().map((c) => c.id);

    expect(ids1).toEqual(ids2);
    expect(ids1).not.toEqual(ids3);
    expect(Deck.verifyInvariants([deck1.getCards()], 52)).toBe(true);
  });

  it('deals cards evenly and strictly enforces card conservation invariant', () => {
    const deck = new Deck().shuffle(42);
    const hands = deck.deal(4, 13); // 4 players, 13 cards each (Call Break)

    expect(hands.length).toBe(4);
    hands.forEach((h) => expect(h.length).toBe(13));
    expect(deck.size).toBe(0);

    expect(Deck.verifyInvariants(hands, 52)).toBe(true);
  });

  it('sorts hands by suit and rank properly', () => {
    const hand = new Hand([
      createCard(10, 'H'),
      createCard(14, 'S'),
      createCard(2, 'S'),
      createCard(13, 'H'),
      createCard(5, 'D'),
    ]);

    hand.sortBySuit();
    const sortedIds = hand.getCards().map((c) => c.id);
    expect(sortedIds).toEqual(['AS', '2S', 'KH', '10H', '5D']);
  });
});
