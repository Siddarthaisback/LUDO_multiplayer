import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateRoomCode,
  normalizeRoomCode,
  LobbyState,
  MultiplayerSession,
  GameSnapshot,
  PROTOCOL_VERSION,
  WireMessage,
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
      seatPeers: {
        0: 'peer-host',
        1: 'peer-guest',
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

    // 2c. Malformed forceSix (non-boolean) -> safely normalized to false without blocking or rejecting
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
    expect(onRemoteRoll).toHaveBeenCalledTimes(3);
    expect(onRemoteRoll).toHaveBeenLastCalledWith(0, 1, false);

    // Reset in-flight by broadcasting snapshot
    hostController.broadcastSnapshot({
      ...hostSnapshot,
      hasRolled: false,
    });

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
    expect(onRemoteRoll).toHaveBeenCalledTimes(4);

    hostTransportHandler(
      {
        type: 'ROLL_REQUEST',
        matchId: 'match-01',
        seatIndex: 1,
        timestamp: Date.now(),
      },
      'peer-guest-1'
    );
    expect(onRemoteRoll).toHaveBeenCalledTimes(4); // Still 4, dropped!

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

  it('enforces authoritative seat ownership and rejects unverified sender', () => {
    const onRemoteRoll = vi.fn();
    const hostController = new OnlineLudoController();

    const hostSession: MultiplayerSession = {
      roomCode: 'VERIFY01',
      matchId: 'match-verify-01',
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
      seatPeers: { 0: 'peer-host', 1: 'peer-guest-9999' },
    };

    const hostSnapshot: GameSnapshot = {
      matchId: 'match-verify-01',
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

    // Impostor rejected
    hostTransportHandler(
      {
        type: 'ROLL_REQUEST',
        matchId: 'match-verify-01',
        seatIndex: 1,
        timestamp: Date.now(),
      },
      'peer-impostor-1111'
    );
    expect(onRemoteRoll).not.toHaveBeenCalled();

    // Authoritative bound peer accepted
    hostTransportHandler(
      {
        type: 'ROLL_REQUEST',
        matchId: 'match-verify-01',
        seatIndex: 1,
        timestamp: Date.now(),
      },
      'peer-guest-9999'
    );
    expect(onRemoteRoll).toHaveBeenCalledTimes(1);
  });

  it('accepts GAME_STATE updates only when sequence > lastSequence on guest', () => {
    const onStateSnapshot = vi.fn();
    const guestController = new OnlineLudoController();

    const guestSession: MultiplayerSession = {
      roomCode: 'SEQ01',
      matchId: 'match-seq-01',
      mySeatIndex: 1,
      myPeerId: 'peer-guest',
      isHost: false,
      players: [],
      options: {} as any,
    };

    const initialSnapshot: GameSnapshot = {
      matchId: 'match-seq-01',
      sequence: 2,
      players: [],
      activePlayerIndex: 0,
      diceValue: 1,
      hasRolled: false,
      isRolling: false,
      consecutiveSixes: 0,
      winner: null,
      rankings: [],
    };

    guestController.initSession(guestSession, initialSnapshot);
    guestController.setCallbacks({ onStateSnapshot });

    const guestHandler = (guestController as any).handleWireMessage.bind(guestController);

    // Sequence 2 (equal sequence) is dropped
    guestHandler(
      {
        type: 'GAME_STATE',
        matchId: 'match-seq-01',
        sequence: 2,
        snapshot: { ...initialSnapshot, isRolling: true },
      },
      'peer-host'
    );
    expect(onStateSnapshot).not.toHaveBeenCalled();

    // Sequence 3 (newer sequence update) is accepted
    guestHandler(
      {
        type: 'GAME_STATE',
        matchId: 'match-seq-01',
        sequence: 3,
        snapshot: { ...initialSnapshot, isRolling: false, hasRolled: true, diceValue: 4 },
      },
      'peer-host'
    );
    expect(onStateSnapshot).toHaveBeenCalledTimes(1);

    // Stale sequence 1 is dropped
    guestHandler(
      {
        type: 'GAME_STATE',
        matchId: 'match-seq-01',
        sequence: 1,
        snapshot: { ...initialSnapshot, diceValue: 1 },
      },
      'peer-host'
    );
    expect(onStateSnapshot).toHaveBeenCalledTimes(1);
  });

  it('sends ACTION_REJECTED to sender on illegal move request and invokes onRemoteActionRejected on guest', () => {
    const sendToPeerSpy = vi.spyOn(peerTransport, 'sendToPeer').mockReturnValue(true);
    const hostController = new OnlineLudoController();

    const hostSession: MultiplayerSession = {
      roomCode: 'REJ01',
      matchId: 'match-rej-01',
      mySeatIndex: 0,
      myPeerId: 'peer-host',
      isHost: true,
      players: [],
      options: {} as any,
      seatPeers: { 0: 'peer-host', 1: 'peer-guest-1' },
    };

    const activeSnapshot: GameSnapshot = {
      matchId: 'match-rej-01',
      sequence: 1,
      players: [
        {
          config: { id: 'p0', name: 'Host', color: 'red', type: 'human', avatar: '👑', isHost: true },
          tokens: [{ id: 0, color: 'red', step: -1, status: 'yard', trackIndex: -1 }],
          tokensHome: 0,
          tokensCaptured: 0,
          tokensLost: 0,
        },
        {
          config: { id: 'p1', name: 'Guest', color: 'green', type: 'human', avatar: '🦊' },
          tokens: [{ id: 0, color: 'green', step: 0, status: 'track', trackIndex: 13 }],
          tokensHome: 0,
          tokensCaptured: 0,
          tokensLost: 0,
        },
      ],
      activePlayerIndex: 0, // Host's turn, not Guest's!
      diceValue: 6,
      hasRolled: true,
      isRolling: false,
      consecutiveSixes: 0,
      winner: null,
      rankings: [],
    };

    hostController.initSession(hostSession, activeSnapshot);
    const hostHandler = (hostController as any).handleWireMessage.bind(hostController);

    // Guest sends MOVE_REQUEST during Host's turn
    hostHandler(
      {
        type: 'MOVE_REQUEST',
        matchId: 'match-rej-01',
        seatIndex: 1,
        tokenId: 0,
        timestamp: Date.now(),
      },
      'peer-guest-1'
    );

    // Host should send ACTION_REJECTED to guest peer
    expect(sendToPeerSpy).toHaveBeenCalledWith(
      'peer-guest-1',
      expect.objectContaining({
        type: 'ACTION_REJECTED',
        actionType: 'MOVE',
        seatIndex: 1,
        reason: 'Not your turn',
      })
    );

    // Verify Guest handles ACTION_REJECTED
    const onRemoteActionRejected = vi.fn();
    const guestController = new OnlineLudoController();
    guestController.initSession(
      { ...hostSession, mySeatIndex: 1, myPeerId: 'peer-guest-1', isHost: false },
      activeSnapshot
    );
    guestController.setCallbacks({ onRemoteActionRejected });

    const guestHandler = (guestController as any).handleWireMessage.bind(guestController);
    guestHandler(
      {
        type: 'ACTION_REJECTED',
        matchId: 'match-rej-01',
        actionType: 'MOVE',
        seatIndex: 1,
        reason: 'Not your turn',
      },
      'peer-host'
    );

    expect(onRemoteActionRejected).toHaveBeenCalledWith('MOVE', 'Not your turn');

    // Verify untrusted sender is dropped
    onRemoteActionRejected.mockClear();
    guestHandler(
      {
        type: 'ACTION_REJECTED',
        matchId: 'match-rej-01',
        actionType: 'MOVE',
        seatIndex: 1,
        reason: 'Spoofed rejection',
      },
      'peer-impostor-attacker'
    );
    expect(onRemoteActionRejected).not.toHaveBeenCalled();

    sendToPeerSpy.mockRestore();
  });

  it('broadcasts TOKEN_MOVE on host and validates/deduplicates TOKEN_MOVE on guest', () => {
    const hostBroadcastSpy = vi.spyOn(peerTransport, 'broadcastFromHost').mockImplementation(() => {});

    const testSession: MultiplayerSession = {
      matchId: 'match-anim-01',
      myPeerId: 'peer-host',
      mySeatIndex: 0,
      isHost: true,
      roomCode: 'ANIM01',
      players: [
        { id: 'p1', name: 'Host', color: 'red', avatar: '👑', type: 'human' },
        { id: 'p2', name: 'Guest', color: 'green', avatar: '🎮', type: 'human' },
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

    const testSnapshot: GameSnapshot = {
      matchId: 'match-anim-01',
      sequence: 5,
      players: [],
      activePlayerIndex: 1,
      diceValue: 6,
      hasRolled: true,
      isRolling: false,
      consecutiveSixes: 0,
      winner: null,
      rankings: [],
    };

    // 1. Host broadcastTokenMove
    const hostController = new OnlineLudoController();
    hostController.initSession(testSession, testSnapshot);

    const moveId = hostController.broadcastTokenMove(1, 0, -1, 0);
    expect(moveId).toBeTruthy();
    expect(hostBroadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'TOKEN_MOVE',
        matchId: 'match-anim-01',
        moveId,
        seatIndex: 1,
        tokenId: 0,
        fromStep: -1,
        toStep: 0,
        baseRevision: 5,
      })
    );

    // 2. Guest receives valid TOKEN_MOVE from host
    const onRemoteTokenMove = vi.fn();
    const guestController = new OnlineLudoController();
    guestController.initSession(
      { ...testSession, isHost: false, mySeatIndex: 1, myPeerId: 'peer-guest-1' },
      testSnapshot
    );
    guestController.setCallbacks({ onRemoteTokenMove });

    const guestWireHandler = (guestController as any).handleWireMessage.bind(guestController);

    guestWireHandler(
      {
        type: 'TOKEN_MOVE',
        matchId: 'match-anim-01',
        moveId: 'move-test-100',
        seatIndex: 1,
        tokenId: 0,
        fromStep: -1,
        toStep: 0,
        baseRevision: 5,
      },
      'peer-host'
    );

    expect(onRemoteTokenMove).toHaveBeenCalledTimes(1);
    expect(onRemoteTokenMove).toHaveBeenCalledWith({
      moveId: 'move-test-100',
      seatIndex: 1,
      tokenId: 0,
      fromStep: -1,
      toStep: 0,
      baseRevision: 5,
    });

    // 3. Duplicate moveId suppression on guest
    guestWireHandler(
      {
        type: 'TOKEN_MOVE',
        matchId: 'match-anim-01',
        moveId: 'move-test-100',
        seatIndex: 1,
        tokenId: 0,
        fromStep: -1,
        toStep: 0,
        baseRevision: 5,
      },
      'peer-host'
    );
    expect(onRemoteTokenMove).toHaveBeenCalledTimes(1); // Still 1, dropped duplicate

    // 4. Unauthorized sender dropped
    guestWireHandler(
      {
        type: 'TOKEN_MOVE',
        matchId: 'match-anim-01',
        moveId: 'move-test-101',
        seatIndex: 1,
        tokenId: 0,
        fromStep: -1,
        toStep: 0,
        baseRevision: 5,
      },
      'peer-unauthorized-imposter'
    );
    expect(onRemoteTokenMove).toHaveBeenCalledTimes(1); // Still 1, dropped unauthorized

    // 5. Match ID mismatch dropped
    guestWireHandler(
      {
        type: 'TOKEN_MOVE',
        matchId: 'wrong-match-999',
        moveId: 'move-test-102',
        seatIndex: 1,
        tokenId: 0,
        fromStep: -1,
        toStep: 0,
        baseRevision: 5,
      },
      'peer-host'
    );
    expect(onRemoteTokenMove).toHaveBeenCalledTimes(1); // Still 1, dropped wrong match

    // 6. Malformed payload dropped (invalid seat index)
    guestWireHandler(
      {
        type: 'TOKEN_MOVE',
        matchId: 'match-anim-01',
        moveId: 'move-test-103',
        seatIndex: 99, // Invalid seat index
        tokenId: 0,
        fromStep: -1,
        toStep: 0,
        baseRevision: 5,
      },
      'peer-host'
    );
    expect(onRemoteTokenMove).toHaveBeenCalledTimes(1); // Dropped malformed seat

    // 7. Malformed payload: empty moveId
    guestWireHandler(
      {
        type: 'TOKEN_MOVE',
        matchId: 'match-anim-01',
        moveId: '',
        seatIndex: 1,
        tokenId: 0,
        fromStep: -1,
        toStep: 0,
        baseRevision: 5,
      },
      'peer-host'
    );
    expect(onRemoteTokenMove).toHaveBeenCalledTimes(1); // Dropped empty moveId

    // 7b. Malformed payload: whitespace-only moveId
    guestWireHandler(
      {
        type: 'TOKEN_MOVE',
        matchId: 'match-anim-01',
        moveId: '   \t  ',
        seatIndex: 1,
        tokenId: 0,
        fromStep: -1,
        toStep: 0,
        baseRevision: 5,
      },
      'peer-host'
    );
    expect(onRemoteTokenMove).toHaveBeenCalledTimes(1); // Dropped whitespace-only moveId

    // 8. Malformed payload: invalid step ordering / range (fromStep 10, toStep 5)
    guestWireHandler(
      {
        type: 'TOKEN_MOVE',
        matchId: 'match-anim-01',
        moveId: 'move-test-104',
        seatIndex: 1,
        tokenId: 0,
        fromStep: 10,
        toStep: 5, // Backwards
        baseRevision: 5,
      },
      'peer-host'
    );
    expect(onRemoteTokenMove).toHaveBeenCalledTimes(1); // Dropped backwards step

    // 9. Malformed payload: hop > 6 steps
    guestWireHandler(
      {
        type: 'TOKEN_MOVE',
        matchId: 'match-anim-01',
        moveId: 'move-test-105',
        seatIndex: 1,
        tokenId: 0,
        fromStep: 10,
        toStep: 18, // 8 steps > 6
        baseRevision: 5,
      },
      'peer-host'
    );
    expect(onRemoteTokenMove).toHaveBeenCalledTimes(1); // Dropped hop > 6

    // 10. Malformed payload: out-of-range baseRevision when sequence is 5 (max 55)
    guestWireHandler(
      {
        type: 'TOKEN_MOVE',
        matchId: 'match-anim-01',
        moveId: 'move-test-106',
        seatIndex: 1,
        tokenId: 0,
        fromStep: 0,
        toStep: 4,
        baseRevision: 999, // Wildly out of range (> lastSequence + 50)
      },
      'peer-host'
    );
    expect(onRemoteTokenMove).toHaveBeenCalledTimes(1); // Dropped out of bounds revision

    // 11. Malformed payload: out-of-range baseRevision when sequence is 0 (max 50)
    const guestSeqZeroController = new OnlineLudoController();
    guestSeqZeroController.initSession(
      { ...testSession, isHost: false, mySeatIndex: 1, myPeerId: 'peer-guest-1' },
      { ...testSnapshot, sequence: 0 }
    );
    const onSeqZeroTokenMove = vi.fn();
    guestSeqZeroController.setCallbacks({ onRemoteTokenMove: onSeqZeroTokenMove });
    const guestSeqZeroWireHandler = (guestSeqZeroController as any).handleWireMessage.bind(guestSeqZeroController);

    guestSeqZeroWireHandler(
      {
        type: 'TOKEN_MOVE',
        matchId: 'match-anim-01',
        moveId: 'move-test-107',
        seatIndex: 1,
        tokenId: 0,
        fromStep: 0,
        toStep: 4,
        baseRevision: 999, // Out of bounds even when lastSequence === 0
      },
      'peer-host'
    );
    expect(onSeqZeroTokenMove).not.toHaveBeenCalled(); // Dropped unbounded revision on seq 0

    // 12. True LRU recency promotion and single-overflow eviction test
    const lruController = new OnlineLudoController();
    lruController.initSession(
      { ...testSession, isHost: false, mySeatIndex: 1, myPeerId: 'peer-guest-1' },
      testSnapshot
    );
    const lruWireHandler = (lruController as any).handleWireMessage.bind(lruController);

    // Add move-oldest (initial LRU), then move-second
    lruWireHandler(
      {
        type: 'TOKEN_MOVE',
        matchId: 'match-anim-01',
        moveId: 'move-oldest',
        seatIndex: 1,
        tokenId: 0,
        fromStep: 0,
        toStep: 1,
        baseRevision: 5,
      },
      'peer-host'
    );
    lruWireHandler(
      {
        type: 'TOKEN_MOVE',
        matchId: 'match-anim-01',
        moveId: 'move-second',
        seatIndex: 1,
        tokenId: 0,
        fromStep: 0,
        toStep: 1,
        baseRevision: 5,
      },
      'peer-host'
    );

    // Fill up to capacity (200 total items: move-oldest, move-second, and 198 fill items)
    for (let i = 3; i <= 200; i++) {
      lruWireHandler(
        {
          type: 'TOKEN_MOVE',
          matchId: 'match-anim-01',
          moveId: `move-fill-${i}`,
          seatIndex: 1,
          tokenId: 0,
          fromStep: 0,
          toStep: 1,
          baseRevision: 5,
        },
        'peer-host'
      );
    }

    const lruSet = (lruController as any).processedMoveIds as Set<string>;
    expect(lruSet.size).toBe(200);
    expect(lruSet.has('move-oldest')).toBe(true);
    expect(lruSet.has('move-second')).toBe(true);

    // Re-access move-oldest: duplicate hit MUST promote it to MRU (end of Set)
    lruWireHandler(
      {
        type: 'TOKEN_MOVE',
        matchId: 'match-anim-01',
        moveId: 'move-oldest',
        seatIndex: 1,
        tokenId: 0,
        fromStep: 0,
        toStep: 1,
        baseRevision: 5,
      },
      'peer-host'
    );

    // Send single overflow item (201st unique move)
    lruWireHandler(
      {
        type: 'TOKEN_MOVE',
        matchId: 'match-anim-01',
        moveId: 'move-overflow-201',
        seatIndex: 1,
        tokenId: 0,
        fromStep: 0,
        toStep: 1,
        baseRevision: 5,
      },
      'peer-host'
    );

    expect(lruSet.size).toBe(200);
    // move-second was NOT refreshed, so it was the true LRU and was evicted!
    expect(lruSet.has('move-second')).toBe(false);
    // move-oldest WAS refreshed, so it was promoted to MRU and survives!
    expect(lruSet.has('move-oldest')).toBe(true);
    // new overflow item is present
    expect(lruSet.has('move-overflow-201')).toBe(true);

    hostBroadcastSpy.mockRestore();
  });

  it('broadcasts and triggers onChatEmote callback upon CHAT_EMOTE messages', () => {
    const onChatEmote = vi.fn();
    const chatController = new OnlineLudoController();
    const sendToHostSpy = vi.spyOn(peerTransport, 'sendToHost').mockImplementation(() => true);
    const broadcastSpy = vi.spyOn(peerTransport, 'broadcastFromHost').mockImplementation(() => {});

    chatController.initSession(mockSession, mockSnapshot);
    chatController.setCallbacks({ onChatEmote });

    // Guest sends emote
    chatController.sendChatEmote('Guest', 'Chito chal yar! ⏳', '😂');
    expect(sendToHostSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CHAT_EMOTE',
        senderName: 'Guest',
        message: 'Chito chal yar! ⏳',
        emoji: '😂',
        seatIndex: 1,
      })
    );
    expect(onChatEmote).toHaveBeenCalledWith({
      seatIndex: 1,
      senderName: 'Guest',
      message: 'Chito chal yar! ⏳',
      emoji: '😂',
    });

    // Test host relay
    let wireHandler: (msg: WireMessage, senderPeerId: string) => void = () => {};
    vi.spyOn(peerTransport, 'setHandlers').mockImplementation((handlers) => {
      if (handlers.onMessage) wireHandler = handlers.onMessage;
    });

    const hostController = new OnlineLudoController();
    const hostChatEmote = vi.fn();
    hostController.initSession(
      {
        ...mockSession,
        isHost: true,
        mySeatIndex: 0,
        myPeerId: 'peer-host',
        seatPeers: { 0: 'peer-host', 1: 'peer-guest' },
      },
      mockSnapshot
    );
    hostController.setCallbacks({ onChatEmote: hostChatEmote });

    // 1. Imposter peer tries to send emote for seat 1 -> MUST BE REJECTED
    wireHandler(
      {
        type: 'CHAT_EMOTE',
        matchId: 'match-01',
        seatIndex: 1,
        senderName: 'Imposter',
        message: 'Hacked!',
        timestamp: Date.now(),
      },
      'peer-imposter-evil'
    );
    expect(broadcastSpy).not.toHaveBeenCalled();
    expect(hostChatEmote).not.toHaveBeenCalled();

    // 2. Malformed payload (e.g. object as message or out-of-range seat) -> MUST BE REJECTED
    wireHandler(
      {
        type: 'CHAT_EMOTE',
        matchId: 'match-01',
        seatIndex: 99 as any,
        senderName: 'Guest',
        message: 'Invalid seat',
        timestamp: Date.now(),
      },
      'peer-guest'
    );
    expect(broadcastSpy).not.toHaveBeenCalled();

    // 3. Authorized sender sends valid emote -> ACCEPTED AND RELAYED
    wireHandler(
      {
        type: 'CHAT_EMOTE',
        matchId: 'match-01',
        seatIndex: 1,
        senderName: 'Guest',
        message: 'Aba marxa! 🎯',
        emoji: '🔥',
        timestamp: Date.now(),
      },
      'peer-guest'
    );

    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CHAT_EMOTE',
        message: 'Aba marxa! 🎯',
        emoji: '🔥',
      })
    );
    expect(hostChatEmote).toHaveBeenCalledWith({
      seatIndex: 1,
      senderName: 'Guest',
      message: 'Aba marxa! 🎯',
      emoji: '🔥',
    });

    // 4. Verify guest deduplication: when guest receives broadcast of their own emote, onChatEmote is NOT triggered again
    (chatController as any).handleWireMessage(
      {
        type: 'CHAT_EMOTE',
        id: 'msg-01',
        matchId: 'match-01',
        seatIndex: 1, // matches guest mySeatIndex
        senderName: 'Guest',
        message: 'Chito chal yar! ⏳',
        emoji: '😂',
        timestamp: Date.now(),
      },
      'peer-host'
    );
    expect(onChatEmote).toHaveBeenCalledTimes(1); // Exactly 1 (no duplicate echo)

    sendToHostSpy.mockRestore();
    broadcastSpy.mockRestore();
  });
});

