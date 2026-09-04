import { Rank } from '../../../core/cards/Card';

export interface JutPattiRuleConfig {
  readonly startingHandSize: 5 | 7 | 9 | 11; // Must be odd (default 9)
  readonly targetWinningPairs: number; // (startingHandSize + 1) / 2
}

export const NEPAL_CLASSIC_JUTPATTI_RULES: JutPattiRuleConfig = {
  startingHandSize: 9,
  targetWinningPairs: 5,
};

/**
 * Computes the wild Joker rank (exactly one rank above the exposed card)
 * A(14) -> 2(2) -> 3 ... -> K(13) -> A(14)
 */
export function getJokerRankFromExposedCard(exposedRank: Rank): Rank {
  if (exposedRank === 13) return 14; // King exposed -> Aces are Jokers
  if (exposedRank === 14) return 2;  // Ace exposed -> 2s are Jokers
  return (exposedRank + 1) as Rank;
}
