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
});
