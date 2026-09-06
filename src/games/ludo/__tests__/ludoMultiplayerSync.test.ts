import { describe, it, expect } from 'vitest';
import { LudoEngine } from '../LudoEngine';
import { canExecuteLudoActionLocally } from '../LudoGame';
import { LudoPlayerState, LudoGameOptions } from '../../../types/ludo';
import { MultiplayerSession } from '../../../multiplayer/protocol';

describe('Ludo Multiplayer Synchronization & State Resilience', () => {
  const defaultOptions: LudoGameOptions = {
    requireSixToStart: true,
    bonusTurnOnSix: true,
    bonusTurnOnCapture: true,
    bonusTurnOnHome: true,
    maxConsecutiveSixes: 3,
  };

  const createTestPlayers = (): LudoPlayerState[] => [
    {
      config: { id: 'p0', name: 'Host Peku', color: 'red', type: 'human', avatar: '👑', isHost: true },
      tokens: [
        { id: 0, color: 'red', step: -1, status: 'yard', trackIndex: -1 },
        { id: 1, color: 'red', step: -1, status: 'yard', trackIndex: -1 },
        { id: 2, color: 'red', step: -1, status: 'yard', trackIndex: -1 },
        { id: 3, color: 'red', step: -1, status: 'yard', trackIndex: -1 },
      ],
      tokensHome: 0,
      tokensCaptured: 0,
      tokensLost: 0,
    },
    {
      config: { id: 'p1', name: 'Guest Opponent', color: 'green', type: 'human', avatar: '🦊' },
      tokens: [
        { id: 0, color: 'green', step: 0, status: 'track', trackIndex: 13 },
        { id: 1, color: 'green', step: -1, status: 'yard', trackIndex: -1 },
        { id: 2, color: 'green', step: -1, status: 'yard', trackIndex: -1 },
        { id: 3, color: 'green', step: -1, status: 'yard', trackIndex: -1 },
      ],
      tokensHome: 0,
      tokensCaptured: 0,
      tokensLost: 0,
    },
    {
      config: { id: 'p2', name: 'Bot Ramesh', color: 'yellow', type: 'bot', avatar: '🤖', difficulty: 'medium' },
      tokens: [
        { id: 0, color: 'yellow', step: -1, status: 'yard', trackIndex: -1 },
        { id: 1, color: 'yellow', step: -1, status: 'yard', trackIndex: -1 },
        { id: 2, color: 'yellow', step: -1, status: 'yard', trackIndex: -1 },
        { id: 3, color: 'yellow', step: -1, status: 'yard', trackIndex: -1 },
      ],
      tokensHome: 0,
      tokensCaptured: 0,
      tokensLost: 0,
    },
  ];

  it('canExecuteLudoActionLocally correctly authorizes host to automate bots and self', () => {
    const players = createTestPlayers();
    const hostSession: MultiplayerSession = {
      roomCode: 'SYNC01',
      matchId: 'match-sync-01',
      mySeatIndex: 0,
      myPeerId: 'peer-host',
      isHost: true,
      players: players.map((p) => p.config),
      options: defaultOptions,
    };

    // Host executing for self (seat 0) -> Allowed
    expect(canExecuteLudoActionLocally(0, false, true, hostSession, players)).toBe(true);

    // Host executing for bot (seat 2) -> Allowed (crucial fix for host bot automation)
    expect(canExecuteLudoActionLocally(2, false, true, hostSession, players)).toBe(true);

    // Host executing locally for guest (seat 1) without fromRemote -> Disallowed
    expect(canExecuteLudoActionLocally(1, false, true, hostSession, players)).toBe(false);

    // Host executing for guest when fromRemote=true -> Allowed
    expect(canExecuteLudoActionLocally(1, true, true, hostSession, players)).toBe(true);
  });

  it('canExecuteLudoActionLocally strictly rejects fromRemote=true on guests and restricts to own seat', () => {
    const players = createTestPlayers();
    const guestSession: MultiplayerSession = {
      roomCode: 'SYNC01',
      matchId: 'match-sync-01',
      mySeatIndex: 1,
      myPeerId: 'peer-guest',
      isHost: false,
      players: players.map((p) => p.config),
      options: defaultOptions,
    };

    // Guest executing for own seat (seat 1) -> Allowed
    expect(canExecuteLudoActionLocally(1, false, true, guestSession, players)).toBe(true);

    // Guest executing for host seat (seat 0) -> Disallowed
    expect(canExecuteLudoActionLocally(0, false, true, guestSession, players)).toBe(false);

    // Guest executing for bot seat (seat 2) -> Disallowed
    expect(canExecuteLudoActionLocally(2, false, true, guestSession, players)).toBe(false);

    // Guest executing with fromRemote=true for own seat -> Disallowed (security fix: guests cannot execute remote actions)
    expect(canExecuteLudoActionLocally(1, true, true, guestSession, players)).toBe(false);

    // Guest executing with fromRemote=true for arbitrary seat -> Disallowed
    expect(canExecuteLudoActionLocally(0, true, true, guestSession, players)).toBe(false);
  });

  it('recalculates valid moves on the fly if cached validMoves is stale or empty', () => {
    const players = createTestPlayers();
    const guestPlayer = players[1]; // Green, has token 0 at step 0
    const roll = 4;

    // Simulate empty cached validMoves (e.g. React closure lag)
    const validMovesRef: any[] = [];

    // Fallback recalculation pattern used in handleSelectToken
    let move = validMovesRef.find((m) => m.tokenId === 0);
    if (!move) {
      const recalculated = LudoEngine.getValidMoves(guestPlayer, roll, players, defaultOptions);
      move = recalculated.find((m) => m.tokenId === 0);
    }

    expect(move).toBeDefined();
    expect(move?.fromStep).toBe(0);
    expect(move?.toStep).toBe(4);
    expect(move?.isExitYard).toBe(false);
  });

  it('resolves move transaction accurately with diceValueRef value (preventing stale roll closure)', () => {
    const players = createTestPlayers();
    const roll = 4; // Fresh roll from diceValueRef
    const tokenId = 0;
    const actingSeat = 1; // Green

    const tx = LudoEngine.resolveMoveTransaction(
      actingSeat,
      tokenId,
      roll,
      players,
      defaultOptions,
      0
    );

    expect(tx).not.toBeNull();
    const updatedToken = tx!.updatedPlayers[1].tokens.find((t) => t.id === 0);
    expect(updatedToken?.step).toBe(4);
    expect(updatedToken?.status).toBe('track');
    expect(updatedToken?.trackIndex).toBe((13 + 4) % 52); // 17
  });

  it('returns 0 valid moves and identifies no-move state when all pawns are in yard and roll is not 6', () => {
    const players = createTestPlayers();
    const hostPlayer = players[0]; // Red, all 4 tokens in yard

    const movesOnRoll3 = LudoEngine.getValidMoves(hostPlayer, 3, players, defaultOptions);
    expect(movesOnRoll3).toHaveLength(0);

    const movesOnRoll6 = LudoEngine.getValidMoves(hostPlayer, 6, players, defaultOptions);
    expect(movesOnRoll6).toHaveLength(4); // All 4 tokens can exit yard
  });
});
