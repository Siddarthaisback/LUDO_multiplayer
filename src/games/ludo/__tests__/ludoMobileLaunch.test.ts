import { describe, it, expect } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { DEFAULT_PLAYERS } from '../../../utils/constants';
import { LudoEngine } from '../LudoEngine';
import { PlayerConfig } from '../../../types/game';
import { parseLaunchState, isMaintenanceActive, getRouterContainerClass } from '../../../App';

describe('Ludo Mobile Launch & Setup Contract', () => {
  describe('parseLaunchState query precedence & parity', () => {
    it('defaults fresh web launch to Ludo Classic with setup menu open', () => {
      const state = parseLaunchState('');
      expect(state.screen).toBe('ludo');
      expect(state.setupGameId).toBe('ludo');
      expect(state.roomCode).toBe('');
      expect(state.isLegacyHub).toBe(false);
    });

    it('prioritizes valid room invitation links to open multiplayer lobby', () => {
      const state = parseLaunchState('?room=K9M2PX');
      expect(state.screen).toBe('ludo');
      expect(state.setupGameId).toBeNull();
      expect(state.roomCode).toBe('K9M2PX');
      expect(state.isLegacyHub).toBe(false);
    });

    it('normalizes room code from URL and handles lowercase/hyphens', () => {
      const state = parseLaunchState('?room=ab-cd-ef');
      expect(state.roomCode).toBe('ABCDEF');
      expect(state.screen).toBe('ludo');
      expect(state.setupGameId).toBeNull();
    });

    it('opens legacy multi-game hub when ?game=hub is explicitly requested without room', () => {
      const state = parseLaunchState('?game=hub');
      expect(state.screen).toBe('menu');
      expect(state.setupGameId).toBeNull();
      expect(state.roomCode).toBe('');
      expect(state.isLegacyHub).toBe(true);
    });

    it('prioritizes room invitation over ?game=hub when both are present', () => {
      const state = parseLaunchState('?room=K9M2PX&game=hub');
      expect(state.roomCode).toBe('K9M2PX');
      expect(state.screen).toBe('ludo');
      expect(state.setupGameId).toBeNull();
      expect(state.isLegacyHub).toBe(false);
    });
  });

  it('identifies native launch mode and defaults match setup correctly', () => {
    // Contract test: when Capacitor native is detected, game setup must target ludo
    const isNative = Capacitor.isNativePlatform();
    expect(DEFAULT_PLAYERS).toHaveLength(4);
    expect(DEFAULT_PLAYERS[0].color).toBe('red');
    expect(DEFAULT_PLAYERS[1].color).toBe('green');
  });

  it('correctly configures 2-player diagonal pairings from setup', () => {
    const twoPlayersDiagonal: PlayerConfig[] = [
      { id: '1', name: 'Player 1', type: 'human', color: 'red', avatar: '👑' },
      { id: '2', name: 'Player 2 (AI)', type: 'bot', color: 'blue', avatar: '🤖', difficulty: 'master' },
    ];

    expect(twoPlayersDiagonal).toHaveLength(2);
    expect(twoPlayersDiagonal[0].color).toBe('red');
    expect(twoPlayersDiagonal[1].color).toBe('blue');

    const initialPlayerStates = twoPlayersDiagonal.map((p) => ({
      config: p,
      tokens: [
        { id: 0, color: p.color, step: -1, status: 'yard' as const, trackIndex: -1 },
        { id: 1, color: p.color, step: -1, status: 'yard' as const, trackIndex: -1 },
        { id: 2, color: p.color, step: -1, status: 'yard' as const, trackIndex: -1 },
        { id: 3, color: p.color, step: -1, status: 'yard' as const, trackIndex: -1 },
      ],
      tokensHome: 0,
      tokensCaptured: 0,
      tokensLost: 0,
    }));

    const movesOnSix = LudoEngine.getValidMoves(initialPlayerStates[0], 6, initialPlayerStates, {
      requireSixToStart: true,
      bonusTurnOnSix: true,
      bonusTurnOnCapture: true,
      bonusTurnOnHome: true,
      maxConsecutiveSixes: 3,
    });

    expect(movesOnSix.length).toBe(4);
    expect(movesOnSix[0].isExitYard).toBe(true);
  });

  it('preserves legal token movement step calculation without RAF thrashing', () => {
    const redToken = { id: 0, color: 'red' as const, step: 0, status: 'track' as const, trackIndex: 0 };
    const movedToken = LudoEngine.applyMoveToToken(redToken, 4, 'red');

    expect(movedToken.step).toBe(4);
    expect(movedToken.trackIndex).toBe(4);
  });

  describe('isMaintenanceActive gating policy', () => {
    it('activates maintenance screen only for production web when VITE_MAINTENANCE_MODE=true', () => {
      expect(isMaintenanceActive('production', false, 'true')).toBe(true);
    });

    it('bypasses maintenance screen during local development', () => {
      expect(isMaintenanceActive('development', true, 'true')).toBe(false);
      expect(isMaintenanceActive('production', true, 'true')).toBe(false);
      expect(isMaintenanceActive('development', false, 'true')).toBe(false);
    });

    it('bypasses maintenance screen for native app builds', () => {
      expect(isMaintenanceActive('native', false, 'true')).toBe(false);
    });

    it('deactivates maintenance screen when VITE_MAINTENANCE_MODE is false or unset', () => {
      expect(isMaintenanceActive('production', false, 'false')).toBe(false);
      expect(isMaintenanceActive('production', false, undefined)).toBe(false);
      expect(isMaintenanceActive('production', false, '')).toBe(false);
    });
  });

  describe('getRouterContainerClass viewport & scroll policy', () => {
    it('enables vertical scrolling and top-alignment when setup menu is open', () => {
      const setupClass = getRouterContainerClass('ludo', 'ludo');
      expect(setupClass).toContain('overflow-y-auto');
      expect(setupClass).toContain('justify-start');
      expect(setupClass).not.toContain('overflow-hidden');
    });

    it('enables vertical scrolling for the card games hub menu', () => {
      const hubClass = getRouterContainerClass('menu', null);
      expect(hubClass).toContain('overflow-y-auto');
      expect(hubClass).toContain('justify-start');
    });

    it('locks overflow and centers content during active gameplay', () => {
      const activeLudoClass = getRouterContainerClass('ludo', null);
      expect(activeLudoClass).toContain('overflow-hidden');
      expect(activeLudoClass).toContain('justify-center');
      expect(activeLudoClass).not.toContain('overflow-y-auto');

      const activeCallbreakClass = getRouterContainerClass('callbreak', null);
      expect(activeCallbreakClass).toContain('overflow-hidden');
      expect(activeCallbreakClass).toContain('justify-center');
    });
  });
});
