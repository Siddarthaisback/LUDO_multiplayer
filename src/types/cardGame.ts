import { PlayerConfig } from './game';

export type CardSuit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export type CardRank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14; // 11=J, 12=Q, 13=K, 14=A

export interface PlayingCardData {
  id: string;
  suit: CardSuit;
  rank: CardRank;
  label: string; // "2", "3"..."10", "J", "Q", "K", "A"
  isFaceUp: boolean;
  isPlayable?: boolean;
  isSelected?: boolean;
}

export type CardGameMode = 'blackjack' | 'teen_patti' | 'spades';

export interface CardPlayerState {
  config: PlayerConfig;
  hand: PlayingCardData[];
  chips: number;
  currentBet: number;
  status: 'playing' | 'stand' | 'busted' | 'folded' | 'won' | 'lost' | 'blackjack';
  score?: number;
  bid?: number;
  tricksWon?: number;
}

export interface CardGameState {
  gameMode: CardGameMode;
  deck: PlayingCardData[];
  discardPile: PlayingCardData[];
  communityCards: PlayingCardData[];
  pot: number;
  currentTurnIndex: number;
  dealerIndex: number;
  roundPhase: 'betting' | 'dealing' | 'action' | 'showdown' | 'round_over';
  winner?: PlayerConfig | null;
  minBet: number;
}
