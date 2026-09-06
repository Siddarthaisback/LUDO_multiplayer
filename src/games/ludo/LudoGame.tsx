import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { PlayerConfig, PlayerColor } from '../../types/game';
import { LudoPlayerState, LudoGameOptions, MoveOption } from '../../types/ludo';
import { LudoBoard } from './LudoBoard';
import { LudoEngine, calculateSmartAutoCaptureRoll } from './LudoEngine';
import { PlayerCornerDock } from './PlayerCornerDock';
import { VictoryModal } from '../../components/UI/VictoryModal';
import './ludoAnimations.css';
import { SettingsBar } from '../../components/UI/SettingsBar';
import { RulesModal } from '../../components/UI/RulesModal';
import { soundEffects } from '../../engine/soundEffects';
import { fireCelebrationBurst } from '../../engine/confetti';
import { BotAI } from '../../engine/botAI';
import { COLOR_MAP } from '../../utils/constants';
import { BoardEffectItem, PathPreviewData } from './ludoAnimationTypes';
import { derivePathPreview } from './ludoMotion';
import { getLudoVisualPosition } from './ludoGeometry';
import { LudoSetupModal } from './ui/LudoSetupModal';
import { Wifi } from 'lucide-react';
import { MultiplayerSession, GameSnapshot } from '../../multiplayer/protocol';
import { onlineLudoController } from '../../multiplayer/onlineLudoController';

const DICE_HOLD_THRESHOLD_MS = 500;
const BOT_ROLL_DELAY_MS = 800;
const BOT_MOVE_DELAY_MS = 750;
const DICE_ROLL_DURATION_MS = 600;
const TOKEN_HOP_DURATION_MS = 200;
const PASS_TURN_DELAY_MS = 1500;
const AFTER_MOVE_DELAY_MS = 600;

interface LudoGameProps {
  initialPlayers: PlayerConfig[];
  options: LudoGameOptions;
  onHome: () => void;
  onOpenSetup?: () => void;
  multiplayerSession?: MultiplayerSession | null;
}

// Pure predicate determining whether an action can execute on the current node
export function canExecuteLudoActionLocally(
  targetPlayerIndex: number,
  fromRemote: boolean,
  isOnline: boolean,
  multiplayerSession: MultiplayerSession | null | undefined,
  players: LudoPlayerState[]
): boolean {
  if (!isOnline) return true;
  if (fromRemote) {
    return Boolean(multiplayerSession?.isHost);
  }
  if (multiplayerSession?.isHost && players[targetPlayerIndex]?.config.type === 'bot') {
    return true;
  }
  return multiplayerSession?.mySeatIndex === targetPlayerIndex;
}

