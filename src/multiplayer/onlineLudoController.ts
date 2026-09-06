import { MultiplayerSession, GameSnapshot, WireMessage } from './protocol';
import { peerTransport } from './peerService';

export interface OnlineGameCallbacks {
  onRemoteRoll?: (rollValue: number, playerIndex: number, forceSix?: boolean, desiredRoll?: number) => void;
  onRemoteMove?: (tokenId: number, playerIndex: number) => void;
  onStateSnapshot?: (snapshot: GameSnapshot) => void;
  onHostDisconnected?: (message: string) => void;
  onGuestDisconnected?: (seatIndex: number, peerId: string) => void;
  onRemoteActionRejected?: (actionType: 'ROLL' | 'MOVE', reason: string) => void;
  onError?: (message: string) => void;
}

export class OnlineLudoController {
  private session: MultiplayerSession | null = null;
  private currentSnapshot: GameSnapshot | null = null;
  private lastSequence: number = 0;
  private isActionInFlight: boolean = false;
  private actionInFlightTimeout: any = null;
  private callbacks: OnlineGameCallbacks = {};

  public setCallbacks(cbs: OnlineGameCallbacks) {
    this.callbacks = cbs;
  }

  public clearActionInFlight() {
    if (this.actionInFlightTimeout) {
      clearTimeout(this.actionInFlightTimeout);
      this.actionInFlightTimeout = null;
    }
    this.isActionInFlight = false;
  }

