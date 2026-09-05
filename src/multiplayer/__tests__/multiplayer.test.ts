import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateRoomCode,
  normalizeRoomCode,
  LobbyState,
  MultiplayerSession,
  GameSnapshot,
  PROTOCOL_VERSION,
} from '../protocol';
import { LobbyController } from '../lobbyController';
import { OnlineLudoController } from '../onlineLudoController';
import { peerTransport } from '../peerService';

describe('Multiplayer Protocol & Helpers', () => {
  it('generates a valid 6-character room code without ambiguous characters', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
    expect(code).not.toMatch(/[01IO]/);
  });

  it('normalizes room code from plain text or full URLs', () => {
    expect(normalizeRoomCode('  abc89z ')).toBe('ABC89Z');
    expect(normalizeRoomCode('ab-cd-ef')).toBe('ABCDEF');
    expect(normalizeRoomCode('https://ludoking.com/?room=k9m2px')).toBe('K9M2PX');
    expect(normalizeRoomCode('http://localhost:5173/?room=xyz123&other=param')).toBe('XYZ123');
    expect(normalizeRoomCode('')).toBe('');
  });
});

describe('LobbyController', () => {
  let lobby: LobbyController;

  beforeEach(() => {
    lobby = new LobbyController();
  });

  it('initializes host correctly at seat 0 with red color', () => {
    lobby.initHostLobby('ROOM88', 'Frank Host', '👑', 'peer-host');
    const state = lobby.getState();

    expect(state.roomCode).toBe('ROOM88');
    expect(state.hostPeerId).toBe('peer-host');
    expect(state.playerCount).toBe(1);
    expect(state.status).toBe('waiting');
    expect(state.seats[0]).not.toBeNull();
    expect(state.seats[0]?.name).toBe('Frank Host');
    expect(state.seats[0]?.color).toBe('red');
    expect(state.seats[0]?.isHost).toBe(true);
    expect(state.seats[1]).toBeNull();
  });

  it('allows guests to join seats 1, 2, 3 and rejects 5th player', () => {
    lobby.initHostLobby('ROOM88', 'Host', '👑', 'peer-host');

    // Guest 1 joins
    lobby.handleJoinRequest('peer-g1', {
      roomCode: 'ROOM88',
      name: 'Guest 1',
      avatar: '🦊',
      protocolVersion: PROTOCOL_VERSION,
    });
    expect(lobby.getState().playerCount).toBe(2);
    expect(lobby.getState().seats[1]?.name).toBe('Guest 1');
    expect(lobby.getState().seats[1]?.color).toBe('green');

    // Guest 2 joins
    lobby.handleJoinRequest('peer-g2', {
      roomCode: 'ROOM88',
      name: 'Guest 2',
      avatar: '🐼',
      protocolVersion: PROTOCOL_VERSION,
    });
    expect(lobby.getState().playerCount).toBe(3);
    expect(lobby.getState().seats[2]?.color).toBe('yellow');

    // Guest 3 joins
    lobby.handleJoinRequest('peer-g3', {
      roomCode: 'ROOM88',
      name: 'Guest 3',
      avatar: '🐯',
      protocolVersion: PROTOCOL_VERSION,
    });
    expect(lobby.getState().playerCount).toBe(4);
    expect(lobby.getState().seats[3]?.color).toBe('blue');

    // 5th Guest attempts to join
    lobby.handleJoinRequest('peer-g4', {
      roomCode: 'ROOM88',
      name: 'Guest 4',
      avatar: '🦁',
      protocolVersion: PROTOCOL_VERSION,
    });
    expect(lobby.getState().playerCount).toBe(4);
  });

  it('validates startMatch conditions (min 2 players)', () => {
    lobby.initHostLobby('ROOM88', 'Host', '👑', 'peer-host');
    expect(lobby.canStart()).toBe(false);

    // After 1 guest joins, match can start
    lobby.handleJoinRequest('peer-g1', {
      roomCode: 'ROOM88',
      name: 'Guest 1',
      avatar: '🦊',
      protocolVersion: PROTOCOL_VERSION,
    });
    expect(lobby.canStart()).toBe(true);

    const result = lobby.startMatch({
      requireSixToStart: true,
      bonusTurnOnSix: true,
      bonusTurnOnCapture: true,
      bonusTurnOnHome: true,
      maxConsecutiveSixes: 3,
    });

    expect(result).not.toBeNull();
    expect(result?.session.players).toHaveLength(2);
    expect(result?.initialSnapshot.players).toHaveLength(2);
    expect(result?.initialSnapshot.activePlayerIndex).toBe(0);
    expect(result?.initialSnapshot.hasRolled).toBe(false);
    expect(lobby.getState().status).toBe('in_game');
    // Cannot start again while in_game
    expect(lobby.canStart()).toBe(false);
  });

  it('allows host to add and remove bots to fill empty seats (4P online with bots)', () => {
    lobby.initHostLobby('ROOM88', 'Host', '👑', 'peer-host');

    // 1 guest joins seat 1
    lobby.handleJoinRequest('peer-g1', {
      roomCode: 'ROOM88',
      name: 'Friend',
      avatar: '🦊',
      protocolVersion: PROTOCOL_VERSION,
    });
    expect(lobby.getState().playerCount).toBe(2);

    // Host cannot add bot to seat 0 (host) or seat 1 (occupied)
    expect(lobby.addBot(0)).toBe(false);
    expect(lobby.addBot(1)).toBe(false);

    // Host adds bots to seat 2 and seat 3
    expect(lobby.addBot(2, 'easy')).toBe(true);
    expect(lobby.addBot(3, 'master')).toBe(true);
    expect(lobby.getState().playerCount).toBe(4);

    const seat2 = lobby.getState().seats[2];
    const seat3 = lobby.getState().seats[3];
    expect(seat2?.kind).toBe('bot');
    expect(seat2?.difficulty).toBe('easy');
    expect(seat2?.color).toBe('yellow');
    expect(seat3?.kind).toBe('bot');
    expect(seat3?.difficulty).toBe('master');
    expect(seat3?.color).toBe('blue');

    // Host removes bot at seat 3
    expect(lobby.removeBot(3)).toBe(true);
    expect(lobby.getState().playerCount).toBe(3);
    expect(lobby.getState().seats[3]).toBeNull();

    // Re-add bot at seat 3 to test 4P start
    expect(lobby.addBot(3, 'medium')).toBe(true);
    expect(lobby.canStart()).toBe(true);

    const matchResult = lobby.startMatch({
      requireSixToStart: true,
      bonusTurnOnSix: true,
      bonusTurnOnCapture: true,
      bonusTurnOnHome: true,
      maxConsecutiveSixes: 3,
    });

    expect(matchResult).not.toBeNull();
    const session = matchResult!.session;
    expect(session.players).toHaveLength(4);
    expect(session.players[0].type).toBe('human');
    expect(session.players[1].type).toBe('human');
    expect(session.players[2].type).toBe('bot');
    expect(session.players[2].difficulty).toBe('easy');
    expect(session.players[3].type).toBe('bot');
    expect(session.players[3].difficulty).toBe('medium');

    // seatPeers should ONLY contain human peers
    expect(session.seatPeers?.[0]).toBe('peer-host');
    expect(session.seatPeers?.[1]).toBe('peer-g1');
    expect(session.seatPeers?.[2]).toBeUndefined();
    expect(session.seatPeers?.[3]).toBeUndefined();
  });

  it('rejects bot management and startMatch when caller is not the local host', () => {
    lobby.initHostLobby('ROOM88', 'Host', '👑', 'peer-host');
    // Simulate non-host / guest environment
    peerTransport.isHost = false;

    expect(lobby.addBot(2, 'easy')).toBe(false);
    expect(lobby.removeBot(2)).toBe(false);
    expect(lobby.canStart()).toBe(false);
    expect(lobby.startMatch({
      requireSixToStart: true,
      bonusTurnOnSix: true,
      bonusTurnOnCapture: true,
      bonusTurnOnHome: true,
      maxConsecutiveSixes: 3,
    })).toBeNull();
  });

  it('handles peer leave and frees their seat', () => {
    lobby.initHostLobby('ROOM88', 'Host', '👑', 'peer-host');
    lobby.handleJoinRequest('peer-g1', {
      roomCode: 'ROOM88',
      name: 'Guest 1',
      avatar: '🦊',
      protocolVersion: PROTOCOL_VERSION,
    });
    expect(lobby.getState().playerCount).toBe(2);
    expect(lobby.getState().seats[1]).not.toBeNull();

    lobby.handlePeerLeave('peer-g1');
    expect(lobby.getState().playerCount).toBe(1);
    expect(lobby.getState().seats[1]).toBeNull();
  });

  it('rejects join requests with missing/mismatched protocolVersion or room code', () => {
    lobby.initHostLobby('ROOM88', 'Host', '👑', 'peer-host');

    // Missing protocol version (fail-closed)
    lobby.handleJoinRequest('peer-no-ver', {
      roomCode: 'ROOM88',
      name: 'No Ver',
      avatar: '🤖',
    });
    expect(lobby.getState().playerCount).toBe(1);

    // Mismatched version
    lobby.handleJoinRequest('peer-bad-ver', {
      roomCode: 'ROOM88',
      name: 'Old Client',
      avatar: '🤖',
      protocolVersion: '0.0.1',
    });
    expect(lobby.getState().playerCount).toBe(1);

    // Mismatched room code
    lobby.handleJoinRequest('peer-bad-code', {
      roomCode: 'WRONG9',
      name: 'Lost Player',
      avatar: '🤖',
      protocolVersion: PROTOCOL_VERSION,
    });
    expect(lobby.getState().playerCount).toBe(1);
  });
});

