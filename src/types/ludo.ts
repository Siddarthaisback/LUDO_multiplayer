import { PlayerColor, PlayerConfig } from './game';

export type TokenStatus = 'yard' | 'track' | 'runway' | 'home';

export interface LudoTokenState {
  id: number; // 0, 1, 2, 3
  color: PlayerColor;
  step: number; // -1 = yard, 0 = start tile, 1-50 = common track steps, 51-55 = home runway steps, 56 = HOME!
  status: TokenStatus;
  trackIndex: number; // Global board cell (0-51) if status === 'track'
}

export interface LudoPlayerState {
  config: PlayerConfig;
  tokens: LudoTokenState[];
  tokensHome: number;
  tokensCaptured: number;
  tokensLost: number;
  rank?: number; // 1 = 1st place, 2 = 2nd, etc.
}

export interface LudoGameOptions {
  requireSixToStart: boolean;
  bonusTurnOnSix: boolean;
  bonusTurnOnCapture: boolean;
  bonusTurnOnHome: boolean;
  maxConsecutiveSixes: number; // 3
}

export interface MoveOption {
  tokenId: number;
  fromStep: number;
  toStep: number;
  isExitYard: boolean;
  isHome: boolean;
  capturesOpponent: boolean;
  targetOpponents?: { color: PlayerColor; tokenId: number }[];
}

export interface LudoMoveTransactionResult {
  updatedPlayers: LudoPlayerState[];
  bonusTurn: boolean;
  capturedTokens: { color: PlayerColor; tokenId: number }[];
  reachedHome: boolean;
  playerWonNow: boolean;
  newRank?: number;
}

export interface LudoAnimationState {
  animatingTokenId: number | null;
  animatingTokenColor: PlayerColor | null;
  currentStep: number;
  isHopping: boolean;
  capturedTokensInFlight: {
    color: PlayerColor;
    tokenId: number;
    fromStep: number;
  }[];
}

