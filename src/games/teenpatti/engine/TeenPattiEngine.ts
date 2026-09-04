import { Card } from '../../../core/cards/Card';
import { Deck } from '../../../core/cards/Deck';
import { TeenPattiRuleConfig, CLASSIC_TEEN_PATTI_RULES } from './TeenPattiRules';
import { TeenPattiEvaluator, TeenPattiEvaluation } from './TeenPattiEvaluator';
import { PlayerConfig } from '../../../types/game';

export interface TeenPattiPlayerState {
  readonly config: PlayerConfig;
  readonly hand: Card[];
  readonly chips: number;
  readonly isBlind: boolean;
  readonly isPacked: boolean;
  readonly totalContributed: number;
  readonly evaluation?: TeenPattiEvaluation;
}

export interface TeenPattiState {
  readonly rules: TeenPattiRuleConfig;
  readonly players: TeenPattiPlayerState[];
  readonly pot: number;
  readonly currentStake: number; // base stake for blind play (seen play = 2 * currentStake)
  readonly turnIndex: number;
  readonly dealerIndex: number;
  readonly phase: 'betting' | 'showdown' | 'hand_over';
  readonly winnerIndex?: number | null;
  readonly winningMessage?: string;
}

export class TeenPattiEngine {
  /**
   * Initializes a fresh Teen Patti hand with Boot collection
   */
  public static createMatch(
    players: PlayerConfig[],
    rules: TeenPattiRuleConfig = CLASSIC_TEEN_PATTI_RULES,
    startingChips: number = 1000,
    seed?: number
  ): TeenPattiState {
    const deck = new Deck().shuffle(seed);
    const hands = deck.deal(players.length, 3); // 3 cards each

    let pot = 0;
    const initialPlayers: TeenPattiPlayerState[] = players.map((p, idx) => {
      const boot = rules.bootAmount;
      pot += boot;
      return {
        config: p,
        hand: hands[idx],
        chips: startingChips - boot,
        isBlind: true, // starts blind by default
        isPacked: false,
        totalContributed: boot,
      };
    });

    return {
      rules,
      players: initialPlayers,
      pot,
      currentStake: rules.bootAmount,
      turnIndex: 0,
      dealerIndex: 0,
      phase: 'betting',
    };
  }

  /**
   * Calculates the exact chip cost for the player's next Chaal
   */
  public static getChaalAmount(state: TeenPattiState, playerIndex: number): number {
    const player = state.players[playerIndex];
    return player.isBlind ? state.currentStake : state.currentStake * 2;
  }

  /**
   * Flips cards so player becomes 'Seen'
   */
  public static seeCards(state: TeenPattiState, playerIndex: number): TeenPattiState {
    if (state.phase !== 'betting') throw new Error('Cannot see cards outside betting phase');
    if (state.players[playerIndex].isPacked) throw new Error('Packed player cannot see cards');

    const updatedPlayers = state.players.map((p, idx) =>
      idx === playerIndex ? { ...p, isBlind: false } : p
    );
    return { ...state, players: updatedPlayers };
  }

  /**
   * Applies Chaal (standard call at current stake)
   */
  public static applyChaal(state: TeenPattiState, playerIndex: number): TeenPattiState {
    if (state.phase !== 'betting') throw new Error('Not in betting phase');
    if (state.turnIndex !== playerIndex) throw new Error(`Not player ${playerIndex}'s turn`);
    if (state.players[playerIndex].isPacked) throw new Error('Packed player cannot play');

    const player = state.players[playerIndex];
    const amount = TeenPattiEngine.getChaalAmount(state, playerIndex);
    const actualBet = Math.min(player.chips, amount);

    const updatedPlayers = state.players.map((p, idx) =>
      idx === playerIndex
        ? {
            ...p,
            chips: p.chips - actualBet,
            totalContributed: p.totalContributed + actualBet,
          }
        : p
    );

    const nextTurn = TeenPattiEngine.getNextActivePlayerIndex(updatedPlayers, playerIndex);

    return {
      ...state,
      players: updatedPlayers,
      pot: state.pot + actualBet,
      turnIndex: nextTurn,
    };
  }

