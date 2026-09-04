import { PlayerColor, BoardStyleMode } from '../../types/game';
import { LudoPlayerState, MoveOption } from '../../types/ludo';
import {
  BoardPoint,
  getLudoVisualPosition,
  LUDO_YARD_SOCKETS_LUXURY,
  LUDO_YARD_SOCKETS_CLASSIC,
} from './ludoGeometry';
import { PathPreviewData } from './ludoAnimationTypes';
import { LUDO_SAFE_CELLS, LUDO_START_CELLS } from '../../utils/constants';

/**
 * Generates all intermediate board coordinates from a token's start step to target step.
 */
export function getMovementPathPoints(
  color: PlayerColor,
  tokenId: number,
  fromStep: number,
  toStep: number,
  boardStyle: BoardStyleMode = 'classic'
): BoardPoint[] {
  const isClassic = boardStyle === 'classic';
  const yardSockets = isClassic ? LUDO_YARD_SOCKETS_CLASSIC : LUDO_YARD_SOCKETS_LUXURY;

  if (fromStep === -1 && toStep === 0) {
    // Yard exit: from socket to start tile
    return [
      yardSockets[color][tokenId] || { x: 0.5, y: 0.5 },
      getLudoVisualPosition(color, tokenId, 0, boardStyle),
    ];
  }

  const points: BoardPoint[] = [];
  const start = Math.max(0, fromStep);
  for (let s = start; s <= toStep; s++) {
    points.push(getLudoVisualPosition(color, tokenId, s, boardStyle));
  }
  return points;
}

/**
 * Calculates a point along a quadratic Bézier curve:
 * B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
 */
export function getBezierPoint(
  p0: BoardPoint,
  p1: BoardPoint,
  p2: BoardPoint,
  t: number
): BoardPoint {
  const invT = 1 - t;
  return {
    x: invT * invT * p0.x + 2 * invT * t * p1.x + t * t * p2.x,
    y: invT * invT * p0.y + 2 * invT * t * p1.y + t * t * p2.y,
  };
}

/**
 * Interpolates sub-frame position and 3D parabolic elevation between two cell centers:
 * - Linear X/Y travel
 * - Parabolic vertical hop: lift = -sin(t * PI) * maxLift
 * - Dynamic scale & contact stretch
 */
export function interpolateHopFrame(
  fromPt: BoardPoint,
  toPt: BoardPoint,
  t: number,
  maxLift: number = 22
): { point: BoardPoint; liftY: number; scale: number } {
  const clampedT = Math.max(0, Math.min(1, t));
  const currentX = fromPt.x + (toPt.x - fromPt.x) * clampedT;
  const currentY = fromPt.y + (toPt.y - fromPt.y) * clampedT;

  const sinCurve = Math.sin(clampedT * Math.PI);
  const liftY = -sinCurve * maxLift;
  const scale = 1.0 + sinCurve * 0.22;

  return {
    point: { x: currentX, y: currentY },
    liftY,
    scale,
  };
}

/**
 * Derives the path preview data for a hovered/selected movable token.
 */
export function derivePathPreview(
  move: MoveOption,
  playerColor: PlayerColor,
  allPlayers: LudoPlayerState[],
  boardStyle: BoardStyleMode = 'classic'
): PathPreviewData {
  const points = getMovementPathPoints(playerColor, move.tokenId, move.fromStep, move.toStep, boardStyle);
  const destPoint = getLudoVisualPosition(playerColor, move.tokenId, move.toStep, boardStyle);

  let destinationType: 'normal' | 'safe' | 'capture' | 'home' = 'normal';

  if (move.isHome || move.toStep === 56) {
    destinationType = 'home';
  } else if (move.capturesOpponent && move.targetOpponents && move.targetOpponents.length > 0) {
    destinationType = 'capture';
  } else if (move.toStep <= 50) {
    const trackIndex = (LUDO_START_CELLS[playerColor] + move.toStep) % 52;
    if (LUDO_SAFE_CELLS.includes(trackIndex)) {
      destinationType = 'safe';
    }
  }

  return {
    tokenId: move.tokenId,
    color: playerColor,
    points,
    destinationPoint: destPoint,
    destinationType,
    capturesCount: move.targetOpponents?.length || 0,
  };
}

