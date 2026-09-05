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
import { PlayerConfig, BotDifficulty } from '../types/game';
import { LudoGameOptions } from '../types/ludo';
import { peerTransport } from './peerService';

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
      kind: 'human',
      peerId: hostPeerId,
      name: sanitizedName,
      avatar: sanitizedAvatar,
      color: SEAT_COLORS[0], // 'red'
      isHost: true,
      isReady: true,
      connectedAt: Date.now(),
    };

    this.sequence = 1;
    peerTransport.isHost = true;
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

    const sanitizedName = (req.name.trim() || `Player ${seatIndex + 1}`).slice(0, 16);
    const sanitizedAvatar = req.avatar || '🤖';

    const newSeat: LobbySeat = {
      seatIndex,
      kind: 'human',
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

  /**
   * Host adds an AI bot to an empty seat (1, 2, or 3)
   */
  public addBot(seatIndex: number, difficulty: BotDifficulty = 'medium'): boolean {
    if (!peerTransport.isHost) return false;
    if (this.state.status !== 'waiting') return false;
    if (seatIndex <= 0 || seatIndex >= 4) return false;
    if (this.state.seats[seatIndex] !== null) return false;

    const BOT_NAMES = ['', 'Bot Ramesh', 'Bot Sita', 'Bot Bikram'];
    const BOT_AVATARS = ['', '🤖', '🦊', '🐲'];

    const botSeat: LobbySeat = {
      seatIndex,
      kind: 'bot',
      peerId: `bot-seat-${seatIndex}`,
      name: BOT_NAMES[seatIndex] || `Bot ${seatIndex + 1}`,
      avatar: BOT_AVATARS[seatIndex] || '🤖',
      color: SEAT_COLORS[seatIndex],
      isHost: false,
      isReady: true,
      connectedAt: Date.now(),
      difficulty,
    };

    const newSeats = [...this.state.seats];
    newSeats[seatIndex] = botSeat;
    this.state = {
      ...this.state,
      seats: newSeats,
      playerCount: newSeats.filter((s) => s !== null).length,
    };

    this.broadcastLobbyState();
    this.notifyUpdate();
    return true;
  }

  /**
   * Host removes a bot from a seat (1, 2, or 3)
   */
  public removeBot(seatIndex: number): boolean {
    if (!peerTransport.isHost) return false;
    if (this.state.status !== 'waiting') return false;
    if (seatIndex <= 0 || seatIndex >= 4) return false;
    const seat = this.state.seats[seatIndex];
    if (!seat || seat.kind !== 'bot') return false;

    const newSeats = [...this.state.seats];
    newSeats[seatIndex] = null;
    this.state = {
      ...this.state,
      seats: newSeats,
      playerCount: newSeats.filter((s) => s !== null).length,
    };

    this.broadcastLobbyState();
    this.notifyUpdate();
    return true;
  }

  public canStart(): boolean {
    if (!peerTransport.isHost) return false;
    const totalCount = this.state.seats.filter((s) => s !== null).length;
    const humanCount = this.state.seats.filter((s) => s && s.kind === 'human').length;
    return totalCount >= 2 && totalCount <= 4 && humanCount >= 1 && this.state.status === 'waiting';
  }

  /**
   * Host starts the online match
   */
  public startMatch(options: LudoGameOptions): { session: MultiplayerSession; initialSnapshot: GameSnapshot } | null {
    if (!peerTransport.isHost) return null;
    if (!this.canStart()) return null;

    this.state.status = 'in_game';
    const matchId = `match-${this.state.roomCode}-${Date.now()}`;

    // Convert occupied seats to PlayerConfig list in ascending lobby seat order (0, 1, 2, 3)
    const activeSeats = this.state.seats.filter((s): s is LobbySeat => s !== null);
    const seatPeers: Record<number, string> = {};
    activeSeats.forEach((seat, index) => {
      if (seat.kind === 'human') {
        seatPeers[index] = seat.peerId;
      }
    });

    const players: PlayerConfig[] = activeSeats.map((seat, index) => ({
      id: seat.kind === 'human' ? `online-${index}-${seat.peerId.slice(-4)}` : `online-bot-${index}`,
      name: seat.name,
      avatar: seat.avatar,
      color: seat.color,
      type: seat.kind === 'bot' ? ('bot' as const) : ('human' as const),
      difficulty: seat.difficulty,
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

    // Notify all human guests to launch the match
    activeSeats.forEach((seat, index) => {
      if (!seat.isHost && seat.kind === 'human') {
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
    peerTransport.isHost = false;
    this.notifyUpdate();
  }
}

export const lobbyController = new LobbyController();
