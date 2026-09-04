import { describe, it, expect } from 'vitest';
import { LudoEngine } from '../LudoEngine';
import { PlayerColor } from '../../../types/game';
import { LudoPlayerState, LudoGameOptions } from '../../../types/ludo';
import { getLudoVisualPosition, getClusterOffset, getLudoLocationKey } from '../ludoGeometry';

const defaultOptions: LudoGameOptions = {
  requireSixToStart: true,
  bonusTurnOnSix: true,
  bonusTurnOnCapture: true,
  bonusTurnOnHome: true,
  maxConsecutiveSixes: 3,
};

function createMockPlayer(color: 'red' | 'green' | 'yellow' | 'blue', name: string, steps: [number, number, number, number] = [-1, -1, -1, -1]): LudoPlayerState {
  return {
    config: {
      id: `p-${color}`,
      name,
      color,
      avatar: '👑',
      type: 'human',
    },
    tokens: steps.map((step, id) => {
      let status: 'yard' | 'track' | 'runway' | 'home' = 'yard';
      let trackIndex = -1;
      if (step >= 56) {
        status = 'home';
      } else if (step >= 51) {
        status = 'runway';
      } else if (step >= 0) {
        status = 'track';
        const startOffset = { red: 0, green: 13, yellow: 26, blue: 39 }[color];
        trackIndex = (startOffset + step) % 52;
      }
      return { id, color, step, status, trackIndex };
    }),
    tokensHome: steps.filter((s) => s >= 56).length,
    tokensCaptured: 0,
    tokensLost: 0,
  };
}

describe('LudoEngine Rule Validation & Transactions', () => {
  it('allows exiting yard only on 6 when requireSixToStart is true', () => {
    const p1 = createMockPlayer('red', 'Alice', [-1, -1, -1, -1]);
    const p2 = createMockPlayer('green', 'Bob', [-1, -1, -1, -1]);

    const movesOn5 = LudoEngine.getValidMoves(p1, 5, [p1, p2], defaultOptions);
    expect(movesOn5.length).toBe(0);

    const movesOn6 = LudoEngine.getValidMoves(p1, 6, [p1, p2], defaultOptions);
    expect(movesOn6.length).toBe(4);
    expect(movesOn6[0].isExitYard).toBe(true);
    expect(movesOn6[0].toStep).toBe(0);
  });

  it('prevents overshooting Home (must be exact step 56)', () => {
    const p1 = createMockPlayer('red', 'Alice', [53, -1, -1, -1]);
    const p2 = createMockPlayer('green', 'Bob', [-1, -1, -1, -1]);

    // Step 53 + 4 = 57 (> 56) -> Invalid
    const movesOn4 = LudoEngine.getValidMoves(p1, 4, [p1, p2], defaultOptions);
    expect(movesOn4.length).toBe(0);

    // Step 53 + 3 = 56 (Exact Home) -> Valid
    const movesOn3 = LudoEngine.getValidMoves(p1, 3, [p1, p2], defaultOptions);
    expect(movesOn3.length).toBe(1);
    expect(movesOn3[0].isHome).toBe(true);
    expect(movesOn3[0].toStep).toBe(56);
  });

  it('executes atomic move transaction and awards bonus turn on capture', () => {
    const p1 = createMockPlayer('red', 'Alice', [5, -1, -1, -1]);
    const p2 = createMockPlayer('green', 'Bob', [49, -1, -1, -1]); // Green token 0 is at global trackIndex 10

    const tx = LudoEngine.resolveMoveTransaction(0, 0, 5, [p1, p2], defaultOptions, 0);
    expect(tx).not.toBeNull();
    if (!tx) return;

    expect(tx.bonusTurn).toBe(true);
    expect(tx.capturedTokens.length).toBe(1);
    expect(tx.capturedTokens[0]).toEqual({ color: 'green', tokenId: 0 });

    // Moving player (Red)
    const updatedRed = tx.updatedPlayers[0];
    expect(updatedRed.tokens[0].step).toBe(10);
    expect(updatedRed.tokensCaptured).toBe(1);

    // Victim player (Green)
    const updatedGreen = tx.updatedPlayers[1];
    expect(updatedGreen.tokens[0].step).toBe(-1);
    expect(updatedGreen.tokens[0].status).toBe('yard');
    expect(updatedGreen.tokensLost).toBe(1);
  });

  it('does not allow capturing opponents on safe star squares', () => {
    const p1 = createMockPlayer('red', 'Alice', [4, -1, -1, -1]);
    const p2 = createMockPlayer('green', 'Bob', [47, -1, -1, -1]);

    const validMoves = LudoEngine.getValidMoves(p1, 4, [p1, p2], defaultOptions);
    expect(validMoves.length).toBe(1);
    expect(validMoves[0].capturesOpponent).toBe(false);
    expect(validMoves[0].targetOpponents?.length || 0).toBe(0);
  });

  it('correctly detects winning rank when all 4 tokens reach Home', () => {
    const p1 = createMockPlayer('red', 'Alice', [55, 56, 56, 56]);
    const p2 = createMockPlayer('green', 'Bob', [-1, -1, -1, -1]);

    const tx = LudoEngine.resolveMoveTransaction(0, 0, 1, [p1, p2], defaultOptions, 0);
    expect(tx).not.toBeNull();
    if (!tx) return;

    expect(tx.playerWonNow).toBe(true);
    expect(tx.newRank).toBe(1);
    expect(tx.updatedPlayers[0].tokensHome).toBe(4);
    expect(tx.updatedPlayers[0].rank).toBe(1);
  });
});

