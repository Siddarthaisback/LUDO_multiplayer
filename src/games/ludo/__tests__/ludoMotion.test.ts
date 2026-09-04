import { describe, it, expect } from 'vitest';
import {
  getMovementPathPoints,
  getBezierPoint,
  derivePathPreview,
  interpolateHopFrame,
} from '../ludoMotion';
import { MoveOption, LudoPlayerState } from '../../../types/ludo';
import { getLudoVisualPosition, LUDO_YARD_SOCKETS } from '../ludoGeometry';

describe('ludoMotion path & interpolation logic', () => {
  it('generates correct yard launch path from socket to step 0', () => {
    const points = getMovementPathPoints('red', 0, -1, 0);
    expect(points.length).toBe(2);
    expect(points[0]).toEqual(LUDO_YARD_SOCKETS.red[0]);
    expect(points[1]).toEqual(getLudoVisualPosition('red', 0, 0));
  });

  it('generates contiguous intermediate path points along the track', () => {
    const points = getMovementPathPoints('blue', 1, 10, 15);
    // Steps: 10, 11, 12, 13, 14, 15 (6 points)
    expect(points.length).toBe(6);
    expect(points[0]).toEqual(getLudoVisualPosition('blue', 1, 10));
    expect(points[5]).toEqual(getLudoVisualPosition('blue', 1, 15));
  });

  it('calculates quadratic Bézier point accurately', () => {
    const p0 = { x: 0, y: 0 };
    const p1 = { x: 0.5, y: 1.0 };
    const p2 = { x: 1.0, y: 0 };

    const startPt = getBezierPoint(p0, p1, p2, 0);
    expect(startPt.x).toBeCloseTo(0);
    expect(startPt.y).toBeCloseTo(0);

    const midPt = getBezierPoint(p0, p1, p2, 0.5);
    expect(midPt.x).toBeCloseTo(0.5);
    expect(midPt.y).toBeCloseTo(0.5);

    const endPt = getBezierPoint(p0, p1, p2, 1);
    expect(endPt.x).toBeCloseTo(1.0);
    expect(endPt.y).toBeCloseTo(0);
  });

  it('derives correct path preview with capture target type', () => {
    const mockMove: MoveOption = {
      tokenId: 0,
      fromStep: 5,
      toStep: 10,
      isExitYard: false,
      isHome: false,
      capturesOpponent: true,
      targetOpponents: [{ color: 'green', tokenId: 2 }],
    };

    const mockPlayers: LudoPlayerState[] = [];
    const preview = derivePathPreview(mockMove, 'red', mockPlayers);

    expect(preview.tokenId).toBe(0);
    expect(preview.color).toBe('red');
    expect(preview.destinationType).toBe('capture');
    expect(preview.capturesCount).toBe(1);
    expect(preview.points.length).toBe(6);
  });

  it('derives home destination type when toStep === 56', () => {
    const mockMove: MoveOption = {
      tokenId: 2,
      fromStep: 53,
      toStep: 56,
      isExitYard: false,
      isHome: true,
      capturesOpponent: false,
    };

    const preview = derivePathPreview(mockMove, 'yellow', []);
    expect(preview.destinationType).toBe('home');
  });

  it('identifies safe star squares correctly in path preview', () => {
    // For red (start cell = 0), step 8 is safe star (trackIndex = 8)
    const mockMove: MoveOption = {
      tokenId: 1,
      fromStep: 3,
      toStep: 8,
      isExitYard: false,
      isHome: false,
      capturesOpponent: false,
    };

    const preview = derivePathPreview(mockMove, 'red', []);
    expect(preview.destinationType).toBe('safe');
  });

  describe('interpolateHopFrame physics', () => {
    const fromPt = { x: 0.1, y: 0.2 };
    const toPt = { x: 0.3, y: 0.4 };

    it('returns exact starting point and zero lift at t=0', () => {
      const frame0 = interpolateHopFrame(fromPt, toPt, 0, 24);
      expect(frame0.point.x).toBeCloseTo(0.1);
      expect(frame0.point.y).toBeCloseTo(0.2);
      expect(frame0.liftY).toBeCloseTo(0);
      expect(frame0.scale).toBeCloseTo(1.0);
    });

    it('returns exact midpoint and maximum parabolic apex lift at t=0.5', () => {
      const frameMid = interpolateHopFrame(fromPt, toPt, 0.5, 24);
      expect(frameMid.point.x).toBeCloseTo(0.2);
      expect(frameMid.point.y).toBeCloseTo(0.3);
      expect(frameMid.liftY).toBeCloseTo(-24);
      expect(frameMid.scale).toBeCloseTo(1.22);
    });

    it('returns exact landing point and touchdown squash/zero lift at t=1', () => {
      const frame1 = interpolateHopFrame(fromPt, toPt, 1, 24);
      expect(frame1.point.x).toBeCloseTo(0.3);
      expect(frame1.point.y).toBeCloseTo(0.4);
      expect(frame1.liftY).toBeCloseTo(0);
      expect(frame1.scale).toBeCloseTo(1.0);
    });

    it('safely clamps values beyond range [0, 1]', () => {
      const frameUnder = interpolateHopFrame(fromPt, toPt, -0.5, 24);
      expect(frameUnder.point.x).toBeCloseTo(0.1);

      const frameOver = interpolateHopFrame(fromPt, toPt, 1.5, 24);
      expect(frameOver.point.x).toBeCloseTo(0.3);
    });
  });
});

