import {
  LobbySeat,
  LobbyState,
  SEAT_COLORS,
  WireMessage,
  MultiplayerSession,
  GameSnapshot,
  PROTOCOL_VERSION,
  normalizeRoomCode,
} from './protocol';
import { PlayerConfig } from '../types/game';
import { LudoGameOptions } from '../types/ludo';
import { peerTransport } from './peerService';
import { HUMAN_NAME_POOL } from '../utils/constants';

export class LobbyController {
  private state: LobbyState = {
    roomCode: '',
    hostPeerId: '',
    status: 'waiting',
    seats: [null, null, null, null],
    playerCount: 0,
  };

  private sequence: number = 0;
  private onStateUpdateCb?: (state: LobbyState) => void;
  private onStartMatchCb?: (session: MultiplayerSession, initialSnapshot: GameSnapshot) => void;

  public subscribe(
    onStateUpdate: (state: LobbyState) => void,
    onStartMatch?: (session: MultiplayerSession, initialSnapshot: GameSnapshot) => void
  ) {
    this.onStateUpdateCb = onStateUpdate;
    this.onStartMatchCb = onStartMatch;
  }

  public getState(): LobbyState {
    return { ...this.state, seats: [...this.state.seats] };
  }

  /**
   * Host initializes a fresh lobby
   */
  public initHostLobby(roomCode: string, hostName: string, hostAvatar: string, hostPeerId: string): LobbyState {
    const sanitizedName = (hostName.trim() || 'Host').slice(0, 16);
    const sanitizedAvatar = hostAvatar || '👑';

    const hostSeat: LobbySeat = {
      seatIndex: 0,
      peerId: hostPeerId,
      name: sanitizedName,
      avatar: sanitizedAvatar,
      color: SEAT_COLORS[0], // 'red'
      isHost: true,
      isReady: true,
      connectedAt: Date.now(),
    };

    this.sequence = 1;
    this.state = {
      roomCode,
      hostPeerId,
      status: 'waiting',
      seats: [hostSeat, null, null, null],
      playerCount: 1,
    };

    this.notifyUpdate();
    return this.getState();
  }

  /**
   * Host handles incoming join request from a guest
   */
  public handleJoinRequest(
    senderPeerId: string,
    req: { name: string; avatar: string; roomCode: string; protocolVersion?: string }
  ) {
    // 1. Fail closed on protocol version: require exact match
    if (!req.protocolVersion || req.protocolVersion !== PROTOCOL_VERSION) {
      peerTransport.sendToPeer(senderPeerId, {
        type: 'ERROR',
        code: 'PROTOCOL_MISMATCH',
        message: `Version mismatch: Host is on v${PROTOCOL_VERSION}, but client reported ${req.protocolVersion || 'no version'}. Please refresh.`,
      });
      return;
    }

    // 2. Fail closed on room code: require matching normalized code
    const hostCode = normalizeRoomCode(this.state.roomCode);
    const guestCode = normalizeRoomCode(req.roomCode);
    if (!guestCode || !hostCode || guestCode !== hostCode) {
      peerTransport.sendToPeer(senderPeerId, {
        type: 'ERROR',
        code: 'INVALID_CODE',
        message: 'Invalid room code for this lobby.',
      });
      return;
    }

    if (this.state.status !== 'waiting') {
      peerTransport.sendToPeer(senderPeerId, {
        type: 'ERROR',
        code: 'GAME_ALREADY_STARTED',
        message: 'This match has already started!',
      });
      return;
    }

    if (this.state.playerCount >= 4) {
      peerTransport.sendToPeer(senderPeerId, {
        type: 'ERROR',
        code: 'ROOM_FULL',
        message: 'Room is full (max 4 players).',
      });
      return;
    }

    // Check if peer is already seated
    let seatIndex = this.state.seats.findIndex((s) => s?.peerId === senderPeerId);
    if (seatIndex === -1) {
      // Find lowest empty seat among 1, 2, 3
      seatIndex = this.state.seats.findIndex((s, idx) => idx > 0 && s === null);
    }

    if (seatIndex === -1 || seatIndex >= 4) {
      peerTransport.sendToPeer(senderPeerId, {
        type: 'ERROR',
        code: 'ROOM_FULL',
        message: 'No available seat for this match.',
      });
      return;
    }

    const fallbackName = HUMAN_NAME_POOL[seatIndex % HUMAN_NAME_POOL.length] || `Player ${seatIndex + 1}`;
    const sanitizedName = (req.name.trim() || fallbackName).slice(0, 16);
    const sanitizedAvatar = req.avatar || '🐼';

    const newSeat: LobbySeat = {
      seatIndex,
      peerId: senderPeerId,
      name: sanitizedName,
      avatar: sanitizedAvatar,
      color: SEAT_COLORS[seatIndex],
      isHost: false,
      isReady: true,
      connectedAt: Date.now(),
    };

    const newSeats = [...this.state.seats];
    newSeats[seatIndex] = newSeat;
    const newCount = newSeats.filter((s) => s !== null).length;

    this.state = {
      ...this.state,
      seats: newSeats,
      playerCount: newCount,
    };

    // Send JOIN_RESPONSE to the new guest
    peerTransport.sendToPeer(senderPeerId, {
      type: 'JOIN_RESPONSE',
      success: true,
      seatIndex,
      roomCode: this.state.roomCode,
    });

    this.broadcastLobbyState();
    this.notifyUpdate();
  }

