import { describe, it, expect } from 'vitest';
import { JutPattiEngine } from '../engine/JutPattiEngine';
import { getJokerRankFromExposedCard, NEPAL_CLASSIC_JUTPATTI_RULES } from '../engine/JutPattiRules';
import { parseCardId } from '../../../core/cards/Card';

describe('Jut Patti Nepali Game Engine', () => {
  it('correctly calculates wild Joker rank from exposed card including King to Ace wrap', () => {
    expect(getJokerRankFromExposedCard(9)).toBe(10); // 9 exposed -> 10s are Jokers
    expect(getJokerRankFromExposedCard(10)).toBe(11); // 10 exposed -> Jacks are Jokers
    expect(getJokerRankFromExposedCard(12)).toBe(13); // Queen exposed -> Kings are Jokers
    expect(getJokerRankFromExposedCard(13)).toBe(14); // King exposed -> Aces are Jokers (Wrap!)
    expect(getJokerRankFromExposedCard(14)).toBe(2);  // Ace exposed -> 2s are Jokers
  });

  it('evaluates completely paired 10-card winning hands without Jokers', () => {
    // 5 natural pairs (7s, 9s, Js, Ks, 4s)
    const hand = [
      parseCardId('7H'),
      parseCardId('7S'),
      parseCardId('9D'),
      parseCardId('9C'),
      parseCardId('JH'),
      parseCardId('JS'),
      parseCardId('KD'),
      parseCardId('KC'),
      parseCardId('4H'),
      parseCardId('4S'),
    ];

    const result = JutPattiEngine.canPartitionIntoPairs(hand, 10); // Joker rank 10
    expect(result.canPair).toBe(true);
    expect(result.pairs.length).toBe(5);
  });

  it('evaluates paired hands with wild Jokers correctly', () => {
    // Joker is 10. Hand has:
    // Pair of 7s (7H + 7S)
    // Pair of 9s (9D + 9C)
    // Single JH paired with Joker 10S
    // Single KD paired with Joker 10C
    // Pair of 4s (4H + 4S)
    const hand = [
      parseCardId('7H'),
      parseCardId('7S'),
      parseCardId('9D'),
      parseCardId('9C'),
      parseCardId('JH'),
      parseCardId('10S'), // Joker 1
      parseCardId('KD'),
      parseCardId('10C'), // Joker 2
      parseCardId('4H'),
      parseCardId('4S'),
    ];

    const result = JutPattiEngine.canPartitionIntoPairs(hand, 10);
    expect(result.canPair).toBe(true);
    expect(result.pairs.length).toBe(5);
  });

  it('rejects hands with unpaired cards', () => {
    // Hand has unmatched 2H and 3S with no Jokers
    const hand = [
      parseCardId('7H'),
      parseCardId('7S'),
      parseCardId('9D'),
      parseCardId('9C'),
      parseCardId('JH'),
      parseCardId('JS'),
      parseCardId('KD'),
      parseCardId('KC'),
      parseCardId('2H'), // Unmatched single 1
      parseCardId('3S'), // Unmatched single 2
    ];

    const result = JutPattiEngine.canPartitionIntoPairs(hand, 10);
    expect(result.canPair).toBe(false);
    expect(result.unpaired.length).toBe(2);
  });
});
