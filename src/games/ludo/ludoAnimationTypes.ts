import { PlayerColor } from '../../types/game';
import { BoardPoint } from './ludoGeometry';

export type LudoEffectType =
  | 'hop_ripple'
  | 'yard_launch'
  | 'combat_explosion'
  | 'capture_dust'
  | 'capture_banner'
  | 'home_crown'
  | 'safe_star_shine';

export interface BoardEffectItem {
  id: string;
  type: LudoEffectType;
  point: BoardPoint;
  color?: PlayerColor;
  text?: string;
  durationMs: number;
  startTime: number;
}

export interface TokenVisualOverride {
  color: PlayerColor;
  tokenId: number;
  point: BoardPoint;
  liftY: number;      // in px (hop elevation)
  scale: number;      // scale factor
  rotateDeg: number;  // rotation in degrees (e.g. during capture spin)
  opacity: number;
  isHopping: boolean;
  isCapturing: boolean;
  isDefeated: boolean;
}

export interface PathPreviewData {
  tokenId: number;
  color: PlayerColor;
  points: BoardPoint[];
  destinationPoint: BoardPoint;
  destinationType: 'normal' | 'safe' | 'capture' | 'home';
  capturesCount: number;
}
