import { describe, it, expect, vi } from 'vitest';
import {
  handleDiceCornerTap,
  consumeArmedCheatOnRoll,
  resetDiceCornerRitual,
  REQUIRED_TURNS_FOR_CHEAT,
  CLOCKWISE_CORNER_SEQUENCE,
  INITIAL_RITUAL_STATE,
  DiceCornerRitualState,
} from '../diceCornerRitual';

describe('Strict Clockwise Dice-Corner Cheat Ritual', () => {
  describe('4-Turn Eligibility Gate', () => {
    it('rejects corner tap progress before 4 turns have elapsed', () => {
      let state = INITIAL_RITUAL_STATE;

      for (let turns = 0; turns < REQUIRED_TURNS_FOR_CHEAT; turns++) {
        const res = handleDiceCornerTap('TL', state, turns, true);
        expect(res.nextState.step).toBe(0);
        expect(res.nextState.cheatArmed).toBe(false);
        expect(res.justArmed).toBe(false);
      }
    });

    it('allows corner tap progress once turnCount >= 4', () => {
      const res = handleDiceCornerTap('TL', INITIAL_RITUAL_STATE, 4, true);
      expect(res.nextState.step).toBe(1);
      expect(res.nextState.cheatArmed).toBe(false);
      expect(res.wasReset).toBe(false);
    });

    it('rejects progress when isEligible is false (e.g. inactive player / bot turn)', () => {
      const res = handleDiceCornerTap('TL', INITIAL_RITUAL_STATE, 4, false);
      expect(res.nextState.step).toBe(0);
      expect(res.nextState.cheatArmed).toBe(false);
    });
  });

  describe('Strict Clockwise Sequence (TL -> TR -> BR -> BL)', () => {
    it('successfully arms the cheat when all 4 corners are tapped in clockwise order', () => {
      let state: DiceCornerRitualState = INITIAL_RITUAL_STATE;

      // 1. Top-Left
      const r1 = handleDiceCornerTap('TL', state, 4, true);
      expect(r1.nextState.step).toBe(1);
      expect(r1.nextState.cheatArmed).toBe(false);
      expect(r1.justArmed).toBe(false);
      state = r1.nextState;

      // 2. Top-Right
      const r2 = handleDiceCornerTap('TR', state, 4, true);
      expect(r2.nextState.step).toBe(2);
      expect(r2.nextState.cheatArmed).toBe(false);
      expect(r2.justArmed).toBe(false);
      state = r2.nextState;

      // 3. Bottom-Right
      const r3 = handleDiceCornerTap('BR', state, 4, true);
      expect(r3.nextState.step).toBe(3);
      expect(r3.nextState.cheatArmed).toBe(false);
      expect(r3.justArmed).toBe(false);
      state = r3.nextState;

      // 4. Bottom-Left
      const r4 = handleDiceCornerTap('BL', state, 4, true);
      expect(r4.nextState.step).toBe(0);
      expect(r4.nextState.cheatArmed).toBe(true);
      expect(r4.justArmed).toBe(true);
      expect(r4.wasReset).toBe(false);
    });

    it('verifies CLOCKWISE_CORNER_SEQUENCE order constant', () => {
      expect(CLOCKWISE_CORNER_SEQUENCE).toEqual(['TL', 'TR', 'BR', 'BL']);
    });
  });

  describe('Strict State Machine Reset on Broken Ritual', () => {
    it('resets immediately to step 0 if sequence is broken: TL -> TR -> TL', () => {
      let state = INITIAL_RITUAL_STATE;

      const r1 = handleDiceCornerTap('TL', state, 5, true);
      expect(r1.nextState.step).toBe(1);
      state = r1.nextState;

      const r2 = handleDiceCornerTap('TR', state, 5, true);
      expect(r2.nextState.step).toBe(2);
      state = r2.nextState;

      // Broken: tapped TL instead of BR
      const r3 = handleDiceCornerTap('TL', state, 5, true);
      expect(r3.nextState.step).toBe(0);
      expect(r3.nextState.cheatArmed).toBe(false);
      expect(r3.wasReset).toBe(true);
    });

    it('resets immediately if starting with any non-TL corner', () => {
      const rTR = handleDiceCornerTap('TR', INITIAL_RITUAL_STATE, 4, true);
      expect(rTR.nextState.step).toBe(0);
      expect(rTR.wasReset).toBe(true);

      const rBR = handleDiceCornerTap('BR', INITIAL_RITUAL_STATE, 4, true);
      expect(rBR.nextState.step).toBe(0);
      expect(rBR.wasReset).toBe(true);

      const rBL = handleDiceCornerTap('BL', INITIAL_RITUAL_STATE, 4, true);
      expect(rBL.nextState.step).toBe(0);
      expect(rBL.wasReset).toBe(true);
    });

    it('resets immediately if broken at step 1 (skipping TR to BR or BL)', () => {
      const r1 = handleDiceCornerTap('TL', INITIAL_RITUAL_STATE, 4, true);
      expect(r1.nextState.step).toBe(1);

      const rWrong = handleDiceCornerTap('BL', r1.nextState, 4, true);
      expect(rWrong.nextState.step).toBe(0);
      expect(rWrong.wasReset).toBe(true);
    });

    it('resets immediately if broken at step 3 (tapping anything other than BL)', () => {
      const r1 = handleDiceCornerTap('TL', INITIAL_RITUAL_STATE, 4, true);
      const r2 = handleDiceCornerTap('TR', r1.nextState, 4, true);
      const r3 = handleDiceCornerTap('BR', r2.nextState, 4, true);
      expect(r3.nextState.step).toBe(3);

      const rWrong = handleDiceCornerTap('TR', r3.nextState, 4, true);
      expect(rWrong.nextState.step).toBe(0);
      expect(rWrong.nextState.cheatArmed).toBe(false);
      expect(rWrong.wasReset).toBe(true);
    });

    it('resets armed state if an extra corner tap occurs after arming', () => {
      const armedState: DiceCornerRitualState = { step: 0, cheatArmed: true };
      const res = handleDiceCornerTap('TL', armedState, 4, true);
      expect(res.nextState.step).toBe(0);
      expect(res.nextState.cheatArmed).toBe(false);
      expect(res.wasReset).toBe(true);
    });
  });

  describe('Atomic Roll Consumption & Standard Fair RNG', () => {
    it('consumes armed cheat atomically on roll and returns to unarmed state', () => {
      const armedState: DiceCornerRitualState = { step: 0, cheatArmed: true };

      // 1st roll consumes cheat
      const roll1 = consumeArmedCheatOnRoll(armedState);
      expect(roll1.wasArmed).toBe(true);
      expect(roll1.nextState.cheatArmed).toBe(false);
      expect(roll1.nextState.step).toBe(0);

      // 2nd roll is unarmed (fair)
      const roll2 = consumeArmedCheatOnRoll(roll1.nextState);
      expect(roll2.wasArmed).toBe(false);
      expect(roll2.nextState.cheatArmed).toBe(false);
    });

    it('resets in-progress ritual if a roll occurs before completing BL', () => {
      const inProgressState: DiceCornerRitualState = { step: 2, cheatArmed: false };
      const roll = consumeArmedCheatOnRoll(inProgressState);
      expect(roll.wasArmed).toBe(false);
      expect(roll.nextState.step).toBe(0);
      expect(roll.nextState.cheatArmed).toBe(false);
    });

    it('resets completely via resetDiceCornerRitual on turn handover or restart', () => {
      const res = resetDiceCornerRitual();
      expect(res).toEqual({ step: 0, cheatArmed: false });
    });
  });

  describe('Integration: Turn Lifecycle & Gesture Reset Guarantees', () => {
    it('resets in-progress ritual when center is pressed before sequence completion', () => {
      let state = INITIAL_RITUAL_STATE;

      // Tap TL and TR
      state = handleDiceCornerTap('TL', state, 4, true).nextState;
      state = handleDiceCornerTap('TR', state, 4, true).nextState;
      expect(state.step).toBe(2);
      expect(state.cheatArmed).toBe(false);

      // Center pointerdown occurs (simulating handleRollPointerDown logic)
      if (!state.cheatArmed && state.step > 0) {
        state = resetDiceCornerRitual();
      }

      expect(state.step).toBe(0);
      expect(state.cheatArmed).toBe(false);

      // Next corner tap must start fresh from TL, not BR
      const afterCenterTap = handleDiceCornerTap('BR', state, 4, true);
      expect(afterCenterTap.nextState.step).toBe(0);
      expect(afterCenterTap.wasReset).toBe(true);
    });

    it('enforces turn handover progression: unlocks on 4th handover and resets on match restart', () => {
      let matchTurnCount = 0;
      let state = INITIAL_RITUAL_STATE;

      // Turn 0-3: Tapping TL cannot arm
      for (let t = 0; t < 4; t++) {
        matchTurnCount = t;
        const res = handleDiceCornerTap('TL', state, matchTurnCount, true);
        expect(res.nextState.step).toBe(0);
        expect(res.nextState.cheatArmed).toBe(false);
      }

      // 4th turn handover occurs (advanceTurn called 4 times)
      matchTurnCount = 4;
      state = handleDiceCornerTap('TL', state, matchTurnCount, true).nextState;
      state = handleDiceCornerTap('TR', state, matchTurnCount, true).nextState;
      state = handleDiceCornerTap('BR', state, matchTurnCount, true).nextState;
      state = handleDiceCornerTap('BL', state, matchTurnCount, true).nextState;
      expect(state.cheatArmed).toBe(true);

      // Match restart occurs (handleRestart logic)
      matchTurnCount = 0;
      state = resetDiceCornerRitual();
      expect(matchTurnCount).toBe(0);
      expect(state.cheatArmed).toBe(false);
      expect(state.step).toBe(0);

      // Attempting ritual immediately after restart fails because matchTurnCount is 0
      const restartAttempt = handleDiceCornerTap('TL', state, matchTurnCount, true);
      expect(restartAttempt.nextState.step).toBe(0);
      expect(restartAttempt.nextState.cheatArmed).toBe(false);
    });

    it('atomically guarantees exactly one cheat roll followed by standard fair RNG', () => {
      let state = INITIAL_RITUAL_STATE;

      // Complete ritual on turn 4
      state = handleDiceCornerTap('TL', state, 4, true).nextState;
      state = handleDiceCornerTap('TR', state, 4, true).nextState;
      state = handleDiceCornerTap('BR', state, 4, true).nextState;
      state = handleDiceCornerTap('BL', state, 4, true).nextState;
      expect(state.cheatArmed).toBe(true);

      // First roll: consumes cheat
      const roll1 = consumeArmedCheatOnRoll(state);
      expect(roll1.wasArmed).toBe(true);
      state = roll1.nextState;

      // Subsequent 10 rolls without re-arming must all be unarmed (fair RNG)
      for (let i = 0; i < 10; i++) {
        const subsequentRoll = consumeArmedCheatOnRoll(state);
        expect(subsequentRoll.wasArmed).toBe(false);
        state = subsequentRoll.nextState;
      }
    });

    it('verifies production resolveRollOutcome produces smart auto-capture roll when armed and fair RNG when unarmed', async () => {
      const { resolveRollOutcome } = await import('../diceCornerRitual');
      const mockPlayer = {
        config: { id: 'p1', name: 'Player 1', color: 'red' as const, type: 'human' as const, avatar: '🦁' },
        tokens: [
          { id: 0, color: 'red' as const, step: -1, status: 'yard' as const, trackIndex: -1 },
          { id: 1, color: 'red' as const, step: -1, status: 'yard' as const, trackIndex: -1 },
          { id: 2, color: 'red' as const, step: -1, status: 'yard' as const, trackIndex: -1 },
          { id: 3, color: 'red' as const, step: -1, status: 'yard' as const, trackIndex: -1 },
        ],
        tokensHome: 0,
        tokensCaptured: 0,
        tokensLost: 0,
      };
      const options = {
        requireSixToStart: true,
        bonusTurnOnSix: true,
        bonusTurnOnCapture: true,
        bonusTurnOnHome: true,
        maxConsecutiveSixes: 3,
      };

      // When armed and all tokens in yard: returns 6 to release pawn
      const armedResult = resolveRollOutcome(true, mockPlayer, [mockPlayer], options);
      expect(armedResult.isSmartAutoCapture).toBe(true);
      expect(armedResult.roll).toBe(6);

      // When unarmed: returns standard RNG roll (1-6) and isSmartAutoCapture is false
      const fairRolls = new Set<number>();
      for (let i = 0; i < 100; i++) {
        const unarmedResult = resolveRollOutcome(false, mockPlayer, [mockPlayer], options);
        expect(unarmedResult.isSmartAutoCapture).toBe(false);
        expect(unarmedResult.roll).toBeGreaterThanOrEqual(1);
        expect(unarmedResult.roll).toBeLessThanOrEqual(6);
        fairRolls.add(unarmedResult.roll);
      }
      expect(fairRolls.size).toBeGreaterThan(1);
    });

    it('renders all 4 dice-corner ritual touch targets in PlayerCornerDock when interactive', async () => {
      const { PlayerCornerDock } = await import('../PlayerCornerDock');
      const { renderToStaticMarkup } = await import('react-dom/server');
      const React = await import('react');

      const mockPlayer = {
        config: { id: 'p1', name: 'Player 1', color: 'red' as const, type: 'human' as const, avatar: '🦁' },
        tokens: [
          { id: 0, color: 'red' as const, step: -1, status: 'yard' as const, trackIndex: -1 },
        ],
        tokensHome: 0,
        tokensCaptured: 0,
        tokensLost: 0,
      };

      const html = renderToStaticMarkup(
        React.createElement(PlayerCornerDock, {
          color: 'red',
          corner: 'top-left',
          playerState: mockPlayer,
          isActive: true,
          diceValue: 1,
          isRolling: false,
          canRoll: true,
          hasRolled: false,
          isAnimatingMove: false,
          isAutomatedTurn: false,
          isOnline: false,
          isMyOnlineTurn: true,
          onRollPointerDown: () => {},
          onRollPointerUp: () => {},
          onRollPointerCancel: () => {},
          onRollKeyDown: () => {},
          onRollKeyUp: () => {},
          onRollClick: () => {},
          onCornerTap: () => {},
        })
      );

      // Must contain all 4 corner test ids and the central roll button
      expect(html).toContain('data-testid="dice-corner-red-TL"');
      expect(html).toContain('data-testid="dice-corner-red-TR"');
      expect(html).toContain('data-testid="dice-corner-red-BR"');
      expect(html).toContain('data-testid="dice-corner-red-BL"');
      expect(html).toContain('data-testid="dice-button-red"');
    });
  });

  describe('Online Guest-to-Host Roll Propagation', () => {
    it('transmits forceSix: true from guest to authoritative host', async () => {
      const { OnlineLudoController } = await import('../../../multiplayer/onlineLudoController');
      const onRemoteRoll = vi.fn();
      const hostController = new OnlineLudoController();

      const hostSession = {
        roomCode: 'CHEAT6',
        matchId: 'match-cheat',
        mySeatIndex: 0,
        myPeerId: 'peer-host',
        isHost: true,
        players: [
          { id: 'p0', name: 'Host', color: 'red' as const, avatar: '👑', type: 'human' as const, isHost: true },
          { id: 'p1', name: 'Guest Dev', color: 'green' as const, avatar: '🦊', type: 'human' as const, isHost: false },
        ],
        options: {
          requireSixToStart: true,
          bonusTurnOnSix: true,
          bonusTurnOnCapture: true,
          bonusTurnOnHome: true,
          maxConsecutiveSixes: 3,
        },
        seatPeers: {
          0: 'peer-host',
          1: 'peer-guest-dev',
        },
      };

      const hostSnapshot = {
        matchId: 'match-cheat',
        sequence: 1,
        players: [],
        activePlayerIndex: 1,
        diceValue: 1,
        hasRolled: false,
        isRolling: false,
        consecutiveSixes: 0,
        winner: null,
        rankings: [],
      };

      hostController.initSession(hostSession, hostSnapshot);
      hostController.setCallbacks({ onRemoteRoll });

      const hostTransportHandler = (hostController as any).handleWireMessage.bind(hostController);

      hostTransportHandler(
        {
          type: 'ROLL_REQUEST',
          matchId: 'match-cheat',
          seatIndex: 1,
          forceSix: true,
          timestamp: Date.now(),
        },
        'peer-guest-dev'
      );

      expect(onRemoteRoll).toHaveBeenCalledTimes(1);
      expect(onRemoteRoll).toHaveBeenCalledWith(0, 1, true);
    });
  });
});
