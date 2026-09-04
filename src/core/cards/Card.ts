export type Suit = 'S' | 'H' | 'D' | 'C'; // Spades, Hearts, Diamonds, Clubs
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14; // 11=J, 12=Q, 13=K, 14=A

export type CardId = string; // e.g. "AS", "KH", "10D", "2C"

export interface Card {
  readonly id: CardId;
  readonly suit: Suit;
  readonly rank: Rank;
  readonly label: string;
}

export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C'] as const;

export const RANKS: readonly { rank: Rank; label: string }[] = [
  { rank: 2, label: '2' },
  { rank: 3, label: '3' },
  { rank: 4, label: '4' },
  { rank: 5, label: '5' },
  { rank: 6, label: '6' },
  { rank: 7, label: '7' },
  { rank: 8, label: '8' },
  { rank: 9, label: '9' },
  { rank: 10, label: '10' },
  { rank: 11, label: 'J' },
  { rank: 12, label: 'Q' },
  { rank: 13, label: 'K' },
  { rank: 14, label: 'A' },
] as const;

export const SUIT_SYMBOLS: Record<Suit, string> = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
};

export const SUIT_NAMES: Record<Suit, string> = {
  S: 'Spades',
  H: 'Hearts',
  D: 'Diamonds',
  C: 'Clubs',
};

export const SUIT_COLORS: Record<Suit, string> = {
  S: '#0f172a',
  H: '#ef4444',
  D: '#dc2626',
  C: '#1e293b',
};

/**
 * Creates an immutable Card object from rank and suit
 */
export function createCard(rank: Rank, suit: Suit): Card {
  const rankItem = RANKS.find((r) => r.rank === rank);
  const label = rankItem ? rankItem.label : String(rank);
  const id: CardId = `${label}${suit}`;
  return Object.freeze({
    id,
    suit,
    rank,
    label,
  });
}

/**
 * Parses a standard card ID like "AS" or "10D" into a Card object
 */
export function parseCardId(id: CardId): Card {
  const suit = id.slice(-1) as Suit;
  const label = id.slice(0, -1);
  let rank: Rank;
  if (label === 'A') rank = 14;
  else if (label === 'K') rank = 13;
  else if (label === 'Q') rank = 12;
  else if (label === 'J') rank = 11;
  else rank = parseInt(label, 10) as Rank;

  return createCard(rank, suit);
}
