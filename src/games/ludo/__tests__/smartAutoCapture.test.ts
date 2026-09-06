import { describe, it, expect, vi } from 'vitest';
import { calculateSmartAutoCaptureRoll } from '../LudoEngine';
import { LudoPlayerState, LudoGameOptions } from '../../../types/ludo';
import { OnlineLudoController } from '../../../multiplayer/onlineLudoController';
import { peerTransport } from '../../../multiplayer/peerService';
import { MultiplayerSession, GameSnapshot } from '../../../multiplayer/protocol';

describe('Smart Auto-Capture / Distance Calculator', () => {
  const defaultOptions: LudoGameOptions = {
    requireSixToStart: true,
    bonusTurnOnSix: true,
    bonusTurnOnCapture: true,
    bonusTurnOnHome: true,
    maxConsecutiveSixes: 3,
  };

  const createPlayer = (
    color: 'red' | 'green' | 'yellow' | 'blue',
    tokenDefs: { step: number; status: 'yard' | 'track' | 'runway' | 'home'; trackIndex?: number }[]
  ): LudoPlayerState => ({
    config: {
      id: `player-${color}`,
      name: `Player ${color}`,
      color,
      type: 'human',
      avatar: '🎮',
    },
    tokens: tokenDefs.map((def, id) => ({
      id,
      color,
      step: def.step,
      status: def.status,
      trackIndex: def.trackIndex ?? (def.status === 'track' ? def.step : -1),
    })),
    tokensHome: tokenDefs.filter((d) => d.status === 'home' || d.step >= 56).length,
    tokensCaptured: 0,
    tokensLost: 0,
  });

  describe('calculateSmartAutoCaptureRoll', () => {
    it('returns exact roll (1..6) required to capture an opponent pawn', () => {
      // Red starts at main board tile 0.
      // Red token 0 is at step 10 on the common track (trackIndex = 10).
      const redPlayer = createPlayer('red', [
        { step: 10, status: 'track', trackIndex: 10 },
        { step: -1, status: 'yard' },
        { step: -1, status: 'yard' },
        { step: -1, status: 'yard' },
      ]);

      // Green token 0 is at trackIndex 14 (not a safe star cell: safe are 0,8,13,21,26,34,39,47)
      // Red needs exactly roll = 4 to land on trackIndex 14 (10 + 4 = 14)
      const greenPlayer = createPlayer('green', [
        { step: 1, status: 'track', trackIndex: 14 },
        { step: -1, status: 'yard' },
        { step: -1, status: 'yard' },
        { step: -1, status: 'yard' },
      ]);

      const roll = calculateSmartAutoCaptureRoll(redPlayer, [redPlayer, greenPlayer], defaultOptions);
      expect(roll).toBe(4);
    });

    it('prioritizes exact finish into home (step 56) when no capture is available', () => {
      // Red token is at runway step 53 (exactly 3 steps away from Home 56)
      const redPlayer = createPlayer('red', [
        { step: 53, status: 'runway', trackIndex: -1 },
        { step: -1, status: 'yard' },
        { step: -1, status: 'yard' },
        { step: -1, status: 'yard' },
      ]);
      const greenPlayer = createPlayer('green', [
        { step: -1, status: 'yard' },
        { step: -1, status: 'yard' },
        { step: -1, status: 'yard' },
        { step: -1, status: 'yard' },
      ]);

      const roll = calculateSmartAutoCaptureRoll(redPlayer, [redPlayer, greenPlayer], defaultOptions);
      expect(roll).toBe(3);
    });

    it('returns 6 to release from yard when all tokens are in yard', () => {
      const redPlayer = createPlayer('red', [
        { step: -1, status: 'yard' },
        { step: -1, status: 'yard' },
        { step: -1, status: 'yard' },
        { step: -1, status: 'yard' },
      ]);
      const greenPlayer = createPlayer('green', [
        { step: -1, status: 'yard' },
        { step: -1, status: 'yard' },
        { step: -1, status: 'yard' },
        { step: -1, status: 'yard' },
      ]);

      const roll = calculateSmartAutoCaptureRoll(redPlayer, [redPlayer, greenPlayer], defaultOptions);
      expect(roll).toBe(6);
    });

    it('returns a valid die value between 1 and 6 in all circumstances', () => {
      const redPlayer = createPlayer('red', [
        { step: 5, status: 'track', trackIndex: 5 },
        { step: 12, status: 'track', trackIndex: 12 },
        { step: 25, status: 'track', trackIndex: 25 },
        { step: 40, status: 'track', trackIndex: 40 },
      ]);
      const greenPlayer = createPlayer('green', [
        { step: 8, status: 'track', trackIndex: 8 },
        { step: 15, status: 'track', trackIndex: 15 },
        { step: 30, status: 'track', trackIndex: 30 },
        { step: 45, status: 'track', trackIndex: 45 },
      ]);

      const roll = calculateSmartAutoCaptureRoll(redPlayer, [redPlayer, greenPlayer], defaultOptions);
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(6);
    });
  });

  describe('Online Multiplayer Controller desiredRoll Validation', () => {
    const mockSession: MultiplayerSession = {
      matchId: 'room-test',
      myPeerId: 'host-1',
      mySeatIndex: 0,
      isHost: true,
      roomCode: 'ABCD',
      players: [
        { id: 'p1', name: 'Host', color: 'red', avatar: '👑', type: 'human' },
        { id: 'p2', name: 'Guest', color: 'green', avatar: '🎮', type: 'human' },
      ],
      options: defaultOptions,
      seatPeers: { 0: 'host-1', 1: 'guest-2' },
    };

    const mockSnapshot: GameSnapshot = {
      matchId: 'room-test',
      sequence: 1,
      players: [
        createPlayer('red', [{ step: 0, status: 'track', trackIndex: 0 }]),
        createPlayer('green', [{ step: 0, status: 'track', trackIndex: 0 }]),
      ],
      activePlayerIndex: 1,
      diceValue: 1,
      hasRolled: false,
      isRolling: false,
      consecutiveSixes: 0,
      winner: null,
      rankings: [],
    };

    it('forwards valid desiredRoll (1..6) to onRemoteRoll on the host', () => {
      const controller = new OnlineLudoController();
      controller.initSession(mockSession, mockSnapshot);

      const onRemoteRoll = vi.fn();
      controller.setCallbacks({ onRemoteRoll });

      // Simulate guest at seat 1 sending a ROLL_REQUEST with desiredRoll = 4
      (controller as any).handleWireMessage(
        {
          type: 'ROLL_REQUEST',
          matchId: 'room-test',
          seatIndex: 1,
          forceSix: false,
          desiredRoll: 4,
          timestamp: Date.now(),
        },
        'guest-2'
      );

      expect(onRemoteRoll).toHaveBeenCalledTimes(1);
      expect(onRemoteRoll).toHaveBeenCalledWith(0, 1, false, 4);
    });

    it('safely falls back to standard RNG roll when desiredRoll is null, undefined, out of bounds, NaN, or string without emitting ACTION_REJECTED', () => {
      const sendToPeerSpy = vi.spyOn(peerTransport, 'sendToPeer').mockReturnValue(true);

      const invalidDesiredRolls = [null, undefined, 7, 0, -1, 3.5, NaN, '4'];

      for (const invalidVal of invalidDesiredRolls) {
        sendToPeerSpy.mockClear();
        const controller = new OnlineLudoController();
        controller.initSession(mockSession, mockSnapshot);

        const onRemoteRoll = vi.fn();
        controller.setCallbacks({ onRemoteRoll });

        (controller as any).handleWireMessage(
          {
            type: 'ROLL_REQUEST',
            matchId: 'room-test',
            seatIndex: 1,
            forceSix: false,
            desiredRoll: invalidVal,
            timestamp: Date.now(),
          },
          'guest-2'
        );

        expect(onRemoteRoll).toHaveBeenCalledTimes(1);
        // Must be invoked with 3 arguments (no desiredRoll override argument)
        expect(onRemoteRoll).toHaveBeenCalledWith(0, 1, false);

        // Never emit ACTION_REJECTED for optional parameter variations
        const rejectionCall = sendToPeerSpy.mock.calls.find((call) => (call[1] as any)?.type === 'ACTION_REJECTED');
        expect(rejectionCall).toBeUndefined();
      }

      sendToPeerSpy.mockRestore();
    });

    it('normalizes forceSix safely: boolean true becomes true, while null or malformed values fall back to false without rejection', () => {
      const sendToPeerSpy = vi.spyOn(peerTransport, 'sendToPeer').mockReturnValue(true);

      // 1. Literal true
      {
        const controller = new OnlineLudoController();
        controller.initSession(mockSession, mockSnapshot);
        const onRemoteRoll = vi.fn();
        controller.setCallbacks({ onRemoteRoll });

        (controller as any).handleWireMessage(
          {
            type: 'ROLL_REQUEST',
            matchId: 'room-test',
            seatIndex: 1,
            forceSix: true,
            timestamp: Date.now(),
          },
          'guest-2'
        );

        expect(onRemoteRoll).toHaveBeenCalledTimes(1);
        expect(onRemoteRoll).toHaveBeenCalledWith(0, 1, true);
      }

      // 2. Malformed / non-boolean forceSix values fallback to false
      const malformedForceSixValues = [null, 'true', 1, {}, false];
      for (const val of malformedForceSixValues) {
        sendToPeerSpy.mockClear();
        const controller = new OnlineLudoController();
        controller.initSession(mockSession, mockSnapshot);
        const onRemoteRoll = vi.fn();
        controller.setCallbacks({ onRemoteRoll });

        (controller as any).handleWireMessage(
          {
            type: 'ROLL_REQUEST',
            matchId: 'room-test',
            seatIndex: 1,
            forceSix: val,
            timestamp: Date.now(),
          },
          'guest-2'
        );

        expect(onRemoteRoll).toHaveBeenCalledTimes(1);
        expect(onRemoteRoll).toHaveBeenCalledWith(0, 1, false);

        const rejectionCall = sendToPeerSpy.mock.calls.find((call) => (call[1] as any)?.type === 'ACTION_REJECTED');
        expect(rejectionCall).toBeUndefined();
      }

      sendToPeerSpy.mockRestore();
    });
  });
});
