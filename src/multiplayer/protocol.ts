import { PlayerColor, PlayerConfig, BotDifficulty } from '../types/game';
import { LudoPlayerState, LudoGameOptions } from '../types/ludo';

export const PROTOCOL_VERSION = '1.2.0';

export const SEAT_COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

export interface LobbySeat {
  seatIndex: number; // 0 = Host (Red), 1 = Green, 2 = Yellow, 3 = Blue
  kind: 'human' | 'bot';
  peerId: string;
  name: string;
  avatar: string;
  color: PlayerColor;
  isHost: boolean;
  isReady: boolean;
  connectedAt: number;
  difficulty?: BotDifficulty;
}

export interface LobbyState {
  roomCode: string;
  hostPeerId: string;
  status: 'waiting' | 'starting' | 'in_game';
  seats: (LobbySeat | null)[]; // exactly 4 slots
  playerCount: number;
}

export interface GameSnapshot {
  matchId: string;
  sequence: number;
  players: LudoPlayerState[];
  activePlayerIndex: number;
  diceValue: number;
  hasRolled: boolean;
  isRolling: boolean;
  consecutiveSixes: number;
  winner: PlayerConfig | null;
  rankings: { player: PlayerConfig; rank: number; stats?: string }[];
  lastAction?: {
    type: 'ROLL' | 'MOVE' | 'PASS' | 'START';
    playerIndex: number;
    details?: string;
  };
}

export interface MultiplayerSession {
  roomCode: string;
  matchId: string;
  mySeatIndex: number;
  myPeerId: string;
  isHost: boolean;
  players: PlayerConfig[];
  options: LudoGameOptions;
  seatPeers?: Record<number, string>;
}

// Wire Messages from Client -> Host or Host -> Clients
export type WireMessage =
  // Lobby Handshake
  | {
      type: 'JOIN_REQUEST';
      protocolVersion: string;
      name: string;
      avatar: string;
      roomCode: string;
    }
  | {
      type: 'JOIN_RESPONSE';
      success: boolean;
      seatIndex?: number;
      error?: string;
      roomCode: string;
    }
  | {
      type: 'LOBBY_STATE';
      state: LobbyState;
      sequence: number;
    }
  | {
      type: 'START_MATCH';
      session: MultiplayerSession;
      initialSnapshot: GameSnapshot;
    }
  | {
      type: 'PLAYER_LEAVE';
      seatIndex: number;
      peerId: string;
    }
  | {
      type: 'ERROR';
      code: 'ROOM_FULL' | 'GAME_ALREADY_STARTED' | 'INVALID_CODE' | 'PROTOCOL_MISMATCH' | 'GENERAL';
      message: string;
    }
  | {
      type: 'ROLL_REQUEST';
      matchId: string;
      seatIndex: number;
      forceSix?: boolean;
      desiredRoll?: number;
      timestamp: number;
    }
  | {
      type: 'MOVE_REQUEST';
      matchId: string;
      seatIndex: number;
      tokenId: number;
      timestamp: number;
    }
  | {
      type: 'GAME_STATE';
      matchId: string;
      sequence: number;
      snapshot: GameSnapshot;
    }
  | {
      type: 'REMATCH_REQUEST';
      matchId: string;
      seatIndex: number;
    }
  | {
      type: 'HOST_DISCONNECTED';
      message: string;
    }
  | {
      type: 'TOKEN_MOVE';
      matchId: string;
      moveId: string;
      seatIndex: number;
      tokenId: number;
      fromStep: number;
      toStep: number;
      baseRevision: number;
    }
  | {
      type: 'ACTION_REJECTED';
      matchId: string;
      actionType: 'ROLL' | 'MOVE';
      seatIndex: number;
      reason: string;
    };

export function normalizeRoomCode(raw: string): string {
  if (!raw) return '';
  // If user pasted a full URL or query string with ?room= or &room=
  if (raw.includes('room=')) {
    const match = raw.match(/[?&]room=([a-zA-Z0-9_-]+)/i);
    if (match && match[1]) {
      return match[1].replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
    }
  }
  // Extract alphanumeric uppercase 6-char code
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit ambiguous I, O, 1, 0
  const randomBytes = new Uint8Array(6);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 6; i++) randomBytes[i] = Math.floor(Math.random() * 256);
  }
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[randomBytes[i] % chars.length];
  }
  return code;
}