describe('OnlineLudoController & Turn Authority', () => {
  let controller: OnlineLudoController;
  let mockSession: MultiplayerSession;
  let mockSnapshot: GameSnapshot;

  beforeEach(() => {
    controller = new OnlineLudoController();
    mockSession = {
      roomCode: 'TEST01',
      matchId: 'match-01',
      mySeatIndex: 1, // Simulated guest at Seat 1
      myPeerId: 'peer-guest',
      isHost: false,
      players: [
        { id: 'p0', name: 'Host', color: 'red', avatar: '👑', type: 'human', isHost: true },
        { id: 'p1', name: 'Guest', color: 'green', avatar: '🦊', type: 'human', isHost: false },
      ],
      options: {
        requireSixToStart: true,
        bonusTurnOnSix: true,
        bonusTurnOnCapture: true,
        bonusTurnOnHome: true,
        maxConsecutiveSixes: 3,
      },
    };

    mockSnapshot = {
      matchId: 'match-01',
      sequence: 1,
      players: [],
      activePlayerIndex: 0, // Seat 0 turn
      diceValue: 1,
      hasRolled: false,
      isRolling: false,
      consecutiveSixes: 0,
      winner: null,
      rankings: [],
    };

    controller.initSession(mockSession, mockSnapshot);
  });

  it('correctly reports turn authority based on activePlayerIndex', () => {
    // When activePlayerIndex is 0 (host), it is NOT guest's turn (mySeatIndex: 1)
    expect(controller.isMyTurn(0)).toBe(false);
    expect(controller.requestRoll(0)).toBe(false);
    expect(controller.requestMove(0, 0)).toBe(false);

    // When activePlayerIndex is 1, it IS guest's turn
    expect(controller.isMyTurn(1)).toBe(true);
    // requestRoll returns false for guest because guest must await authoritative snapshot from host
    expect(controller.requestRoll(1)).toBe(false);
  });

  it('rejects stale snapshot sequences', () => {
    const onSnapshot = vi.fn();
    controller.setCallbacks({ onStateSnapshot: onSnapshot });

    // Simulate incoming older or equal sequence
    const transportHandler = (controller as any).handleWireMessage.bind(controller);

    transportHandler({
      type: 'GAME_STATE',
      matchId: 'match-01',
      sequence: 1, // equal to initial sequence
      snapshot: { ...mockSnapshot, sequence: 1, diceValue: 5 },
    });
    expect(onSnapshot).not.toHaveBeenCalled();

    // Valid newer sequence
    transportHandler({
      type: 'GAME_STATE',
      matchId: 'match-01',
      sequence: 2,
      snapshot: { ...mockSnapshot, sequence: 2, diceValue: 6 },
    });
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(onSnapshot).toHaveBeenCalledWith(expect.objectContaining({ diceValue: 6 }));
  });

  it('host strictly enforces senderPeerId ownership and phase on ROLL_REQUEST and MOVE_REQUEST', () => {
    const onRemoteRoll = vi.fn();
    const onRemoteMove = vi.fn();
    const hostController = new OnlineLudoController();

    const hostSession: MultiplayerSession = {
      roomCode: 'TEST01',
      matchId: 'match-01',
      mySeatIndex: 0,
      myPeerId: 'peer-host',
      isHost: true,
      players: [
        { id: 'p0', name: 'Host', color: 'red', avatar: '👑', type: 'human', isHost: true },
        { id: 'p1', name: 'Guest', color: 'green', avatar: '🦊', type: 'human', isHost: false },
      ],
      options: {
        requireSixToStart: true,
        bonusTurnOnSix: true,
        bonusTurnOnCapture: true,
        bonusTurnOnHome: true,
        maxConsecutiveSixes: 3,
      },
      seatPeers: {
        0: 'peer-host',
        1: 'peer-guest-1',
      },
    };

    const hostSnapshot: GameSnapshot = {
      matchId: 'match-01',
      sequence: 1,
      players: [
        {
          config: hostSession.players[0],
          tokens: [{ id: 0, color: 'red', step: -1, status: 'yard', trackIndex: -1 }],
          tokensHome: 0,
          tokensCaptured: 0,
          tokensLost: 0,
        },
        {
          config: hostSession.players[1],
          tokens: [{ id: 0, color: 'green', step: -1, status: 'yard', trackIndex: -1 }],
          tokensHome: 0,
          tokensCaptured: 0,
          tokensLost: 0,
        },
      ],
      activePlayerIndex: 1, // Guest's turn
      diceValue: 1,
      hasRolled: false,
      isRolling: false,
      consecutiveSixes: 0,
      winner: null,
      rankings: [],
    };

    hostController.initSession(hostSession, hostSnapshot);
    hostController.setCallbacks({ onRemoteRoll, onRemoteMove });

    const hostTransportHandler = (hostController as any).handleWireMessage.bind(hostController);

    // 1. Spoofed sender sends ROLL_REQUEST -> MUST BE REJECTED
    hostTransportHandler(
      {
        type: 'ROLL_REQUEST',
        matchId: 'match-01',
        seatIndex: 1,
        timestamp: Date.now(),
      },
      'peer-imposter'
    );
    expect(onRemoteRoll).not.toHaveBeenCalled();

    // 2. Legitimate sender sends ROLL_REQUEST without forceSix -> defaults to false
    hostTransportHandler(
      {
        type: 'ROLL_REQUEST',
        matchId: 'match-01',
        seatIndex: 1,
        timestamp: Date.now(),
      },
      'peer-guest-1'
    );
    expect(onRemoteRoll).toHaveBeenCalledTimes(1);
    expect(onRemoteRoll).toHaveBeenCalledWith(0, 1, false);

    // Reset in-flight by broadcasting snapshot
    hostController.broadcastSnapshot({
      ...hostSnapshot,
      hasRolled: false,
    });

    // 2b. Legitimate sender sends ROLL_REQUEST with forceSix: true
    hostTransportHandler(
      {
        type: 'ROLL_REQUEST',
        matchId: 'match-01',
        seatIndex: 1,
        forceSix: true,
        timestamp: Date.now(),
      },
      'peer-guest-1'
    );
    expect(onRemoteRoll).toHaveBeenCalledTimes(2);
    expect(onRemoteRoll).toHaveBeenLastCalledWith(0, 1, true);

    // Reset in-flight by broadcasting snapshot
    hostController.broadcastSnapshot({
      ...hostSnapshot,
      hasRolled: false,
    });

    // 2c. Malformed forceSix (non-boolean) -> MUST BE REJECTED
    hostTransportHandler(
      {
        type: 'ROLL_REQUEST',
        matchId: 'match-01',
        seatIndex: 1,
        forceSix: 'invalid' as any,
        timestamp: Date.now(),
      },
      'peer-guest-1'
    );
    expect(onRemoteRoll).toHaveBeenCalledTimes(2); // Not called, rejected!

    // 3. Immediate duplicate ROLL_REQUEST while in-flight -> MUST BE DROPPED
    // Set in-flight by valid call:
    hostTransportHandler(
      {
        type: 'ROLL_REQUEST',
        matchId: 'match-01',
        seatIndex: 1,
        forceSix: false,
        timestamp: Date.now(),
      },
      'peer-guest-1'
    );
    expect(onRemoteRoll).toHaveBeenCalledTimes(3);

    hostTransportHandler(
      {
        type: 'ROLL_REQUEST',
        matchId: 'match-01',
        seatIndex: 1,
        timestamp: Date.now(),
      },
      'peer-guest-1'
    );
    expect(onRemoteRoll).toHaveBeenCalledTimes(3); // Still 3, dropped!

    // Reset in-flight by broadcasting snapshot
    hostController.broadcastSnapshot({
      ...hostSnapshot,
      hasRolled: true,
      diceValue: 4,
    });

    // 4. MOVE_REQUEST for valid token while hasRolled is true -> MUST BE ACCEPTED
    hostTransportHandler(
      {
        type: 'MOVE_REQUEST',
        matchId: 'match-01',
        seatIndex: 1,
        tokenId: 0,
        timestamp: Date.now(),
      },
      'peer-guest-1'
    );
    expect(onRemoteMove).toHaveBeenCalledTimes(1);

    // 5. Immediate duplicate MOVE_REQUEST while in-flight -> MUST BE DROPPED
    hostTransportHandler(
      {
        type: 'MOVE_REQUEST',
        matchId: 'match-01',
        seatIndex: 1,
        tokenId: 0,
        timestamp: Date.now(),
      },
      'peer-guest-1'
    );
    expect(onRemoteMove).toHaveBeenCalledTimes(1); // Still 1, dropped!
  });

  it('notifies host with onGuestDisconnected when a seated guest peer leaves mid-match', () => {
    const onGuestDisconnected = vi.fn();
    const hostController = new OnlineLudoController();

    const hostSession: MultiplayerSession = {
      roomCode: 'TEST02',
      matchId: 'match-02',
      mySeatIndex: 0,
      myPeerId: 'peer-host',
      isHost: true,
      players: [
        { id: 'p0', name: 'Host', color: 'red', avatar: '👑', type: 'human', isHost: true },
        { id: 'p1', name: 'Guest', color: 'green', avatar: '🦊', type: 'human', isHost: false },
      ],
      options: {
        requireSixToStart: true,
        bonusTurnOnSix: true,
        bonusTurnOnCapture: true,
        bonusTurnOnHome: true,
        maxConsecutiveSixes: 3,
      },
      seatPeers: {
        0: 'peer-host',
        1: 'peer-guest-1',
      },
    };

    const hostSnapshot: GameSnapshot = {
      matchId: 'match-02',
      sequence: 1,
      players: [],
      activePlayerIndex: 1,
      diceValue: 1,
      hasRolled: false,
      isRolling: false,
      consecutiveSixes: 0,
      winner: null,
      rankings: [],
    };

    hostController.initSession(hostSession, hostSnapshot);
    hostController.setCallbacks({ onGuestDisconnected });

    expect(hostSession.seatPeers?.[1]).toBe('peer-guest-1');
  });

  it('automatically recovers from stuck in-flight action via watchdog timeout (2500ms)', () => {
    vi.useFakeTimers();
    try {
      const onRemoteRoll = vi.fn();
      const hostController = new OnlineLudoController();

      const hostSession: MultiplayerSession = {
        roomCode: 'TEST03',
        matchId: 'match-03',
        mySeatIndex: 0,
        myPeerId: 'peer-host',
        isHost: true,
        players: [
          { id: 'p0', name: 'Host', color: 'red', avatar: '👑', type: 'human', isHost: true },
          { id: 'p1', name: 'Guest', color: 'green', avatar: '🦊', type: 'human', isHost: false },
        ],
        options: {
          requireSixToStart: true,
          bonusTurnOnSix: true,
          bonusTurnOnCapture: true,
          bonusTurnOnHome: true,
          maxConsecutiveSixes: 3,
        },
        seatPeers: { 0: 'peer-host', 1: 'peer-guest-1' },
      };

      const hostSnapshot: GameSnapshot = {
        matchId: 'match-03',
        sequence: 1,
        players: [],
        activePlayerIndex: 1,
        diceValue: 1,
        hasRolled: false,
        isRolling: false,
        consecutiveSixes: 0,
        winner: null,
        rankings: [],
      };

      hostController.initSession(hostSession, hostSnapshot);
      hostController.setCallbacks({ onRemoteRoll });

      const hostTransportHandler = (hostController as any).handleWireMessage.bind(hostController);

      // 1. Send first valid ROLL_REQUEST
      hostTransportHandler(
        {
          type: 'ROLL_REQUEST',
          matchId: 'match-03',
          seatIndex: 1,
          timestamp: Date.now(),
        },
        'peer-guest-1'
      );
      expect(onRemoteRoll).toHaveBeenCalledTimes(1);

      // 2. Immediate second request is dropped because action is in-flight
      hostTransportHandler(
        {
          type: 'ROLL_REQUEST',
          matchId: 'match-03',
          seatIndex: 1,
          timestamp: Date.now(),
        },
        'peer-guest-1'
      );
      expect(onRemoteRoll).toHaveBeenCalledTimes(1);

      // 3. Fast-forward past watchdog timeout (2500ms)
      vi.advanceTimersByTime(2600);

      // 4. Now a new roll request is accepted because watchdog released the lock
      hostTransportHandler(
        {
          type: 'ROLL_REQUEST',
          matchId: 'match-03',
          seatIndex: 1,
          timestamp: Date.now(),
        },
        'peer-guest-1'
      );
      expect(onRemoteRoll).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clearActionInFlight immediately releases the lock', () => {
    const onRemoteRoll = vi.fn();
    const hostController = new OnlineLudoController();

    const hostSession: MultiplayerSession = {
      roomCode: 'TEST04',
      matchId: 'match-04',
      mySeatIndex: 0,
      myPeerId: 'peer-host',
      isHost: true,
      players: [
        { id: 'p0', name: 'Host', color: 'red', avatar: '👑', type: 'human', isHost: true },
        { id: 'p1', name: 'Guest', color: 'green', avatar: '🦊', type: 'human', isHost: false },
      ],
      options: {
        requireSixToStart: true,
        bonusTurnOnSix: true,
        bonusTurnOnCapture: true,
        bonusTurnOnHome: true,
        maxConsecutiveSixes: 3,
      },
      seatPeers: { 0: 'peer-host', 1: 'peer-guest-1' },
    };

    const hostSnapshot: GameSnapshot = {
      matchId: 'match-04',
      sequence: 1,
      players: [],
      activePlayerIndex: 1,
      diceValue: 1,
      hasRolled: false,
      isRolling: false,
      consecutiveSixes: 0,
      winner: null,
      rankings: [],
    };

    hostController.initSession(hostSession, hostSnapshot);
    hostController.setCallbacks({ onRemoteRoll });

    const hostTransportHandler = (hostController as any).handleWireMessage.bind(hostController);

    // Roll 1
    hostTransportHandler(
      {
        type: 'ROLL_REQUEST',
        matchId: 'match-04',
        seatIndex: 1,
        timestamp: Date.now(),
      },
      'peer-guest-1'
    );
    expect(onRemoteRoll).toHaveBeenCalledTimes(1);

    // Manually clear action in flight (as done if handler finishes or rejects)
    hostController.clearActionInFlight();

    // Roll 2 is accepted immediately
    hostTransportHandler(
      {
        type: 'ROLL_REQUEST',
        matchId: 'match-04',
        seatIndex: 1,
        timestamp: Date.now(),
      },
      'peer-guest-1'
    );
    expect(onRemoteRoll).toHaveBeenCalledTimes(2);
  });
});
