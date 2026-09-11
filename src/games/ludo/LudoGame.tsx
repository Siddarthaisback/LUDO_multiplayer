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
import { Wifi, MessageCircle } from 'lucide-react';
import { MultiplayerSession, GameSnapshot } from '../../multiplayer/protocol';
import { onlineLudoController } from '../../multiplayer/onlineLudoController';
import { triggerHaptic } from '../../utils/haptics';
import { QuickChatModal } from './QuickChatModal';
import { FloatingEmotesLayer, FloatingEmoteItem } from './FloatingEmotesLayer';
import { TurnTimeoutManager } from './turnTimeoutManager';
import {
  handleDiceCornerTap,
  consumeArmedCheatOnRoll,
  resetDiceCornerRitual,
  INITIAL_RITUAL_STATE,
  DiceCornerRitualState,
  DiceCorner,
  resolveRollOutcome,
} from './diceCornerRitual';

const BOT_ROLL_DELAY_MS = 650;
const BOT_MOVE_DELAY_MS = 550;
const DICE_ROLL_DURATION_MS = 600;
const TOKEN_HOP_DURATION_MS = 200;
const PASS_TURN_DELAY_MS = 1000;
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
  const [actionRejectedNotice, setActionRejectedNotice] = useState<string | null>(null);

  const [boardStyle, setBoardStyle] = useState<'luxury' | 'classic'>('classic');
  const [isShaking, setIsShaking] = useState(false);

  // Animation & Visual Effect States
  const [effects, setEffects] = useState<BoardEffectItem[]>([]);
  const [hoveredTokenId, setHoveredTokenId] = useState<number | null>(null);
  const [isAnimatingMove, setIsAnimatingMove] = useState(false);
  const [showQuickChat, setShowQuickChat] = useState<boolean>(false);
  const [floatingEmotes, setFloatingEmotes] = useState<FloatingEmoteItem[]>([]);
  const [turnCountdown, setTurnCountdown] = useState<number | undefined>(undefined);
  const [turnCycleId, setTurnCycleId] = useState<number>(0);
  const [turnCount, setTurnCount] = useState<number>(0);
  const [ritualState, setRitualState] = useState<DiceCornerRitualState>(INITIAL_RITUAL_STATE);

  // Synchronized refs to eliminate race conditions and stale closures in network callbacks
  const activePlayerIndexRef = useRef<number>(activePlayerIndex);
  const hasRolledRef = useRef<boolean>(hasRolled);
  const isRollingRef = useRef<boolean>(isRolling);
  const playersRef = useRef<LudoPlayerState[]>(players);
  const isAnimatingMoveRef = useRef<boolean>(isAnimatingMove);
  const diceValueRef = useRef<number>(diceValue);
  const validMovesRef = useRef<MoveOption[]>(validMoves);
  const isTimedOutRef = useRef<boolean>(false);
  const isMyOnlineTurnRef = useRef<boolean>(isMyOnlineTurn);
  const guestRollTimeoutRef = useRef<any>(null);
  const turnCountRef = useRef<number>(0);
  const ritualStateRef = useRef<DiceCornerRitualState>(INITIAL_RITUAL_STATE);

  useEffect(() => {
    activePlayerIndexRef.current = activePlayerIndex;
    hasRolledRef.current = hasRolled;
    isRollingRef.current = isRolling;
    playersRef.current = players;
    isAnimatingMoveRef.current = isAnimatingMove;
    diceValueRef.current = diceValue;
    validMovesRef.current = validMoves;
    isMyOnlineTurnRef.current = isMyOnlineTurn;
    turnCountRef.current = turnCount;
    ritualStateRef.current = ritualState;
  }, [activePlayerIndex, hasRolled, isRolling, players, isAnimatingMove, diceValue, validMoves, isMyOnlineTurn, turnCount, ritualState]);

  const activePlayer = players[activePlayerIndex];
  // In online mode, host automates bot turns; in local mode, bots auto-play their turns
  const isAutomatedTurn = isOnline
    ? Boolean(multiplayerSession?.isHost && activePlayer?.config.type === 'bot')
    : activePlayer?.config.type === 'bot';
  const botActionTimerRef = useRef<any>(null);
  const diceRollTimerRef = useRef<any>(null);
  const turnTimerRef = useRef<any>(null);
  const timeoutManagerRef = useRef<TurnTimeoutManager>(new TurnTimeoutManager());
  const currentMoveSessionRef = useRef<number>(0);
  const currentRollSessionRef = useRef<number>(0);
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
      timeoutManagerRef.current.stop();
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
    if (!snapshot.hasRolled && !snapshot.isRolling) {
      setTurnCycleId((c) => c + 1);
    }
    if (snapshot.winner) setWinner(snapshot.winner);
    if (snapshot.rankings) setRankings(snapshot.rankings);
    if (snapshot.isRolling && isOnline) {
      timeoutManagerRef.current.stop();
    }

    const isPostMove = snapshot.lastAction?.type === 'MOVE' || isAnimatingMoveRef.current;

    if (snapshot.hasRolled && !isPostMove && snapshot.activePlayerIndex === multiplayerSession?.mySeatIndex) {
      const myPlayer = snapshot.players[snapshot.activePlayerIndex];
      const legalMoves = LudoEngine.getValidMoves(myPlayer, snapshot.diceValue, snapshot.players, options);
      setValidMoves(legalMoves);
      validMovesRef.current = legalMoves;
      if (legalMoves.length > 0) {
        if (!timeoutManagerRef.current.getIsTimedOut()) {
          timeoutManagerRef.current.startTurn(15);
        }
      }
    } else {
      setValidMoves([]);
      validMovesRef.current = [];
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
      onRemoteActionRejected: (actionType: 'ROLL' | 'MOVE', reason: string) => {
        if (guestRollTimeoutRef.current) clearTimeout(guestRollTimeoutRef.current);
        setIsRolling(false);
        isRollingRef.current = false;
        setIsAnimatingMove(false);
        isAnimatingMoveRef.current = false;
        setActionRejectedNotice(`Action rejected: ${reason}`);
        setTimeout(() => setActionRejectedNotice(null), 2500);

        if (!multiplayerSession.isHost && activePlayerIndexRef.current === multiplayerSession.mySeatIndex && !winner) {
          if (actionType === 'MOVE' && hasRolledRef.current) {
            const myPlayer = playersRef.current[multiplayerSession.mySeatIndex];
            if (myPlayer) {
              const restoredMoves = LudoEngine.getValidMoves(myPlayer, diceValueRef.current, playersRef.current, options);
              validMovesRef.current = restoredMoves;
              setValidMoves(restoredMoves);
            }
          }

          if (timeoutManagerRef.current.getIsTimedOut()) {
            if (!hasRolledRef.current) {
              handleRollDiceRef.current(false, false);
            }
          } else {
            timeoutManagerRef.current.startTurn(Math.max(3, timeoutManagerRef.current.getRemainingSeconds()));
          }
        }
      },
      onStateSnapshot: (snapshot) => {
        if (snapshot.hasRolled || !snapshot.isRolling) {
          if (guestRollTimeoutRef.current) clearTimeout(guestRollTimeoutRef.current);
        }
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
      onChatEmote: (data) => {
        soundEffects.playPop();
        const seatPlayer = playersRef.current[data.seatIndex];
        const color = seatPlayer ? seatPlayer.config.color : 'red';
        const newItem: FloatingEmoteItem = {
          id: `${Date.now()}-${Math.random()}`,
          seatIndex: data.seatIndex,
          senderName: data.senderName,
          message: data.message,
          emoji: data.emoji,
          color,
        };
        setFloatingEmotes((prev) => [...prev, newItem]);
        setTimeout(() => {
          setFloatingEmotes((prev) => prev.filter((it) => it.id !== newItem.id));
        }, 2500);
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

  // 15-Second Turn Countdown Timer & Auto-Play on timeout (Online Multiplayer Only)
  useEffect(() => {
    // Turn countdown is strictly reserved for online matches to keep remote lobbies alive.
    // Offline local games (Pass & Play and Solo vs Bots) must NEVER force-roll or auto-play human friends!
    if (!isOnline || winner || isAutomatedTurn) {
      timeoutManagerRef.current.stop();
      setTurnCountdown(undefined);
      return;
    }

    timeoutManagerRef.current.setHandlers({
      onTick: (seconds) => {
        setTurnCountdown(seconds);
        if (seconds <= 4 && seconds > 0 && isMyOnlineTurnRef.current) {
          soundEffects.playUrgentTick();
          triggerHaptic('urgent');
        }
      },
      onTimeout: () => {
        if (isMyOnlineTurnRef.current) {
          if (!hasRolledRef.current) {
            if (!isRollingRef.current) {
              handleRollDiceRef.current();
            }
          } else if (validMovesRef.current.length > 0) {
            const curPlayer = playersRef.current[activePlayerIndexRef.current];
            const chosenTokenId = curPlayer
              ? BotAI.selectBestLudoMove(
                  validMovesRef.current,
                  curPlayer.config.color,
                  curPlayer,
                  playersRef.current,
                  'easy'
                )
              : validMovesRef.current[0].tokenId;
            handleSelectTokenRef.current(chosenTokenId !== null ? chosenTokenId : validMovesRef.current[0].tokenId);
          }
        }
      },
    });

    timeoutManagerRef.current.startTurn(15);

    return () => {
      timeoutManagerRef.current.stop();
    };
  }, [turnCycleId, activePlayerIndex, winner, isAutomatedTurn, isOnline]);

  // If an online turn timed out before or during rolling, auto-select a move as soon as rolling finishes
  useEffect(() => {
    if (!isOnline || !timeoutManagerRef.current.getIsTimedOut()) return;
    if (winner || isRolling || isAnimatingMove) return;
    if (!isMyOnlineTurn) return;

    if (hasRolled && validMoves.length > 0) {
      const curPlayer = players[activePlayerIndex];
      const chosenTokenId = curPlayer
        ? BotAI.selectBestLudoMove(
            validMoves,
            curPlayer.config.color,
            curPlayer,
            players,
            'easy'
          )
        : validMoves[0].tokenId;

      const finalTokenId = chosenTokenId !== null ? chosenTokenId : validMoves[0].tokenId;
      handleSelectToken(finalTokenId);
    }
  }, [hasRolled, isRolling, validMoves, winner, isAnimatingMove, isOnline, isMyOnlineTurn, activePlayerIndex, players]);

  const handleSendChatEmote = (message?: string, emoji?: string) => {
    const mySeat = isOnline ? multiplayerSession!.mySeatIndex : activePlayerIndexRef.current;
    const myPlayer = playersRef.current[mySeat];
    const myName = myPlayer?.config.name || 'Player';
    const myColor = myPlayer?.config.color || 'red';

    if (isOnline) {
      onlineLudoController.sendChatEmote(myName, message, emoji);
    } else {
      soundEffects.playPop();
      const newItem: FloatingEmoteItem = {
        id: `${Date.now()}-${Math.random()}`,
        seatIndex: mySeat,
        senderName: myName,
        message,
        emoji,
        color: myColor,
      };
      setFloatingEmotes((prev) => [...prev, newItem]);
      setTimeout(() => {
        setFloatingEmotes((prev) => prev.filter((it) => it.id !== newItem.id));
      }, 2500);
    }
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

  // Clockwise Dice-Corner Cheat Ritual Handler
  const handleCornerTap = (corner: DiceCorner) => {
    if (isRolling || hasRolled || winner || isAnimatingMove || isAutomatedTurn) return;
    if (isOnline && !isMyOnlineTurn) return;

    const res = handleDiceCornerTap(
      corner,
      ritualStateRef.current,
      turnCountRef.current,
      true
    );

    ritualStateRef.current = res.nextState;
    setRitualState(res.nextState);

    if (res.justArmed) {
      triggerHaptic('tap');
    }
  };

  // Central Roll Execution Trigger (Consumes armed ritual atomically, otherwise 100% fair RNG)
  const triggerUserRoll = () => {
    if (isRolling || hasRolled || winner || isAnimatingMove || isAutomatedTurn) return;
    if (isOnline && !isMyOnlineTurn) return;

    const { wasArmed, nextState } = consumeArmedCheatOnRoll(ritualStateRef.current);
    ritualStateRef.current = nextState;
    setRitualState(nextState);

    const outcome = resolveRollOutcome(
      wasArmed,
      players[activePlayerIndex],
      players,
      options
    );

    if (outcome.isSmartAutoCapture) {
      handleRollDice(false, outcome.roll === 6, outcome.roll);
    } else {
      handleRollDice(false, false);
    }
  };

  const handleRollPointerDown = (_e: React.PointerEvent) => {
    // If a ritual was partially in-progress (not yet fully armed), interacting with the center resets it
    if (!ritualStateRef.current.cheatArmed && ritualStateRef.current.step > 0) {
      const reset = resetDiceCornerRitual();
      ritualStateRef.current = reset;
      setRitualState(reset);
    }
  };

  const handleRollPointerUp = (_e: React.PointerEvent) => {
    // Handled by click to ensure proper gesture routing
  };

  const handleRollPointerCancel = (_e: React.PointerEvent) => {
    if (ritualStateRef.current.step > 0 || ritualStateRef.current.cheatArmed) {
      const reset = resetDiceCornerRitual();
      ritualStateRef.current = reset;
      setRitualState(reset);
    }
  };

  const handleRollClick = () => {
    triggerUserRoll();
  };

  const handleRollKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      if (e.repeat) return;
      e.preventDefault();
      triggerUserRoll();
    } else if (!ritualStateRef.current.cheatArmed && ritualStateRef.current.step > 0) {
      const reset = resetDiceCornerRitual();
      ritualStateRef.current = reset;
      setRitualState(reset);
    }
  };

  const handleRollKeyUp = (_e: React.KeyboardEvent) => {
    // No-op (roll triggered on keydown)
  };

  // Backwards-compatible auto-capture trigger
  const handleTriggerAutoCapture = () => {
    handleCornerTap('TR');
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

    // Stop online turn timer during rolling animation for both host and guest
    if (isOnline) {
      timeoutManagerRef.current.stop();
    }

    if (isOnline && !multiplayerSession?.isHost) {
      soundEffects.playDiceRoll();
      setIsRolling(true);
      isRollingRef.current = true;
      onlineLudoController.requestRoll(targetPlayerIndex, forceSix, desiredRoll);

      if (guestRollTimeoutRef.current) clearTimeout(guestRollTimeoutRef.current);
      guestRollTimeoutRef.current = setTimeout(() => {
        if (!hasRolledRef.current && isRollingRef.current) {
          isRollingRef.current = false;
          setIsRolling(false);
          if (activePlayerIndexRef.current === multiplayerSession?.mySeatIndex && !winner) {
            if (timeoutManagerRef.current.getIsTimedOut()) {
              handleRollDiceRef.current(false, false);
            } else {
              timeoutManagerRef.current.startTurn(Math.max(3, timeoutManagerRef.current.getRemainingSeconds()));
            }
          }
        }
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
        const nextDelay = PASS_TURN_DELAY_MS;
        if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
        turnTimerRef.current = setTimeout(() => {
          if (rollSession === currentRollSessionRef.current) {
            advanceTurn(false);
          }
        }, nextDelay);
      } else {
        // Rearm online turn timeout only if turn was not already timed out, ensuring timed-out players immediately auto-select
        if (isOnline && !isAutomatedTurn && !timeoutManagerRef.current.getIsTimedOut()) {
          timeoutManagerRef.current.startTurn(15);
        }
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
      timeoutManagerRef.current.stop();
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

    timeoutManagerRef.current.stop();
    setValidMoves([]);
    validMovesRef.current = [];

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
        lastAction: {
          type: 'MOVE',
          playerIndex: targetPlayerIndex,
          details: `Moved token ${tokenId}`,
        },
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
      setTurnCount((prev) => prev + 1);
      turnCountRef.current += 1;
    }

    setRitualState(INITIAL_RITUAL_STATE);
    ritualStateRef.current = INITIAL_RITUAL_STATE;

    activePlayerIndexRef.current = nextIdx;
    hasRolledRef.current = false;
    isRollingRef.current = false;
    setDiceValue(1);
    diceValueRef.current = 1;
    playersRef.current = currentPlayers;
    validMovesRef.current = [];

    setHasRolled(false);
    setIsRolling(false);
    setValidMoves([]);
    setHoveredTokenId(null);
    setConsecutiveSixes(nextConsecutiveSixes);
    setActivePlayerIndex(nextIdx);
    setTurnCycleId((c) => c + 1);

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
    setTurnCount(0);
    turnCountRef.current = 0;
    setRitualState(INITIAL_RITUAL_STATE);
    ritualStateRef.current = INITIAL_RITUAL_STATE;
    hasHandledReleaseRef.current = false;
    setTurnCycleId((c) => c + 1);
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
    setTurnCount(0);
    turnCountRef.current = 0;
    setRitualState(INITIAL_RITUAL_STATE);
    ritualStateRef.current = INITIAL_RITUAL_STATE;
    setShowSetupModal(false);
    setTurnCycleId((c) => c + 1);
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
        onOpenBanter={() => setShowQuickChat(true)}
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
            onCornerTap={handleCornerTap}
            turnTimeRemaining={activePlayer?.config.color === 'red' ? turnCountdown : undefined}
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
            onCornerTap={handleCornerTap}
            turnTimeRemaining={activePlayer?.config.color === 'green' ? turnCountdown : undefined}
          />
        </div>

        {/* The Board (Center of Stage) */}
        <div className="ludo-area-board relative">
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
          <FloatingEmotesLayer emotes={floatingEmotes} />
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
            onCornerTap={handleCornerTap}
            turnTimeRemaining={activePlayer?.config.color === 'yellow' ? turnCountdown : undefined}
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
            onCornerTap={handleCornerTap}
            turnTimeRemaining={activePlayer?.config.color === 'blue' ? turnCountdown : undefined}
          />
        </div>
      </div>

      {/* Quick Banter / Emoji Floating Trigger Button (Large screens only; header provides mobile access) */}
      <div className="hidden xl:flex fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setShowQuickChat(true)}
          title="Open Banter & Emojis"
          className="px-4 py-2.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm shadow-2xl border-2 border-amber-300 flex items-center gap-2 transform transition-all hover:scale-105 active:scale-95 select-none"
        >
          <MessageCircle className="w-4 h-4" />
          <span>Banter & Emojis</span>
        </button>
      </div>

      <QuickChatModal
        isOpen={showQuickChat}
        onClose={() => setShowQuickChat(false)}
        onSend={handleSendChatEmote}
      />

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

      {/* Action Rejection Toast for Online Mode */}
      {actionRejectedNotice && (
        <div
          data-testid="action-rejected-toast"
          role="alert"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-red-950/95 border border-red-500/70 text-red-200 text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-top-2 select-none pointer-events-none"
        >
          <span>⚠️</span>
          <span>{actionRejectedNotice}</span>
        </div>
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
