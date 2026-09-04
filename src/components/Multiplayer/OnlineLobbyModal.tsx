import React, { useState, useEffect } from 'react';
import {
  generateRoomCode,
  normalizeRoomCode,
  LobbyState,
  LobbySeat,
  SEAT_COLORS,
  MultiplayerSession,
  GameSnapshot,
  PROTOCOL_VERSION,
} from '../../multiplayer/protocol';
import { peerTransport, TransportStatus } from '../../multiplayer/peerService';
import { lobbyController } from '../../multiplayer/lobbyController';
import { DEFAULT_AVATARS, COLOR_MAP } from '../../utils/constants';
import {
  Users,
  Copy,
  Check,
  Play,
  ArrowLeft,
  Share2,
  Sparkles,
  Wifi,
  AlertCircle,
  Crown,
  LogOut,
} from 'lucide-react';

interface OnlineLobbyModalProps {
  initialRoomCode?: string;
  onClose: () => void;
  onStartMatch: (session: MultiplayerSession, initialSnapshot: GameSnapshot) => void;
}

export const OnlineLobbyModal: React.FC<OnlineLobbyModalProps> = ({
  initialRoomCode = '',
  onClose,
  onStartMatch,
}) => {
  const [view, setView] = useState<'welcome' | 'lobby'>(initialRoomCode ? 'welcome' : 'welcome');
  const [playerName, setPlayerName] = useState<string>(() => {
    return 'Player ' + Math.floor(100 + Math.random() * 900);
  });
  const [selectedAvatar, setSelectedAvatar] = useState<string>(DEFAULT_AVATARS[0]);
  const [roomInput, setRoomInput] = useState<string>(normalizeRoomCode(initialRoomCode));
  const [lobbyState, setLobbyState] = useState<LobbyState>(lobbyController.getState());
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  useEffect(() => {
    // Listen for lobby updates
    lobbyController.subscribe(
      (updatedState) => {
        setLobbyState(updatedState);
      },
      (session, snapshot) => {
        onStartMatch(session, snapshot);
      }
    );

    peerTransport.setHandlers({
      onStatusChange: (status: TransportStatus, msg?: string) => {
        if (msg) setStatusMessage(msg);
        if (status === 'error') {
          setIsBusy(false);
          setErrorMessage(msg || 'Network error occurred');
        }
      },
      onPeerJoin: (conn) => {
        setStatusMessage(`Peer connected: ${conn.peer}`);
      },
      onPeerLeave: (peerId) => {
        if (peerTransport.isHost) {
          lobbyController.handlePeerLeave(peerId);
        }
      },
      onMessage: (msg, senderPeerId) => {
        if (peerTransport.isHost) {
          if (msg.type === 'JOIN_REQUEST') {
            lobbyController.handleJoinRequest(senderPeerId, msg);
          }
        } else {
          // Guest handling
          if (msg.type === 'JOIN_RESPONSE') {
            if (msg.success) {
              setView('lobby');
              setIsBusy(false);
              setErrorMessage('');
            } else {
              setErrorMessage(msg.error || 'Could not join room');
              setIsBusy(false);
            }
          } else if (msg.type === 'LOBBY_STATE') {
            lobbyController.applyRemoteLobbyState(msg.state, msg.sequence);
            setView('lobby');
            setIsBusy(false);
          } else if (msg.type === 'START_MATCH') {
            onStartMatch(msg.session, msg.initialSnapshot);
          } else if (msg.type === 'HOST_DISCONNECTED') {
            setErrorMessage('The room host has left. The lobby has ended.');
            setView('welcome');
            setIsBusy(false);
          } else if (msg.type === 'ERROR') {
            setErrorMessage(msg.message);
            setIsBusy(false);
          }
        }
      },
    });

    return () => {
      // Don't kill active connection if entering game
    };
  }, [onStartMatch]);

  // Handle Host Create Room
  const handleCreateRoom = async () => {
    setErrorMessage('');
    setIsBusy(true);
    const code = generateRoomCode();
    try {
      await peerTransport.createRoom(code);
      lobbyController.initHostLobby(code, playerName, selectedAvatar, peerTransport.myPeerId);
      setView('lobby');
      setIsBusy(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create room.');
      setIsBusy(false);
    }
  };

  // Handle Guest Join Room
  const handleJoinRoom = async () => {
    const code = normalizeRoomCode(roomInput);
    if (!code || code.length < 4) {
      setErrorMessage('Please enter a valid 4-6 character room code.');
      return;
    }

    setErrorMessage('');
    setIsBusy(true);
    try {
      await peerTransport.joinRoom(code);
      // Send JOIN_REQUEST to host
      peerTransport.sendToHost({
        type: 'JOIN_REQUEST',
        protocolVersion: PROTOCOL_VERSION,
        name: playerName,
        avatar: selectedAvatar,
        roomCode: code,
      });
      // Will transition to 'lobby' on JOIN_RESPONSE
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not join room. Check code!');
      setIsBusy(false);
    }
  };

  // Handle Host Start Game
  const handleStartGame = () => {
    if (!peerTransport.isHost) return;
    if (!lobbyController.canStart()) {
      setErrorMessage('Need at least 2 connected players to start the match!');
      return;
    }

    const defaultOptions = {
      requireSixToStart: true,
      bonusTurnOnSix: true,
      bonusTurnOnCapture: true,
      bonusTurnOnHome: true,
      maxConsecutiveSixes: 3,
    };

    lobbyController.startMatch(defaultOptions);
  };

  const handleCopyCode = () => {
    if (lobbyState.roomCode) {
      navigator.clipboard.writeText(lobbyState.roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined' && lobbyState.roomCode) {
      const url = `${window.location.origin}${window.location.pathname}?room=${lobbyState.roomCode}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleLeaveLobby = () => {
    peerTransport.disconnect();
    lobbyController.reset();
    setView('welcome');
    setErrorMessage('');
    setStatusMessage('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Glow Ambient */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="relative z-10 flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl">
              🌐
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight leading-tight">
                Online Multiplayer Room
              </h3>
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Wifi className="w-3 h-3 text-emerald-400" /> Royal Ludo Live Rooms (WebRTC)
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              handleLeaveLobby();
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all text-xs font-bold cursor-pointer"
          >
            ✕ Close
          </button>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-red-950/70 border border-red-500/50 text-red-200 text-xs font-semibold flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* VIEW 1: WELCOME / SETUP & JOIN */}
        {view === 'welcome' && (
          <div className="flex-1 overflow-y-auto space-y-5 pr-1">
            {/* Player Identity Selection */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
              <label className="text-xs font-black uppercase tracking-wider text-slate-300 block mb-2">
                Your Player Profile
              </label>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl">
                  {selectedAvatar}
                </div>
                <input
                  type="text"
                  value={playerName}
                  maxLength={16}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  className="flex-1 py-2.5 px-3.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Avatar Picker */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {DEFAULT_AVATARS.map((av) => (
                  <button
                    key={av}
                    onClick={() => setSelectedAvatar(av)}
                    className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                      selectedAvatar === av
                        ? 'bg-amber-500/30 border-2 border-amber-400 scale-105'
                        : 'bg-slate-900 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            {/* Room Creation & Join Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option 1: Create a New Room */}
              <div className="bg-gradient-to-b from-amber-500/10 via-slate-900 to-slate-950 border border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center text-base mb-2 font-black">
                    👑
                  </div>
                  <h4 className="text-sm font-black text-white mb-1">Create New Room</h4>
                  <p className="text-[11px] text-slate-400 mb-4">
                    Host a private online lobby. Get a 6-character room code to invite up to 3 friends.
                  </p>
                </div>
                <button
                  disabled={isBusy}
                  onClick={handleCreateRoom}
                  className="w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-lg shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isBusy ? 'Creating Room...' : 'Create Room'}</span>
                </button>
              </div>

              {/* Option 2: Join Existing Room */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center text-base mb-2 font-black">
                    🔑
                  </div>
                  <h4 className="text-sm font-black text-white mb-1">Join with Code</h4>
                  <p className="text-[11px] text-slate-400 mb-3">
                    Have a code from a friend? Enter it below to join their lobby.
                  </p>
                  <input
                    type="text"
                    value={roomInput}
                    maxLength={6}
                    onChange={(e) => setRoomInput(normalizeRoomCode(e.target.value))}
                    placeholder="e.g. 7K9Q2P"
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-amber-400 font-mono font-black text-center text-base tracking-widest uppercase focus:outline-none focus:border-blue-400 mb-4"
                  />
                </div>
                <button
                  disabled={isBusy || roomInput.length < 4}
                  onClick={handleJoinRoom}
                  className="w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  <span>{isBusy ? 'Connecting...' : 'Join Room'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: LOBBY WAITING ROOM */}
        {view === 'lobby' && (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Room Code & Share Banner */}
            <div className="bg-gradient-to-r from-amber-500/15 via-slate-900 to-amber-500/15 border border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                  Room Code (Share with Friends)
                </span>
                <span className="text-2xl sm:text-3xl font-mono font-black tracking-widest text-amber-400">
                  {lobbyState.roomCode}
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleCopyCode}
                  className="flex-1 sm:flex-initial py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                </button>
                <button
                  onClick={handleCopyLink}
                  className="flex-1 sm:flex-initial py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            {/* 4 Player Slots */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                  Connected Players ({lobbyState.playerCount}/4)
                </span>
                <span className="text-[11px] text-amber-400 font-semibold">
                  {peerTransport.isHost ? '👑 You are the Host' : 'Joined as Guest'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {lobbyState.seats.map((seat: LobbySeat | null, idx: number) => {
                  const color = SEAT_COLORS[idx];
                  const colorInfo = COLOR_MAP[color];
                  const isOccupied = seat !== null;

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                        isOccupied
                          ? 'bg-slate-950/80 border-slate-700 shadow-md'
                          : 'bg-slate-950/30 border-dashed border-slate-800 text-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow"
                          style={{
                            background: isOccupied ? colorInfo.tokenBg : 'rgba(255,255,255,0.05)',
                          }}
                        >
                          {isOccupied ? seat.avatar : '👤'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-black ${isOccupied ? 'text-white' : 'text-slate-500'}`}>
                              {isOccupied ? seat.name : `Seat ${idx + 1} (Empty)`}
                            </span>
                            {seat?.isHost && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                Host
                              </span>
                            )}
                          </div>
                          <span
                            className="text-[10px] font-extrabold uppercase tracking-wider block"
                            style={{ color: isOccupied ? colorInfo.primary : '#64748b' }}
                          >
                            {colorInfo.name}
                          </span>
                        </div>
                      </div>

                      {isOccupied && (
                        <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Ready</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Match Start & Lobby Controls */}
            <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
              {peerTransport.isHost ? (
                <button
                  disabled={!lobbyController.canStart()}
                  onClick={handleStartGame}
                  className={`w-full py-3.5 px-5 rounded-2xl font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xl cursor-pointer ${
                    lobbyController.canStart()
                      ? 'bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 hover:from-emerald-400 hover:to-green-400 text-slate-950 shadow-emerald-500/25 active:scale-98 animate-pulse'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  }`}
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>
                    {lobbyController.canStart()
                      ? `Start Match (${lobbyState.playerCount} Players)`
                      : 'Waiting for players (Need 2-4)...'}
                  </span>
                </button>
              ) : (
                <div className="w-full py-3 px-4 rounded-xl bg-slate-800/80 border border-slate-700/80 text-center text-xs font-bold text-amber-300 flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>Waiting for room host to start the match...</span>
                </div>
              )}

              <button
                onClick={handleLeaveLobby}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-slate-400 hover:text-rose-400 hover:bg-slate-800/50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Leave Room</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
