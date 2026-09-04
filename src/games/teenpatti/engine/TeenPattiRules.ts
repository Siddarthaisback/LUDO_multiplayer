export type TeenPattiSequenceRanking = 'AKQ_HIGH' | 'A23_HIGH';

export interface TeenPattiRuleConfig {
  readonly bootAmount: number; // default 10 chips
  readonly maxStake: number; // default 500 chips
  readonly maxBlindRounds: number; // default 4 rounds
  readonly sequenceRanking: TeenPattiSequenceRanking; // default AKQ_HIGH (A-K-Q > A-2-3 > K-Q-J...)
  readonly allowSideShow: boolean; // default true
}

export const CLASSIC_TEEN_PATTI_RULES: TeenPattiRuleConfig = {
  bootAmount: 10,
  maxStake: 500,
  maxBlindRounds: 4,
  sequenceRanking: 'AKQ_HIGH',
  allowSideShow: true,
};
