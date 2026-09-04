import { PlayerColor } from '../../types/game';
import {
  LudoPlayerState,
  LudoTokenState,
  MoveOption,
  TokenStatus,
  LudoGameOptions,
  LudoMoveTransactionResult,
} from '../../types/ludo';
import {
  LUDO_START_CELLS,
  LUDO_SAFE_CELLS,
  LUDO_TRACK_COORDINATES,
  LUDO_HOME_RUNWAYS,
  LUDO_YARD_POSITIONS,
  LUDO_GOAL_COORDINATES,
} from '../../utils/constants';

export class LudoEngine {
  /**
   * Translates a player's token step (-1 to 56) into a global board [row, col] on 15x15 grid.
   */
  public static getTokenGridPosition(
    color: PlayerColor,
    tokenId: number,
    step: number
  ): [number, number] {
    // 1. In Yard (-1)
    if (step < 0) {
      return LUDO_YARD_POSITIONS[color][tokenId] || [0, 0];
    }

    // 2. Reached Home Goal (56)
    if (step >= 56) {
      return LUDO_GOAL_COORDINATES[color];
    }

    // 3. In Colored Home Runway (51 to 55)
    if (step >= 51) {
      const runwayIndex = step - 51; // 0 to 4
      return LUDO_HOME_RUNWAYS[color][runwayIndex] || [7, 7];
    }

    // 4. On Common Track (0 to 50)
    const startCell = LUDO_START_CELLS[color];
    const trackIndex = (startCell + step) % 52;
    return LUDO_TRACK_COORDINATES[trackIndex] || [7, 7];
  }

  /**
   * Returns an array of intermediate steps for path animation / preview
   */
  public static getPathSteps(fromStep: number, toStep: number): number[] {
    if (fromStep < 0) {
      return [0];
    }
    const steps: number[] = [];
    for (let s = fromStep + 1; s <= toStep; s++) {
      steps.push(s);
    }
    return steps;
  }

  /**
   * Calculates all valid moves for a player given the dice roll and game options.
   */
  public static getValidMoves(
    player: LudoPlayerState,
    roll: number,
    allPlayers: LudoPlayerState[],
    options?: LudoGameOptions
  ): MoveOption[] {
    const validMoves: MoveOption[] = [];
    const canExitYard = options?.requireSixToStart ? roll === 6 : (roll === 6 || roll === 1);

    for (const token of player.tokens) {
      // 1. Token already finished at Home
      if (token.step >= 56 || token.status === 'home') {
        continue;
      }

      // 2. Token in Yard
      if (token.step === -1 || token.status === 'yard') {
        if (canExitYard) {
          // Can exit yard to start tile (step 0)
          const startTrackIndex = LUDO_START_CELLS[player.config.color];
          const captures = this.getCapturableOpponents(startTrackIndex, player.config.color, allPlayers);
          validMoves.push({
            tokenId: token.id,
            fromStep: -1,
            toStep: 0,
            isExitYard: true,
            isHome: false,
            capturesOpponent: captures.length > 0,
            targetOpponents: captures,
          });
        }
        continue;
      }

      // 3. Token on Track or Runway
      const targetStep = token.step + roll;

      // Cannot overshoot Home (must be exact <= 56)
      if (targetStep > 56) {
        continue;
      }

      const isHome = targetStep === 56;
      let captures: { color: PlayerColor; tokenId: number }[] = [];

      // Check capture if landing on common track (targetStep <= 50)
      if (targetStep <= 50) {
        const destTrackIndex = (LUDO_START_CELLS[player.config.color] + targetStep) % 52;
        captures = this.getCapturableOpponents(destTrackIndex, player.config.color, allPlayers);
      }

      validMoves.push({
        tokenId: token.id,
        fromStep: token.step,
        toStep: targetStep,
        isExitYard: false,
        isHome,
        capturesOpponent: captures.length > 0,
        targetOpponents: captures,
      });
    }

    return validMoves;
  }

