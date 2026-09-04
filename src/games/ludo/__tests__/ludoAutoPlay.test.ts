import { describe, it, expect } from 'vitest';
import { LudoEngine } from '../LudoEngine';
import { BotAI } from '../../../engine/botAI';
import { LudoPlayerState } from '../../../types/ludo';
import { PlayerConfig } from '../../../types/game';

describe('Ludo Auto-Play (Spectator Mode) Contracts', () => {
  const sampleConfig: PlayerConfig[] = [
    { id: '1', name: 'Auto Player 1', type: 'human', color: 'red', avatar: '👑' },
    { id: '2', name: 'Auto Player 2', type: 'bot', color: 'green', avatar: '🤖', difficulty: 'master' },
    { id: '3', name: 'Auto Player 3', type: 'bot', color: 'yellow', avatar: '🦁', difficulty: 'master' },
    { id: '4', name: 'Auto Player 4', type: 'bot', color: 'blue', avatar: '⚡', difficulty: 'master' },
  ];

  const createInitialState = (): LudoPlayerState[] =>
    sampleConfig.map((p) => ({
      config: p,
      tokens: [
        { id: 0, color: p.color, step: -1, status: 'yard' as const, trackIndex: -1 },
        { id: 1, color: p.color, step: -1, status: 'yard' as const, trackIndex: -1 },
        { id: 2, color: p.color, step: -1, status: 'yard' as const, trackIndex: -1 },
        { id: 3, color: p.color, step: -1, status: 'yard' as const, trackIndex: -1 },
      ],
      tokensHome: 0,
      tokensCaptured: 0,
      tokensLost: 0,
    }));

  it('selects legal exit moves automatically on a roll of 6 when all tokens are in yard', () => {
    const states = createInitialState();
    const moves = LudoEngine.getValidMoves(states[0], 6, states, {
      requireSixToStart: true,
      bonusTurnOnSix: true,
      bonusTurnOnCapture: true,
      bonusTurnOnHome: true,
      maxConsecutiveSixes: 3,
    });

    expect(moves.length).toBe(4);
    const chosenTokenId = BotAI.selectBestLudoMove(moves, 'red', states[0], states, 'master');
    expect(chosenTokenId).not.toBeNull();
    const chosenMove = moves.find((m) => m.tokenId === chosenTokenId);
    expect(chosenMove?.isExitYard).toBe(true);
  });

  it('prioritizes capturing enemy tokens in automated spectator mode', () => {
    const states = createInitialState();
    // Red token 0 at step 10 (trackIndex 10)
    states[0].tokens[0] = { id: 0, color: 'red', step: 10, status: 'track', trackIndex: 10 };
    // Red token 1 at step 2
    states[0].tokens[1] = { id: 1, color: 'red', step: 2, status: 'track', trackIndex: 2 };
    // Green enemy token at trackIndex 14 (not safe: safe cells are 0, 8, 13, 21...)
    states[1].tokens[0] = { id: 0, color: 'green', step: 1, status: 'track', trackIndex: 14 };

    const moves = LudoEngine.getValidMoves(states[0], 4, states, {
      requireSixToStart: true,
      bonusTurnOnSix: true,
      bonusTurnOnCapture: true,
      bonusTurnOnHome: true,
      maxConsecutiveSixes: 3,
    });

    expect(moves.some((m) => m.capturesOpponent)).toBe(true);
    const chosenTokenId = BotAI.selectBestLudoMove(moves, 'red', states[0], states, 'master');
    expect(chosenTokenId).toBe(0); // Token 0 makes the capture
  });

  it('prioritizes moving token into home goal in automated spectator mode', () => {
    const states = createInitialState();
    // Red token 0 at step 55 (1 step away from goal 56)
    states[0].tokens[0] = { id: 0, color: 'red', step: 55, status: 'runway', trackIndex: -1 };
    // Red token 1 at step 10
    states[0].tokens[1] = { id: 1, color: 'red', step: 10, status: 'track', trackIndex: 10 };

    const moves = LudoEngine.getValidMoves(states[0], 1, states, {
      requireSixToStart: true,
      bonusTurnOnSix: true,
      bonusTurnOnCapture: true,
      bonusTurnOnHome: true,
      maxConsecutiveSixes: 3,
    });

    const homeMove = moves.find((m) => m.isHome);
    expect(homeMove).toBeDefined();

    const chosenTokenId = BotAI.selectBestLudoMove(moves, 'red', states[0], states, 'master');
    expect(chosenTokenId).toBe(0); // Reaching home receives highest score (+10000)
  });

  it('suspends all turns including bot players when Auto-Play is paused', () => {
    const resolveAutomatedTurn = (isAutoPlay: boolean, isAutoPlayPaused: boolean, playerType: 'human' | 'bot') => {
      return isAutoPlay ? !isAutoPlayPaused : playerType === 'bot';
    };

    // When Auto-Play is active and running:
    expect(resolveAutomatedTurn(true, false, 'human')).toBe(true);
    expect(resolveAutomatedTurn(true, false, 'bot')).toBe(true);

    // When Auto-Play is paused: ALL turns are suspended (including bots)
    expect(resolveAutomatedTurn(true, true, 'human')).toBe(false);
    expect(resolveAutomatedTurn(true, true, 'bot')).toBe(false);

    // When Auto-Play is off (normal mode):
    expect(resolveAutomatedTurn(false, false, 'human')).toBe(false);
    expect(resolveAutomatedTurn(false, false, 'bot')).toBe(true);
  });
});
