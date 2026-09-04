import { PlayerColor, BoardStyleMode } from '../../types/game';
import {
  LUDO_TRACK_COORDINATES,
  LUDO_HOME_RUNWAYS,
  LUDO_GOAL_COORDINATES,
  LUDO_START_CELLS,
} from '../../utils/constants';

export interface BoardPoint {
  x: number; // 0..1 (fraction of board width)
  y: number; // 0..1 (fraction of board height)
}

/**
 * Classic 15x15 Grid Constants (full 0..1 coordinate grid without inset)
 */
const CLASSIC_CELL_SIZE = 1.0 / 15.0;

/**
 * Converts standard 15x15 row and column (0..14) into normalized [0..1] BoardPoint
 */
export function gridToNormalizedClassic(row: number, col: number): BoardPoint {
  return {
    x: (col + 0.5) * CLASSIC_CELL_SIZE,
    y: (row + 0.5) * CLASSIC_CELL_SIZE,
  };
}

export const gridToNormalizedLuxury = gridToNormalizedClassic;

/**
 * Symmetrical socket centers for the 4 circular gold socket rings in each yard:
 */
export const LUDO_YARD_SOCKETS_CLASSIC: Record<PlayerColor, BoardPoint[]> = {
  red: [
    { x: 0.125, y: 0.125 },
    { x: 0.275, y: 0.125 },
    { x: 0.125, y: 0.275 },
    { x: 0.275, y: 0.275 },
  ],
  green: [
    { x: 0.725, y: 0.125 },
    { x: 0.875, y: 0.125 },
    { x: 0.725, y: 0.275 },
    { x: 0.875, y: 0.275 },
  ],
  yellow: [
    { x: 0.125, y: 0.725 },
    { x: 0.275, y: 0.725 },
    { x: 0.125, y: 0.875 },
    { x: 0.275, y: 0.875 },
  ],
  blue: [
    { x: 0.725, y: 0.725 },
    { x: 0.875, y: 0.725 },
    { x: 0.725, y: 0.875 },
    { x: 0.875, y: 0.875 },
  ],
};

export const LUDO_YARD_SOCKETS_LUXURY = LUDO_YARD_SOCKETS_CLASSIC;
export const LUDO_YARD_SOCKETS = LUDO_YARD_SOCKETS_CLASSIC;

/**
 * 52 Common Track Cell Normalized Centers
 */
export const LUDO_NORMALIZED_TRACK_CLASSIC: BoardPoint[] = LUDO_TRACK_COORDINATES.map(
  ([r, c]) => gridToNormalizedClassic(r, c)
);
export const LUDO_NORMALIZED_TRACK_LUXURY = LUDO_NORMALIZED_TRACK_CLASSIC;

/**
 * 5-Step Finishing Runway Centers for each color
 */
export const LUDO_NORMALIZED_RUNWAYS_CLASSIC: Record<PlayerColor, BoardPoint[]> = {
  red: LUDO_HOME_RUNWAYS.red.map(([r, c]) => gridToNormalizedClassic(r, c)),
  green: LUDO_HOME_RUNWAYS.green.map(([r, c]) => gridToNormalizedClassic(r, c)),
  yellow: LUDO_HOME_RUNWAYS.yellow.map(([r, c]) => gridToNormalizedClassic(r, c)),
  blue: LUDO_HOME_RUNWAYS.blue.map(([r, c]) => gridToNormalizedClassic(r, c)),
};
export const LUDO_NORMALIZED_RUNWAYS_LUXURY = LUDO_NORMALIZED_RUNWAYS_CLASSIC;

/**
 * Exact normalized center goals for finishing tokens
 */
