import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { PlayerConfig, AnimationSpeed, PlayerColor } from '../../types/game';
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
import { Sparkles, Wifi } from 'lucide-react';
import { MultiplayerSession } from '../../multiplayer/protocol';
import { onlineLudoController } from '../../multiplayer/onlineLudoController';

const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

interface LudoGameProps {
  initialPlayers: PlayerConfig[];
  options: LudoGameOptions;
  onHome: () => void;
  onOpenSetup?: () => void;
  initialAutoPlay?: boolean;
  multiplayerSession?: MultiplayerSession | null;
}

export const LudoGame: React.FC<LudoGameProps> = ({
  initialPlayers,
  options,
  onHome,
  onOpenSetup,
  initialAutoPlay = false,
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

  const [speed, setSpeed] = useState<AnimationSpeed>('normal');
  const [isAutoPlay, setIsAutoPlay] = useState<boolean>(() => Boolean(initialAutoPlay && !isNative && !multiplayerSession));
  const [isAutoPlayPaused, setIsAutoPlayPaused] = useState<boolean>(false);
  const [boardStyle, setBoardStyle] = useState<'luxury' | 'classic'>('classic');
  const [isShaking, setIsShaking] = useState(false);

  // Animation & Visual Effect States
  const [effects, setEffects] = useState<BoardEffectItem[]>([]);
  const [hoveredTokenId, setHoveredTokenId] = useState<number | null>(null);
  const [isAnimatingMove, setIsAnimatingMove] = useState(false);

  const activePlayer = players[activePlayerIndex];
  // In Auto-Play mode, all turns are automated unless paused; in online mode, host automates bot turns (e.g. disconnected guests)
  const isAutomatedTurn = isOnline
    ? Boolean(multiplayerSession?.isHost && activePlayer?.config.type === 'bot')
    : isAutoPlay
    ? !isAutoPlayPaused
    : activePlayer?.config.type === 'bot';
  const botActionTimerRef = useRef<any>(null);
  const diceRollTimerRef = useRef<any>(null);
  const turnTimerRef = useRef<any>(null);
  const currentMoveSessionRef = useRef<number>(0);
  const handleRollDiceRef = useRef<(fromRemote?: boolean) => void>(() => {});
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
      onRemoteRoll: () => {
        if (multiplayerSession.isHost) {
          handleRollDiceRef.current(true);
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
      const rollDelay = speed === 'turbo' ? 200 : speed === 'fast' ? 450 : 800;
      botActionTimerRef.current = setTimeout(() => {
        handleRollDice();
      }, rollDelay);
    }

    if (isAutomatedTurn && hasRolled && validMoves.length > 0 && activePlayer) {
      const moveDelay = speed === 'turbo' ? 200 : speed === 'fast' ? 400 : 750;
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
      }, moveDelay);
    }

    return () => {
      if (botActionTimerRef.current) clearTimeout(botActionTimerRef.current);
    };
  }, [activePlayerIndex, hasRolled, isRolling, validMoves, winner, isAutomatedTurn, speed, isAnimatingMove]);

  // Dice Roll
  const handleRollDice = (fromRemote: boolean = false) => {
    if (isRolling || hasRolled || winner || isAnimatingMove) return;
    if (isOnline && !fromRemote && !isMyOnlineTurn) return;

    if (isOnline && !multiplayerSession?.isHost) {
      onlineLudoController.requestRoll(activePlayerIndex);
      return;
    }

    if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
    const sessionAtRoll = currentMoveSessionRef.current;

    soundEffects.playDiceRoll();
    setIsRolling(true);
    const roll = Math.floor(Math.random() * 6) + 1;
    const rollDuration = speed === 'turbo' ? 250 : speed === 'fast' ? 400 : 600;

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
        const nextDelay = speed === 'turbo' ? 300 : speed === 'fast' ? 500 : 800;
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

    const hopDuration = speed === 'turbo' ? 100 : speed === 'fast' ? 150 : 200;
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

    const nextDelay = speed === 'turbo' ? 150 : speed === 'fast' ? 300 : 500;
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
    setIsAutoPlayPaused(false);
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

  const handleToggleAutoPlay = () => {
    if (isNative) return;
    if (!isAutoPlay) {
      setIsAutoPlay(true);
      setIsAutoPlayPaused(false);
    } else {
      setIsAutoPlay(false);
      setIsAutoPlayPaused(false);
      if (botActionTimerRef.current) clearTimeout(botActionTimerRef.current);
    }
  };

  const handleTogglePauseAutoPlay = () => {
    if (isNative || !isAutoPlay) return;
    setIsAutoPlayPaused((prev) => {
      const next = !prev;
      if (next && botActionTimerRef.current) {
        clearTimeout(botActionTimerRef.current);
      }
      return next;
    });
  };

  return (
    <div className="flex-1 flex flex-col max-w-[1680px] w-full mx-auto px-2 sm:px-4 lg:px-6 py-2 gap-3 sm:gap-4">
      {/* Top Settings Bar */}
      <SettingsBar
        speed={speed}
        onSpeedChange={setSpeed}
        onRestart={handleRestart}
        onHome={handleHome}
        onOpenRules={() => setShowRules(true)}
        onOpenSetup={handleOpenSetup}
        gameTitle="Royal Ludo (🎲 3D Physics)"
        isAutoPlay={isAutoPlay}
        onToggleAutoPlay={!isNative ? handleToggleAutoPlay : undefined}
        boardStyle={boardStyle}
        onToggleBoardStyle={() => setBoardStyle(boardStyle === 'luxury' ? 'classic' : 'luxury')}
      />

      {/* Online Multiplayer Match Banner */}
      {isOnline && (
        <div className="w-full py-2 px-4 rounded-2xl bg-gradient-to-r from-blue-900/40 via-indigo-900/50 to-blue-900/40 border border-blue-500/50 flex items-center justify-between shadow-lg shadow-blue-500/10 select-none">
          <div className="flex items-center gap-2.5 text-xs font-black text-blue-300">
            <Wifi className="w-4 h-4 text-cyan-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>ONLINE ROOM: <strong className="font-mono text-white tracking-wider">{multiplayerSession?.roomCode}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold hidden sm:inline">You are playing as:</span>
            <span
              className="font-black px-2.5 py-0.5 rounded-lg text-white text-[11px] shadow"
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

      {/* Pulsing Amber Auto-Play Spectator Banner */}
      {!isNative && isAutoPlay && !isOnline && (
        <div
          className={`w-full py-2 px-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/25 to-amber-500/20 border border-amber-400/60 flex items-center justify-between shadow-lg shadow-amber-500/10 select-none ${
            isAutoPlayPaused ? 'border-amber-400/40 opacity-90' : 'animate-pulse'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-black text-amber-300 uppercase tracking-wider">
            <span className="text-base">{isAutoPlayPaused ? '⏸️' : '🤖'}</span>
            <span>
              {isAutoPlayPaused
                ? 'AUTO-PLAY PAUSED • ALL TURNS SUSPENDED'
                : 'AUTO-PLAY ACTIVE • HANDS-FREE SPECTATOR MODE'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold text-amber-200/90 hidden sm:inline">
              Speed: <strong className="uppercase text-amber-300">{speed}</strong> &bull;{' '}
              {isAutoPlayPaused ? 'Turns suspended' : 'AI is auto-rolling & moving'}
            </span>
            <button
              onClick={handleTogglePauseAutoPlay}
              className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 border border-amber-400/60 transition-all cursor-pointer"
            >
              {isAutoPlayPaused ? '▶️ Resume Auto-Play' : '⏸ Pause Auto-Play'}
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Turn Instruction Banner */}
      <div
        className="w-full py-2.5 px-3.5 sm:px-5 rounded-2xl flex items-center justify-between shadow-lg border bg-slate-900 transition-all"
        style={{
          borderColor: activeColorInfo.primary,
        }}
      >
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <span className="text-2xl sm:text-3xl">{activePlayer?.config.avatar}</span>
          <div>
            <div className="text-xs sm:text-sm font-black uppercase tracking-wider text-white flex items-center gap-1.5 flex-wrap">
              <span>{activePlayer?.config.name}'s Turn</span>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              {isAutoPlay && !isOnline && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1 ${
                    isAutoPlayPaused
                      ? 'bg-amber-500/10 text-amber-400/80 border-amber-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  {isAutoPlayPaused ? 'Auto-Play Paused' : 'Auto-Play Active'}
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-300">
              {isOnline && !isMyOnlineTurn
                ? `⏳ Waiting for ${activePlayer?.config.name} to roll or move...`
                : isOnline && isMyOnlineTurn && !hasRolled
                ? '🎲 It is your turn! Tap the dice to roll!'
                : isOnline && isMyOnlineTurn && hasRolled && validMoves.length > 0
                ? '👉 Tap your highlighted pawn to make your move!'
                : isAutoPlay && isAutoPlayPaused
                ? '⏸️ Auto-Play is paused. All turns suspended. Click Resume to continue.'
                : isAutoPlay
                ? '🤖 AI is analyzing board and executing turns automatically (Spectator Mode)'
                : isAnimatingMove
                ? '⚡ Moving pawn...'
                : !hasRolled
                ? '🎲 Tap the dice to roll!'
                : validMoves.length > 0
                ? '👉 Tap or hover a highlighted bouncing pawn to move!'
                : '❌ No legal moves with this roll.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {consecutiveSixes > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/30 text-amber-300 border border-amber-400">
              🔥 6s: {consecutiveSixes}/3
            </span>
          )}
        </div>
      </div>

      {/* Main Game Layout Grid */}
      <div className={`grid ${isNative ? 'grid-cols-1 max-w-lg mx-auto' : 'grid-cols-1 lg:grid-cols-12'} gap-4 lg:gap-6 items-start w-full`}>
        {/* Center: The Board */}
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

        {/* Left Column: Player Cards (Hidden on native APK per user request) */}
        {!isNative && (
          <div className="lg:col-span-3 flex flex-col gap-3 order-3 lg:order-1 bg-slate-900 lg:border lg:border-slate-800 rounded-3xl p-2.5 sm:p-3.5 lg:p-4 shadow-xl">
            <div className="text-xs uppercase font-extrabold tracking-wider text-slate-400 px-1">
              <span>Player Standings ({players.length}P)</span>
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
          <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-3.5 sm:p-4 shadow-2xl flex flex-col items-center justify-center gap-2.5 sm:gap-3">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
              Dice Roller
            </span>
            <Dice3D
              value={diceValue}
              isRolling={isRolling}
              canRoll={!isRolling && !hasRolled && !isAnimatingMove && !isAutomatedTurn}
              activeColor={activePlayer?.config.color || 'red'}
              onRoll={handleRollDice}
              size={60}
              showButton={false}
            />
            {isAutoPlay ? (
              <div className="w-full flex flex-col gap-2">
                {isAutoPlayPaused ? (
                  <div className="w-full py-2.5 px-3 rounded-2xl bg-amber-950/80 border border-amber-500/50 text-center text-xs font-bold text-amber-200 flex items-center justify-center gap-2 shadow-inner">
                    <span>⏸️ Auto-Play Suspended (Paused)</span>
                  </div>
                ) : (
                  <div className="w-full py-2.5 px-3 rounded-2xl bg-amber-950/80 border border-amber-500/50 text-center text-xs font-bold text-amber-200 flex items-center justify-center gap-2 shadow-inner">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>🤖 AI Playing ({activePlayer?.config.name})...</span>
                  </div>
                )}
                {!isNative && (
                  <div className="flex gap-1.5 w-full">
                    <button
                      onClick={handleTogglePauseAutoPlay}
                      className="flex-1 py-2 px-2.5 rounded-xl bg-amber-800/80 hover:bg-amber-700 text-amber-100 text-[11px] font-black border border-amber-600/70 transition-all cursor-pointer flex items-center justify-center gap-1 shadow-md"
                    >
                      <span>{isAutoPlayPaused ? '▶️ Resume Auto-Play' : '⏸ Pause Auto-Play'}</span>
                    </button>
                    <button
                      onClick={handleToggleAutoPlay}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-bold border border-slate-700 transition-all cursor-pointer"
                      title="Turn Off Auto-Play Mode"
                    >
                      Exit
                    </button>
                  </div>
                )}
              </div>
            ) : isOnline && !isMyOnlineTurn ? (
              <div className="w-full py-2.5 px-3 rounded-2xl bg-slate-800/90 border border-slate-700 text-center text-xs font-bold text-slate-300 flex items-center justify-center gap-2 shadow-inner">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span>⏳ WAITING FOR {activePlayer?.config.name.toUpperCase()}...</span>
              </div>
            ) : !hasRolled && !isRolling && !isAnimatingMove && !isAutomatedTurn ? (
              <button
                onClick={() => handleRollDice(false)}
                className="w-full py-2.5 px-4 rounded-2xl text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 border border-white/20 animate-pulse cursor-pointer"
                style={{
                  background: `linear-gradient(135deg, ${activeColorInfo.primary}, ${activeColorInfo.dark})`,
                  boxShadow: `0 6px 20px ${activeColorInfo.primary}60`,
                }}
              >
                <span>🎲 TAP TO ROLL</span>
              </button>
            ) : hasRolled ? (
              <div className="w-full py-2 px-3 rounded-xl bg-slate-800/80 border border-slate-700/80 text-center text-xs font-bold text-slate-300 shadow-inner">
                Rolled: <span className="text-amber-400 font-black text-base ml-1">{diceValue}</span>
              </div>
            ) : null}

            {/* Laptop Controls: Quick Auto-Play & Speed Bar */}
            {!isNative && (
              <div className="w-full flex flex-col gap-2 pt-2 border-t border-slate-800/80">
                {!isAutoPlay && (
                  <button
                    onClick={handleToggleAutoPlay}
                    className="w-full py-1.5 px-3 rounded-xl bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 hover:text-amber-100 text-xs font-bold border border-amber-800/60 hover:border-amber-600 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Start Auto-Play</span>
                  </button>
                )}

                <div className="w-full flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Speed:</span>
                  <div className="flex gap-1">
                    {(['normal', 'fast', 'turbo'] as AnimationSpeed[]).map((spd) => (
                      <button
                        key={spd}
                        onClick={() => setSpeed(spd)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase transition-all border cursor-pointer ${
                          speed === spd
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow font-black'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {spd === 'turbo' ? '⚡ Turbo' : spd === 'fast' ? '⏩ Fast' : 'Normal'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
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
          isAutoPlay={isAutoPlay}
          onToggleAutoPlay={!isNative ? handleToggleAutoPlay : undefined}
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
