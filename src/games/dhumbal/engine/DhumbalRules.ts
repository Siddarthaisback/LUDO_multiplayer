export interface DhumbalRuleConfig {
  readonly callThreshold: number; // default 5 (hand total <= 5 to call)
  readonly failedCallPenalty: number; // default 25
  readonly jackValue: number; // default 11
  readonly queenValue: number; // default 12
  readonly kingValue: number; // default 13
  readonly aceValue: number; // default 1
  readonly targetScore: number; // default 100
  readonly allowDiscardPickup: boolean; // default true (can pick up top discard)
}

export const NEPAL_CLASSIC_DHUMBAL_RULES: DhumbalRuleConfig = {
  callThreshold: 5,
  failedCallPenalty: 25,
  jackValue: 11,
  queenValue: 12,
  kingValue: 13,
  aceValue: 1,
  targetScore: 100,
  allowDiscardPickup: true,
};
