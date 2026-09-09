import { MultiplayerSession, GameSnapshot, WireMessage } from './protocol';
import { peerTransport } from './peerService';

export interface OnlineGameCallbacks {
  onRemoteRoll?: (rollValue: number, playerIndex: number, forceSix?: boolean, desiredRoll?: number) => void;
  onRemoteMove?: (tokenId: number, playerIndex: number) => void;
  onRemoteTokenMove?: (data: {
    moveId: string;
    seatIndex: number;
    tokenId: number;
    fromStep: number;
    toStep: number;
    baseRevision: number;
  }) => void;
  onStateSnapshot?: (snapshot: GameSnapshot) => void;
  onHostDisconnected?: (message: string) => void;
  onGuestDisconnected?: (seatIndex: number, peerId: string) => void;
  onRemoteActionRejected?: (actionType: 'ROLL' | 'MOVE', reason: string) => void;
  onChatEmote?: (data: { seatIndex: number; senderName: string; message?: string; emoji?: string }) => void;
  onError?: (message: string) => void;
}

export class OnlineLudoController {
  private session: MultiplayerSession | null = null;
  private currentSnapshot: GameSnapshot | null = null;
  private lastSequence: number = 0;
  private isActionInFlight: boolean = false;
  private actionInFlightTimeout: any = null;
  private processedMoveIds = new Set<string>();
  private callbacks: OnlineGameCallbacks = {};
  private processedEmoteIds = new Set<string>();

  public setCallbacks(cbs: OnlineGameCallbacks) {
    this.callbacks = cbs;
  }

