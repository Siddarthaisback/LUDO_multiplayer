export interface CallBreakRuleConfig {
  readonly roundCount: number;
  readonly minimumBid: number;
  readonly forceHigherCard: boolean; // Must play higher card of lead suit if available
  readonly forceTrump: boolean; // Must play Spade if void in lead suit
  readonly forceOverTrump: boolean; // Must play higher Spade if a Spade was already played
  readonly overtrickMultiplier: number; // default 0.1
}

export const NEPAL_CLASSIC_CALLBREAK_RULES: CallBreakRuleConfig = {
  roundCount: 5,
  minimumBid: 1,
  forceHigherCard: true,
  forceTrump: true,
  forceOverTrump: true,
  overtrickMultiplier: 0.1,
};