  /**
   * Checks if an enemy token can be captured at a given trackIndex.
   * (Star squares and Start squares in safe list cannot be captured).
   */
  public static getCapturableOpponents(
    trackIndex: number,
    myColor: PlayerColor,
    allPlayers: LudoPlayerState[]
  ): { color: PlayerColor; tokenId: number }[] {
    // If it's a safe star square, tokens are immune!
    if (LUDO_SAFE_CELLS.includes(trackIndex)) {
      return [];
    }

    const capturables: { color: PlayerColor; tokenId: number }[] = [];

    for (const otherPlayer of allPlayers) {
      if (otherPlayer.config.color === myColor) continue;

      for (const token of otherPlayer.tokens) {
        if (token.status === 'track' && token.trackIndex === trackIndex) {
          capturables.push({
            color: otherPlayer.config.color,
            tokenId: token.id,
          });
        }
      }
    }

    return capturables;
  }

  /**
   * Applies move to token and updates track index and status.
   */
  public static applyMoveToToken(
    token: LudoTokenState,
    toStep: number,
    color: PlayerColor
  ): LudoTokenState {
    let status: TokenStatus = 'track';
    let trackIndex = -1;

    if (toStep < 0) {
      status = 'yard';
    } else if (toStep >= 56) {
      status = 'home';
    } else if (toStep >= 51) {
      status = 'runway';
    } else {
      status = 'track';
      trackIndex = (LUDO_START_CELLS[color] + toStep) % 52;
    }

    return {
      ...token,
      step: toStep,
      status,
      trackIndex,
    };
  }

  /**
   * Executes authoritative move transaction resolution.
   */
  public static resolveMoveTransaction(
    activePlayerIndex: number,
    tokenId: number,
    roll: number,
    players: LudoPlayerState[],
    options: LudoGameOptions,
    currentRankCount: number
  ): LudoMoveTransactionResult | null {
    const activePlayer = players[activePlayerIndex];
    if (!activePlayer) return null;

    const token = activePlayer.tokens.find((t) => t.id === tokenId);
    if (!token) return null;

    const validMoves = this.getValidMoves(activePlayer, roll, players, options);
    const move = validMoves.find((m) => m.tokenId === tokenId);
    if (!move) return null;

    const updatedToken = this.applyMoveToToken(token, move.toStep, activePlayer.config.color);
    const capturedTokens = move.targetOpponents || [];
    const reachedHome = move.isHome;

    // Apply token updates and capture resets across all players
    const updatedPlayers = players.map((p, pIdx) => {
      if (pIdx === activePlayerIndex) {
        const nextTokens = p.tokens.map((t) => (t.id === tokenId ? updatedToken : t));
        const homeCount = nextTokens.filter((t) => t.status === 'home').length;
        const isFinished = homeCount === 4;
        const nextRank = isFinished && !p.rank ? currentRankCount + 1 : p.rank;

        return {
          ...p,
          tokens: nextTokens,
          tokensHome: homeCount,
          tokensCaptured: p.tokensCaptured + capturedTokens.length,
          rank: nextRank,
        };
      }

      // Check if any opponent tokens were captured
      const victimCaptures = capturedTokens.filter((c) => c.color === p.config.color);
      if (victimCaptures.length > 0) {
        const victimIds = new Set(victimCaptures.map((c) => c.tokenId));
        return {
          ...p,
          tokensLost: p.tokensLost + victimCaptures.length,
          tokens: p.tokens.map((t) =>
            victimIds.has(t.id)
              ? { ...t, step: -1, status: 'yard' as const, trackIndex: -1 }
              : t
          ),
        };
      }

      return p;
    });

    const activeUpdated = updatedPlayers[activePlayerIndex];
    const playerWonNow = activeUpdated.tokensHome === 4 && activePlayer.tokensHome < 4;

    const bonusTurn =
      (options.bonusTurnOnSix && roll === 6) ||
      (options.bonusTurnOnCapture && capturedTokens.length > 0) ||
      (options.bonusTurnOnHome && reachedHome);

    return {
      updatedPlayers,
      bonusTurn,
      capturedTokens,
      reachedHome,
      playerWonNow,
      newRank: playerWonNow ? currentRankCount + 1 : undefined,
    };
  }
}