  public sendChatEmote(senderName: string, message?: string, emoji?: string) {
    if (!this.session) return;
    const emoteId = `${this.session.matchId}-${this.session.mySeatIndex}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.processedEmoteIds.add(emoteId);
    if (this.processedEmoteIds.size > 150) {
      const oldest = this.processedEmoteIds.values().next().value;
      if (oldest) this.processedEmoteIds.delete(oldest);
    }
    const msg: WireMessage = {
      type: 'CHAT_EMOTE',
      id: emoteId,
      matchId: this.session.matchId,
      seatIndex: this.session.mySeatIndex,
      senderName,
      message,
      emoji,
      timestamp: Date.now(),
    };
    if (this.session.isHost) {
      peerTransport.broadcastFromHost(msg);
      this.callbacks.onChatEmote?.({ seatIndex: this.session.mySeatIndex, senderName, message, emoji });
    } else {
      peerTransport.sendToHost(msg);
      this.callbacks.onChatEmote?.({ seatIndex: this.session.mySeatIndex, senderName, message, emoji });
    }
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
    this.processedMoveIds.clear();
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

  private recordProcessedMoveId(moveId: string) {
    if (this.processedMoveIds.has(moveId)) {
      this.processedMoveIds.delete(moveId);
    }
    this.processedMoveIds.add(moveId);
    if (this.processedMoveIds.size > 200) {
      const oldest = this.processedMoveIds.values().next().value;
      if (oldest) this.processedMoveIds.delete(oldest);
    }
  }

  /**
   * Host broadcasts authoritative TOKEN_MOVE animation event to all peers
   */
  public broadcastTokenMove(seatIndex: number, tokenId: number, fromStep: number, toStep: number): string | null {
    if (!this.session?.isHost) return null;
    const moveId = `${this.session.matchId}-${this.lastSequence}-${seatIndex}-${tokenId}-${Date.now()}`;
    this.recordProcessedMoveId(moveId);

    peerTransport.broadcastFromHost({
      type: 'TOKEN_MOVE',
      matchId: this.session.matchId,
      moveId,
      seatIndex,
      tokenId,
      fromStep,
      toStep,
      baseRevision: this.lastSequence,
    });
    return moveId;
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

      case 'TOKEN_MOVE': {
        // Guest receives token animation event from host
        if (!this.session?.isHost && msg.matchId === this.session?.matchId) {
          const expectedHostPeerId = this.session.seatPeers?.[0] || `ludo-room-${this.session.roomCode.toLowerCase()}`;
          if (senderPeerId !== expectedHostPeerId) {
            console.warn(`[OnlineLudo] Dropping TOKEN_MOVE from unauthorized sender ${senderPeerId}`);
            return;
          }

          // 1. Strict payload and boundary validation BEFORE deduplication
          const isValidMoveId = typeof msg.moveId === 'string' && msg.moveId.trim().length > 0 && msg.moveId.length <= 128;
          const isValidSeat = Number.isInteger(msg.seatIndex) && msg.seatIndex >= 0 && msg.seatIndex <= 3;
          const isValidToken = Number.isInteger(msg.tokenId) && msg.tokenId >= 0 && msg.tokenId <= 3;
          const isIntegerSteps = Number.isInteger(msg.fromStep) && Number.isInteger(msg.toStep);
          const isValidStepRange = isIntegerSteps && (
            (msg.fromStep === -1 && msg.toStep === 0) ||
            (msg.fromStep >= 0 && msg.toStep > msg.fromStep && msg.toStep <= 56 && (msg.toStep - msg.fromStep) <= 6)
          );
          const isValidRevision = Number.isInteger(msg.baseRevision) && msg.baseRevision >= 0;
          const minRevision = Math.max(0, this.lastSequence - 10);
          const maxRevision = this.lastSequence + 50;
          const isRevisionWindowValid = isValidRevision && msg.baseRevision >= minRevision && msg.baseRevision <= maxRevision;

          if (!isValidMoveId || !isValidSeat || !isValidToken || !isValidStepRange || !isRevisionWindowValid) {
            console.warn(`[OnlineLudo] Dropping malformed or invalid TOKEN_MOVE`);
            return;
          }

          // 2. Duplicate suppression with true LRU recency refresh
          if (this.processedMoveIds.has(msg.moveId)) {
            this.recordProcessedMoveId(msg.moveId);
            return;
          }

          this.recordProcessedMoveId(msg.moveId);

          this.callbacks.onRemoteTokenMove?.({
            moveId: msg.moveId,
            seatIndex: msg.seatIndex,
            tokenId: msg.tokenId,
            fromStep: msg.fromStep,
            toStep: msg.toStep,
            baseRevision: msg.baseRevision,
          });
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

      case 'CHAT_EMOTE': {
        if (!this.session || msg.matchId !== this.session.matchId) return;

        // 1. Validate payload types and reject malformed / malicious objects
        if (
          typeof msg.seatIndex !== 'number' ||
          msg.seatIndex < 0 ||
          msg.seatIndex > 3 ||
          typeof msg.senderName !== 'string'
        ) {
          console.warn('[OnlineLudo] Dropping malformed CHAT_EMOTE: invalid seat or sender');
          return;
        }

        const safeSenderName = msg.senderName.slice(0, 32);
        const safeMessage = typeof msg.message === 'string' ? msg.message.slice(0, 100) : undefined;
        const safeEmoji = typeof msg.emoji === 'string' ? msg.emoji.slice(0, 16) : undefined;

        if (!safeMessage && !safeEmoji) {
          console.warn('[OnlineLudo] Dropping empty CHAT_EMOTE');
          return;
        }

        // 2. Enforce sender authorization
        if (this.session.isHost) {
          const authorizedPeer = this.session.seatPeers?.[msg.seatIndex];
          if (authorizedPeer && authorizedPeer !== senderPeerId) {
            console.warn(
              `[OnlineLudo] Rejected CHAT_EMOTE: sender ${senderPeerId} does not match authorized peer ${authorizedPeer} for seat ${msg.seatIndex}`
            );
            return;
          }
        } else {
          const expectedHostPeerId = this.session.seatPeers?.[0] || `ludo-room-${this.session.roomCode.toLowerCase()}`;
          if (senderPeerId !== expectedHostPeerId) {
            console.warn(
              `[OnlineLudo] Dropping CHAT_EMOTE from unauthorized non-host sender ${senderPeerId}`
            );
            return;
          }
        }

        // 3. Prevent echo to sender (sender already invoked onChatEmote optimistically)
        if (msg.seatIndex === this.session.mySeatIndex) return;
        if (msg.id && this.processedEmoteIds.has(msg.id)) return;

        if (msg.id) {
          this.processedEmoteIds.add(msg.id);
          if (this.processedEmoteIds.size > 150) {
            const oldest = this.processedEmoteIds.values().next().value;
            if (oldest) this.processedEmoteIds.delete(oldest);
          }
        }

        const sanitizedMsg: WireMessage = {
          type: 'CHAT_EMOTE',
          id: msg.id,
          matchId: this.session.matchId,
          seatIndex: msg.seatIndex,
          senderName: safeSenderName,
          message: safeMessage,
          emoji: safeEmoji,
          timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : Date.now(),
        };

        // Host relays sanitized message to all other peers
        if (this.session.isHost) {
          peerTransport.broadcastFromHost(sanitizedMsg);
        }
        this.callbacks.onChatEmote?.({
          seatIndex: msg.seatIndex,
          senderName: safeSenderName,
          message: safeMessage,
          emoji: safeEmoji,
        });
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
    this.processedMoveIds.clear();
    this.session = null;
    this.currentSnapshot = null;
    this.lastSequence = 0;
    peerTransport.disconnect();
  }
}

export const onlineLudoController = new OnlineLudoController();
