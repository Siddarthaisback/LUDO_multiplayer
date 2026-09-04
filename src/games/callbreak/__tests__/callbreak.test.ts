import { describe, it, expect } from 'vitest';
import { CallBreakEngine, TrickCard } from '../engine/CallBreakEngine';
import { NEPAL_CLASSIC_CALLBREAK_RULES } from '../engine/CallBreakRules';
import { parseCardId } from '../../../core/cards/Card';
import { DEFAULT_PLAYERS } from '../../../utils/constants';

describe('Call Break Canonical Nepali Engine', () => {
  it('correctly calculates round scores with decimal overtricks and negative penalties', () => {
    // Bid 3, Won 5 -> 3 + (2 * 0.1) = 3.2
    expect(CallBreakEngine.calculateRoundScore(3, 5)).toBe(3.2);

    // Bid 4, Won 4 -> 4.0
    expect(CallBreakEngine.calculateRoundScore(4, 4)).toBe(4.0);

    // Bid 4, Won 3 -> -4
    expect(CallBreakEngine.calculateRoundScore(4, 3)).toBe(-4);

    // Bid 2, Won 7 -> 2.5
    expect(CallBreakEngine.calculateRoundScore(2, 7)).toBe(2.5);
  });

  it('determines trick winners correctly with lead suit and spades trump', () => {
    // Trick 1: Hearts lead, highest Heart wins
    const trick1: TrickCard[] = [
      { playerIndex: 0, card: parseCardId('10H') },
      { playerIndex: 1, card: parseCardId('KH') },
      { playerIndex: 2, card: parseCardId('4H') },
      { playerIndex: 3, card: parseCardId('JH') },
    ];
    expect(CallBreakEngine.determineTrickWinner(trick1)).toBe(1); // KH (Player 1)

    // Trick 2: Hearts lead, player 2 cuts with 2 of Spades (trump)
    const trick2: TrickCard[] = [
      { playerIndex: 0, card: parseCardId('AH') },
      { playerIndex: 1, card: parseCardId('KH') },
      { playerIndex: 2, card: parseCardId('2S') }, // Trump!
      { playerIndex: 3, card: parseCardId('QH') },
    ];
    expect(CallBreakEngine.determineTrickWinner(trick2)).toBe(2); // 2S (Player 2)

    // Trick 3: Overtrump - Player 2 plays 4S, Player 3 plays JS
    const trick3: TrickCard[] = [
      { playerIndex: 0, card: parseCardId('AH') },
      { playerIndex: 1, card: parseCardId('9H') },
      { playerIndex: 2, card: parseCardId('4S') },
      { playerIndex: 3, card: parseCardId('JS') }, // Higher trump!
    ];
    expect(CallBreakEngine.determineTrickWinner(trick3)).toBe(3); // JS (Player 3)
  });

  it('enforces strict Nepali follow-suit and force-higher rules', () => {
    const hand = [
      parseCardId('4H'),
      parseCardId('JH'),
      parseCardId('AH'),
      parseCardId('5S'),
      parseCardId('10D'),
    ];

    // Current trick: Player 0 played 10H
    const trick1: TrickCard[] = [{ playerIndex: 0, card: parseCardId('10H') }];

    // Player has Hearts, higher than 10H (JH, AH). Force-higher rule requires playing JH or AH!
    const legal1 = CallBreakEngine.getLegalCards(hand, trick1, NEPAL_CLASSIC_CALLBREAK_RULES);
    const legal1Ids = legal1.map((c) => c.id);
    expect(legal1Ids).toEqual(['JH', 'AH']);

    // Current trick: Player 0 played KH
    const trick2: TrickCard[] = [{ playerIndex: 0, card: parseCardId('KH') }];
    // Player has Hearts, higher than KH is AH
    const legal2 = CallBreakEngine.getLegalCards(hand, trick2, NEPAL_CLASSIC_CALLBREAK_RULES);
    expect(legal2.map((c) => c.id)).toEqual(['AH']);
  });

  it('enforces force-trump when void in lead suit', () => {
    const handNoClubs = [
      parseCardId('4H'),
      parseCardId('JH'),
      parseCardId('3S'),
      parseCardId('10S'),
      parseCardId('10D'),
    ];

    // Lead is Club (Player 0 played 10C)
    const trick: TrickCard[] = [{ playerIndex: 0, card: parseCardId('10C') }];

    // Player has no clubs, but has Spades (3S, 10S). Must trump with Spade!
    const legal = CallBreakEngine.getLegalCards(handNoClubs, trick, NEPAL_CLASSIC_CALLBREAK_RULES);
    expect(legal.map((c) => c.id)).toEqual(['3S', '10S']);
  });

  it('initializes a match, accepts bids, and advances through tricks deterministically', () => {
    const match = CallBreakEngine.createMatch(DEFAULT_PLAYERS, NEPAL_CLASSIC_CALLBREAK_RULES, 42);
    expect(match.players.length).toBe(4);
    expect(match.phase).toBe('bidding');
    expect(match.players[0].hand.length).toBe(13);

    // Apply 4 bids
    let s = CallBreakEngine.applyBid(match, 1, 3);
    s = CallBreakEngine.applyBid(s, 2, 2);
    s = CallBreakEngine.applyBid(s, 3, 4);
    s = CallBreakEngine.applyBid(s, 0, 3);

    expect(s.phase).toBe('playing');
    expect(s.turnIndex).toBe(s.leaderIndex);

    // Leader plays first legal card
    const leader = s.players[s.turnIndex];
    const legalCards = CallBreakEngine.getLegalCards(leader.hand, s.currentTrick, s.rules);
    expect(legalCards.length).toBe(13);

    const firstPlay = legalCards[0].id;
    s = CallBreakEngine.applyPlayCard(s, s.turnIndex, firstPlay);
    expect(s.currentTrick.length).toBe(1);
  });
});
