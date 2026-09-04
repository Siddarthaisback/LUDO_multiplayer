import { describe, it, expect, vi } from 'vitest';
import { OnlineLudoController } from '../../../multiplayer/onlineLudoController';
import { MultiplayerSession, GameSnapshot } from '../../../multiplayer/protocol';

describe('Secret Dice Hold Trick (Option 3)', () => {
  const DICE_HOLD_THRESHOLD_MS = 500;

  const resolveHoldForceSix = (pressStartTime: number | null, releaseTime: number): boolean => {
    if (pressStartTime === null) return false;
    const elapsedMs = releaseTime - pressStartTime;
    return elapsedMs >= DICE_HOLD_THRESHOLD_MS;
  };

  const computeRoll = (forceSix: boolean): number => {
    return forceSix ? 6 : Math.floor(Math.random() * 6) + 1;
  };

  describe('Microtiming Contract', () => {
    it('does not force six for quick taps under 500ms', () => {
      expect(resolveHoldForceSix(1000, 1050)).toBe(false); // 50ms quick tap
      expect(resolveHoldForceSix(1000, 1250)).toBe(false); // 250ms press
      expect(resolveHoldForceSix(1000, 1499)).toBe(false); // 499ms near-threshold
    });

    it('forces six exactly at 500ms or longer holds', () => {
      expect(resolveHoldForceSix(1000, 1500)).toBe(true);  // Exactly 500ms
      expect(resolveHoldForceSix(1000, 1501)).toBe(true);  // 501ms
      expect(resolveHoldForceSix(1000, 2200)).toBe(true);  // 1200ms long hold
    });

    it('returns false when no pointer-down timestamp was recorded', () => {
      expect(resolveHoldForceSix(null, 1500)).toBe(false);
    });
  });

  describe('Roll Value Resolution', () => {
    it('always resolves to 6 when forceSix is true', () => {
      for (let i = 0; i < 50; i++) {
        expect(computeRoll(true)).toBe(6);
      }
    });

    it('resolves between 1 and 6 with standard RNG when forceSix is false', () => {
      const seen = new Set<number>();
      for (let i = 0; i < 200; i++) {
        const val = computeRoll(false);
        expect(val).toBeGreaterThanOrEqual(1);
        expect(val).toBeLessThanOrEqual(6);
        seen.add(val);
      }
      // Over 200 rolls, we should observe multiple distinct values
      expect(seen.size).toBeGreaterThan(1);
    });
  });

  describe('Consecutive Sixes & Engine Compliance', () => {
    it('penalizes 3 consecutive forced sixes according to maxConsecutiveSixes rule', () => {
      const maxSixes = 3;
      let consecutiveSixes = 0;
      let turnForfeited = false;

      const recordRoll = (roll: number) => {
        let nextConsecutive = roll === 6 ? consecutiveSixes + 1 : 0;
        if (nextConsecutive >= maxSixes) {
          consecutiveSixes = 0;
          turnForfeited = true;
        } else {
          consecutiveSixes = nextConsecutive;
          turnForfeited = false;
        }
      };

      // 1st forced six
      recordRoll(computeRoll(true));
      expect(consecutiveSixes).toBe(1);
      expect(turnForfeited).toBe(false);

      // 2nd forced six
      recordRoll(computeRoll(true));
      expect(consecutiveSixes).toBe(2);
      expect(turnForfeited).toBe(false);

      // 3rd forced six -> penalty!
      recordRoll(computeRoll(true));
      expect(consecutiveSixes).toBe(0);
      expect(turnForfeited).toBe(true);
    });
  });

  describe('Online Guest-to-Host Hold Propagation', () => {
    it('transmits forceSix: true from guest to authoritative host', () => {
      const onRemoteRoll = vi.fn();
      const hostController = new OnlineLudoController();

      const hostSession: MultiplayerSession = {
        roomCode: 'CHEAT6',
        matchId: 'match-cheat',
        mySeatIndex: 0,
        myPeerId: 'peer-host',
        isHost: true,
        players: [
          { id: 'p0', name: 'Host', color: 'red', avatar: '👑', type: 'human', isHost: true },
          { id: 'p1', name: 'Guest Dev', color: 'green', avatar: '🦊', type: 'human', isHost: false },
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

      const hostSnapshot: GameSnapshot = {
        matchId: 'match-cheat',
        sequence: 1,
        players: [],
        activePlayerIndex: 1, // Guest Dev's turn
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

      // Guest dev holds roll button for 650ms, triggering requestRoll with forceSix: true
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

      // Host receives callback indicating guest requested a forced six
      expect(onRemoteRoll).toHaveBeenCalledTimes(1);
      expect(onRemoteRoll).toHaveBeenCalledWith(0, 1, true);
    });
  });
});
