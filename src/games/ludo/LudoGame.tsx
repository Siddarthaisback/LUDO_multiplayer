import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { PlayerConfig, PlayerColor } from '../../types/game';
import { LudoPlayerState, LudoGameOptions, MoveOption } from '../../types/ludo';
import { LudoBoard } from './LudoBoard';
import { LudoEngine } from './LudoEngine';
import { Dice3D } from '../../components/UI/Dice3D';
import { PlayerCard } from '../../components/UI/PlayerCard';
import { VictoryModal } from '../../components/UI/VictoryModal';
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
import { MultiplayerSession } from '../../multiplayer/protocol';
import { onlineLudoController } from '../../multiplayer/onlineLudoController';

const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();
const DICE_HOLD_THRESHOLD_MS = 500;
const BOT_ROLL_DELAY_MS = 800;
const BOT_MOVE_DELAY_MS = 750;
const DICE_ROLL_DURATION_MS = 600;
const TOKEN_HOP_DURATION_MS = 200;
const PASS_TURN_DELAY_MS = 800;
const AFTER_MOVE_DELAY_MS = 500;

interface LudoGameProps {
  initialPlayers: PlayerConfig[];
  options: LudoGameOptions;
  onHome: () => void;
  onOpenSetup?: () => void;
  multiplayerSession?: MultiplayerSession | null;
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

  const activePlayer = players[activePlayerIndex];
  // In online mode, host automates bot turns; in local mode, bots auto-play their turns
  const isAutomatedTurn = isOnline
    ? Boolean(multiplayerSession?.isHost && activePlayer?.config.type === 'bot')
    : activePlayer?.config.type === 'bot';
  const botActionTimerRef = useRef<any>(null);
  const diceRollTimerRef = useRef<any>(null);
  const turnTimerRef = useRef<any>(null);
  const currentMoveSessionRef = useRef<number>(0);
  const rollPressStartTimeRef = useRef<number | null>(null);
  const hasHandledReleaseRef = useRef<boolean>(false);
  const handleRollDiceRef = useRef<(fromRemote?: boolean, forceSix?: boolean) => void>(() => {});
  const handleSelectTokenRef = useRef<(tokenId: number, fromRemote?: boolean) => void>(() => {});

  // Invalidate any active move transaction or timer on unmount
  useEffect(() => {
    return () => {
      currentMoveSessionRef.current++;
      if (botActionTimerRef.current) clearTimeout(botActionTimerRef.current);
      if (diceRollTimerRef.current) clearTimeout(diceRollTimerRef.current);
      if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
    };
  }, []);

