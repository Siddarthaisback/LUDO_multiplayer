import { PlayerConfig } from './game';

export interface SnakeOrLadder {
  from: number; // Start tile (1-100)
  to: number;   // Destination tile (1-100)
  type: 'snake' | 'ladder';
}

export type SpecialTileType = 'shield' | 'boost' | 'mystery' | 'freeze';

export interface SpecialTile {
  tile: number;
  type: SpecialTileType;
  label: string;
  description: string;
}

export interface SnakePlayerState {
  config: PlayerConfig;
  position: number; // 0 = not on board, 1-100 = board tile
  hasShield: boolean;
  isFrozen: boolean;
  snakesBitten: number;
  laddersClimbed: number;
  totalRolls: number;
  rank?: number;
}

export type SnakesBoardTheme = 'classic' | 'jungle' | 'cyberpunk' | 'royal';

export interface SnakesGameOptions {
  theme: SnakesBoardTheme;
  exactRollToWin: boolean;
  extraTurnOnSix: boolean;
  enablePowerUps: boolean;
}