  /**
   * Handles peer disconnect from lobby
   */
  public handlePeerLeave(peerId: string) {
    const seatIndex = this.state.seats.findIndex((s) => s?.peerId === peerId);
    if (seatIndex === -1) return;

    // If host leaves, room closes
    if (seatIndex === 0) {
      peerTransport.broadcastFromHost({
        type: 'HOST_DISCONNECTED',
        message: 'The room host has left the lobby.',
      });
      this.reset();
      return;
    }

    const newSeats = [...this.state.seats];
    newSeats[seatIndex] = null;
    const newCount = newSeats.filter((s) => s !== null).length;

    this.state = {
      ...this.state,
      seats: newSeats,
      playerCount: newCount,
    };

    this.broadcastLobbyState();
    this.notifyUpdate();
  }

  /**
   * Guest applies lobby state broadcast from host
   */
  public applyRemoteLobbyState(msgState: LobbyState, sequence: number) {
    if (sequence > this.sequence) {
      this.sequence = sequence;
      this.state = msgState;
      this.notifyUpdate();
    }
  }

  public canStart(): boolean {
    return this.state.playerCount >= 2 && this.state.status === 'waiting';
  }

  /**
   * Host starts the online match
   */
  public startMatch(options: LudoGameOptions): { session: MultiplayerSession; initialSnapshot: GameSnapshot } | null {
    if (!this.canStart()) return null;

    this.state.status = 'in_game';
    const matchId = `match-${this.state.roomCode}-${Date.now()}`;

    // Convert occupied seats to PlayerConfig list
    const activeSeats = this.state.seats.filter((s): s is LobbySeat => s !== null);
    const seatPeers: Record<number, string> = {};
    activeSeats.forEach((seat, index) => {
      seatPeers[index] = seat.peerId;
    });

    const players: PlayerConfig[] = activeSeats.map((seat, index) => ({
      id: `online-${index}-${seat.peerId.slice(-4)}`,
      name: seat.name,
      avatar: seat.avatar,
      color: seat.color,
      type: 'human' as const,
      isHost: seat.isHost,
    }));

    const session: MultiplayerSession = {
      roomCode: this.state.roomCode,
      matchId,
      mySeatIndex: 0, // Host is always seat 0
      myPeerId: this.state.hostPeerId,
      isHost: true,
      players,
      options,
      seatPeers,
    };

    // Initial Authoritative Game Snapshot
    const initialSnapshot: GameSnapshot = {
      matchId,
      sequence: 1,
      players: players.map((p) => ({
        config: p,
        tokens: [
          { id: 0, color: p.color, step: -1, status: 'yard', trackIndex: -1 },
          { id: 1, color: p.color, step: -1, status: 'yard', trackIndex: -1 },
          { id: 2, color: p.color, step: -1, status: 'yard', trackIndex: -1 },
          { id: 3, color: p.color, step: -1, status: 'yard', trackIndex: -1 },
        ],
        tokensHome: 0,
        tokensCaptured: 0,
        tokensLost: 0,
      })),
      activePlayerIndex: 0,
      diceValue: 1,
      hasRolled: false,
      isRolling: false,
      consecutiveSixes: 0,
      winner: null,
      rankings: [],
      lastAction: {
        type: 'START',
        playerIndex: 0,
        details: 'Match started by Host',
      },
    };

    // Notify all guests to launch the match
    activeSeats.forEach((seat, index) => {
      if (!seat.isHost) {
        const guestSession: MultiplayerSession = {
          ...session,
          mySeatIndex: index,
          myPeerId: seat.peerId,
          isHost: false,
        };
        peerTransport.sendToPeer(seat.peerId, {
          type: 'START_MATCH',
          session: guestSession,
          initialSnapshot,
        });
      }
    });

    this.onStartMatchCb?.(session, initialSnapshot);
    return { session, initialSnapshot };
  }

  private broadcastLobbyState() {
    this.sequence++;
    peerTransport.broadcastFromHost({
      type: 'LOBBY_STATE',
      state: this.state,
      sequence: this.sequence,
    });
  }

  private notifyUpdate() {
    this.onStateUpdateCb?.(this.getState());
  }

  public reset() {
    this.state = {
      roomCode: '',
      hostPeerId: '',
      status: 'waiting',
      seats: [null, null, null, null],
      playerCount: 0,
    };
    this.sequence = 0;
    this.notifyUpdate();
  }
}

export const lobbyController = new LobbyController();
