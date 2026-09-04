import { PlayerColor, PlayerConfig } from '../types/game';
import { SnakeOrLadder, SpecialTile } from '../types/snakes';

export const COLOR_MAP: Record<PlayerColor, {
  name: string;
  primary: string;
  light: string;
  dark: string;
  border: string;
  bg: string;
  badge: string;
  text: string;
  shadow: string;
  tokenBg: string;
  ring: string;
}> = {
  red: {
    name: 'Ruby Red',
    primary: '#ef4444',
    light: '#fca5a5',
    dark: '#991b1b',
    border: 'border-red-500',
    bg: 'bg-red-500',
    badge: 'bg-red-500/20 text-red-300 border-red-500/40',
    text: 'text-red-400',
    shadow: 'shadow-red-500/40',
    tokenBg: 'radial-gradient(circle at 35% 35%, #f87171, #dc2626 70%, #991b1b)',
    ring: 'ring-red-400',
  },
  green: {
    name: 'Emerald Green',
    primary: '#22c55e',
    light: '#86efac',
    dark: '#166534',
    border: 'border-green-500',
    bg: 'bg-green-500',
    badge: 'bg-green-500/20 text-green-300 border-green-500/40',
    text: 'text-green-400',
    shadow: 'shadow-green-500/40',
    tokenBg: 'radial-gradient(circle at 35% 35%, #4ade80, #16a34a 70%, #166534)',
    ring: 'ring-green-400',
  },
  yellow: {
    name: 'Solar Yellow',
    primary: '#eab308',
    light: '#fde047',
    dark: '#854d0e',
    border: 'border-yellow-500',
    bg: 'bg-yellow-500',
    badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    text: 'text-yellow-400',
    shadow: 'shadow-yellow-500/40',
    tokenBg: 'radial-gradient(circle at 35% 35%, #facc15, #ca8a04 70%, #854d0e)',
    ring: 'ring-yellow-400',
  },
  blue: {
    name: 'Sapphire Blue',
    primary: '#3b82f6',
    light: '#93c5fd',
    dark: '#1e40af',
    border: 'border-blue-500',
    bg: 'bg-blue-500',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    text: 'text-blue-400',
    shadow: 'shadow-blue-500/40',
    tokenBg: 'radial-gradient(circle at 35% 35%, #60a5fa, #2563eb 70%, #1e40af)',
    ring: 'ring-blue-400',
  },
};

export const DEFAULT_AVATARS = [
  '🦁', '🐯', '🐼', '🦊', '🐨', '🐸', '🦄', '🐲', '🤖', '👑', '⚡', '🚀'
];

export const DEFAULT_PLAYERS: PlayerConfig[] = [
  { id: 'p1', name: 'Player 1', color: 'red', type: 'human', avatar: '🦁', isHost: true },
  { id: 'p2', name: 'Player 2', color: 'green', type: 'human', avatar: '🐼' },
  { id: 'p3', name: 'Bot Blaze', color: 'yellow', type: 'bot', difficulty: 'medium', avatar: '🤖' },
  { id: 'p4', name: 'Bot Viper', color: 'blue', type: 'bot', difficulty: 'master', avatar: '🐲' },
];

// Snakes and Ladders Board Setup (Standard 1-100)
export const DEFAULT_SNAKES_AND_LADDERS: SnakeOrLadder[] = [
  // Ladders (Climb Up)
  { from: 4, to: 25, type: 'ladder' },
  { from: 8, to: 31, type: 'ladder' },
  { from: 21, to: 42, type: 'ladder' },
  { from: 28, to: 84, type: 'ladder' },
  { from: 36, to: 57, type: 'ladder' },
  { from: 51, to: 67, type: 'ladder' },
  { from: 71, to: 91, type: 'ladder' },
  { from: 80, to: 99, type: 'ladder' },

  // Snakes (Slide Down)
  { from: 98, to: 28, type: 'snake' },
  { from: 95, to: 56, type: 'snake' },
  { from: 92, to: 51, type: 'snake' },
  { from: 83, to: 19, type: 'snake' },
  { from: 73, to: 15, type: 'snake' },
  { from: 64, to: 36, type: 'snake' },
  { from: 62, to: 18, type: 'snake' },
  { from: 48, to: 9,  type: 'snake' },
  { from: 38, to: 14, type: 'snake' },
];