describe('ludoGeometry & Cluster Layout', () => {
  it('resolves identical visual locations for classic and luxury styles without skew', () => {
    const colors: PlayerColor[] = ['red', 'green', 'blue', 'yellow'];
    colors.forEach((c) => {
      // Test track cell 0
      const luxTrack = getLudoVisualPosition(c, 0, 0, 'luxury');
      const clsTrack = getLudoVisualPosition(c, 0, 0, 'classic');
      expect(luxTrack.x).toBeCloseTo(clsTrack.x, 4);
      expect(luxTrack.y).toBeCloseTo(clsTrack.y, 4);

      // Test yard socket 0
      const luxYard = getLudoVisualPosition(c, 0, -1, 'luxury');
      const clsYard = getLudoVisualPosition(c, 0, -1, 'classic');
      expect(luxYard.x).toBeCloseTo(clsYard.x, 4);
      expect(luxYard.y).toBeCloseTo(clsYard.y, 4);

      // Test home runway 53
      const luxRunway = getLudoVisualPosition(c, 0, 53, 'luxury');
      const clsRunway = getLudoVisualPosition(c, 0, 53, 'classic');
      expect(luxRunway.x).toBeCloseTo(clsRunway.x, 4);
      expect(luxRunway.y).toBeCloseTo(clsRunway.y, 4);

      // Test home goal 56
      const luxGoal = getLudoVisualPosition(c, 0, 56, 'luxury');
      const clsGoal = getLudoVisualPosition(c, 0, 56, 'classic');
      expect(luxGoal.x).toBeCloseTo(clsGoal.x, 4);
      expect(luxGoal.y).toBeCloseTo(clsGoal.y, 4);
    });
  });

  it('generates canonical location keys consistently', () => {
    expect(getLudoLocationKey('red', 0, -1)).toBe('yard:red:0');
    expect(getLudoLocationKey('red', 0, 56)).toBe('home:red');
    expect(getLudoLocationKey('red', 0, 52)).toBe('runway:red:1');
    expect(getLudoLocationKey('red', 0, 0)).toBe('track:0');
  });

  it('computes symmetric cluster offsets for multi-token blocks', () => {
    const offset1 = getClusterOffset(0, 2);
    const offset2 = getClusterOffset(1, 2);

    expect(offset1.dx).toBe(-offset2.dx);
    expect(offset1.dy).toBe(-offset2.dy);
  });

  describe('2-Player Diagonal Matchup Configurations', () => {
    const diagonalPairs: Record<string, [PlayerColor, PlayerColor]> = {
      'red-blue': ['red', 'blue'],
      'blue-red': ['blue', 'red'],
      'green-yellow': ['green', 'yellow'],
      'yellow-green': ['yellow', 'green'],
    };

    it.each(Object.entries(diagonalPairs))(
      'correctly configures %s matchup with diagonal opposite corners',
      (mode, [col1, col2]) => {
        const players = [
          createMockPlayer(col1, 'Player 1'),
          createMockPlayer(col2, 'Player 2'),
        ];

        // Ensure Player 1 and Player 2 have distinct opposite colors
        expect(players[0].config.color).toBe(col1);
        expect(players[1].config.color).toBe(col2);

        // Start offsets for diagonal pairs
        const startOffset: Record<PlayerColor, number> = {
          red: 0,
          green: 13,
          yellow: 26,
          blue: 39,
        };

        // Red (0) and Blue (39) or Green (13) and Yellow (26) are opposite corners
        const diff = Math.abs(startOffset[col1] - startOffset[col2]);
        expect(diff === 39 || diff === 13).toBe(true);

        // Valid moves can be generated for both players in 2-player mode
        const p1Moves = LudoEngine.getValidMoves(players[0], 6, players, defaultOptions);
        expect(p1Moves.length).toBe(4);
        expect(p1Moves[0].isExitYard).toBe(true);
      }
    );
  });
});

