import { Card } from '../../../core/cards/Card';
import { PokerEvaluator, PokerEvaluation } from './PokerEvaluator';

export interface PotContribution {
  playerIndex: number;
  amount: number;
  isFolded: boolean;
}

export interface ResolvedPot {
  potIndex: number;
  amount: number;
  eligiblePlayerIndices: number[];
  winners: { playerIndex: number; payout: number; evaluation: PokerEvaluation }[];
}

export class PokerSidePots {
  /**
   * Constructs main pot and all side pots from player contributions
   */
  public static calculatePots(contributions: PotContribution[]): { amount: number; eligiblePlayerIndices: number[] }[] {
    const activeContributions = contributions.filter((c) => c.amount > 0);
    if (activeContributions.length === 0) return [];

    // Distinct non-zero contribution levels sorted ascending
    const levels = Array.from(new Set(activeContributions.map((c) => c.amount))).sort((a, b) => a - b);

    const pots: { amount: number; eligiblePlayerIndices: number[] }[] = [];
    let previousLevel = 0;

    for (const level of levels) {
      const levelDiff = level - previousLevel;
      let potSliceAmount = 0;
      const eligiblePlayers: number[] = [];

      for (const contrib of contributions) {
        if (contrib.amount >= level) {
          potSliceAmount += levelDiff;
          if (!contrib.isFolded) {
            eligiblePlayers.push(contrib.playerIndex);
          }
        } else if (contrib.amount > previousLevel) {
          potSliceAmount += (contrib.amount - previousLevel);
        }
      }

      if (potSliceAmount > 0) {
        if (eligiblePlayers.length > 0) {
          pots.push({
            amount: potSliceAmount,
            eligiblePlayerIndices: eligiblePlayers,
          });
        } else if (pots.length > 0) {
          // Dead money from folded players above active bets rolls into the highest contested pot
          pots[pots.length - 1].amount += potSliceAmount;
        } else {
          // If no pots exist yet, award dead money to any remaining active players
          const nonFolded = contributions.filter((c) => !c.isFolded).map((c) => c.playerIndex);
          if (nonFolded.length > 0) {
            pots.push({
              amount: potSliceAmount,
              eligiblePlayerIndices: nonFolded,
            });
          }
        }
      }

      previousLevel = level;
    }

    return pots;
  }

  /**
   * Resolves each pot (main and side pots) and awards chips to best hand(s)
   */
  public static resolveAllPots(
    contributions: PotContribution[],
    hands: Card[][],
    communityCards: Card[]
  ): ResolvedPot[] {
    const potSlices = PokerSidePots.calculatePots(contributions);
    const resolved: ResolvedPot[] = [];

    potSlices.forEach((slice, idx) => {
      // Evaluate hands of eligible players
      const evaluations = slice.eligiblePlayerIndices.map((pIdx) => ({
        playerIndex: pIdx,
        evaluation: PokerEvaluator.evaluate7CardHand([...hands[pIdx], ...communityCards]),
      }));

      // Find best evaluation
      let winningEval = evaluations[0].evaluation;
      for (let i = 1; i < evaluations.length; i++) {
        if (
          PokerEvaluator.compareScoreVectors(
            evaluations[i].evaluation.scoreVector,
            winningEval.scoreVector
          ) > 0
        ) {
          winningEval = evaluations[i].evaluation;
        }
      }

      // Find all tied winners for this pot
      const potWinners = evaluations.filter(
        (e) =>
          PokerEvaluator.compareScoreVectors(e.evaluation.scoreVector, winningEval.scoreVector) === 0
      );

      const splitShare = Math.floor(slice.amount / potWinners.length);
      const remainder = slice.amount % potWinners.length;

      const winnerPayouts = potWinners.map((w, wIdx) => ({
        playerIndex: w.playerIndex,
        payout: splitShare + (wIdx === 0 ? remainder : 0),
        evaluation: w.evaluation,
      }));

      resolved.push({
        potIndex: idx,
        amount: slice.amount,
        eligiblePlayerIndices: slice.eligiblePlayerIndices,
        winners: winnerPayouts,
      });
    });

    return resolved;
  }
}
