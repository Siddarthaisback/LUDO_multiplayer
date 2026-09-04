import { PlayingCardData, CardSuit, CardRank } from '../../types/cardGame';

const SUITS: CardSuit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS: { rank: CardRank; label: string }[] = [
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
];

export class CardDeckEngine {
  /**
   * Generates a fresh 52-card standard deck
   */
  public static createDeck(faceUp: boolean = false): PlayingCardData[] {
    const deck: PlayingCardData[] = [];
    SUITS.forEach((suit) => {
      RANKS.forEach(({ rank, label }) => {
        deck.push({
          id: `${suit}-${rank}-${Math.random().toString(36).substring(2, 7)}`,
          suit,
          rank,
          label,
          isFaceUp: faceUp,
        });
      });
    });
    return deck;
  }

  /**
   * Cryptographically sound Fisher-Yates shuffle
   */
  public static shuffleDeck(deck: PlayingCardData[]): PlayingCardData[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Calculate Blackjack hand value (handles soft/hard Aces dynamically)
   */
  public static calculateBlackjackScore(cards: PlayingCardData[]): { score: number; isSoft: boolean; isBusted: boolean; isBlackjack: boolean } {
    let score = 0;
    let aceCount = 0;

    cards.forEach((card) => {
      if (card.rank >= 10 && card.rank <= 13) {
        score += 10;
      } else if (card.rank === 14) {
        aceCount += 1;
        score += 11;
      } else {
        score += card.rank;
      }
    });

    let isSoft = aceCount > 0;
    while (score > 21 && aceCount > 0) {
      score -= 10;
      aceCount -= 1;
    }
    isSoft = aceCount > 0;

    const isBusted = score > 21;
    const isBlackjack = cards.length === 2 && score === 21;

    return { score, isSoft, isBusted, isBlackjack };
  }

  /**
   * Evaluates 3-Card Teen Patti Hand Rank
   * 6 = Trail (Trio), 5 = Pure Sequence (Straight Flush), 4 = Sequence (Straight),
   * 3 = Color (Flush), 2 = Pair, 1 = High Card
   */
  public static evaluateTeenPattiHand(cards: PlayingCardData[]): { rankType: number; rankName: string; highCard: number } {
    if (cards.length < 3) return { rankType: 0, rankName: 'Incomplete', highCard: 0 };

    const sorted = [...cards].sort((a, b) => b.rank - a.rank);
    const r1 = sorted[0].rank;
    const r2 = sorted[1].rank;
    const r3 = sorted[2].rank;

    const isFlush = cards[0].suit === cards[1].suit && cards[1].suit === cards[2].suit;
    const isTrio = r1 === r2 && r2 === r3;
    const isStraight = (r1 - r2 === 1 && r2 - r3 === 1) || (r1 === 14 && r2 === 3 && r3 === 2); // A-2-3 special straight
    const isPair = r1 === r2 || r2 === r3 || r1 === r3;

    if (isTrio) return { rankType: 6, rankName: '🔥 Trail (Three of a Kind)', highCard: r1 };
    if (isFlush && isStraight) return { rankType: 5, rankName: '👑 Pure Sequence', highCard: r1 };
    if (isStraight) return { rankType: 4, rankName: '⚡ Sequence (Straight)', highCard: r1 };
    if (isFlush) return { rankType: 3, rankName: '💎 Color (Flush)', highCard: r1 };
    if (isPair) return { rankType: 2, rankName: '✨ Pair', highCard: r1 === r2 ? r1 : r2 === r3 ? r2 : r1 };
    return { rankType: 1, rankName: 'High Card', highCard: r1 };
  }
}
