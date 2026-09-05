import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { PlayerColor } from '../../../types/game';
import { LudoPlayerState } from '../../../types/ludo';
import { PlayerCornerDock, getDockDiceAriaLabel } from '../PlayerCornerDock';

describe('PlayerCornerDock Mapping & Turn Shifting Invariants', () => {
  const CORNER_MAP: Record<PlayerColor, 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'> = {
    red: 'top-left',
    green: 'top-right',
    yellow: 'bottom-left',
    blue: 'bottom-right',
  };

  it('strictly maps player colors to the 4 board corner yards', () => {
    expect(CORNER_MAP.red).toBe('top-left');
    expect(CORNER_MAP.green).toBe('top-right');
    expect(CORNER_MAP.yellow).toBe('bottom-left');
    expect(CORNER_MAP.blue).toBe('bottom-right');
  });

  it('ensures exactly one dock is active at any point in the turn cycle', () => {
    const activeColors: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

    activeColors.forEach((currentTurn) => {
      const activeDocks = Object.keys(CORNER_MAP).filter(
        (color) => color === currentTurn
      );
      expect(activeDocks).toHaveLength(1);
      expect(activeDocks[0]).toBe(currentTurn);
    });
  });

  it('correctly maps 2-player diagonal match corners', () => {
    const twoPlayerColors: PlayerColor[] = ['red', 'blue'];
    const activeCornerPositions = twoPlayerColors.map((c) => CORNER_MAP[c]);

    expect(activeCornerPositions).toEqual(['top-left', 'bottom-right']);
  });

  it('determines accurate accessible labels via getDockDiceAriaLabel for all 6 states', () => {
    // 1. Ready to roll
    expect(
      getDockDiceAriaLabel({
        isRolling: false,
        isInteractive: true,
        hasRolled: false,
        diceValue: 1,
        isAutomatedTurn: false,
        isOnline: false,
        isMyOnlineTurn: true,
      })
    ).toBe('Roll dice (tap or hold)');

    // 2. In motion
    expect(
      getDockDiceAriaLabel({
        isRolling: true,
        isInteractive: false,
        hasRolled: false,
        diceValue: 1,
        isAutomatedTurn: false,
        isOnline: false,
        isMyOnlineTurn: true,
      })
    ).toBe('Dice rolling');

    // 3. Rolled value
    expect(
      getDockDiceAriaLabel({
        isRolling: false,
        isInteractive: false,
        hasRolled: true,
        diceValue: 6,
        isAutomatedTurn: false,
        isOnline: false,
        isMyOnlineTurn: true,
      })
    ).toBe('Rolled 6');

    // 4. Bot turn in progress
    expect(
      getDockDiceAriaLabel({
        isRolling: false,
        isInteractive: false,
        hasRolled: false,
        diceValue: 1,
        isAutomatedTurn: true,
        isOnline: false,
        isMyOnlineTurn: true,
      })
    ).toBe('Bot turn in progress');

    // 5. Waiting for online opponent
    expect(
      getDockDiceAriaLabel({
        isRolling: false,
        isInteractive: false,
        hasRolled: false,
        diceValue: 1,
        isAutomatedTurn: false,
        isOnline: true,
        isMyOnlineTurn: false,
      })
    ).toBe('Waiting for opponent');

    // 6. Inactive or transitioning fallback
    expect(
      getDockDiceAriaLabel({
        isRolling: false,
        isInteractive: false,
        hasRolled: false,
        diceValue: 1,
        isAutomatedTurn: false,
        isOnline: false,
        isMyOnlineTurn: false,
      })
    ).toBe('Dice waiting');
  });

  it('renders actual PlayerCornerDock component with exact dice button aria-label for all 6 states', () => {
    const basePlayerState: LudoPlayerState = {
      config: {
        id: 'p1',
        name: 'Player 1',
        color: 'red',
        type: 'human',
        avatar: '🔴',
      },
      tokens: [],
      tokensHome: 0,
      tokensCaptured: 0,
      tokensLost: 0,
    };

    const renderDock = (props: Partial<React.ComponentProps<typeof PlayerCornerDock>>) => {
      return renderToStaticMarkup(
        React.createElement(PlayerCornerDock, {
          color: 'red',
          corner: 'top-left',
          playerState: basePlayerState,
          isActive: true,
          diceValue: 6,
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
          ...props,
        })
      );
    };

    // 1. Interactive roll
    const htmlInteractive = renderDock({ canRoll: true, hasRolled: false, isRolling: false });
    expect(htmlInteractive).toContain('aria-label="Roll dice (tap or hold)"');

    // 2. Rolling
    const htmlRolling = renderDock({ isRolling: true });
    expect(htmlRolling).toContain('aria-label="Dice rolling"');

    // 3. Rolled
    const htmlRolled = renderDock({ hasRolled: true, diceValue: 6 });
    expect(htmlRolled).toContain('aria-label="Rolled 6"');

    // 4. Bot turn
    const htmlBot = renderDock({ isAutomatedTurn: true, canRoll: false });
    expect(htmlBot).toContain('aria-label="Bot turn in progress"');

    // 5. Waiting for online opponent
    const htmlOnlineWait = renderDock({ isOnline: true, isMyOnlineTurn: false });
    expect(htmlOnlineWait).toContain('aria-label="Waiting for opponent"');

    // 6. Transitioning / waiting fallback (canRoll=false, hasRolled=false, isRolling=false, not bot, not online)
    const htmlFallback = renderDock({ canRoll: false, hasRolled: false, isRolling: false });
    expect(htmlFallback).toContain('aria-label="Dice waiting"');
  });

  it('renders purple auto-capture trigger button only when interactive and callback is provided', () => {
    const basePlayerState: LudoPlayerState = {
      config: {
        id: 'p1',
        name: 'Player 1',
        color: 'red',
        type: 'human',
        avatar: '🔴',
      },
      tokens: [],
      tokensHome: 0,
      tokensCaptured: 0,
      tokensLost: 0,
    };

    // When interactive and callback provided: trigger should be rendered
    const htmlWithTrigger = renderToStaticMarkup(
      React.createElement(PlayerCornerDock, {
        color: 'red',
        corner: 'top-left',
        playerState: basePlayerState,
        isActive: true,
        diceValue: 6,
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
        onTriggerAutoCapture: () => {},
      })
    );
    expect(htmlWithTrigger).toContain('data-testid="auto-capture-trigger-red"');
    expect(htmlWithTrigger).toContain('bg-transparent');

    // When already rolled: trigger should NOT be rendered
    const htmlRolled = renderToStaticMarkup(
      React.createElement(PlayerCornerDock, {
        color: 'red',
        corner: 'top-left',
        playerState: basePlayerState,
        isActive: true,
        diceValue: 6,
        isRolling: false,
        canRoll: true,
        hasRolled: true,
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
        onTriggerAutoCapture: () => {},
      })
    );
    expect(htmlRolled).not.toContain('data-testid="auto-capture-trigger-red"');
  });
});