  // Online Multiplayer Controller Callback Registration
  useEffect(() => {
    if (!multiplayerSession) return;

    onlineLudoController.setCallbacks({
      onRemoteRoll: (_val, _seatIndex, forceSix) => {
        if (multiplayerSession.isHost) {
          handleRollDiceRef.current(true, Boolean(forceSix));
        }
      },
      onRemoteMove: (tokenId) => {
        if (multiplayerSession.isHost) {
          handleSelectTokenRef.current(tokenId, true);
        }
      },
      onStateSnapshot: (snapshot) => {
        currentMoveSessionRef.current++;
        setPlayers(snapshot.players);
        setActivePlayerIndex(snapshot.activePlayerIndex);
        setDiceValue(snapshot.diceValue);
        setHasRolled(snapshot.hasRolled);
        setIsRolling(snapshot.isRolling);
        setConsecutiveSixes(snapshot.consecutiveSixes);
        if (snapshot.winner) setWinner(snapshot.winner);
        if (snapshot.rankings) setRankings(snapshot.rankings);

        if (snapshot.hasRolled && snapshot.activePlayerIndex === multiplayerSession.mySeatIndex) {
          const myPlayer = snapshot.players[snapshot.activePlayerIndex];
          const legalMoves = LudoEngine.getValidMoves(myPlayer, snapshot.diceValue, snapshot.players, options);
          setValidMoves(legalMoves);
        } else {
          setValidMoves([]);
        }
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

  // Dice Roll (Secret Hold: >= 500ms forces 6; normal tap produces standard 1-6 RNG)
  const handleRollDice = (fromRemote: boolean = false, forceSix: boolean = false) => {
    if (isRolling || hasRolled || winner || isAnimatingMove) return;
    if (isOnline && !fromRemote && !isMyOnlineTurn) return;

    if (isOnline && !multiplayerSession?.isHost) {
      onlineLudoController.requestRoll(activePlayerIndex, forceSix);
      return;
    }

    if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
    const sessionAtRoll = currentMoveSessionRef.current;

    soundEffects.playDiceRoll();
    setIsRolling(true);
    const roll = forceSix ? 6 : Math.floor(Math.random() * 6) + 1;
    const rollDuration = DICE_ROLL_DURATION_MS;

    if (diceRollTimerRef.current) clearTimeout(diceRollTimerRef.current);
    diceRollTimerRef.current = setTimeout(() => {
      if (sessionAtRoll !== currentMoveSessionRef.current) return;
      setDiceValue(roll);
      setIsRolling(false);
      setHasRolled(true);

      const currentPlayer = players[activePlayerIndex];

      // Check Consecutive Sixes rule
      let newConsecutiveSixes = roll === 6 ? consecutiveSixes + 1 : 0;
      setConsecutiveSixes(newConsecutiveSixes);

      const maxSixes = options.maxConsecutiveSixes || 3;
      if (newConsecutiveSixes >= maxSixes) {
        setConsecutiveSixes(0);
        if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
        turnTimerRef.current = setTimeout(() => {
          if (sessionAtRoll === currentMoveSessionRef.current) {
            advanceTurn(false);
          }
        }, 800);
        return;
      }

      // Calculate Valid Moves with options
      const legalMoves = LudoEngine.getValidMoves(currentPlayer, roll, players, options);
      setValidMoves(legalMoves);

      if (multiplayerSession?.isHost) {
        onlineLudoController.broadcastSnapshot({
          matchId: multiplayerSession.matchId,
          sequence: 0,
          players,
          activePlayerIndex,
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
          if (sessionAtRoll === currentMoveSessionRef.current) {
            advanceTurn(false);
          }
        }, nextDelay);
      }
    }, rollDuration);
  };

  // Move Token Animation & Execution
  const handleSelectToken = async (tokenId: number, fromRemote: boolean = false) => {
    if (!hasRolled || isRolling || winner || isAnimatingMove) return;
    if (isOnline && !fromRemote && !isMyOnlineTurn) return;

    if (isOnline && !multiplayerSession?.isHost) {
      onlineLudoController.requestMove(tokenId, activePlayerIndex);
      return;
    }

    const move = validMoves.find((m) => m.tokenId === tokenId);
    if (!move) return;

    const currentPlayer = players[activePlayerIndex];
    const token = currentPlayer.tokens.find((t) => t.id === tokenId);
    if (!token) return;

    // Authoritative transaction resolution from pure engine
    const tx = LudoEngine.resolveMoveTransaction(
      activePlayerIndex,
      tokenId,
      diceValue,
      players,
      options,
      rankings.length
    );
    if (!tx) return;

    // Invalidate any prior move transactions and identify this session
    const sessionId = ++currentMoveSessionRef.current;

    // 1. FLUSH PRE-ANIMATION STATE UPDATES IMMEDIATELY
    // Prevents React rerender (from setValidMoves / setIsAnimatingMove) from overwriting
    // the first hop or yard-exit transform with the token's old position
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
        tokenEl.style.transition = `transform ${hopDuration * 1.5}ms cubic-bezier(0.25, 1, 0.5, 1)`;
        tokenEl.style.zIndex = '50';
        tokenEl.style.transform = `translate3d(${startTilePos.x * boardWidth}px, ${startTilePos.y * boardWidth}px, 0) translate(-50%, -50%)`;
      }
      await new Promise((r) => setTimeout(r, hopDuration * 1.5));
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
      tokenEl.style.zIndex = '';
    }
    for (const el of capturedEls) {
      el.style.transition = '';
      el.style.transform = '';
      el.style.opacity = '';
      el.style.zIndex = '';
    }
    if (sessionId !== currentMoveSessionRef.current) return;
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
        activePlayerIndex,
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
        return;
      }
    }

    setIsAnimatingMove(false);

    const nextDelay = AFTER_MOVE_DELAY_MS;
    if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
    turnTimerRef.current = setTimeout(() => {
      if (sessionId === currentMoveSessionRef.current) {
        advanceTurn(tx.bonusTurn, tx.updatedPlayers);
      }
    }, nextDelay);
  };

  handleRollDiceRef.current = handleRollDice;
  handleSelectTokenRef.current = handleSelectToken;

  const advanceTurn = (samePlayer: boolean, latestPlayers?: LudoPlayerState[]) => {
    if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
    setHasRolled(false);
    setValidMoves([]);
    setHoveredTokenId(null);

    const currentPlayers = latestPlayers || players;
    let nextIdx = activePlayerIndex;
    if (!samePlayer) {
      setConsecutiveSixes(0);
      nextIdx = (activePlayerIndex + 1) % currentPlayers.length;
      let loopCount = 0;
      while (currentPlayers[nextIdx].rank && loopCount < currentPlayers.length) {
        nextIdx = (nextIdx + 1) % currentPlayers.length;
        loopCount++;
      }
      setActivePlayerIndex(nextIdx);
    }

    if (multiplayerSession?.isHost) {
      onlineLudoController.broadcastSnapshot({
        matchId: multiplayerSession.matchId,
        sequence: 0,
        players: currentPlayers,
        activePlayerIndex: nextIdx,
        diceValue,
        hasRolled: false,
        isRolling: false,
        consecutiveSixes: samePlayer ? consecutiveSixes : 0,
        winner,
        rankings,
      });
    }
  };

  const handleRestart = () => {
    currentMoveSessionRef.current++;
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
    if (botActionTimerRef.current) clearTimeout(botActionTimerRef.current);
    if (diceRollTimerRef.current) clearTimeout(diceRollTimerRef.current);
    if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
    setIsRolling(false);
    onHome();
  };

  const handleOpenSetup = () => {
    currentMoveSessionRef.current++;
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

  const activeColorInfo = activePlayer ? COLOR_MAP[activePlayer.config.color] : COLOR_MAP.red;

  return (
    <div className="flex-1 flex flex-col max-w-[1680px] w-full mx-auto px-2 sm:px-4 lg:px-6 py-2 gap-3 sm:gap-4">
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
        <div className="w-full py-2 px-4 rounded-xl bg-[#0f1a36] border border-[#294376] flex items-center justify-between shadow-sm select-none">
          <div className="flex items-center gap-2.5 text-xs font-bold text-[#f6d77b]">
            <Wifi className="w-4 h-4 text-cyan-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>ONLINE ROOM: <strong className="font-mono text-white tracking-wider">{multiplayerSession?.roomCode}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#aebbd6] font-medium hidden sm:inline">You are playing as:</span>
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

      {/* Main Game Layout Grid: Exact b0dca67 Layout */}
      <div className={`grid ${isNative ? 'grid-cols-1 max-w-lg mx-auto' : 'grid-cols-1 lg:grid-cols-12'} gap-4 lg:gap-6 items-start w-full`}>
        {/* Center: The Board (100% untouched b0dca67 direct mount) */}
        <div className={`${isNative ? 'w-full' : 'lg:col-span-6 order-1 lg:order-2'} flex flex-col items-center justify-center`}>
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

        {/* Left Column: Player Standings */}
        {!isNative && (
          <div className="lg:col-span-3 flex flex-col gap-3 order-3 lg:order-1 bg-[#0f1a36] border border-[#294376] rounded-2xl p-3 sm:p-4 shadow-[0_8px_20px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="text-xs uppercase font-semibold tracking-wide text-[#f6d77b] px-1 flex items-center justify-between">
              <span>Player Standings</span>
              <span className="text-[10px] text-[#aebbd6] font-medium">{players.length}P</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 gap-2.5">
              {players.map((p, idx) => (
                <PlayerCard
                  key={p.config.id}
                  player={p.config}
                  isActive={activePlayerIndex === idx}
                  scoreLabel="Home"
                  scoreValue={`${p.tokensHome}/4`}
                  rank={p.rank}
                  consecutiveSixes={activePlayerIndex === idx ? consecutiveSixes : 0}
                  tokens={p.tokens}
                />
              ))}
            </div>
          </div>
        )}

        {/* Right Column: Dice Action Tray */}
        <div className={`${isNative ? 'w-full max-w-xs mx-auto' : 'lg:col-span-3 order-2 lg:order-3'} flex flex-col gap-3 sm:gap-4`}>
          <div className="bg-[#0f1a36] border border-[#294376] rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_20px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.06)] flex flex-col items-center justify-center gap-2.5 sm:gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#f6d77b]">
              Dice Roller
            </span>
            <div
              onPointerDown={handleRollPointerDown}
              onPointerUp={handleRollPointerUp}
              onPointerCancel={handleRollPointerCancel}
              onContextMenu={(e) => e.preventDefault()}
              className="touch-none select-none cursor-pointer p-1"
            >
              <Dice3D
                value={diceValue}
                isRolling={isRolling}
                canRoll={!isRolling && !hasRolled && !isAnimatingMove && !isAutomatedTurn && (!isOnline || isMyOnlineTurn)}
                activeColor={activePlayer?.config.color || 'red'}
                onRoll={() => {}}
                size={62}
                showButton={false}
              />
            </div>
            {isOnline && !isMyOnlineTurn ? (
              <div className="w-full py-2.5 px-3 rounded-xl bg-[#18294d] border border-[#355286] text-center text-xs font-medium text-[#dce6fa] flex items-center justify-center gap-2 shadow-inner">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span>⏳ WAITING FOR {activePlayer?.config.name.toUpperCase()}...</span>
              </div>
            ) : !hasRolled && !isRolling && !isAnimatingMove && !isAutomatedTurn ? (
              <button
                onPointerDown={handleRollPointerDown}
                onPointerUp={handleRollPointerUp}
                onPointerCancel={handleRollPointerCancel}
                onKeyDown={handleRollKeyDown}
                onKeyUp={handleRollKeyUp}
                onClick={handleRollClick}
                onContextMenu={(e) => e.preventDefault()}
                className="w-full py-3 px-5 rounded-xl text-white font-black text-sm uppercase tracking-wider shadow-lg hover:brightness-110 active:translate-y-0.5 active:shadow-sm transition-all flex items-center justify-center gap-2 border border-white/25 cursor-pointer select-none touch-none"
                style={{
                  background: `linear-gradient(180deg, ${activeColorInfo.light || activeColorInfo.primary} 0%, ${activeColorInfo.primary} 50%, ${activeColorInfo.dark} 100%)`,
                  boxShadow: `0 6px 20px ${activeColorInfo.primary}50, inset 0 1px 1px rgba(255,255,255,0.35)`,
                }}
              >
                <span className="drop-shadow-sm">🎲 TAP TO ROLL</span>
              </button>
            ) : hasRolled ? (
              <div className="w-full py-2 px-3 rounded-xl bg-[#142447] border border-[#294376] text-center text-xs font-semibold text-[#aebbd6] shadow-inner flex items-center justify-center gap-1">
                <span>Rolled:</span>
                <span className="text-[#f6d77b] font-black text-base ml-1">{diceValue}</span>
              </div>
            ) : null}
          </div>
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
