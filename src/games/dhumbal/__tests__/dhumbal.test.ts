import { describe, it, expect } from 'vitest';
import { DhumbalEngine } from '../engine/DhumbalEngine';
import { NEPAL_CLASSIC_DHUMBAL_RULES } from '../engine/DhumbalRules';
import { parseCardId } from '../../../core/cards/Card';
import { DEFAULT_PLAYERS } from '../../../utils/constants';

describe('Dhumbal / Jhyap Nepali Game Engine', () => {
  it('calculates card and hand point values accurately according to Nepali rules', () => {
    expect(DhumbalEngine.getCardPointValue(parseCardId('AS'))).toBe(1);
    expect(DhumbalEngine.getCardPointValue(parseCardId('5D'))).toBe(5);
    expect(DhumbalEngine.getCardPointValue(parseCardId('10C'))).toBe(10);
    expect(DhumbalEngine.getCardPointValue(parseCardId('JH'))).toBe(11);
    expect(DhumbalEngine.getCardPointValue(parseCardId('QS'))).toBe(12);
    expect(DhumbalEngine.getCardPointValue(parseCardId('KD'))).toBe(13);

    const hand = [
      parseCardId('AS'), // 1
      parseCardId('2H'), // 2
      parseCardId('JH'), // 11
      parseCardId('KD'), // 13
    ];
    expect(DhumbalEngine.calculateHandPoints(hand)).toBe(1 + 2 + 11 + 13); // 27
  });

  it('validates single cards, sets, and pure same-suit runs correctly', () => {
    // Single card
    expect(DhumbalEngine.isValidDiscard([parseCardId('7H')])).toBe(true);

    // Set of same rank (pair, trio, four of a kind)
    expect(DhumbalEngine.isValidDiscard([parseCardId('7H'), parseCardId('7S')])).toBe(true);
    expect(
      DhumbalEngine.isValidDiscard([parseCardId('QD'), parseCardId('QC'), parseCardId('QH')])
    ).toBe(true);

    // Pure run of same suit (3+ cards)
    expect(
      DhumbalEngine.isValidDiscard([parseCardId('3H'), parseCardId('4H'), parseCardId('5H')])
    ).toBe(true);
    expect(
      DhumbalEngine.isValidDiscard([
        parseCardId('8S'),
        parseCardId('9S'),
        parseCardId('10S'),
        parseCardId('JS'),
      ])
    ).toBe(true);

    // INVALID discards:
    // Mixed suit run
    expect(
      DhumbalEngine.isValidDiscard([parseCardId('3H'), parseCardId('4S'), parseCardId('5H')])
    ).toBe(false);

    // Non-consecutive
    expect(
      DhumbalEngine.isValidDiscard([parseCardId('3H'), parseCardId('4H'), parseCardId('6H')])
    ).toBe(false);

    // Two cards of different ranks
    expect(DhumbalEngine.isValidDiscard([parseCardId('7H'), parseCardId('8H')])).toBe(false);
  });

  it('handles successful Dhumbal declarations with 0 points for caller', () => {
    const match = DhumbalEngine.createMatch(DEFAULT_PLAYERS, NEPAL_CLASSIC_DHUMBAL_RULES, 100);

    // Force Player 0 to have low points (AS, 2H -> 3 points <= 5 threshold)
    const customMatch = {
      ...match,
      players: [
        { ...match.players[0], hand: [parseCardId('AS'), parseCardId('2H')] }, // 3 pts
        { ...match.players[1], hand: [parseCardId('10H'), parseCardId('KD')] }, // 23 pts
        { ...match.players[2], hand: [parseCardId('JH'), parseCardId('QD')] }, // 23 pts
        { ...match.players[3], hand: [parseCardId('9S'), parseCardId('8D')] }, // 17 pts
      ],
    };

    const resolved = DhumbalEngine.declareDhumbal(customMatch, 0);
    expect(resolved.lastResult?.isUndercut).toBe(false);
    expect(resolved.players[0].lastRoundScore).toBe(0);
    expect(resolved.players[1].lastRoundScore).toBe(23);
    expect(resolved.players[2].lastRoundScore).toBe(23);
    expect(resolved.players[3].lastRoundScore).toBe(17);
  });

  it('handles Undercut (Jhyap) penalty when opponent ties or beats caller', () => {
    const match = DhumbalEngine.createMatch(DEFAULT_PLAYERS, NEPAL_CLASSIC_DHUMBAL_RULES, 100);

    // Player 0 calls with 4 pts, but Player 1 has 2 pts (Undercut!)
    const undercutMatch = {
      ...match,
      players: [
        { ...match.players[0], hand: [parseCardId('2S'), parseCardId('2H')] }, // 4 pts
        { ...match.players[1], hand: [parseCardId('AS'), parseCardId('AH')] }, // 2 pts (Undercut!)
        { ...match.players[2], hand: [parseCardId('JH'), parseCardId('QD')] }, // 23 pts
        { ...match.players[3], hand: [parseCardId('9S'), parseCardId('8D')] }, // 17 pts
      ],
    };

    const resolved = DhumbalEngine.declareDhumbal(undercutMatch, 0);
    expect(resolved.lastResult?.isUndercut).toBe(true);
    // Caller penalty = hand total (4) + 25 penalty = 29 pts
    expect(resolved.players[0].lastRoundScore).toBe(29);
  });
});