export const SPECIAL_TILES: SpecialTile[] = [
  { tile: 17, type: 'shield', label: '🛡️ Shield', description: 'Blocks the next snake bite you land on!' },
  { tile: 45, type: 'boost', label: '⚡ Speed Boost', description: 'Surges forward +5 tiles instantly!' },
  { tile: 69, type: 'mystery', label: '🎁 Mystery', description: 'Rolls a bonus spin or secret bonus!' },
  { tile: 88, type: 'freeze', label: '❄️ Freeze', description: 'Freezes opponents for 1 turn!' },
];

// Ludo Constants
export const LUDO_START_CELLS: Record<PlayerColor, number> = {
  red: 0,
  green: 13,
  blue: 26,
  yellow: 39,
};

// 8 Safe Squares on standard Ludo board (no piece can be captured here)
export const LUDO_SAFE_CELLS: number[] = [0, 8, 13, 21, 26, 34, 39, 47];

// 52 Common Track Coordinates on 15x15 Matrix [row, col] (0-indexed from top-left: 0..14)
export const LUDO_TRACK_COORDINATES: [number, number][] = [
  // 0-4 (Red Starting Row: Left to Right towards center)
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  // 5-10 (Green Quadrant Approach: Going UP)
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  // 11-12 (Top crossover)
  [0, 7], [0, 8],
  // 13-17 (Green Starting Column: Going DOWN)
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  // 18-23 (Blue Quadrant Approach: Going RIGHT)
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  // 24-25 (Right crossover)
  [7, 14], [8, 14],
  // 26-30 (Blue Starting Row: Going LEFT)
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  // 31-36 (Yellow Quadrant Approach: Going DOWN)
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  // 37-38 (Bottom crossover)
  [14, 7], [14, 6],
  // 39-43 (Yellow Starting Column: Going UP)
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  // 44-49 (Red Approach: Going LEFT)
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  // 50-51 (Left crossover)
  [7, 0], [6, 0] // 51 is [6,0], then Red enters [7, 1] runway!
];

// 5 Colored Home Runway Coordinates for each player
export const LUDO_HOME_RUNWAYS: Record<PlayerColor, [number, number][]> = {
  red: [ [7, 1], [7, 2], [7, 3], [7, 4], [7, 5] ],
  green: [ [1, 7], [2, 7], [3, 7], [4, 7], [5, 7] ],
  blue: [ [7, 13], [7, 12], [7, 11], [7, 10], [7, 9] ],
  yellow: [ [13, 7], [12, 7], [11, 7], [10, 7], [9, 7] ],
};

// Yard circle token anchor points [row, col] on 15x15 board (harmoniously balanced across 6x6 yards)
export const LUDO_YARD_POSITIONS: Record<PlayerColor, [number, number][]> = {
  red: [ [1.4, 1.4], [1.4, 4.1], [4.1, 1.4], [4.1, 4.1] ],
  green: [ [1.4, 10.4], [1.4, 13.1], [4.1, 10.4], [4.1, 13.1] ],
  blue: [ [10.4, 10.4], [10.4, 13.1], [13.1, 10.4], [13.1, 13.1] ],
  yellow: [ [10.4, 1.4], [10.4, 4.1], [13.1, 1.4], [13.1, 4.1] ],
};

// Center Goal Center
export const LUDO_GOAL_COORDINATES: Record<PlayerColor, [number, number]> = {
  red: [7, 6.2],
  green: [6.2, 7],
  blue: [7, 7.8],
  yellow: [7.8, 7],
};
