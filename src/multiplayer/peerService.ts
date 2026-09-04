import Peer, { DataConnection } from 'peerjs';
import { WireMessage, normalizeRoomCode } from './protocol';

export type TransportStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface PeerEventHandlers {
  onStatusChange?: (status: TransportStatus, message?: string) => void;
  onMessage?: (msg: WireMessage, senderPeerId: string) => void;
  onPeerJoin?: (conn: DataConnection) => void;
  onPeerLeave?: (peerId: string) => void;
}

export class PeerTransport {
  private peer: Peer | null = null;
  private guestConns: Map<string, DataConnection> = new Map();
  private hostConn: DataConnection | null = null;
  public myPeerId: string = '';
  public roomCode: string = '';
  public isHost: boolean = false;
  public status: TransportStatus = 'idle';

  private handlers: PeerEventHandlers = {};
  private connectTimeoutTimer: any = null;

  public setHandlers(handlers: PeerEventHandlers) {
    this.handlers = handlers;
  }

  private setStatus(status: TransportStatus, message?: string) {
    this.status = status;
    this.handlers.onStatusChange?.(status, message);
  }

  /**
   * Host creates an authoritative room with normalized 6-character roomCode
   */
  public async createRoom(rawCode: string): Promise<string> {
    this.disconnect();
    this.isHost = true;
    const code = normalizeRoomCode(rawCode);
    this.roomCode = code;
    const targetPeerId = `ludo-room-${code.toLowerCase()}`;

    this.setStatus('connecting', `Creating room ${code}...`);

    return new Promise((resolve, reject) => {
      let isResolved = false;

      this.connectTimeoutTimer = setTimeout(() => {
        if (!isResolved) {
          this.setStatus('error', 'Signaling server timeout. Please try again.');
          this.disconnect();
          reject(new Error('Signaling timeout'));
        }
      }, 15000);

      try {
        // Use PeerJS public cloud broker with Google public STUN servers for NAT traversal
        this.peer = new Peer(targetPeerId, {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
            ],
          },
        });

        this.peer.on('open', (id) => {
          clearTimeout(this.connectTimeoutTimer);
          isResolved = true;
          this.myPeerId = id;
          this.setStatus('connected', `Room ${code} created successfully.`);
          resolve(code);
        });

        this.peer.on('connection', (conn) => {
          this.handleIncomingGuestConnection(conn);
        });

        this.peer.on('error', (err: any) => {
          clearTimeout(this.connectTimeoutTimer);
          console.warn('[PeerTransport] Host peer error:', err);
          const msg =
            err.type === 'unavailable-id'
              ? 'Room code is already active. Please generate a new code.'
              : err.message || 'Peer network error';
          this.setStatus('error', msg);
          if (!isResolved) {
            isResolved = true;
            reject(new Error(msg));
          }
        });
      } catch (err: any) {
        clearTimeout(this.connectTimeoutTimer);
        this.setStatus('error', err.message);
        reject(err);
      }
    });
  }

  /**
   * Guest connects to host via roomCode
   */
  public async joinRoom(rawCode: string): Promise<boolean> {
    this.disconnect();
    this.isHost = false;
    const code = normalizeRoomCode(rawCode);
    this.roomCode = code;
    const hostPeerId = `ludo-room-${code.toLowerCase()}`;

    this.setStatus('connecting', `Connecting to room ${code}...`);

    return new Promise((resolve, reject) => {
      let isResolved = false;

      this.connectTimeoutTimer = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          this.setStatus('error', 'Room not found or host unreachable.');
          this.disconnect();
          reject(new Error('Host connection timeout'));
        }
      }, 12000);

      try {
        this.peer = new Peer({
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
            ],
          },
        });

        this.peer.on('open', (id) => {
          this.myPeerId = id;
          const conn = this.peer!.connect(hostPeerId, {
            reliable: true,
          });

          this.hostConn = conn;

          conn.on('open', () => {
            clearTimeout(this.connectTimeoutTimer);
            if (!isResolved) {
              isResolved = true;
              this.setStatus('connected', 'Connected to room host!');
              resolve(true);
            }
          });

          conn.on('data', (data) => {
            try {
              const msg = data as WireMessage;
              this.handlers.onMessage?.(msg, hostPeerId);
            } catch (err) {
              console.warn('[PeerTransport] Malformed packet from host:', err);
            }
          });

          conn.on('close', () => {
            this.setStatus('error', 'Host has disconnected from the room.');
            this.handlers.onPeerLeave?.(hostPeerId);
          });

          conn.on('error', (err) => {
            clearTimeout(this.connectTimeoutTimer);
            this.setStatus('error', `Connection error: ${err.message}`);
            if (!isResolved) {
              isResolved = true;
              reject(err);
            }
          });
        });

        this.peer.on('error', (err: any) => {
          clearTimeout(this.connectTimeoutTimer);
          console.warn('[PeerTransport] Guest peer error:', err);
          const msg =
            err.type === 'peer-unavailable'
              ? 'Room not found. Check the room code!'
              : err.message || 'Connection failed';
          this.setStatus('error', msg);
          if (!isResolved) {
            isResolved = true;
            reject(new Error(msg));
          }
        });
      } catch (err: any) {
        clearTimeout(this.connectTimeoutTimer);
        this.setStatus('error', err.message);
        reject(err);
      }
    });
  }

  private handleIncomingGuestConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.guestConns.set(conn.peer, conn);
      this.handlers.onPeerJoin?.(conn);
    });

    conn.on('data', (data) => {
      try {
        const msg = data as WireMessage;
        // Do NOT blindly rebroadcast; pass to host controller for validation
        this.handlers.onMessage?.(msg, conn.peer);
      } catch (err) {
        console.warn('[PeerTransport] Malformed data from peer:', err);
      }
    });

    conn.on('close', () => {
      this.guestConns.delete(conn.peer);
      this.handlers.onPeerLeave?.(conn.peer);
    });

    conn.on('error', (err) => {
      console.warn(`[PeerTransport] Conn error with peer ${conn.peer}:`, err);
      this.guestConns.delete(conn.peer);
      this.handlers.onPeerLeave?.(conn.peer);
    });
  }

  /**
   * Send wire message directly to host (from guest)
   */
  public sendToHost(msg: WireMessage) {
    if (!this.isHost && this.hostConn && this.hostConn.open) {
      this.hostConn.send(msg);
    }
  }

  /**
   * Send wire message directly to a specific guest peer (from host)
   */
  public sendToPeer(peerId: string, msg: WireMessage) {
    if (this.isHost) {
      const conn = this.guestConns.get(peerId);
      if (conn && conn.open) {
        conn.send(msg);
      }
    }
  }

  /**
   * Broadcast wire message from host to all connected guest peers
   */
  public broadcastFromHost(msg: WireMessage) {
    if (this.isHost) {
      this.guestConns.forEach((conn) => {
        if (conn.open) {
          conn.send(msg);
        }
      });
    }
  }

  public disconnect() {
    if (this.connectTimeoutTimer) {
      clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }
    if (this.hostConn) {
      this.hostConn.close();
      this.hostConn = null;
    }
    this.guestConns.forEach((conn) => conn.close());
    this.guestConns.clear();

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.isHost = false;
    this.roomCode = '';
    this.myPeerId = '';
    this.setStatus('idle');
  }
}

export const peerTransport = new PeerTransport();
