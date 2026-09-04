import { MultiplayerSession, GameSnapshot, WireMessage } from './protocol';
import { peerTransport } from './peerService';

export interface OnlineGameCallbacks {
  onRemoteRoll?: (rollValue: number, playerIndex: number, forceSix?: boolean) => void;
  onRemoteMove?: (tokenId: number, playerIndex: number) => void;
  onStateSnapshot?: (snapshot: GameSnapshot) => void;
  onHostDisconnected?: (message: string) => void;
  onGuestDisconnected?: (seatIndex: number, peerId: string) => void;
  onError?: (message: string) => void;
}

export class OnlineLudoController {
  private session: MultiplayerSession | null = null;
  private currentSnapshot: GameSnapshot | null = null;
  private lastSequence: number = 0;
  private isActionInFlight: boolean = false;
  private callbacks: OnlineGameCallbacks = {};

  public setCallbacks(cbs: OnlineGameCallbacks) {
    this.callbacks = cbs;
  }

  public initSession(session: MultiplayerSession, initialSnapshot: GameSnapshot) {
    this.session = session;
    this.currentSnapshot = initialSnapshot;
    this.lastSequence = initialSnapshot.sequence;
    this.isActionInFlight = false;

    // Listen for incoming network packets during gameplay
    peerTransport.setHandlers({
      onMessage: (msg: WireMessage, senderPeerId: string) => {
        this.handleWireMessage(msg, senderPeerId);
      },
      onPeerLeave: (peerId: string) => {
        if (!this.session?.isHost) {
          this.callbacks.onHostDisconnected?.('The room host has disconnected.');
        } else {
          // If a guest leaves during game, locate their seat and notify
          const seatEntry = Object.entries(this.session.seatPeers || {}).find(([_, pId]) => pId === peerId);
          if (seatEntry) {
            const seatIndex = Number(seatEntry[0]);
            console.warn(`[OnlineLudo] Guest at seat ${seatIndex} (${peerId}) disconnected.`);
            this.callbacks.onGuestDisconnected?.(seatIndex, peerId);
          }
        }
      },
      onStatusChange: (status, message) => {
        if (status === 'error') {
          this.callbacks.onError?.(message || 'Network transport error');
        }
      },
    });
  }

  public getSession(): MultiplayerSession | null {
    return this.session;
  }

  public isMyTurn(activePlayerIndex: number): boolean {
    if (!this.session) return true; // Offline match
    return this.session.mySeatIndex === activePlayerIndex;
  }

  /**
   * Called when local player clicks Roll Dice
   */
  public requestRoll(activePlayerIndex: number, forceSix: boolean = false): boolean {
    if (!this.session) return true;
    if (!this.isMyTurn(activePlayerIndex)) return false;

    if (this.session.isHost) {
      // Host generates authoritative roll locally and broadcasts
      return true;
    } else {
      // Guest sends roll request to host
      peerTransport.sendToHost({
        type: 'ROLL_REQUEST',
        matchId: this.session.matchId,
        seatIndex: this.session.mySeatIndex,
        forceSix: Boolean(forceSix),
        timestamp: Date.now(),
      });
      return false; // Wait for host to broadcast authoritative roll
    }
  }

  /**
   * Called when local player selects a token to move
   */
  public requestMove(tokenId: number, activePlayerIndex: number): boolean {
    if (!this.session) return true;
    if (!this.isMyTurn(activePlayerIndex)) return false;

    if (this.session.isHost) {
      // Host executes locally and broadcasts
      return true;
    } else {
      // Guest sends move request to host
      peerTransport.sendToHost({
        type: 'MOVE_REQUEST',
        matchId: this.session.matchId,
        seatIndex: this.session.mySeatIndex,
        tokenId,
        timestamp: Date.now(),
      });
      return false; // Wait for host to broadcast authoritative move
    }
  }

  /**
   * Host broadcasts authoritative snapshot to all peers
   */
  public broadcastSnapshot(snapshot: GameSnapshot) {
    if (!this.session?.isHost) return;
    this.isActionInFlight = false;
    this.lastSequence++;
    const sequencedSnapshot = {
      ...snapshot,
      sequence: this.lastSequence,
    };
    this.currentSnapshot = sequencedSnapshot;

    peerTransport.broadcastFromHost({
      type: 'GAME_STATE',
      matchId: this.session.matchId,
      sequence: this.lastSequence,
      snapshot: sequencedSnapshot,
    });
  }

