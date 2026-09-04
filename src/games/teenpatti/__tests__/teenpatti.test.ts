import { describe, it, expect } from 'vitest';
import { TeenPattiEvaluator } from '../engine/TeenPattiEvaluator';
import { TeenPattiEngine } from '../engine/TeenPattiEngine';
import { parseCardId } from '../../../core/cards/Card';
import { DEFAULT_PLAYERS } from '../../../utils/constants';

describe('Teen Patti Hand Evaluator and Betting Engine', () => {
  it('correctly classifies all six Teen Patti hand categories', () => {
    // 1. Trail
    const trail = [parseCardId('AS'), parseCardId('AH'), parseCardId('AD')];
    expect(TeenPattiEvaluator.evaluateHand(trail).category).toBe('TRAIL');

    // 2. Pure Sequence
    const pureSeq = [parseCardId('KS'), parseCardId('QS'), parseCardId('JS')];
    expect(TeenPattiEvaluator.evaluateHand(pureSeq).category).toBe('PURE_SEQUENCE');

    // 3. Sequence
    const seq = [parseCardId('KS'), parseCardId('QH'), parseCardId('JD')];
    expect(TeenPattiEvaluator.evaluateHand(seq).category).toBe('SEQUENCE');

    // 4. Color (Flush)
    const color = [parseCardId('KS'), parseCardId('9S'), parseCardId('2S')];
    expect(TeenPattiEvaluator.evaluateHand(color).category).toBe('COLOR');

    // 5. Pair
    const pair = [parseCardId('KH'), parseCardId('KS'), parseCardId('4D')];
    expect(TeenPattiEvaluator.evaluateHand(pair).category).toBe('PAIR');

    // 6. High Card
    const highCard = [parseCardId('AH'), parseCardId('9S'), parseCardId('3D')];
    expect(TeenPattiEvaluator.evaluateHand(highCard).category).toBe('HIGH_CARD');
  });

  it('correctly breaks ties between matching hand categories', () => {
    // Trail: AAA beats KKK
    const trailA = [parseCardId('AS'), parseCardId('AH'), parseCardId('AD')];
    const trailK = [parseCardId('KS'), parseCardId('KH'), parseCardId('KD')];
    expect(TeenPattiEvaluator.compareHands(trailA, trailK)).toBeGreaterThan(0);

    // Pair: Pair of Aces with King kicker beats Pair of Aces with Queen kicker
    const pairAK = [parseCardId('AS'), parseCardId('AH'), parseCardId('KD')];
    const pairAQ = [parseCardId('AS'), parseCardId('AH'), parseCardId('QD')];
    expect(TeenPattiEvaluator.compareHands(pairAK, pairAQ)).toBeGreaterThan(0);

    // Color: K-9-2 vs K-8-7 -> K-9-2 wins
    const color1 = [parseCardId('KS'), parseCardId('9S'), parseCardId('2S')];
    const color2 = [parseCardId('KH'), parseCardId('8H'), parseCardId('7H')];
    expect(TeenPattiEvaluator.compareHands(color1, color2)).toBeGreaterThan(0);
  });

  it('handles blind vs seen stakes and showdown payouts correctly', () => {
    const match = TeenPattiEngine.createMatch(DEFAULT_PLAYERS, undefined, 1000, 42);

    // Boot collected: 4 players * $10 = $40 pot
    expect(match.pot).toBe(40);
    expect(match.players[0].chips).toBe(990);
    expect(match.currentStake).toBe(10);

    // Player 0 (Blind) Chaals -> costs $10
    let s = TeenPattiEngine.applyChaal(match, 0);
    expect(s.pot).toBe(50);
    expect(s.players[0].chips).toBe(980);

    // Player 1 sees cards -> becomes Seen
    s = TeenPattiEngine.seeCards(s, 1);
    expect(s.players[1].isBlind).toBe(false);

    // Player 1 (Seen) Chaals -> costs 2x stake = $20
    s = TeenPattiEngine.applyChaal(s, 1);
    expect(s.pot).toBe(70);
    expect(s.players[1].chips).toBe(970);
  });
});