  public initSession(session: MultiplayerSession, initialSnapshot: GameSnapshot) {
    this.clearActionInFlight();
    this.session = session;
    this.currentSnapshot = initialSnapshot;
    this.lastSequence = initialSnapshot.sequence;

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
  public requestRoll(activePlayerIndex: number, forceSix: boolean = false, desiredRoll?: number): boolean {
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
        desiredRoll: typeof desiredRoll === 'number' && Number.isInteger(desiredRoll) && desiredRoll >= 1 && desiredRoll <= 6 ? desiredRoll : undefined,
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
    this.clearActionInFlight();
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

  private armActionInFlightWatchdog(actionType: string) {
    this.isActionInFlight = true;
    if (this.actionInFlightTimeout) clearTimeout(this.actionInFlightTimeout);
    this.actionInFlightTimeout = setTimeout(() => {
      if (this.isActionInFlight) {
        console.warn(`[OnlineLudo] Action ${actionType} timed out after 2500ms. Resetting in-flight guard.`);
        this.clearActionInFlight();
      }
    }, 2500);
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
          if (msg.matchId !== this.session.matchId) {
            peerTransport.sendToPeer(senderPeerId, {
              type: 'ACTION_REJECTED',
              matchId: this.session.matchId,
              actionType: 'ROLL',
              seatIndex: msg.seatIndex,
              reason: 'Match ID mismatch',
            });
            return;
          }
          // 2. Verify active player turn
          if (msg.seatIndex !== this.currentSnapshot.activePlayerIndex) {
            peerTransport.sendToPeer(senderPeerId, {
              type: 'ACTION_REJECTED',
              matchId: this.session.matchId,
              actionType: 'ROLL',
              seatIndex: msg.seatIndex,
              reason: 'Not your turn',
            });
            return;
          }
          // 3. Sender authorization check: fail-closed on authoritative seat-to-peer binding
          const authorizedPeer = this.session.seatPeers?.[msg.seatIndex];
          if (!authorizedPeer || authorizedPeer !== senderPeerId) {
            console.warn(`[OnlineLudo] Rejected ROLL_REQUEST: sender ${senderPeerId} does not match authorized peer ${authorizedPeer || 'none'}`);
            peerTransport.sendToPeer(senderPeerId, {
              type: 'ACTION_REJECTED',
              matchId: this.session.matchId,
              actionType: 'ROLL',
              seatIndex: msg.seatIndex,
              reason: 'Unauthorized seat',
            });
            return;
          }

          // 4. Verify game phase: must not have already rolled, not rolling, not game over
          if (this.currentSnapshot.hasRolled || this.currentSnapshot.isRolling || this.currentSnapshot.winner) {
            peerTransport.sendToPeer(senderPeerId, {
              type: 'ACTION_REJECTED',
              matchId: this.session.matchId,
              actionType: 'ROLL',
              seatIndex: msg.seatIndex,
              reason: 'Dice already rolled or in motion',
            });
            return;
          }

          // 5. Safely normalize optional forceSix (treat only literal boolean true as forced six)
          const isForcedSix = msg.forceSix === true;

          // 6. Safely normalize optional desiredRoll (must be finite integer 1..6; otherwise standard RNG)
          let validatedDesiredRoll: number | undefined = undefined;
          if (typeof msg.desiredRoll === 'number' && Number.isInteger(msg.desiredRoll) && msg.desiredRoll >= 1 && msg.desiredRoll <= 6) {
            validatedDesiredRoll = msg.desiredRoll;
          }

          // Mark in-flight with 2.5s watchdog timeout
          this.armActionInFlightWatchdog('ROLL_REQUEST');
          try {
            if (validatedDesiredRoll !== undefined) {
              this.callbacks.onRemoteRoll?.(0, msg.seatIndex, isForcedSix, validatedDesiredRoll);
            } else {
              this.callbacks.onRemoteRoll?.(0, msg.seatIndex, isForcedSix);
            }
          } catch (err) {
            console.error('[OnlineLudo] Error in onRemoteRoll handler:', err);
            this.clearActionInFlight();
          }
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
          if (msg.matchId !== this.session.matchId) {
            peerTransport.sendToPeer(senderPeerId, {
              type: 'ACTION_REJECTED',
              matchId: this.session.matchId,
              actionType: 'MOVE',
              seatIndex: msg.seatIndex,
              reason: 'Match ID mismatch',
            });
            return;
          }
          // 2. Verify active player turn
          if (msg.seatIndex !== this.currentSnapshot.activePlayerIndex) {
            peerTransport.sendToPeer(senderPeerId, {
              type: 'ACTION_REJECTED',
              matchId: this.session.matchId,
              actionType: 'MOVE',
              seatIndex: msg.seatIndex,
              reason: 'Not your turn',
            });
            return;
          }
          // 3. Sender authorization check: fail-closed on authoritative seat-to-peer binding
          const authorizedPeer = this.session.seatPeers?.[msg.seatIndex];
          if (!authorizedPeer || authorizedPeer !== senderPeerId) {
            console.warn(`[OnlineLudo] Rejected MOVE_REQUEST: sender ${senderPeerId} does not match authorized peer ${authorizedPeer || 'none'}`);
            peerTransport.sendToPeer(senderPeerId, {
              type: 'ACTION_REJECTED',
              matchId: this.session.matchId,
              actionType: 'MOVE',
              seatIndex: msg.seatIndex,
              reason: 'Unauthorized seat',
            });
            return;
          }

          // 4. Verify game phase: must have rolled, not rolling, not game over
          if (!this.currentSnapshot.hasRolled || this.currentSnapshot.isRolling || this.currentSnapshot.winner) {
            peerTransport.sendToPeer(senderPeerId, {
              type: 'ACTION_REJECTED',
              matchId: this.session.matchId,
              actionType: 'MOVE',
              seatIndex: msg.seatIndex,
              reason: 'Move not allowed in current phase',
            });
            return;
          }
          // 5. Verify token ownership and ID legality
          if (typeof msg.tokenId !== 'number' || msg.tokenId < 0 || msg.tokenId > 3) {
            peerTransport.sendToPeer(senderPeerId, {
              type: 'ACTION_REJECTED',
              matchId: this.session.matchId,
              actionType: 'MOVE',
              seatIndex: msg.seatIndex,
              reason: 'Invalid token ID',
            });
            return;
          }
          const activePlayer = this.currentSnapshot.players[msg.seatIndex];
          const token = activePlayer?.tokens.find((t) => t.id === msg.tokenId);
          if (!token) {
            peerTransport.sendToPeer(senderPeerId, {
              type: 'ACTION_REJECTED',
              matchId: this.session.matchId,
              actionType: 'MOVE',
              seatIndex: msg.seatIndex,
              reason: 'Token not found',
            });
            return;
          }

          // Mark in-flight with 2.5s watchdog timeout
          this.armActionInFlightWatchdog('MOVE_REQUEST');
          try {
            this.callbacks.onRemoteMove?.(msg.tokenId, msg.seatIndex);
          } catch (err) {
            console.error('[OnlineLudo] Error in onRemoteMove handler:', err);
            this.clearActionInFlight();
          }
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

      case 'ACTION_REJECTED': {
        if (!this.session?.isHost && msg.matchId === this.session?.matchId) {
          const expectedHostPeerId = this.session.seatPeers?.[0] || `ludo-room-${this.session.roomCode.toLowerCase()}`;
          if (senderPeerId === expectedHostPeerId) {
            this.callbacks.onRemoteActionRejected?.(msg.actionType, msg.reason);
          } else {
            console.warn(`[OnlineLudo] Dropping ACTION_REJECTED from unauthorized sender ${senderPeerId}`);
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
    this.clearActionInFlight();
    this.session = null;
    this.currentSnapshot = null;
    this.lastSequence = 0;
    peerTransport.disconnect();
  }
}

export const onlineLudoController = new OnlineLudoController();
