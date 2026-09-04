import { TeenPattiEngine, TeenPattiState } from '../engine/TeenPattiEngine';
import { TeenPattiEvaluator } from '../engine/TeenPattiEvaluator';
import { BotDifficulty } from '../../../types/game';

export type TeenPattiBotAction = 'see' | 'chaal' | 'raise' | 'pack' | 'show';

export class TeenPattiAI {
  /**
   * Evaluates best betting action for the bot
   */
  public static makeDecision(
    state: TeenPattiState,
    playerIndex: number,
    difficulty: BotDifficulty = 'medium'
  ): TeenPattiBotAction {
    const player = state.players[playerIndex];
    const activePlayers = state.players.filter((p) => !p.isPacked);

    // If only 2 players remain and pot is substantial, consider Show
    if (activePlayers.length === 2) {
      if (!player.isBlind) {
        const evalResult = TeenPattiEvaluator.evaluateHand(player.hand, state.rules);
        if (evalResult.categoryRank >= 2 || Math.random() < 0.5) {
          return 'show';
        }
      }
    }

    // If bot is blind, decide whether to play blind or see cards
    if (player.isBlind) {
      if (Math.random() < 0.4) {
        // Play blind chaal
        return 'chaal';
      } else {
        // See cards
        return 'see';
      }
    }

    // Player has seen cards: evaluate hand strength tier
    const evalResult = TeenPattiEvaluator.evaluateHand(player.hand, state.rules);
    const rank = evalResult.categoryRank; // 6=Trail, 5=PureSeq, 4=Seq, 3=Color, 2=Pair, 1=HighCard

    if (rank >= 4) {
      // Very strong hand: Raise or Chaal
      return Math.random() < 0.6 ? 'raise' : 'chaal';
    } else if (rank === 3 || rank === 2) {
      // Decent hand (Color / Pair): Chaal
      return 'chaal';
    } else {
      // Weak hand (High Card): Bluff or Pack
      const bluffProbability = difficulty === 'master' ? 0.2 : difficulty === 'medium' ? 0.1 : 0.05;
      if (Math.random() < bluffProbability && state.currentStake <= state.rules.bootAmount * 2) {
        return 'chaal';
      }
      return 'pack';
    }
  }
}
