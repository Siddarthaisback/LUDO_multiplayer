import { BotDifficulty, PlayerColor } from '../types/game';
import { LudoPlayerState, MoveOption } from '../types/ludo';
import { LUDO_SAFE_CELLS, LUDO_START_CELLS } from '../utils/constants';

export class BotAI {
  /**
   * Evaluates valid moves for Ludo and selects the optimal token based on difficulty.
   */
  public static selectBestLudoMove(
    validMoves: MoveOption[],
    botColor: PlayerColor,
    myPlayer: LudoPlayerState,
    allPlayers: LudoPlayerState[],
    difficulty: BotDifficulty = 'medium'
  ): number | null {
    if (validMoves.length === 0) return null;
    if (validMoves.length === 1) return validMoves[0].tokenId;

    // Easy: Random choice among legal moves
    if (difficulty === 'easy') {
      const randomIndex = Math.floor(Math.random() * validMoves.length);
      return validMoves[randomIndex].tokenId;
    }

    // Medium & Master: Heuristic evaluation
    let bestScore = -Infinity;
    let bestTokenId = validMoves[0].tokenId;

    for (const move of validMoves) {
      let score = 0;
      const token = myPlayer.tokens.find((t) => t.id === move.tokenId);
      if (!token) continue;

      // 1. Scoring: Reaching Home
      if (move.isHome) {
        score += 10000;
      }

      // 2. Scoring: Capturing opponent token (Huge reward)
      if (move.capturesOpponent) {
        score += 5000;
        // Bonus if capturing opponent close to home
        if (move.targetOpponents && move.targetOpponents.length > 0) {
          score += 1000 * move.targetOpponents.length;
        }
      }

      // 3. Scoring: Exiting Yard (Freeing pieces)
      if (move.isExitYard) {
        // High priority if few pieces are active
        const activeTokens = myPlayer.tokens.filter((t) => t.status !== 'yard' && t.status !== 'home').length;
        score += (4 - activeTokens) * 1200 + 1500;
      }

      // 4. Scoring: Entering Home Runway (Immunity from all danger)
      if (move.toStep >= 51 && move.fromStep < 51) {
        score += 2500;
      }

      // 5. Scoring: Moving to a Safe Star Square
      // Convert step to global track index if on common track
      const destTrackIndex = (LUDO_START_CELLS[botColor] + move.toStep) % 52;
      if (move.toStep < 51 && LUDO_SAFE_CELLS.includes(destTrackIndex)) {
        score += 1800;
      }

      // Master AI: Danger detection & Evasion
      if (difficulty === 'master') {
        // A. Is current token currently in danger? (Opponent 1-6 spaces behind on unsafe cell)
        const currentlyInDanger = this.isTokenInDanger(token.trackIndex, token.step, botColor, allPlayers);
        if (currentlyInDanger && move.fromStep < 51) {
          score += 2200; // escaping danger is high priority!
        }

        // B. Will landing position be in danger?
        const landingInDanger = move.toStep < 51 && this.isTokenInDanger(destTrackIndex, move.toStep, botColor, allPlayers);
        if (landingInDanger && !LUDO_SAFE_CELLS.includes(destTrackIndex)) {
          score -= 1500; // Penalize moving into enemy strike range
        }

        // C. Prefer advancing pieces that are further along
        score += move.toStep * 15;
      } else {
        // Medium AI: Simple advancement preference
        score += move.toStep * 10;
      }

      // Add a small random jitter so bot moves are not 100% deterministic
      score += Math.random() * 50;

      if (score > bestScore) {
        bestScore = score;
        bestTokenId = move.tokenId;
      }
    }

    return bestTokenId;
  }

  /**
   * Checks if a token at global trackIndex is within 1-6 tiles of an opponent behind it.
   */
  private static isTokenInDanger(
    trackIndex: number,
    step: number,
    myColor: PlayerColor,
    allPlayers: LudoPlayerState[]
  ): boolean {
    if (step < 0 || step >= 51) return false; // in yard, runway or home is safe
    if (LUDO_SAFE_CELLS.includes(trackIndex)) return false; // safe star

    for (const player of allPlayers) {
      if (player.config.color === myColor) continue;
      for (const enemyToken of player.tokens) {
        if (enemyToken.status === 'track') {
          // Distance from enemy to my token on 52-tile ring
          const dist = (trackIndex - enemyToken.trackIndex + 52) % 52;
          if (dist >= 1 && dist <= 6) {
            return true; // Enemy is 1 to 6 steps behind us!
          }
        }
      }
    }
    return false;
  }

  /**
   * Random bot banter message for lively play
   */
  public static getBotReaction(
    event: 'roll_six' | 'captured' | 'snake' | 'ladder' | 'win' | 'taunt',
    botName: string
  ): string {
    const dialogues: Record<string, string[]> = {
      roll_six: [
        `🎲 ${botName}: "Boom! Lucky 6!"`,
        `🎲 ${botName}: "Just what I needed!"`,
        `🎲 ${botName}: "Watch me go!"`,
      ],
      captured: [
        `💥 ${botName}: "Target eliminated! Back to the yard!"`,
        `💥 ${botName}: "Nothing personal, just business!"`,
        `💥 ${botName}: "Checkmate on the board!"`,
      ],
      snake: [
        `🐍 ${botName}: "Oh no, cursed snake!"`,
        `🐍 ${botName}: "I will get my revenge!"`,
        `🐍 ${botName}: "Down the slide I go..."`,
      ],
      ladder: [
        `🪜 ${botName}: "Sky is the limit!"`,
        `🪜 ${botName}: "Climbing to the top!"`,
        `🪜 ${botName}: "Thanks for the lift!"`,
      ],
      win: [
        `👑 ${botName}: "Victory is sweet! GG everyone!"`,
        `👑 ${botName}: "Crown belongs to the bot master!"`,
      ],
      taunt: [
        `💬 ${botName}: "Your turn, human!"`,
        `💬 ${botName}: "Let's see your roll!"`,
      ],
    };

    const list = dialogues[event] || dialogues.taunt;
    return list[Math.floor(Math.random() * list.length)];
  }
}
