export type GameType = 'snakes' | 'ludo' | 'cards';

export type PlayerType = 'human' | 'bot';

export type BotDifficulty = 'easy' | 'medium' | 'master';

export type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';

export interface PlayerConfig {
  id: string;
  name: string;
  color: PlayerColor;
  type: PlayerType;
  difficulty?: BotDifficulty;
  avatar: string;
  isHost?: boolean;
}

export type MultiplayerMode = 'local' | 'online_host' | 'online_guest';

export interface GameLogEntry {
  id: string;
  timestamp: number;
  text: string;
  type: 'roll' | 'move' | 'snake' | 'ladder' | 'capture' | 'win' | 'info' | 'chat';
  playerColor?: PlayerColor;
  playerName?: string;
}

export interface GameAudioSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  volume: number;
}

export type AnimationSpeed = 'normal' | 'fast' | 'turbo';

export type BoardStyleMode = 'luxury' | 'classic';