  /**
   * Applies Raise (doubles the current stake)
   */
  public static applyRaise(state: TeenPattiState, playerIndex: number): TeenPattiState {
    if (state.phase !== 'betting') throw new Error('Not in betting phase');
    if (state.turnIndex !== playerIndex) throw new Error(`Not player ${playerIndex}'s turn`);
    if (state.players[playerIndex].isPacked) throw new Error('Packed player cannot raise');

    const newStake = Math.min(state.rules.maxStake, state.currentStake * 2);
    const player = state.players[playerIndex];
    const amount = player.isBlind ? newStake : newStake * 2;
    const actualBet = Math.min(player.chips, amount);

    const updatedPlayers = state.players.map((p, idx) =>
      idx === playerIndex
        ? {
            ...p,
            chips: p.chips - actualBet,
            totalContributed: p.totalContributed + actualBet,
          }
        : p
    );

    const nextTurn = TeenPattiEngine.getNextActivePlayerIndex(updatedPlayers, playerIndex);

    return {
      ...state,
      players: updatedPlayers,
      currentStake: newStake,
      pot: state.pot + actualBet,
      turnIndex: nextTurn,
    };
  }

  /**
   * Applies Pack / Fold
   */
  public static applyPack(state: TeenPattiState, playerIndex: number): TeenPattiState {
    if (state.phase !== 'betting') throw new Error('Not in betting phase');
    if (state.turnIndex !== playerIndex) throw new Error(`Not player ${playerIndex}'s turn to pack`);
    if (state.players[playerIndex].isPacked) throw new Error('Player is already packed');

    const updatedPlayers = state.players.map((p, idx) =>
      idx === playerIndex ? { ...p, isPacked: true } : p
    );

    const activePlayers = updatedPlayers.filter((p) => !p.isPacked);

    // If only 1 player remains, they instantly win the pot!
    if (activePlayers.length === 1) {
      const winner = activePlayers[0];
      const winnerIdx = updatedPlayers.findIndex((p) => p.config.id === winner.config.id);

      const settledPlayers = updatedPlayers.map((p, idx) =>
        idx === winnerIdx ? { ...p, chips: p.chips + state.pot } : p
      );

      return {
        ...state,
        players: settledPlayers,
        phase: 'hand_over',
        winnerIndex: winnerIdx,
        winningMessage: `🏆 ${winner.config.name} WON $${state.pot} (All opponents packed)!`,
      };
    }

    const nextTurn = TeenPattiEngine.getNextActivePlayerIndex(updatedPlayers, playerIndex);

    return {
      ...state,
      players: updatedPlayers,
      turnIndex: nextTurn,
    };
  }

  /**
   * Calls Showdown when 2 players remain
   */
  public static applyShow(state: TeenPattiState, playerIndex: number): TeenPattiState {
    if (state.phase !== 'betting') throw new Error('Cannot call Show outside betting phase');
    if (state.turnIndex !== playerIndex) throw new Error(`Not player ${playerIndex}'s turn to call Show`);
    if (state.players[playerIndex].isPacked) throw new Error('Packed player cannot call Show');

    const activePlayers = state.players.filter((p) => !p.isPacked);
    if (activePlayers.length !== 2) {
      throw new Error('Show can only be called when exactly 2 players remain');
    }

    const chaalCost = TeenPattiEngine.getChaalAmount(state, playerIndex);
    const caller = state.players[playerIndex];
    const actualCost = Math.min(caller.chips, chaalCost);
    const updatedPot = state.pot + actualCost;

    // Evaluate active players
    const [pA, pB] = activePlayers;
    const idxA = state.players.findIndex((p) => p.config.id === pA.config.id);
    const idxB = state.players.findIndex((p) => p.config.id === pB.config.id);

    const cmp = TeenPattiEvaluator.compareHands(pA.hand, pB.hand, state.rules);
    const winnerIdx = cmp >= 0 ? idxA : idxB;
    const winner = state.players[winnerIdx];
    const winningEval = TeenPattiEvaluator.evaluateHand(winner.hand, state.rules);

    const settledPlayers = state.players.map((p, idx) => {
      const evalResult = TeenPattiEvaluator.evaluateHand(p.hand, state.rules);
      if (idx === playerIndex) {
        const remainingChips = p.chips - actualCost;
        return {
          ...p,
          chips: idx === winnerIdx ? remainingChips + updatedPot : remainingChips,
          evaluation: evalResult,
        };
      }
      return {
        ...p,
        chips: idx === winnerIdx ? p.chips + updatedPot : p.chips,
        evaluation: evalResult,
      };
    });

    return {
      ...state,
      players: settledPlayers,
      pot: updatedPot,
      phase: 'hand_over',
      winnerIndex: winnerIdx,
      winningMessage: `🏆 ${winner.config.name} WON $${updatedPot} with ${winningEval.name}!`,
    };
  }

  private static getNextActivePlayerIndex(players: TeenPattiPlayerState[], current: number): number {
    let next = (current + 1) % players.length;
    while (players[next].isPacked) {
      next = (next + 1) % players.length;
    }
    return next;
  }
}
