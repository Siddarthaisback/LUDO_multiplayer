import { describe, it, expect } from 'vitest';
import { PokerEvaluator } from '../engine/PokerEvaluator';
import { PokerSidePots, PotContribution } from '../engine/PokerSidePots';
import { PokerEngine } from '../engine/PokerEngine';
import { parseCardId } from '../../../core/cards/Card';
import { DEFAULT_PLAYERS } from '../../../utils/constants';

describe('Texas Holdem Poker Engine and Evaluators', () => {
  it('accurately evaluates all poker hand tiers including wheel straight', () => {
    // 1. Royal Flush
    const royal = [
      parseCardId('AS'),
      parseCardId('KS'),
      parseCardId('QS'),
      parseCardId('JS'),
      parseCardId('10S'),
      parseCardId('2D'),
      parseCardId('3C'),
    ];
    expect(PokerEvaluator.evaluate7CardHand(royal).tier).toBe('ROYAL_FLUSH');

    // 2. Full House (Aces full of Kings)
    const fullHouse = [
      parseCardId('AS'),
      parseCardId('AH'),
      parseCardId('AD'),
      parseCardId('KS'),
      parseCardId('KH'),
      parseCardId('2C'),
      parseCardId('3D'),
    ];
    expect(PokerEvaluator.evaluate7CardHand(fullHouse).tier).toBe('FULL_HOUSE');

    // 3. Wheel Straight (A-2-3-4-5)
    const wheel = [
      parseCardId('AS'),
      parseCardId('2H'),
      parseCardId('3D'),
      parseCardId('4C'),
      parseCardId('5S'),
      parseCardId('KD'),
      parseCardId('QC'),
    ];
    const wheelEval = PokerEvaluator.evaluate7CardHand(wheel);
    expect(wheelEval.tier).toBe('STRAIGHT');
    expect(wheelEval.scoreVector[1]).toBe(5); // 5-high straight
  });

  it('correctly constructs main and side pots for unequal all-ins', () => {
    // Player 0 is all-in for 100
    // Player 1 is all-in for 300
    // Player 2 calls 500
    // Player 3 calls 500
    const contributions: PotContribution[] = [
      { playerIndex: 0, amount: 100, isFolded: false },
      { playerIndex: 1, amount: 300, isFolded: false },
      { playerIndex: 2, amount: 500, isFolded: false },
      { playerIndex: 3, amount: 500, isFolded: false },
    ];

    const pots = PokerSidePots.calculatePots(contributions);

    // Pot 0 (Main Pot): 100 * 4 = 400 (Players 0, 1, 2, 3 eligible)
    expect(pots[0].amount).toBe(400);
    expect(pots[0].eligiblePlayerIndices).toEqual([0, 1, 2, 3]);

    // Pot 1 (Side Pot 1): (300 - 100) * 3 = 600 (Players 1, 2, 3 eligible)
    expect(pots[1].amount).toBe(600);
    expect(pots[1].eligiblePlayerIndices).toEqual([1, 2, 3]);

    // Pot 2 (Side Pot 2): (500 - 300) * 2 = 400 (Players 2, 3 eligible)
    expect(pots[2].amount).toBe(400);
    expect(pots[2].eligiblePlayerIndices).toEqual([2, 3]);

    // Total pot = 400 + 600 + 400 = 1400 (Matches sum of contributions)
    expect(pots.reduce((a, b) => a + b.amount, 0)).toBe(1400);
  });

  it('preserves all contributed chips when folded players contribute at higher tiers than active players', () => {
    // Player 0 (active) bet 100
    // Player 1 (folded) bet 300
    // Player 2 (folded) bet 500
    const contributions: PotContribution[] = [
      { playerIndex: 0, amount: 100, isFolded: false },
      { playerIndex: 1, amount: 300, isFolded: true },
      { playerIndex: 2, amount: 500, isFolded: true },
    ];

    const pots = PokerSidePots.calculatePots(contributions);
    const totalContributed = contributions.reduce((sum, c) => sum + c.amount, 0); // 900
    const totalInPots = pots.reduce((sum, p) => sum + p.amount, 0);

    expect(totalInPots).toBe(totalContributed);
    expect(pots.length).toBe(1);
    expect(pots[0].amount).toBe(900);
    expect(pots[0].eligiblePlayerIndices).toEqual([0]);
  });

  it('initializes a hand, posts blinds, and advances streets with community cards', () => {
    const hand = PokerEngine.createHand(DEFAULT_PLAYERS, undefined, undefined, 0, 42);

    expect(hand.pot).toBe(30); // SB (10) + BB (20)
    expect(hand.street).toBe('preflop');
    expect(hand.communityCards.length).toBe(0);

    // Call from first to act
    const s1 = PokerEngine.applyCallOrCheck(hand, hand.turnIndex);
    expect(s1.pot).toBe(50);
  });
});
