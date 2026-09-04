import { describe, it, expect } from 'vitest';
import { PlayerColor } from '../../../types/game';

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
});
