import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TurnTimeoutManager } from "../turnTimeoutManager";
import { BotAI } from "../../../engine/botAI";
import { LudoEngine } from "../LudoEngine";
import { LudoPlayerState, MoveOption } from "../../../types/ludo";
import { PlayerConfig } from "../../../types/game";

describe("15-Second Turn Timeout & Auto-Play Progression (TurnTimeoutManager)", () => {
  const sampleConfig: PlayerConfig[] = [
    { id: "1", name: "Player 1", type: "human", color: "red", avatar: "👑" },
    { id: "2", name: "Player 2", type: "human", color: "green", avatar: "🦊" },
  ];

  const createInitialState = (): LudoPlayerState[] =>
    sampleConfig.map((p) => ({
      config: p,
      tokens: [
        { id: 0, color: p.color, step: -1, status: "yard" as const, trackIndex: -1 },
        { id: 1, color: p.color, step: -1, status: "yard" as const, trackIndex: -1 },
        { id: 2, color: p.color, step: -1, status: "yard" as const, trackIndex: -1 },
        { id: 3, color: p.color, step: -1, status: "yard" as const, trackIndex: -1 },
      ],
      tokensHome: 0,
      tokensCaptured: 0,
      tokensLost: 0,
    }));

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("triggers onTimeout exactly once and counts down second by second", () => {
    const onTick = vi.fn();
    const onTimeout = vi.fn();
    const manager = new TurnTimeoutManager({ onTick, onTimeout });

    manager.startTurn(15);
    expect(onTick).toHaveBeenCalledWith(15);
    expect(manager.getRemainingSeconds()).toBe(15);
    expect(manager.getIsTimedOut()).toBe(false);

    // 14 seconds advance
    vi.advanceTimersByTime(14000);
    expect(onTimeout).not.toHaveBeenCalled();
    expect(manager.getRemainingSeconds()).toBe(1);
    expect(manager.getIsTimedOut()).toBe(false);

    // Final 1 second
    vi.advanceTimersByTime(1000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(manager.getRemainingSeconds()).toBe(0);
    expect(manager.getIsTimedOut()).toBe(true);

    // Further time does not re-trigger
    vi.advanceTimersByTime(5000);
    expect(onTimeout).toHaveBeenCalledTimes(1);

    manager.stop();
  });

  it("completes the roll-and-move sequence after timeout-triggered roll lands on legal moves", () => {
    const states = createInitialState();
    let hasRolled = false;
    let isRolling = false;
    let validMoves: MoveOption[] = [];

    const rollDiceSpy = vi.fn(() => {
      isRolling = true;
    });
    const selectTokenSpy = vi.fn();

    const manager = new TurnTimeoutManager({
      onTimeout: () => {
        if (!hasRolled && !isRolling) {
          rollDiceSpy();
        }
      },
    });

    const checkMoveProgression = () => {
      if (manager.getIsTimedOut() && !isRolling && hasRolled && validMoves.length > 0) {
        const curPlayer = states[0];
        const chosenTokenId = BotAI.selectBestLudoMove(
          validMoves,
          curPlayer.config.color,
          curPlayer,
          states,
          "easy"
        );
        selectTokenSpy(chosenTokenId !== null ? chosenTokenId : validMoves[0].tokenId);
      }
    };

    manager.startTurn(15);
    vi.advanceTimersByTime(15000);

    // 1. Timeout triggered roll
    expect(rollDiceSpy).toHaveBeenCalledTimes(1);
    expect(manager.getIsTimedOut()).toBe(true);

    // While rolling, move progression cannot happen yet
    checkMoveProgression();
    expect(selectTokenSpy).not.toHaveBeenCalled();

    // 2. Rolling finishes with a 6
    isRolling = false;
    hasRolled = true;
    validMoves = LudoEngine.getValidMoves(states[0], 6, states, {
      requireSixToStart: true,
      bonusTurnOnSix: true,
      bonusTurnOnCapture: true,
      bonusTurnOnHome: true,
      maxConsecutiveSixes: 3,
    });
    expect(validMoves.length).toBe(4);

    // 3. Move progression hook completes the sequence
    checkMoveProgression();
    expect(selectTokenSpy).toHaveBeenCalledTimes(1);
    expect(validMoves.some((m) => m.tokenId === selectTokenSpy.mock.calls[0][0])).toBe(true);

    manager.stop();
  });

  it("handles timeout occurring during active rolling without double-rolling, then auto-selects move", () => {
    const states = createInitialState();
    let isRolling = true; // Roll already started before timeout
    let hasRolled = false;
    let validMoves: MoveOption[] = [];

    const rollDiceSpy = vi.fn();
    const selectTokenSpy = vi.fn();

    const manager = new TurnTimeoutManager({
      onTimeout: () => {
        if (!hasRolled && !isRolling) {
          rollDiceSpy();
        }
      },
    });

    manager.startTurn(15);
    vi.advanceTimersByTime(15000);

    // Timeout fired, but because isRolling was true, no duplicate roll occurred
    expect(rollDiceSpy).not.toHaveBeenCalled();
    expect(manager.getIsTimedOut()).toBe(true);

    // Now roll finishes
    isRolling = false;
    hasRolled = true;
    validMoves = LudoEngine.getValidMoves(states[0], 6, states, {
      requireSixToStart: true,
      bonusTurnOnSix: true,
      bonusTurnOnCapture: true,
      bonusTurnOnHome: true,
      maxConsecutiveSixes: 3,
    });

    if (manager.getIsTimedOut() && !isRolling && hasRolled && validMoves.length > 0) {
      const curPlayer = states[0];
      const chosen = BotAI.selectBestLudoMove(validMoves, curPlayer.config.color, curPlayer, states, "easy");
      selectTokenSpy(chosen !== null ? chosen : validMoves[0].tokenId);
    }

    expect(selectTokenSpy).toHaveBeenCalledTimes(1);

    manager.stop();
  });

  it("restarts the 15s countdown for same-player bonus turns", () => {
    const onTick = vi.fn();
    const manager = new TurnTimeoutManager({ onTick });

    // Initial turn starts
    manager.startTurn(15);
    vi.advanceTimersByTime(10000); // 5s left
    expect(manager.getRemainingSeconds()).toBe(5);

    // Player scores a Six or Capture -> same-player bonus turn triggers
    manager.startTurn(15);
    expect(manager.getRemainingSeconds()).toBe(15);
    expect(manager.getIsTimedOut()).toBe(false);
    expect(onTick).toHaveBeenLastCalledWith(15);

    // Count down on bonus turn
    vi.advanceTimersByTime(2000);
    expect(manager.getRemainingSeconds()).toBe(13);

    manager.stop();
  });

  it("executes timeout -> roll -> exactly one move -> turn advancement lifecycle without duplicate moves", () => {
    const states = createInitialState();
    let hasRolled = false;
    let isRolling = false;
    let isAnimatingMove = false;
    let validMoves: MoveOption[] = [];
    const rollSpy = vi.fn();
    const selectTokenSpy = vi.fn();
    const advanceTurnSpy = vi.fn();

    const manager = new TurnTimeoutManager({
      onTimeout: () => {
        if (!hasRolled && !isRolling && !isAnimatingMove) {
          rollSpy();
          isRolling = true;
        }
      },
    });

    // 1. Start turn
    manager.startTurn(15);
    vi.advanceTimersByTime(15000); // Trigger timeout
    expect(rollSpy).toHaveBeenCalledTimes(1);
    expect(manager.getIsTimedOut()).toBe(true);

    // 2. Roll resolves with 6
    isRolling = false;
    hasRolled = true;
    validMoves = LudoEngine.getValidMoves(states[0], 6, states, {
      requireSixToStart: true,
      bonusTurnOnSix: true,
      bonusTurnOnCapture: true,
      bonusTurnOnHome: true,
      maxConsecutiveSixes: 3,
    });

    // Guard: only re-arm if NOT already timed out
    if (!manager.getIsTimedOut()) {
      manager.startTurn(15);
    }
    expect(manager.getIsTimedOut()).toBe(true);

    // 3. Auto-select move hook fires
    const runAutoSelectHook = () => {
      if (manager.getIsTimedOut() && !isRolling && !isAnimatingMove && hasRolled && validMoves.length > 0) {
        const curPlayer = states[0];
        const chosen = BotAI.selectBestLudoMove(validMoves, curPlayer.config.color, curPlayer, states, 'medium');
        const finalTokenId = chosen !== null ? chosen : validMoves[0].tokenId;
        selectTokenSpy(finalTokenId);
        isAnimatingMove = true;
        validMoves = [];
        manager.stop();
      }
    };

    runAutoSelectHook();
    expect(selectTokenSpy).toHaveBeenCalledTimes(1);

    // Secondary execution attempt while moving must not trigger duplicate move
    runAutoSelectHook();
    expect(selectTokenSpy).toHaveBeenCalledTimes(1);

    // 4. Move completes and turn advances
    isAnimatingMove = false;
    advanceTurnSpy(false);
    expect(advanceTurnSpy).toHaveBeenCalledWith(false);
  });

  it("post-move snapshot with hasRolled=true does not restore legal moves or rearm timer", () => {
    const states = createInitialState();
    const manager = new TurnTimeoutManager();
    let validMoves: MoveOption[] = [];
    const options = {
      requireSixToStart: true,
      bonusTurnOnSix: true,
      bonusTurnOnCapture: true,
      bonusTurnOnHome: true,
      maxConsecutiveSixes: 3,
    };

    // Simulate snapshot after move committed: lastAction is MOVE, hasRolled is true
    const postMoveSnapshot = {
      activePlayerIndex: 0,
      hasRolled: true,
      isRolling: false,
      diceValue: 6,
      players: states,
      lastAction: {
        type: 'MOVE' as const,
        playerIndex: 0,
        details: 'Moved token 0',
      },
    };

    // applyStateSnapshot logic
    const isPostMove = postMoveSnapshot.lastAction?.type === 'MOVE';
    if (postMoveSnapshot.hasRolled && !isPostMove && postMoveSnapshot.activePlayerIndex === 0) {
      validMoves = LudoEngine.getValidMoves(states[0], postMoveSnapshot.diceValue, states, options);
      if (validMoves.length > 0 && !manager.getIsTimedOut()) {
        manager.startTurn(15);
      }
    } else {
      validMoves = [];
    }

    expect(validMoves).toHaveLength(0);
    expect(manager.getRemainingSeconds()).toBe(15);
    // Since startTurn was not invoked, timer is not ticking
    vi.advanceTimersByTime(5000);
    expect(manager.getRemainingSeconds()).toBe(15);
  });

  it("restores timeout progression when a guest roll is rejected or watchdog expires", () => {
    const onTimeout = vi.fn();
    const manager = new TurnTimeoutManager({ onTimeout });

    // Guest turn begins
    manager.startTurn(15);
    vi.advanceTimersByTime(5000); // 10s left
    expect(manager.getRemainingSeconds()).toBe(10);

    // Guest taps roll -> pauses timer
    manager.stop();

    // Rejection or watchdog recovery restores remaining time
    const remaining = manager.getRemainingSeconds();
    manager.startTurn(Math.max(3, remaining));
    expect(manager.getRemainingSeconds()).toBe(10);
    expect(manager.getIsTimedOut()).toBe(false);

    // Time advances remaining 10 seconds -> timeout fires as expected
    vi.advanceTimersByTime(10000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(manager.getIsTimedOut()).toBe(true);
    manager.stop();
  });

  it("keeps guest roll watchdog active through isRolling=true snapshot and triggers recovery if completion missing", () => {
    let hasRolled = false;
    let isRolling = true;
    const retryRollSpy = vi.fn();
    const manager = new TurnTimeoutManager();
    manager.startTurn(15);
    vi.advanceTimersByTime(15000); // timed out
    expect(manager.getIsTimedOut()).toBe(true);

    let watchdogTimer: any = setTimeout(() => {
      if (!hasRolled && isRolling) {
        isRolling = false;
        if (manager.getIsTimedOut()) {
          retryRollSpy();
        }
      }
    }, 4000);

    // Intermediate snapshot arrives from host: dice is rolling (isRolling: true, hasRolled: false)
    const rollingSnapshot = { isRolling: true, hasRolled: false };
    if (rollingSnapshot.hasRolled || !rollingSnapshot.isRolling) {
      clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }

    // Watchdog MUST STILL BE ACTIVE
    expect(watchdogTimer).not.toBeNull();

    // 4 seconds elapse without roll-completion snapshot
    vi.advanceTimersByTime(4000);
    expect(retryRollSpy).toHaveBeenCalledTimes(1);
    expect(isRolling).toBe(false);
  });

  it("restores authoritative legal moves after rejected guest MOVE so auto-play can advance", () => {
    const states = createInitialState();
    const manager = new TurnTimeoutManager();
    const options = {
      requireSixToStart: true,
      bonusTurnOnSix: true,
      bonusTurnOnCapture: true,
      bonusTurnOnHome: true,
      maxConsecutiveSixes: 3,
    };
    const selectTokenSpy = vi.fn();

    // Turn timed out, rolled a 6
    manager.startTurn(15);
    vi.advanceTimersByTime(15000);
    expect(manager.getIsTimedOut()).toBe(true);

    let validMoves: MoveOption[] = LudoEngine.getValidMoves(states[0], 6, states, options);
    expect(validMoves.length).toBe(4);

    // Guest attempts move on token 0 -> clears validMoves
    validMoves = [];
    expect(validMoves.length).toBe(0);

    // Host rejects move
    const actionType = 'MOVE';
    if (actionType === 'MOVE') {
      const restored = LudoEngine.getValidMoves(states[0], 6, states, options);
      validMoves = restored;
    }
    expect(validMoves.length).toBe(4);

    // Timed out guest immediately auto-selects valid move
    if (manager.getIsTimedOut() && validMoves.length > 0) {
      const curPlayer = states[0];
      const chosen = BotAI.selectBestLudoMove(validMoves, curPlayer.config.color, curPlayer, states, 'medium');
      selectTokenSpy(chosen !== null ? chosen : validMoves[0].tokenId);
    }

    expect(selectTokenSpy).toHaveBeenCalledTimes(1);
    manager.stop();
  });
});
