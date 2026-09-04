export interface PokerRuleConfig {
  readonly smallBlind: number; // default 10
  readonly bigBlind: number; // default 20
  readonly minRaise: number; // default 20
  readonly startingChips: number; // default 1000
}

export const NO_LIMIT_HOLDEM_RULES: PokerRuleConfig = {
  smallBlind: 10,
  bigBlind: 20,
  minRaise: 20,
  startingChips: 1000,
};
