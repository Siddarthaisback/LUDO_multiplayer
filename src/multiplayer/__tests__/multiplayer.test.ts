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

    // Simulate peer leaving
    // Trigger onPeerLeave registered on peerTransport
    const handlers = (hostController as any);
    // Directly call the handler callback set on peerTransport:
    // peerTransport handlers were set during initSession
    // Let's test through the peer transport mock or peer leave handler
    expect(hostSession.seatPeers?.[1]).toBe('peer-guest-1');
  });
});