export const LUDO_NORMALIZED_GOALS_CLASSIC: Record<PlayerColor, BoardPoint> = {
  red: gridToNormalizedClassic(LUDO_GOAL_COORDINATES.red[0], LUDO_GOAL_COORDINATES.red[1]),
  green: gridToNormalizedClassic(LUDO_GOAL_COORDINATES.green[0], LUDO_GOAL_COORDINATES.green[1]),
  yellow: gridToNormalizedClassic(LUDO_GOAL_COORDINATES.yellow[0], LUDO_GOAL_COORDINATES.yellow[1]),
  blue: gridToNormalizedClassic(LUDO_GOAL_COORDINATES.blue[0], LUDO_GOAL_COORDINATES.blue[1]),
};
export const LUDO_NORMALIZED_GOALS_LUXURY = LUDO_NORMALIZED_GOALS_CLASSIC;

/**
 * Canonical location key for grouping tokens on the same spot.
 */
export function getLudoLocationKey(color: PlayerColor, tokenId: number, step: number): string {
  if (step < 0) {
    return `yard:${color}:${tokenId}`;
  }
  if (step >= 56) {
    return `home:${color}`;
  }
  if (step >= 51) {
    return `runway:${color}:${step - 51}`;
  }
  const trackIndex = (LUDO_START_CELLS[color] + step) % 52;
  return `track:${trackIndex}`;
}

/**
 * Resolves logical step (-1 to 56) into a canonical normalized visual BoardPoint {x, y}
 */
export function getLudoVisualPosition(
  color: PlayerColor,
  tokenId: number,
  step: number,
  boardStyle: BoardStyleMode = 'classic'
): BoardPoint {
  const isClassic = boardStyle === 'classic';

  // 1. In Yard (-1)
  if (step < 0) {
    const sockets = isClassic ? LUDO_YARD_SOCKETS_CLASSIC : LUDO_YARD_SOCKETS_LUXURY;
    return sockets[color][tokenId] || { x: 0.5, y: 0.5 };
  }

  // 2. Reached Home Goal (56)
  if (step >= 56) {
    const goals = isClassic ? LUDO_NORMALIZED_GOALS_CLASSIC : LUDO_NORMALIZED_GOALS_LUXURY;
    return goals[color];
  }

  // 3. In Colored Home Runway (51 to 55)
  if (step >= 51) {
    const runwayIdx = step - 51; // 0 to 4
    const runways = isClassic ? LUDO_NORMALIZED_RUNWAYS_CLASSIC : LUDO_NORMALIZED_RUNWAYS_LUXURY;
    return runways[color][runwayIdx] || { x: 0.5, y: 0.5 };
  }

  // 4. On Common Track (0 to 50)
  const trackIndex = (LUDO_START_CELLS[color] + step) % 52;
  const tracks = isClassic ? LUDO_NORMALIZED_TRACK_CLASSIC : LUDO_NORMALIZED_TRACK_LUXURY;
  return tracks[trackIndex] || { x: 0.5, y: 0.5 };
}

/**
 * Deterministic cluster offset when multiple tokens occupy the exact same cell
 */
export function getClusterOffset(peerIndex: number, totalPeers: number): { dx: number; dy: number } {
  if (totalPeers <= 1) {
    return { dx: 0, dy: 0 };
  }

  if (totalPeers === 2) {
    return peerIndex === 0
      ? { dx: -0.012, dy: -0.007 }
      : { dx: +0.012, dy: +0.007 };
  }

  if (totalPeers === 3) {
    if (peerIndex === 0) return { dx: 0, dy: -0.012 };
    if (peerIndex === 1) return { dx: -0.011, dy: +0.008 };
    return { dx: +0.011, dy: +0.008 };
  }

  if (totalPeers === 4) {
    const xMult = peerIndex % 2 === 0 ? -1 : 1;
    const yMult = peerIndex < 2 ? -1 : 1;
    return { dx: xMult * 0.010, dy: yMult * 0.010 };
  }

  // 5 or more tokens: radial distribution
  const angle = (peerIndex / totalPeers) * 2 * Math.PI;
  const radius = 0.014;
  return {
    dx: Math.cos(angle) * radius,
    dy: Math.sin(angle) * radius,
  };
}