  private handleWireMessage(msg: WireMessage, senderPeerId: string) {
    switch (msg.type) {
      case 'ROLL_REQUEST': {
        // Host receives roll request from guest
        if (this.session?.isHost && this.currentSnapshot) {
          // 0. Idempotency / In-flight action guard
          if (this.isActionInFlight) {
            console.warn(`[OnlineLudo] Dropping duplicate ROLL_REQUEST: an action is already in flight.`);
            return;
          }
          // 1. Verify matchId
          if (msg.matchId !== this.session.matchId) return;
          // 2. Verify active player turn
          if (msg.seatIndex !== this.currentSnapshot.activePlayerIndex) return;
          // 3. Fail closed on senderPeerId authorization
          const authorizedPeer = this.session.seatPeers?.[msg.seatIndex];
          if (!authorizedPeer || authorizedPeer !== senderPeerId) {
            console.warn(`[OnlineLudo] Rejected ROLL_REQUEST: sender ${senderPeerId} does not match authorized peer ${authorizedPeer || 'none'}`);
            return;
          }
          // 4. Verify game phase: must not have already rolled, not rolling, not game over
          if (this.currentSnapshot.hasRolled || this.currentSnapshot.isRolling || this.currentSnapshot.winner) {
            return;
          }

          // 5. Validate forceSix property if present
          if (msg.forceSix !== undefined && typeof msg.forceSix !== 'boolean') {
            console.warn(`[OnlineLudo] Rejected malformed ROLL_REQUEST: forceSix must be boolean`);
            return;
          }

          // Mark in-flight until snapshot broadcasts
          this.isActionInFlight = true;
          const isForcedSix = typeof msg.forceSix === 'boolean' ? msg.forceSix : false;
          this.callbacks.onRemoteRoll?.(0, msg.seatIndex, isForcedSix);
        }
        break;
      }

      case 'MOVE_REQUEST': {
        // Host receives move request from guest
        if (this.session?.isHost && this.currentSnapshot) {
          // 0. Idempotency / In-flight action guard
          if (this.isActionInFlight) {
            console.warn(`[OnlineLudo] Dropping duplicate MOVE_REQUEST: an action is already in flight.`);
            return;
          }
          // 1. Verify matchId
          if (msg.matchId !== this.session.matchId) return;
          // 2. Verify active player turn
          if (msg.seatIndex !== this.currentSnapshot.activePlayerIndex) return;
          // 3. Fail closed on senderPeerId authorization
          const authorizedPeer = this.session.seatPeers?.[msg.seatIndex];
          if (!authorizedPeer || authorizedPeer !== senderPeerId) {
            console.warn(`[OnlineLudo] Rejected MOVE_REQUEST: sender ${senderPeerId} does not match authorized peer ${authorizedPeer || 'none'}`);
            return;
          }
          // 4. Verify game phase: must have rolled, not rolling, not game over
          if (!this.currentSnapshot.hasRolled || this.currentSnapshot.isRolling || this.currentSnapshot.winner) {
            return;
          }
          // 5. Verify token ownership and ID legality
          if (typeof msg.tokenId !== 'number' || msg.tokenId < 0 || msg.tokenId > 3) {
            return;
          }
          const activePlayer = this.currentSnapshot.players[msg.seatIndex];
          const token = activePlayer?.tokens.find((t) => t.id === msg.tokenId);
          if (!token) return;

          // Mark in-flight until snapshot broadcasts
          this.isActionInFlight = true;
          this.callbacks.onRemoteMove?.(msg.tokenId, msg.seatIndex);
        }
        break;
      }

      case 'GAME_STATE': {
        // Guest receives authoritative state snapshot from host
        if (!this.session?.isHost && msg.matchId === this.session?.matchId) {
          if (msg.sequence > this.lastSequence) {
            this.lastSequence = msg.sequence;
            this.currentSnapshot = msg.snapshot;
            this.callbacks.onStateSnapshot?.(msg.snapshot);
          }
        }
        break;
      }

      case 'HOST_DISCONNECTED': {
        this.callbacks.onHostDisconnected?.(msg.message);
        break;
      }

      case 'ERROR': {
        this.callbacks.onError?.(msg.message);
        break;
      }
    }
  }

  public endSession() {
    this.session = null;
    this.currentSnapshot = null;
    this.lastSequence = 0;
    this.isActionInFlight = false;
    peerTransport.disconnect();
  }
}

export const onlineLudoController = new OnlineLudoController();
