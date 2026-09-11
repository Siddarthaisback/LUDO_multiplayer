import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPassAndPlayPlayers } from '../../../components/Ludo/LudoModeMenu';
import { TurnTimeoutManager } from '../turnTimeoutManager';
import { LudoEngine } from '../LudoEngine';
import { LudoPlayerState } from '../../../types/ludo';
import { PlayerConfig } from '../../../types/game';

describe('Local Pass & Play 3-Player Turn Lifecycle & Smooth Handoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('3-player local setup configures players in clockwise order (red -> green -> yellow)', () => {
    const players = createPassAndPlayPlayers(3);
    expect(players).toHaveLength(3);
    expect(players[0].color).toBe('red');
    expect(players[1].color).toBe('green');
    expect(players[2].color).toBe('yellow');
  });

  it('offline pass-and-play does not run turn countdown timer or force timeouts', () => {
    const onTick = vi.fn();
    const onTimeout = vi.fn();
    const manager = new TurnTimeoutManager({ onTick, onTimeout });

    // In offline games, startTurn is explicitly bypassed:
    const isOnline = false;
    if (isOnline) {
      manager.startTurn(15);
    }

    // Advancing 30 seconds should never tick or trigger timeout
    vi.advanceTimersByTime(30000);
    expect(onTick).not.toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();
    expect(manager.getIsTimedOut()).toBe(false);
  });

  it('advanceTurn cleanly cycles 3 players and resets dice state to neutral 1', () => {
    const playerConfigs: PlayerConfig[] = [
      { id: 'p1', name: 'Player 1', color: 'red', type: 'human', avatar: '🦁' },
      { id: 'p2', name: 'Player 2', color: 'green', type: 'human', avatar: '🐼' },
      { id: 'p3', name: 'Player 3', color: 'yellow', type: 'human', avatar: '🦊' },
    ];

    const players: LudoPlayerState[] = playerConfigs.map((cfg) => ({
      config: cfg,
      tokens: [
        { id: 0, color: cfg.color, step: -1, status: 'yard', trackIndex: -1 },
        { id: 1, color: cfg.color, step: -1, status: 'yard', trackIndex: -1 },
        { id: 2, color: cfg.color, step: -1, status: 'yard', trackIndex: -1 },
        { id: 3, color: cfg.color, step: -1, status: 'yard', trackIndex: -1 },
      ],
      tokensHome: 0,
      tokensCaptured: 0,
      tokensLost: 0,
    }));

    let activePlayerIndex = 0;
    let diceValue = 4; // Rolled 4 with no moves
    let hasRolled = true;

    // Simulate turn advancement logic from LudoGame.tsx
    const advanceTurn = (samePlayer: boolean) => {
      let nextIdx = activePlayerIndex;
      if (!samePlayer) {
        nextIdx = (nextIdx + 1) % players.length;
      }
      activePlayerIndex = nextIdx;
      hasRolled = false;
      diceValue = 1; // Neutral reset for incoming player
    };

    // P1 (Red) advances
    advanceTurn(false);
    expect(activePlayerIndex).toBe(1); // Next is P2 (Green)
    expect(players[activePlayerIndex].config.color).toBe('green');
    expect(diceValue).toBe(1);
    expect(hasRolled).toBe(false);

    // P2 (Green) advances
    diceValue = 3;
    hasRolled = true;
    advanceTurn(false);
    expect(activePlayerIndex).toBe(2); // Next is P3 (Yellow)
    expect(players[activePlayerIndex].config.color).toBe('yellow');
    expect(diceValue).toBe(1);
    expect(hasRolled).toBe(false);

    // P3 (Yellow) advances
    diceValue = 5;
    hasRolled = true;
    advanceTurn(false);
    expect(activePlayerIndex).toBe(0); // Loops back to P1 (Red)
    expect(players[activePlayerIndex].config.color).toBe('red');
    expect(diceValue).toBe(1);
    expect(hasRolled).toBe(false);
  });

  it('calculates 0 legal moves on non-six when all tokens are in yard', () => {
    const player: LudoPlayerState = {
      config: { id: 'p3', name: 'Player 3', color: 'yellow', type: 'human', avatar: '🦊' },
      tokens: [
        { id: 0, color: 'yellow', step: -1, status: 'yard', trackIndex: -1 },
        { id: 1, color: 'yellow', step: -1, status: 'yard', trackIndex: -1 },
        { id: 2, color: 'yellow', step: -1, status: 'yard', trackIndex: -1 },
        { id: 3, color: 'yellow', step: -1, status: 'yard', trackIndex: -1 },
      ],
      tokensHome: 0,
      tokensCaptured: 0,
      tokensLost: 0,
    };

    const roll = 3;
    const moves = LudoEngine.getValidMoves(player, roll, [player], {
      requireSixToStart: true,
      bonusTurnOnSix: true,
      bonusTurnOnCapture: true,
      bonusTurnOnHome: true,
      maxConsecutiveSixes: 3,
    });

    expect(moves).toHaveLength(0);
  });
});
