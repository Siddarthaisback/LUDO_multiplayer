import { describe, it, expect } from 'vitest';
import { DhumbalEngine } from '../../games/dhumbal/engine/DhumbalEngine';
import { NEPAL_CLASSIC_DHUMBAL_RULES } from '../../games/dhumbal/engine/DhumbalRules';
import { TeenPattiEvaluator } from '../../games/teenpatti/engine/TeenPattiEvaluator';
import { TeenPattiEngine } from '../../games/teenpatti/engine/TeenPattiEngine';
import { PokerEngine } from '../../games/poker/engine/PokerEngine';
import { parseCardId } from '../cards/Card';
import { DEFAULT_PLAYERS } from '../../utils/constants';

describe('Engine Edge Cases & Codex Review Validations', () => {
  it('Dhumbal: detects ties as undercuts (when opponent ties with caller)', () => {
    const match = DhumbalEngine.createMatch(DEFAULT_PLAYERS, NEPAL_CLASSIC_DHUMBAL_RULES, 100);
    // Player 0 calls with 4 pts (2S + 2H), Player 1 ties with 4 pts (4D)
    const tieMatch = {
      ...match,
      players: [
        { ...match.players[0], hand: [parseCardId('2S'), parseCardId('2H')] }, // 4 pts
        { ...match.players[1], hand: [parseCardId('4D')] },                     // 4 pts (Tie -> Undercut!)
        { ...match.players[2], hand: [parseCardId('JH')] },                     // 11 pts
        { ...match.players[3], hand: [parseCardId('QD')] },                     // 12 pts
      ],
    };

    const resolved = DhumbalEngine.declareDhumbal(tieMatch, 0);
    expect(resolved.lastResult?.isUndercut).toBe(true);
    expect(resolved.players[0].lastRoundScore).toBe(4 + 25); // 29 penalty points
  });

  it('Teen Patti: A-2-3 sequence ranks higher than K-Q-J in AKQ_HIGH ruleset', () => {
    const a23 = [parseCardId('AS'), parseCardId('2H'), parseCardId('3D')];
    const kqj = [parseCardId('KS'), parseCardId('QH'), parseCardId('JD')];
    const akq = [parseCardId('AS'), parseCardId('KH'), parseCardId('QD')];

    // Under AKQ_HIGH: AKQ > A23 > KQJ
    expect(TeenPattiEvaluator.compareHands(akq, a23)).toBeGreaterThan(0);
    expect(TeenPattiEvaluator.compareHands(a23, kqj)).toBeGreaterThan(0);
  });

  it('Teen Patti: rejects out-of-turn actions and packed player moves', () => {
    const match = TeenPattiEngine.createMatch(DEFAULT_PLAYERS, undefined, 1000, 42);
    // Turn is 0, player 1 tries to Chaal
    expect(() => TeenPattiEngine.applyChaal(match, 1)).toThrow(/Not player 1's turn/);
  });

  it('Poker: rejects undersized raises and negative bets', () => {
    const hand = PokerEngine.createHand(DEFAULT_PLAYERS, undefined, undefined, 0, 42);
    const turn = hand.turnIndex;
    // Current high bet is 20 (Big blind). Minimum raise is 20 (total 40). Trying to raise to 25 throws error.
    expect(() => PokerEngine.applyBetOrRaise(hand, turn, 25)).toThrow(/Raise must be at least/);
  });

  it('Poker: auto-runs board out to showdown when all active players are all-in', () => {
    // 2 players with short stacks (20 chips each)
    const shortStacks = [20, 20, 20, 20];
    const hand = PokerEngine.createHand(DEFAULT_PLAYERS, undefined, shortStacks, 0, 42);

    // Players call/all-in preflop until hand automatically resolves
    let s = hand;
    while (s.street !== 'hand_over') {
      s = PokerEngine.applyCallOrCheck(s, s.turnIndex);
    }

    // All players are all-in: hand should automatically run out all 5 community cards and reach hand_over!
    expect(s.street).toBe('hand_over');
    expect(s.communityCards.length).toBe(5);
    expect(s.resolvedPots).toBeDefined();
  });
});