export const LudoGame: React.FC<LudoGameProps> = ({
  initialPlayers,
  options,
  onHome,
  onOpenSetup,
  multiplayerSession = null,
}) => {
  const [players, setPlayers] = useState<LudoPlayerState[]>(() =>
    initialPlayers.map((p) => ({
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
    }))
  );

  const [activePlayerIndex, setActivePlayerIndex] = useState(0);
  const [diceValue, setDiceValue] = useState(1);
  const [isRolling, setIsRolling] = useState(false);
  const [hasRolled, setHasRolled] = useState(false);
  const [validMoves, setValidMoves] = useState<MoveOption[]>([]);
  const [consecutiveSixes, setConsecutiveSixes] = useState(0);
  const [winner, setWinner] = useState<PlayerConfig | null>(null);
  const [rankings, setRankings] = useState<{ player: PlayerConfig; rank: number; stats?: string }[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const isOnline = Boolean(multiplayerSession);
  const isMyOnlineTurn = isOnline ? multiplayerSession!.mySeatIndex === activePlayerIndex : true;
  const [networkDisconnectError, setNetworkDisconnectError] = useState<string | null>(null);

  const [boardStyle, setBoardStyle] = useState<'luxury' | 'classic'>('classic');
  const [isShaking, setIsShaking] = useState(false);

  // Animation & Visual Effect States
  const [effects, setEffects] = useState<BoardEffectItem[]>([]);
  const [hoveredTokenId, setHoveredTokenId] = useState<number | null>(null);
  const [isAnimatingMove, setIsAnimatingMove] = useState(false);
  const [turnPassNotice, setTurnPassNotice] = useState<string | null>(null);

  // Synchronized refs to eliminate race conditions and stale closures in network callbacks
  const activePlayerIndexRef = useRef<number>(activePlayerIndex);
  const hasRolledRef = useRef<boolean>(hasRolled);
  const isRollingRef = useRef<boolean>(isRolling);
  const playersRef = useRef<LudoPlayerState[]>(players);
  const isAnimatingMoveRef = useRef<boolean>(isAnimatingMove);
  const diceValueRef = useRef<number>(diceValue);
  const validMovesRef = useRef<MoveOption[]>(validMoves);
  const guestRollTimeoutRef = useRef<any>(null);

  useEffect(() => {
    activePlayerIndexRef.current = activePlayerIndex;
    hasRolledRef.current = hasRolled;
    isRollingRef.current = isRolling;
    playersRef.current = players;
    isAnimatingMoveRef.current = isAnimatingMove;
    diceValueRef.current = diceValue;
    validMovesRef.current = validMoves;
  }, [activePlayerIndex, hasRolled, isRolling, players, isAnimatingMove, diceValue, validMoves]);

  const activePlayer = players[activePlayerIndex];
  // In online mode, host automates bot turns; in local mode, bots auto-play their turns
  const isAutomatedTurn = isOnline
    ? Boolean(multiplayerSession?.isHost && activePlayer?.config.type === 'bot')
    : activePlayer?.config.type === 'bot';
  const botActionTimerRef = useRef<any>(null);
  const diceRollTimerRef = useRef<any>(null);
  const turnTimerRef = useRef<any>(null);
  const currentMoveSessionRef = useRef<number>(0);
  const currentRollSessionRef = useRef<number>(0);
  const rollPressStartTimeRef = useRef<number | null>(null);
  const hasHandledReleaseRef = useRef<boolean>(false);
  const handleRollDiceRef = useRef<(fromRemote?: boolean, forceSix?: boolean, desiredRoll?: number, actingSeatIndex?: number) => void>(() => {});
  const handleSelectTokenRef = useRef<(tokenId: number, fromRemote?: boolean, actingSeatIndex?: number) => void>(() => {});
  const pendingSnapshotRef = useRef<any>(null);
  const animateRemoteMoveRef = useRef<(seatIndex: number, tokenId: number, fromStep: number, toStep: number) => Promise<void>>(() => Promise.resolve());

  // Determine whether an action can execute on the current node
  const canExecuteLocally = (targetPlayerIndex: number, fromRemote: boolean) =>
    canExecuteLudoActionLocally(targetPlayerIndex, fromRemote, isOnline, multiplayerSession, playersRef.current);

  // Invalidate any active move transaction or timer on unmount
  useEffect(() => {
    return () => {
      currentMoveSessionRef.current++;
      currentRollSessionRef.current++;
      pendingSnapshotRef.current = null;
      if (botActionTimerRef.current) clearTimeout(botActionTimerRef.current);
      if (diceRollTimerRef.current) clearTimeout(diceRollTimerRef.current);
      if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
      if (guestRollTimeoutRef.current) clearTimeout(guestRollTimeoutRef.current);
    };
  }, []);

  const applyStateSnapshot = (snapshot: GameSnapshot) => {
    currentMoveSessionRef.current++;
    activePlayerIndexRef.current = snapshot.activePlayerIndex;
    hasRolledRef.current = snapshot.hasRolled;
    isRollingRef.current = snapshot.isRolling;
    playersRef.current = snapshot.players;
    diceValueRef.current = snapshot.diceValue;

    setPlayers(snapshot.players);
    setActivePlayerIndex(snapshot.activePlayerIndex);
    setDiceValue(snapshot.diceValue);
    setHasRolled(snapshot.hasRolled);
    setIsRolling(snapshot.isRolling);
    setConsecutiveSixes(snapshot.consecutiveSixes);
    if (snapshot.winner) setWinner(snapshot.winner);
    if (snapshot.rankings) setRankings(snapshot.rankings);

    if (snapshot.hasRolled && snapshot.activePlayerIndex === multiplayerSession?.mySeatIndex) {
      const myPlayer = snapshot.players[snapshot.activePlayerIndex];
      const legalMoves = LudoEngine.getValidMoves(myPlayer, snapshot.diceValue, snapshot.players, options);
      setValidMoves(legalMoves);
      validMovesRef.current = legalMoves;
      if (legalMoves.length === 0) {
        setTurnPassNotice(`Rolled ${snapshot.diceValue} — No Moves Available`);
      } else {
        setTurnPassNotice(null);
      }
    } else {
      setValidMoves([]);
      validMovesRef.current = [];
      if (snapshot.hasRolled) {
        const activeP = snapshot.players[snapshot.activePlayerIndex];
        if (activeP) {
          const moves = LudoEngine.getValidMoves(activeP, snapshot.diceValue, snapshot.players, options);
          if (moves.length === 0) {
            setTurnPassNotice(`Rolled ${snapshot.diceValue} — No Moves Available`);
          } else {
            setTurnPassNotice(null);
          }
        }
      } else {
        setTurnPassNotice(null);
      }
    }
  };

  // Online Multiplayer Controller Callback Registration
  useEffect(() => {
    if (!multiplayerSession) return;

    onlineLudoController.setCallbacks({
      onRemoteRoll: (_val, seatIndex, forceSix, desiredRoll) => {
        if (multiplayerSession.isHost) {
          handleRollDiceRef.current(true, Boolean(forceSix), desiredRoll, seatIndex);
        }
      },
      onRemoteMove: (tokenId, seatIndex) => {
        if (multiplayerSession.isHost) {
          handleSelectTokenRef.current(tokenId, true, seatIndex);
        }
      },
      onRemoteTokenMove: (data) => {
        if (!multiplayerSession.isHost) {
          animateRemoteMoveRef.current(data.seatIndex, data.tokenId, data.fromStep, data.toStep);
        }
      },
      onRemoteActionRejected: (_actionType: 'ROLL' | 'MOVE', reason: string) => {
        if (guestRollTimeoutRef.current) clearTimeout(guestRollTimeoutRef.current);
        setIsRolling(false);
        isRollingRef.current = false;
        setIsAnimatingMove(false);
        isAnimatingMoveRef.current = false;
        setTurnPassNotice(`Action rejected: ${reason}`);
        setTimeout(() => setTurnPassNotice(null), 2500);
      },
      onStateSnapshot: (snapshot) => {
        if (guestRollTimeoutRef.current) clearTimeout(guestRollTimeoutRef.current);
        if (isAnimatingMoveRef.current && !multiplayerSession.isHost) {
          pendingSnapshotRef.current = snapshot;
          return;
        }
        applyStateSnapshot(snapshot);
      },
      onHostDisconnected: (msg) => {
        setNetworkDisconnectError(msg || 'The room host has disconnected.');
      },
      onGuestDisconnected: (seatIndex) => {
        if (!multiplayerSession?.isHost) return;
        setPlayers((prev) => {
          const updated = prev.map((p, idx) => {
            if (idx === seatIndex) {
              return {
                ...p,
                config: {
                  ...p.config,
                  type: 'bot' as const,
                  name: `${p.config.name} (Bot)`,
                },
              };
            }
            return p;
          });

          onlineLudoController.broadcastSnapshot({
            matchId: multiplayerSession.matchId,
            sequence: 0,
            players: updated,
            activePlayerIndex,
            diceValue,
            hasRolled,
            isRolling,
            consecutiveSixes,
            winner,
            rankings,
            lastAction: {
              type: 'PASS',
              playerIndex: seatIndex,
              details: `Player disconnected - Bot taking over`,
            },
          });

          return updated;
        });
      },
      onError: (msg) => {
        console.warn('[Multiplayer Ludo error]', msg);
      },
    });
  }, [multiplayerSession, activePlayerIndex, hasRolled, isRolling, isAnimatingMove, players, options]);

  // Helper to trigger and auto-cleanup transient visual effects
  const addEffect = (type: BoardEffectItem['type'], point: any, color?: PlayerColor, text?: string, durationMs: number = 700) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newEffect: BoardEffectItem = {
      id,
      type,
      point,
      color,
      text,
      durationMs,
      startTime: Date.now(),
    };
    setEffects((prev) => [...prev, newEffect]);
    setTimeout(() => {
      setEffects((prev) => prev.filter((e) => e.id !== id));
    }, durationMs);
  };

  // Bot Turn Sequence
  useEffect(() => {
    if (winner || isRolling || isAnimatingMove) return;

    if (isAutomatedTurn && !hasRolled && activePlayer && !activePlayer.rank) {
      botActionTimerRef.current = setTimeout(() => {
        handleRollDice();
      }, BOT_ROLL_DELAY_MS);
    }

    if (isAutomatedTurn && hasRolled && validMoves.length > 0 && activePlayer) {
      botActionTimerRef.current = setTimeout(() => {
        const chosenTokenId = BotAI.selectBestLudoMove(
          validMoves,
          activePlayer.config.color,
          activePlayer,
          players,
          activePlayer.config.difficulty || 'medium'
        );

        if (chosenTokenId !== null) {
          handleSelectToken(chosenTokenId);
        }
      }, BOT_MOVE_DELAY_MS);
    }

    return () => {
      if (botActionTimerRef.current) clearTimeout(botActionTimerRef.current);
    };
  }, [activePlayerIndex, hasRolled, isRolling, validMoves, winner, isAutomatedTurn, isAnimatingMove]);

  // Pointer and Keyboard Hold-to-Roll Handlers (Secret 500ms Hold Trick)
  const handleRollPointerDown = (e: React.PointerEvent) => {
    if (isRolling || hasRolled || winner || isAnimatingMove || isAutomatedTurn) return;
    if (isOnline && !isMyOnlineTurn) return;

    rollPressStartTimeRef.current = performance.now();
    hasHandledReleaseRef.current = false;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  const handleRollPointerUp = (e: React.PointerEvent) => {
    if (rollPressStartTimeRef.current === null) return;
    const elapsedMs = performance.now() - rollPressStartTimeRef.current;
    rollPressStartTimeRef.current = null;
    hasHandledReleaseRef.current = true;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    const forceSix = elapsedMs >= DICE_HOLD_THRESHOLD_MS;
    handleRollDice(false, forceSix);
  };

  const handleRollPointerCancel = (e: React.PointerEvent) => {
    rollPressStartTimeRef.current = null;
    hasHandledReleaseRef.current = true;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  const handleRollClick = () => {
    if (hasHandledReleaseRef.current) {
      hasHandledReleaseRef.current = false;
      return;
    }
    handleRollDice(false, false);
  };

  const handleRollKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      if (e.repeat) return;
      if (isRolling || hasRolled || winner || isAnimatingMove || isAutomatedTurn) return;
      if (isOnline && !isMyOnlineTurn) return;
      if (rollPressStartTimeRef.current === null) {
        rollPressStartTimeRef.current = performance.now();
        hasHandledReleaseRef.current = false;
      }
    }
  };

  const handleRollKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      if (rollPressStartTimeRef.current !== null) {
        const elapsedMs = performance.now() - rollPressStartTimeRef.current;
        rollPressStartTimeRef.current = null;
        hasHandledReleaseRef.current = true;
        const forceSix = elapsedMs >= DICE_HOLD_THRESHOLD_MS;
        handleRollDice(false, forceSix);
      }
    }
  };

  // Smart Auto-Capture / Distance Assist trigger (Purple circle on active dice container)
  const handleTriggerAutoCapture = () => {
    if (isRolling || hasRolled || winner || isAnimatingMove) return;
    if (isOnline && !isMyOnlineTurn) return;

    const currentPlayer = players[activePlayerIndex];
    if (!currentPlayer) return;

    const smartRoll = calculateSmartAutoCaptureRoll(currentPlayer, players, options);
    handleRollDice(false, smartRoll === 6, smartRoll);
  };

  // Dice Roll (Secret Hold: >= 500ms forces 6; normal tap produces standard 1-6 RNG; desiredRoll overrides if provided)
  const handleRollDice = (
    fromRemote: boolean = false,
    forceSix: boolean = false,
    desiredRoll?: number,
    actingSeatIndex?: number
  ) => {
    const targetPlayerIndex = typeof actingSeatIndex === 'number' ? actingSeatIndex : activePlayerIndexRef.current;

    if (isRollingRef.current || hasRolledRef.current || winner || isAnimatingMoveRef.current) {
      if (multiplayerSession?.isHost) {
        onlineLudoController.clearActionInFlight();
      }
      return;
    }
    if (!canExecuteLocally(targetPlayerIndex, fromRemote)) return;

    if (isOnline && !multiplayerSession?.isHost) {
      soundEffects.playDiceRoll();
      setIsRolling(true);
      isRollingRef.current = true;
      onlineLudoController.requestRoll(targetPlayerIndex, forceSix, desiredRoll);

      if (guestRollTimeoutRef.current) clearTimeout(guestRollTimeoutRef.current);
      guestRollTimeoutRef.current = setTimeout(() => {
        setIsRolling((current) => {
          if (current && !hasRolledRef.current) {
            isRollingRef.current = false;
            return false;
          }
          return current;
        });
      }, 4000);
      return;
    }

    if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
    const rollSession = ++currentRollSessionRef.current;

    soundEffects.playDiceRoll();
    setIsRolling(true);
    isRollingRef.current = true;

    // Immediately broadcast rolling snapshot so all remote players see the dice rolling
    if (multiplayerSession?.isHost) {
      onlineLudoController.broadcastSnapshot({
        matchId: multiplayerSession.matchId,
        sequence: 0,
        players: playersRef.current,
        activePlayerIndex: targetPlayerIndex,
        diceValue: diceValueRef.current,
        hasRolled: false,
        isRolling: true,
        consecutiveSixes,
        winner,
        rankings,
      });
    }

    const roll =
      typeof desiredRoll === 'number' && Number.isInteger(desiredRoll) && desiredRoll >= 1 && desiredRoll <= 6
        ? desiredRoll
        : forceSix
          ? 6
          : Math.floor(Math.random() * 6) + 1;
    const rollDuration = DICE_ROLL_DURATION_MS;

    if (diceRollTimerRef.current) clearTimeout(diceRollTimerRef.current);
    diceRollTimerRef.current = setTimeout(() => {
      if (rollSession !== currentRollSessionRef.current) return;
      setDiceValue(roll);
      diceValueRef.current = roll;
      setIsRolling(false);
      isRollingRef.current = false;
      setHasRolled(true);
      hasRolledRef.current = true;

      const currentPlayers = playersRef.current;
      const currentPlayer = currentPlayers[targetPlayerIndex];

      // Check Consecutive Sixes rule
      let newConsecutiveSixes = roll === 6 ? consecutiveSixes + 1 : 0;
      setConsecutiveSixes(newConsecutiveSixes);

      const maxSixes = options.maxConsecutiveSixes || 3;
      if (newConsecutiveSixes >= maxSixes) {
        setConsecutiveSixes(0);
        if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
        turnTimerRef.current = setTimeout(() => {
          if (rollSession === currentRollSessionRef.current) {
            advanceTurn(false);
          }
        }, 800);
        return;
      }

      // Calculate Valid Moves with options
      const legalMoves = LudoEngine.getValidMoves(currentPlayer, roll, currentPlayers, options);
      setValidMoves(legalMoves);
      validMovesRef.current = legalMoves;

      if (multiplayerSession?.isHost) {
        onlineLudoController.broadcastSnapshot({
          matchId: multiplayerSession.matchId,
          sequence: 0,
          players: currentPlayers,
          activePlayerIndex: targetPlayerIndex,
          diceValue: roll,
          hasRolled: true,
          isRolling: false,
          consecutiveSixes: newConsecutiveSixes,
          winner,
          rankings,
        });
      }

      if (legalMoves.length === 0) {
        setTurnPassNotice(`Rolled ${roll} — No Moves Available`);
        const nextDelay = PASS_TURN_DELAY_MS;
        if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
        turnTimerRef.current = setTimeout(() => {
          if (rollSession === currentRollSessionRef.current) {
            setTurnPassNotice(null);
            advanceTurn(false);
          }
        }, nextDelay);
      } else {
        setTurnPassNotice(null);
      }
    }, rollDuration);
  };

  // Move Token Animation & Execution
  const handleSelectToken = async (tokenId: number, fromRemote: boolean = false, actingSeatIndex?: number) => {
    const targetPlayerIndex = typeof actingSeatIndex === 'number' ? actingSeatIndex : activePlayerIndexRef.current;

    if (!hasRolledRef.current || isRollingRef.current || winner || isAnimatingMoveRef.current) {
      if (multiplayerSession?.isHost) {
        onlineLudoController.clearActionInFlight();
      }
      return;
    }
    if (!canExecuteLocally(targetPlayerIndex, fromRemote)) return;

    if (isOnline && !multiplayerSession?.isHost) {
      setIsAnimatingMove(true);
      isAnimatingMoveRef.current = true;
      setValidMoves([]);
      validMovesRef.current = [];
      onlineLudoController.requestMove(tokenId, targetPlayerIndex);
      return;
    }

    const currentPlayers = playersRef.current;
    const currentPlayer = currentPlayers[targetPlayerIndex];
    if (!currentPlayer) {
      if (multiplayerSession?.isHost) {
        onlineLudoController.clearActionInFlight();
      }
      return;
    }
    const currentDice = diceValueRef.current;

    // Authoritatively calculate legal moves for currentPlayer and currentDice
    const legalMoves = LudoEngine.getValidMoves(currentPlayer, currentDice, currentPlayers, options);
    validMovesRef.current = legalMoves;
    const move = legalMoves.find((m) => m.tokenId === tokenId);
    if (!move) {
      if (multiplayerSession?.isHost) {
        onlineLudoController.clearActionInFlight();
      }
      return;
    }

    const token = currentPlayer.tokens.find((t) => t.id === tokenId);
    if (!token) {
      if (multiplayerSession?.isHost) {
        onlineLudoController.clearActionInFlight();
      }
      return;
    }

    // Authoritative transaction resolution from pure engine
    const tx = LudoEngine.resolveMoveTransaction(
      targetPlayerIndex,
      tokenId,
      currentDice,
      currentPlayers,
      options,
      rankings.length
    );
    if (!tx) {
      if (multiplayerSession?.isHost) {
        onlineLudoController.clearActionInFlight();
      }
      return;
    }

    // Broadcast TOKEN_MOVE event so all connected guests animate smoothly in sync!
    if (multiplayerSession?.isHost) {
      onlineLudoController.broadcastTokenMove(targetPlayerIndex, tokenId, token.step, move.toStep);
    }

    // Invalidate any prior move transactions and identify this session
    const sessionId = ++currentMoveSessionRef.current;
    isAnimatingMoveRef.current = true;

    // 1. FLUSH PRE-ANIMATION STATE UPDATES IMMEDIATELY
    // Prevents React rerender (from setValidMoves / setIsAnimatingMove) from overwriting
    // the first hop or yard-exit transform with the token's old position
    validMovesRef.current = [];
    setTurnPassNotice(null);
    flushSync(() => {
      setIsAnimatingMove(true);
      setValidMoves([]);
      setHoveredTokenId(null);
    });

    const hopDuration = TOKEN_HOP_DURATION_MS;
    const playerColor = currentPlayer.config.color;
    const tokenKey = `${playerColor}-${tokenId}`;

    const tokenEl = typeof document !== 'undefined'
      ? document.getElementById(`ludo-token-${tokenKey}`)
      : null;
    const boardEl = tokenEl?.parentElement;
    const boardWidth = boardEl ? boardEl.clientWidth : 0;

    if (move.isExitYard || token.step === -1) {
      // 1. OPENING MOVE: YARD TO STARTING CELL
      const startTilePos = getLudoVisualPosition(playerColor, tokenId, 0, boardStyle);
      soundEffects.playSafeSquare();

      if (tokenEl && boardWidth > 0) {
        tokenEl.style.transition = 'transform 420ms cubic-bezier(0.25, 1, 0.5, 1)';
        tokenEl.style.zIndex = '50';
        tokenEl.style.transform = `translate3d(${startTilePos.x * boardWidth}px, ${startTilePos.y * boardWidth}px, 0) translate(-50%, -50%)`;
      }
      await new Promise((r) => setTimeout(r, 420));
      if (sessionId !== currentMoveSessionRef.current) return;
    } else {
      // 2. STEP-BY-STEP GPU-ACCELERATED HOPPING (Imperative DOM transform, ZERO React state updates)
      if (tokenEl) {
        tokenEl.style.zIndex = '50';
      }
      for (let step = token.step + 1; step <= move.toStep; step++) {
        if (sessionId !== currentMoveSessionRef.current) return;
        const toPos = getLudoVisualPosition(playerColor, tokenId, step, boardStyle);

        if (tokenEl && boardWidth > 0) {
          tokenEl.style.transition = `transform ${hopDuration}ms cubic-bezier(0.25, 1, 0.5, 1)`;
          tokenEl.style.transform = `translate3d(${toPos.x * boardWidth}px, ${toPos.y * boardWidth}px, 0) translate(-50%, -50%)`;
        }

        soundEffects.playHop(step);

        // Await GPU transform completion
        await new Promise((r) => setTimeout(r, hopDuration));
        if (sessionId !== currentMoveSessionRef.current) return;
      }
    }

    // 3. CAPTURED TOKEN RETURN ANIMATION (Imperative GPU glide back to yard before state commit)
    const capturedEls: HTMLElement[] = [];
    if (tx.capturedTokens.length > 0) {
      soundEffects.playCapture();
      if (boardWidth > 0 && typeof document !== 'undefined') {
        for (const target of tx.capturedTokens) {
          const targetEl = document.getElementById(`ludo-token-${target.color}-${target.tokenId}`);
          if (targetEl) {
            const targetYardPos = getLudoVisualPosition(target.color, target.tokenId, -1, boardStyle);
            targetEl.style.zIndex = '40';
            targetEl.style.transition = 'transform 350ms cubic-bezier(0.25, 1, 0.5, 1), opacity 350ms ease';
            targetEl.style.transform = `translate3d(${targetYardPos.x * boardWidth}px, ${targetYardPos.y * boardWidth}px, 0) translate(-50%, -50%)`;
            targetEl.style.opacity = '0.7';
            capturedEls.push(targetEl);
          }
        }
        await new Promise((r) => setTimeout(r, 350));
        if (sessionId !== currentMoveSessionRef.current) return;
      }
    }

    // 4. SYNCHRONOUS ATOMIC STATE COMMIT (React renders authoritative positions before any effects)
    if (tokenEl) {
      tokenEl.style.transition = '';
      tokenEl.style.transform = '';
      tokenEl.style.zIndex = '';
    }
    for (const el of capturedEls) {
      el.style.transition = '';
      el.style.transform = '';
      el.style.opacity = '';
      el.style.zIndex = '';
    }
    if (sessionId !== currentMoveSessionRef.current) return;
    playersRef.current = tx.updatedPlayers;
    flushSync(() => {
      setPlayers(tx.updatedPlayers);
    });

    // 5. COMBAT CAPTURE RESOLUTION & CELEBRATION (Safely run on committed state)
    if (tx.capturedTokens.length > 0) {
      const landingPos = getLudoVisualPosition(playerColor, tokenId, move.toStep, boardStyle);

      // Strike flash, shake, sound, and confetti
      addEffect('combat_explosion', landingPos, playerColor, undefined, 600);
      addEffect('capture_banner', landingPos, playerColor, '💥 CAPTURE!', 900);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 450);
      fireCelebrationBurst();

      // Landing dust puff at yard
      tx.capturedTokens.forEach((target) => {
        const targetYardPos = getLudoVisualPosition(target.color, target.tokenId, -1, boardStyle);
        addEffect('capture_dust', targetYardPos, target.color, undefined, 400);
      });
      await new Promise((r) => setTimeout(r, 450));
      if (sessionId !== currentMoveSessionRef.current) return;
    }

    // 6. HOME GOAL CELEBRATION
    if (tx.reachedHome) {
      const homePos = getLudoVisualPosition(playerColor, tokenId, 56, boardStyle);
      addEffect('home_crown', homePos, playerColor, undefined, 1000);
      soundEffects.playSafeSquare();
      fireCelebrationBurst();
      await new Promise((r) => setTimeout(r, 400));
      if (sessionId !== currentMoveSessionRef.current) return;
    }

    const finalWinner = tx.playerWonNow && tx.newRank === 1 ? currentPlayer.config : winner;
    const finalRankings = tx.playerWonNow && tx.newRank ? [...rankings, { player: currentPlayer.config, rank: tx.newRank }] : rankings;

    if (multiplayerSession?.isHost) {
      onlineLudoController.broadcastSnapshot({
        matchId: multiplayerSession.matchId,
        sequence: 0,
        players: tx.updatedPlayers,
        activePlayerIndex: targetPlayerIndex,
        diceValue,
        hasRolled: true,
        isRolling: false,
        consecutiveSixes,
        winner: finalWinner,
        rankings: finalRankings,
      });
    }

    if (tx.playerWonNow && tx.newRank) {
      setRankings((prev) => [...prev, { player: currentPlayer.config, rank: tx.newRank! }]);

      if (tx.newRank === 1) {
        setWinner(currentPlayer.config);
        setIsAnimatingMove(false);
        isAnimatingMoveRef.current = false;
        return;
      }
    }

    setIsAnimatingMove(false);
    isAnimatingMoveRef.current = false;

    const nextDelay = AFTER_MOVE_DELAY_MS;
    if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
    turnTimerRef.current = setTimeout(() => {
      if (sessionId === currentMoveSessionRef.current) {
        advanceTurn(tx.bonusTurn, tx.updatedPlayers);
      }
    }, nextDelay);
  };

  // Smooth remote token move animation on guest clients
  const animateRemoteMove = async (
    seatIndex: number,
    tokenId: number,
    fromStep: number,
    toStep: number
  ) => {
    let tokenEl: HTMLElement | null = null;
    try {
      const sessionId = ++currentMoveSessionRef.current;
      isAnimatingMoveRef.current = true;
      validMovesRef.current = [];
      setTurnPassNotice(null);
      flushSync(() => {
        setIsAnimatingMove(true);
        setValidMoves([]);
        setHoveredTokenId(null);
      });

      const currentPlayers = playersRef.current;
      const currentPlayer = currentPlayers[seatIndex];
      const playerColor = currentPlayer?.config.color;
      const tokenKey = playerColor ? `${playerColor}-${tokenId}` : null;

      tokenEl = tokenKey && typeof document !== 'undefined'
        ? document.getElementById(`ludo-token-${tokenKey}`)
        : null;
      const boardEl = tokenEl?.parentElement;
      const boardWidth = boardEl ? boardEl.clientWidth : 0;
      const hopDuration = TOKEN_HOP_DURATION_MS;

      if (!currentPlayer || !playerColor) {
        return;
      }
      if (fromStep === -1) {
        // Opening move: yard to starting cell (420ms smooth glide)
        const startTilePos = getLudoVisualPosition(playerColor, tokenId, 0, boardStyle);
        soundEffects.playSafeSquare();

        if (tokenEl && boardWidth > 0) {
          tokenEl.style.transition = 'transform 420ms cubic-bezier(0.25, 1, 0.5, 1)';
          tokenEl.style.zIndex = '50';
          tokenEl.style.transform = `translate3d(${startTilePos.x * boardWidth}px, ${startTilePos.y * boardWidth}px, 0) translate(-50%, -50%)`;
        }
        await new Promise((r) => setTimeout(r, 420));
      } else {
        // Step-by-step GPU-accelerated hopping
        if (tokenEl) {
          tokenEl.style.zIndex = '50';
        }
        for (let step = fromStep + 1; step <= toStep; step++) {
          if (sessionId !== currentMoveSessionRef.current) break;
          const toPos = getLudoVisualPosition(playerColor, tokenId, step, boardStyle);

          if (tokenEl && boardWidth > 0) {
            tokenEl.style.transition = `transform ${hopDuration}ms cubic-bezier(0.25, 1, 0.5, 1)`;
            tokenEl.style.transform = `translate3d(${toPos.x * boardWidth}px, ${toPos.y * boardWidth}px, 0) translate(-50%, -50%)`;
          }

          soundEffects.playHop(step);
          await new Promise((r) => setTimeout(r, hopDuration));
        }
      }
    } finally {
      if (tokenEl) {
        tokenEl.style.transition = '';
        tokenEl.style.transform = '';
        tokenEl.style.zIndex = '';
      }

      // Always clear animation state flags on every exit path
      setIsAnimatingMove(false);
      isAnimatingMoveRef.current = false;

      // Drain and apply any queued authoritative state snapshot
      if (pendingSnapshotRef.current) {
        const s = pendingSnapshotRef.current;
        pendingSnapshotRef.current = null;
        applyStateSnapshot(s);
      }
    }
  };

  useEffect(() => {
    handleRollDiceRef.current = handleRollDice;
    handleSelectTokenRef.current = handleSelectToken;
    animateRemoteMoveRef.current = animateRemoteMove;
  });

  const advanceTurn = (samePlayer: boolean, latestPlayers?: LudoPlayerState[]) => {
    if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
    if (guestRollTimeoutRef.current) clearTimeout(guestRollTimeoutRef.current);

    const currentPlayers = latestPlayers || playersRef.current;
    let nextIdx = activePlayerIndexRef.current;
    let nextConsecutiveSixes = samePlayer ? consecutiveSixes : 0;

    if (!samePlayer) {
      nextConsecutiveSixes = 0;
      nextIdx = (nextIdx + 1) % currentPlayers.length;
      let loopCount = 0;
      while (currentPlayers[nextIdx].rank && loopCount < currentPlayers.length) {
        nextIdx = (nextIdx + 1) % currentPlayers.length;
        loopCount++;
      }
    }

    setTurnPassNotice(null);
    activePlayerIndexRef.current = nextIdx;
    hasRolledRef.current = false;
    isRollingRef.current = false;
    playersRef.current = currentPlayers;
    validMovesRef.current = [];

    setHasRolled(false);
    setIsRolling(false);
    setValidMoves([]);
    setHoveredTokenId(null);
    setConsecutiveSixes(nextConsecutiveSixes);
    setActivePlayerIndex(nextIdx);

    if (multiplayerSession?.isHost) {
      onlineLudoController.broadcastSnapshot({
        matchId: multiplayerSession.matchId,
        sequence: 0,
        players: currentPlayers,
        activePlayerIndex: nextIdx,
        diceValue: diceValueRef.current,
        hasRolled: false,
        isRolling: false,
        consecutiveSixes: nextConsecutiveSixes,
        winner,
        rankings,
      });
    }
  };

  const handleRestart = () => {
    currentMoveSessionRef.current++;
    currentRollSessionRef.current++;
    if (botActionTimerRef.current) clearTimeout(botActionTimerRef.current);
    if (diceRollTimerRef.current) clearTimeout(diceRollTimerRef.current);
    if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
    setIsRolling(false);

    if (typeof document !== 'undefined') {
      const tokenEls = document.querySelectorAll('[id^="ludo-token-"]');
      tokenEls.forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.transition = '';
        htmlEl.style.transform = '';
        htmlEl.style.opacity = '';
        htmlEl.style.zIndex = '';
      });
    }

    setPlayers((prev) =>
      prev.map((p) => ({
        ...p,
        tokens: [
          { id: 0, color: p.config.color, step: -1, status: 'yard', trackIndex: -1 },
          { id: 1, color: p.config.color, step: -1, status: 'yard', trackIndex: -1 },
          { id: 2, color: p.config.color, step: -1, status: 'yard', trackIndex: -1 },
          { id: 3, color: p.config.color, step: -1, status: 'yard', trackIndex: -1 },
        ],
        tokensHome: 0,
        tokensCaptured: 0,
        tokensLost: 0,
        rank: undefined,
      }))
    );
    setActivePlayerIndex(0);
    setDiceValue(1);
    setHasRolled(false);
    setValidMoves([]);
    setConsecutiveSixes(0);
    setWinner(null);
    setRankings([]);
    setEffects([]);
    setIsAnimatingMove(false);
    setHoveredTokenId(null);
    rollPressStartTimeRef.current = null;
    hasHandledReleaseRef.current = false;
  };

  const handleStartConfiguredMatch = (newPlayers: PlayerConfig[]) => {
    currentMoveSessionRef.current++;
    currentRollSessionRef.current++;
    if (botActionTimerRef.current) clearTimeout(botActionTimerRef.current);
    if (diceRollTimerRef.current) clearTimeout(diceRollTimerRef.current);
    if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
    setIsRolling(false);

    if (typeof document !== 'undefined') {
      const tokenEls = document.querySelectorAll('[id^="ludo-token-"]');
      tokenEls.forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.transition = '';
        htmlEl.style.transform = '';
        htmlEl.style.opacity = '';
        htmlEl.style.zIndex = '';
      });
    }

    setPlayers(
      newPlayers.map((p) => ({
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
      }))
    );
    setActivePlayerIndex(0);
    setDiceValue(1);
    setHasRolled(false);
    setValidMoves([]);
    setConsecutiveSixes(0);
    setWinner(null);
    setRankings([]);
    setEffects([]);
    setIsAnimatingMove(false);
    setHoveredTokenId(null);
    setShowSetupModal(false);
  };

  const handleHome = () => {
    currentMoveSessionRef.current++;
    currentRollSessionRef.current++;
    if (botActionTimerRef.current) clearTimeout(botActionTimerRef.current);
    if (diceRollTimerRef.current) clearTimeout(diceRollTimerRef.current);
    if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
    setIsRolling(false);
    onHome();
  };

  const handleOpenSetup = () => {
    currentMoveSessionRef.current++;
    currentRollSessionRef.current++;
    if (botActionTimerRef.current) clearTimeout(botActionTimerRef.current);
    if (diceRollTimerRef.current) clearTimeout(diceRollTimerRef.current);
    if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
    setIsRolling(false);
    if (onOpenSetup) {
      onOpenSetup();
    } else {
      setShowSetupModal(true);
    }
  };

  // Derive Path Preview for hovered token
  const currentPreview: PathPreviewData | null = (() => {
    if (hoveredTokenId === null || !hasRolled || isRolling || isAnimatingMove || !activePlayer) {
      return null;
    }
    const move = validMoves.find((m) => m.tokenId === hoveredTokenId);
    if (!move) return null;
    return derivePathPreview(move, activePlayer.config.color, players, boardStyle);
  })();

  const redPlayer = players.find((p) => p.config.color === 'red');
  const greenPlayer = players.find((p) => p.config.color === 'green');
  const yellowPlayer = players.find((p) => p.config.color === 'yellow');
  const bluePlayer = players.find((p) => p.config.color === 'blue');

  return (
    <div className="flex-1 flex flex-col justify-center items-center max-w-[1680px] w-full mx-auto px-2 sm:px-4 lg:px-6 py-1 sm:py-2 gap-2 sm:gap-4 min-h-0 relative isolate">
      {/* Decorative Fixed 90-Degree Top-Down Luxury Wood Tabletop Theme Background */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none" aria-hidden="true">
        <img
          src="/assets/ludo_bg_topdown_wood.jpg"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover object-center filter brightness-[0.82] contrast-[1.05]"
        />
        {/* Overhead radial vignette: subtle bright center under board, darkening toward table edges */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.15)_0%,rgba(0,0,0,0.55)_100%)]" />
      </div>

      {/* Top Settings Bar */}
      <SettingsBar
        onRestart={handleRestart}
        onHome={handleHome}
        onOpenRules={() => setShowRules(true)}
        onOpenSetup={handleOpenSetup}
        gameTitle="Royal Ludo (🎲 3D Physics)"
        boardStyle={boardStyle}
        onToggleBoardStyle={() => setBoardStyle(boardStyle === 'luxury' ? 'classic' : 'luxury')}
      />

      {/* Online Multiplayer Match Banner */}
      {isOnline && (
        <div className="w-full py-2 px-4 rounded-xl bg-[#2a170c]/90 border border-[#4d2a15] flex items-center justify-between shadow-sm select-none relative z-10">
          <div className="flex items-center gap-2.5 text-xs font-bold text-[#f6ead7]">
            <Wifi className="w-4 h-4 text-amber-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>ONLINE ROOM: <strong className="font-mono text-white tracking-wider">{multiplayerSession?.roomCode}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#cdb99d] font-medium hidden sm:inline">You are playing as:</span>
            <span
              className="font-bold px-2.5 py-0.5 rounded-lg text-white text-[11px] shadow border border-white/20"
              style={{
                backgroundColor: COLOR_MAP[multiplayerSession?.players[multiplayerSession.mySeatIndex]?.color || 'red'].primary,
              }}
            >
              {multiplayerSession?.players[multiplayerSession.mySeatIndex]?.avatar}{' '}
              {multiplayerSession?.players[multiplayerSession.mySeatIndex]?.name}
            </span>
          </div>
        </div>
      )}

      {/* Main Game Stage with Side Corner Docks */}
      {turnPassNotice && (
        <div className="w-full max-w-sm mx-auto px-4 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs sm:text-sm font-bold text-center shadow-lg animate-pulse select-none z-30">
          <span>{turnPassNotice}</span>
        </div>
      )}
      <div className="ludo-stage-grid relative z-10">
        {/* Red Home Dock (Top-Left on Desktop, Top-Left on Mobile) */}
        <div className="ludo-area-red self-start">
          <PlayerCornerDock
            color="red"
            corner="top-left"
            playerState={redPlayer}
            isActive={activePlayer?.config.color === 'red'}
            diceValue={diceValue}
            isRolling={isRolling}
            canRoll={!isRolling && !hasRolled && !isAnimatingMove && !isAutomatedTurn && (!isOnline || isMyOnlineTurn)}
            hasRolled={hasRolled}
            isAnimatingMove={isAnimatingMove}
            isAutomatedTurn={isAutomatedTurn}
            isOnline={isOnline}
            isMyOnlineTurn={isMyOnlineTurn}
            onRollPointerDown={handleRollPointerDown}
            onRollPointerUp={handleRollPointerUp}
            onRollPointerCancel={handleRollPointerCancel}
            onRollKeyDown={handleRollKeyDown}
            onRollKeyUp={handleRollKeyUp}
            onRollClick={handleRollClick}
            onTriggerAutoCapture={handleTriggerAutoCapture}
            noMovesNotice={activePlayer?.config.color === 'red' ? turnPassNotice : null}
          />
        </div>

        {/* Green Home Dock (Top-Right on Desktop, Top-Right on Mobile) */}
        <div className="ludo-area-green self-start">
          <PlayerCornerDock
            color="green"
            corner="top-right"
            playerState={greenPlayer}
            isActive={activePlayer?.config.color === 'green'}
            diceValue={diceValue}
            isRolling={isRolling}
            canRoll={!isRolling && !hasRolled && !isAnimatingMove && !isAutomatedTurn && (!isOnline || isMyOnlineTurn)}
            hasRolled={hasRolled}
            isAnimatingMove={isAnimatingMove}
            isAutomatedTurn={isAutomatedTurn}
            isOnline={isOnline}
            isMyOnlineTurn={isMyOnlineTurn}
            onRollPointerDown={handleRollPointerDown}
            onRollPointerUp={handleRollPointerUp}
            onRollPointerCancel={handleRollPointerCancel}
            onRollKeyDown={handleRollKeyDown}
            onRollKeyUp={handleRollKeyUp}
            onRollClick={handleRollClick}
            onTriggerAutoCapture={handleTriggerAutoCapture}
            noMovesNotice={activePlayer?.config.color === 'green' ? turnPassNotice : null}
          />
        </div>

        {/* The Board (Center of Stage) */}
        <div className="ludo-area-board">
          <LudoBoard
            players={players}
            activeColor={activePlayer?.config.color || 'red'}
            validMoves={validMoves}
            onTokenClick={handleSelectToken}
            onTokenHover={setHoveredTokenId}
            isRolling={isRolling}
            boardStyle={boardStyle}
            isShaking={isShaking}
            effects={effects}
            pathPreview={currentPreview}
          />
        </div>

        {/* Yellow Home Dock (Bottom-Left on Desktop, Bottom-Left on Mobile) */}
        <div className="ludo-area-yellow self-end">
          <PlayerCornerDock
            color="yellow"
            corner="bottom-left"
            playerState={yellowPlayer}
            isActive={activePlayer?.config.color === 'yellow'}
            diceValue={diceValue}
            isRolling={isRolling}
            canRoll={!isRolling && !hasRolled && !isAnimatingMove && !isAutomatedTurn && (!isOnline || isMyOnlineTurn)}
            hasRolled={hasRolled}
            isAnimatingMove={isAnimatingMove}
            isAutomatedTurn={isAutomatedTurn}
            isOnline={isOnline}
            isMyOnlineTurn={isMyOnlineTurn}
            onRollPointerDown={handleRollPointerDown}
            onRollPointerUp={handleRollPointerUp}
            onRollPointerCancel={handleRollPointerCancel}
            onRollKeyDown={handleRollKeyDown}
            onRollKeyUp={handleRollKeyUp}
            onRollClick={handleRollClick}
            onTriggerAutoCapture={handleTriggerAutoCapture}
            noMovesNotice={activePlayer?.config.color === 'yellow' ? turnPassNotice : null}
          />
        </div>

        {/* Blue Home Dock (Bottom-Right on Desktop, Bottom-Right on Mobile) */}
        <div className="ludo-area-blue self-end">
          <PlayerCornerDock
            color="blue"
            corner="bottom-right"
            playerState={bluePlayer}
            isActive={activePlayer?.config.color === 'blue'}
            diceValue={diceValue}
            isRolling={isRolling}
            canRoll={!isRolling && !hasRolled && !isAnimatingMove && !isAutomatedTurn && (!isOnline || isMyOnlineTurn)}
            hasRolled={hasRolled}
            isAnimatingMove={isAnimatingMove}
            isAutomatedTurn={isAutomatedTurn}
            isOnline={isOnline}
            isMyOnlineTurn={isMyOnlineTurn}
            onRollPointerDown={handleRollPointerDown}
            onRollPointerUp={handleRollPointerUp}
            onRollPointerCancel={handleRollPointerCancel}
            onRollKeyDown={handleRollKeyDown}
            onRollKeyUp={handleRollKeyUp}
            onRollClick={handleRollClick}
            onTriggerAutoCapture={handleTriggerAutoCapture}
            noMovesNotice={activePlayer?.config.color === 'blue' ? turnPassNotice : null}
          />
        </div>
      </div>

      {/* Rules Modal */}
      {showRules && <RulesModal initialGame="ludo" onClose={() => setShowRules(false)} />}

      {/* Match Setup Modal (2P / 3P / 4P & Human vs Bot) */}
      <LudoSetupModal
        isOpen={showSetupModal}
        onStartGame={handleStartConfiguredMatch}
        onClose={() => setShowSetupModal(false)}
      />

      {/* Victory Modal */}
      {winner && (
        <VictoryModal
          winner={winner}
          rankings={rankings}
          onRematch={handleRestart}
          onHome={handleHome}
        />
      )}

      {/* Network Disconnect Overlay for Online Mode */}
      {networkDisconnectError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="max-w-md w-full bg-slate-900 border border-red-500/40 rounded-3xl p-6 text-center shadow-2xl space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center text-3xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Connection Lost</h3>
              <p className="text-xs text-slate-400 mt-1">{networkDisconnectError}</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleHome}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg cursor-pointer"
              >
                Return to Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
