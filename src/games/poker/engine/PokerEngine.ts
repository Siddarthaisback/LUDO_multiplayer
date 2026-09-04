import { Card } from '../../../core/cards/Card';
import { Deck } from '../../../core/cards/Deck';
import { PokerRuleConfig, NO_LIMIT_HOLDEM_RULES } from './PokerRules';
import { PokerEvaluator, PokerEvaluation } from './PokerEvaluator';
import { PokerSidePots, PotContribution, ResolvedPot } from './PokerSidePots';
import { PlayerConfig } from '../../../types/game';

export type PokerStreet = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'hand_over';

export interface PokerPlayerState {
  readonly config: PlayerConfig;
  readonly hand: Card[];
  readonly chips: number;
  readonly currentStreetBet: number;
  readonly totalHandContribution: number;
  readonly isFolded: boolean;
  readonly isAllIn: boolean;
  readonly hasActed: boolean;
  readonly evaluation?: PokerEvaluation;
}

export interface PokerState {
  readonly rules: PokerRuleConfig;
  readonly players: PokerPlayerState[];
  readonly communityCards: Card[];
  readonly deck: Card[];
  readonly pot: number;
  readonly currentHighBet: number;
  readonly minRaise: number;
  readonly dealerIndex: number;
  readonly smallBlindIndex: number;
  readonly bigBlindIndex: number;
  readonly turnIndex: number;
  readonly street: PokerStreet;
  readonly resolvedPots?: ResolvedPot[];
  readonly winningMessage?: string;
}

export class PokerEngine {
  /**
   * Initializes a fresh Texas Hold'em hand with blind posting
   */
  public static createHand(
    players: PlayerConfig[],
    rules: PokerRuleConfig = NO_LIMIT_HOLDEM_RULES,
    chipStacks?: number[],
    dealerIndex: number = 0,
    seed?: number
  ): PokerState {
    const numPlayers = players.length;
    const deck = new Deck().shuffle(seed);
    const hands = deck.deal(numPlayers, 2);

    const sbIndex = numPlayers === 2 ? dealerIndex : (dealerIndex + 1) % numPlayers;
    const bbIndex = numPlayers === 2 ? (dealerIndex + 1) % numPlayers : (dealerIndex + 2) % numPlayers;
    const firstToAct = numPlayers === 2 ? dealerIndex : (bbIndex + 1) % numPlayers;

    let pot = 0;
    const initialPlayers: PokerPlayerState[] = players.map((p, idx) => {
      const startingStack = chipStacks ? chipStacks[idx] : rules.startingChips;
      let streetBet = 0;
      let isAllIn = false;

      if (idx === sbIndex) {
        streetBet = Math.min(startingStack, rules.smallBlind);
        isAllIn = streetBet === startingStack;
      } else if (idx === bbIndex) {
        streetBet = Math.min(startingStack, rules.bigBlind);
        isAllIn = streetBet === startingStack;
      }

      pot += streetBet;

      return {
        config: p,
        hand: hands[idx],
        chips: startingStack - streetBet,
        currentStreetBet: streetBet,
        totalHandContribution: streetBet,
        isFolded: false,
        isAllIn,
        hasActed: false,
      };
    });

    return {
      rules,
      players: initialPlayers,
      communityCards: [],
      deck: deck.getCards(),
      pot,
      currentHighBet: rules.bigBlind,
      minRaise: rules.minRaise,
      dealerIndex,
      smallBlindIndex: sbIndex,
      bigBlindIndex: bbIndex,
      turnIndex: firstToAct,
      street: 'preflop',
    };
  }

  /**
   * Handles player FOLD
   */
  public static applyFold(state: PokerState, playerIndex: number): PokerState {
    if (state.street === 'hand_over' || state.street === 'showdown') {
      throw new Error('Cannot fold after hand has concluded');
    }
    if (state.turnIndex !== playerIndex) {
      throw new Error(`Not player ${playerIndex}'s turn`);
    }
    const player = state.players[playerIndex];
    if (player.isFolded) throw new Error('Player is already folded');
    if (player.isAllIn) throw new Error('All-in player cannot fold');

    const updatedPlayers = state.players.map((p, idx) =>
      idx === playerIndex ? { ...p, isFolded: true, hasActed: true } : p
    );

    const activePlayers = updatedPlayers.filter((p) => !p.isFolded);
    if (activePlayers.length === 1) {
      // Last standing player wins everything
      const winner = activePlayers[0];
      const winnerIdx = updatedPlayers.findIndex((p) => p.config.id === winner.config.id);

      const settledPlayers = updatedPlayers.map((p, idx) =>
        idx === winnerIdx ? { ...p, chips: p.chips + state.pot } : p
      );

      return {
        ...state,
        players: settledPlayers,
        street: 'hand_over',
        winningMessage: `🏆 ${winner.config.name} WON $${state.pot} (All opponents folded)!`,
      };
    }

    return PokerEngine.advanceOrNextTurn(state, updatedPlayers, playerIndex);
  }

  /**
   * Handles player CHECK or CALL
   */
  public static applyCallOrCheck(state: PokerState, playerIndex: number): PokerState {
    if (state.street === 'hand_over' || state.street === 'showdown') {
      throw new Error('Cannot call/check after hand has concluded');
    }
    if (state.turnIndex !== playerIndex) {
      throw new Error(`Not player ${playerIndex}'s turn`);
    }
    const player = state.players[playerIndex];
    if (player.isFolded || player.isAllIn) {
      throw new Error('Folded or all-in player cannot call/check');
    }

    const callAmount = Math.min(player.chips, state.currentHighBet - player.currentStreetBet);
    const isAllIn = player.chips === callAmount;

    const updatedPlayers = state.players.map((p, idx) =>
      idx === playerIndex
        ? {
            ...p,
            chips: p.chips - callAmount,
            currentStreetBet: p.currentStreetBet + callAmount,
            totalHandContribution: p.totalHandContribution + callAmount,
            isAllIn,
            hasActed: true,
          }
        : p
    );

    return PokerEngine.advanceOrNextTurn(
      { ...state, pot: state.pot + callAmount },
      updatedPlayers,
      playerIndex
    );
  }

  /**
   * Handles player BET or RAISE
   */
  public static applyBetOrRaise(state: PokerState, playerIndex: number, totalStreetBet: number): PokerState {
    if (state.street === 'hand_over' || state.street === 'showdown') {
      throw new Error('Cannot bet/raise after hand has concluded');
    }
    if (state.turnIndex !== playerIndex) {
      throw new Error(`Not player ${playerIndex}'s turn`);
    }
    const player = state.players[playerIndex];
    if (player.isFolded || player.isAllIn) {
      throw new Error('Folded or all-in player cannot bet/raise');
    }

    const additionalChips = totalStreetBet - player.currentStreetBet;
    if (additionalChips <= 0) {
      throw new Error('Bet or raise must be greater than current street bet');
    }

    const actualAdditional = Math.min(player.chips, additionalChips);
    const newStreetBet = player.currentStreetBet + actualAdditional;
    const isAllIn = player.chips === actualAdditional;

    // Validate minimum raise size unless going all-in
    if (!isAllIn && newStreetBet < state.currentHighBet + state.minRaise) {
      throw new Error(
        `Raise must be at least ${state.currentHighBet + state.minRaise} chips unless all-in`
      );
    }

    // Reset hasActed for all other active non-allin players facing the new raise
    const updatedPlayers = state.players.map((p, idx) => {
      if (idx === playerIndex) {
        return {
          ...p,
          chips: p.chips - actualAdditional,
          currentStreetBet: newStreetBet,
          totalHandContribution: p.totalHandContribution + actualAdditional,
          isAllIn,
          hasActed: true,
        };
      }
      return p.isFolded || p.isAllIn ? p : { ...p, hasActed: false };
    });

    const raiseDiff = newStreetBet - state.currentHighBet;
    const newMinRaise = Math.max(state.rules.minRaise, raiseDiff);

    return PokerEngine.advanceOrNextTurn(
      {
        ...state,
        pot: state.pot + actualAdditional,
        currentHighBet: newStreetBet,
        minRaise: newMinRaise,
      },
      updatedPlayers,
      playerIndex
    );
  }

  private static advanceOrNextTurn(
    state: PokerState,
    players: PokerPlayerState[],
    lastActedIndex: number
  ): PokerState {
    const activeNonAllIn = players.filter((p) => !p.isFolded && !p.isAllIn);
    const unactedUnmatched = activeNonAllIn.filter(
      (p) => !p.hasActed || p.currentStreetBet < state.currentHighBet
    );

    if (unactedUnmatched.length === 0) {
      // Current street is fully settled
      return PokerEngine.advanceStreet(state, players);
    }

    // Next player turn on current street
    let nextTurn = (lastActedIndex + 1) % players.length;
    while (players[nextTurn].isFolded || players[nextTurn].isAllIn) {
      nextTurn = (nextTurn + 1) % players.length;
    }

    return {
      ...state,
      players,
      turnIndex: nextTurn,
    };
  }

  private static advanceStreet(state: PokerState, players: PokerPlayerState[]): PokerState {
    // Reset street bets and hasActed flags
    const resetPlayers = players.map((p) => ({
      ...p,
      currentStreetBet: 0,
      hasActed: false,
    }));

    let deck = [...state.deck];
    let community = [...state.communityCards];

    const activeNonAllIn = resetPlayers.filter((p) => !p.isFolded && !p.isAllIn);

    // If 1 or 0 players can act (all others all-in/folded), run out the board directly to showdown!
    if (activeNonAllIn.length <= 1) {
      while (community.length < 5 && deck.length > 0) {
        community.push(deck.shift()!);
      }
      return PokerEngine.resolveShowdown(state, resetPlayers, community);
    }

    if (state.street === 'preflop') {
      // Deal Flop (3 cards)
      community.push(...deck.splice(0, 3));
      return {
        ...state,
        players: resetPlayers,
        communityCards: community,
        deck,
        currentHighBet: 0,
        street: 'flop',
        turnIndex: PokerEngine.findFirstToAct(resetPlayers, state.dealerIndex),
      };
    } else if (state.street === 'flop') {
      // Deal Turn (1 card)
      community.push(...deck.splice(0, 1));
      return {
        ...state,
        players: resetPlayers,
        communityCards: community,
        deck,
        currentHighBet: 0,
        street: 'turn',
        turnIndex: PokerEngine.findFirstToAct(resetPlayers, state.dealerIndex),
      };
    } else if (state.street === 'turn') {
      // Deal River (1 card)
      community.push(...deck.splice(0, 1));
      return {
        ...state,
        players: resetPlayers,
        communityCards: community,
        deck,
        currentHighBet: 0,
        street: 'river',
        turnIndex: PokerEngine.findFirstToAct(resetPlayers, state.dealerIndex),
      };
    } else {
      // Showdown & Side Pot Resolution
      return PokerEngine.resolveShowdown(state, resetPlayers, community);
    }
  }

  private static resolveShowdown(
    state: PokerState,
    players: PokerPlayerState[],
    community: Card[]
  ): PokerState {
    const contributions: PotContribution[] = players.map((p, idx) => ({
      playerIndex: idx,
      amount: p.totalHandContribution,
      isFolded: p.isFolded,
    }));

    const hands = players.map((p) => p.hand);
    const resolvedPots = PokerSidePots.resolveAllPots(contributions, hands, community);

    // Distribute payouts
    const updatedPlayers = players.map((p, idx) => {
      let payout = 0;
      resolvedPots.forEach((rp) => {
        const winnerEntry = rp.winners.find((w) => w.playerIndex === idx);
        if (winnerEntry) {
          payout += winnerEntry.payout;
        }
      });
      const evalResult = !p.isFolded ? PokerEvaluator.evaluate7CardHand([...p.hand, ...community]) : undefined;
      return {
        ...p,
        chips: p.chips + payout,
        evaluation: evalResult,
      };
    });

    const mainWinners = resolvedPots[0]?.winners
      .map((w) => `${players[w.playerIndex].config.name} (${w.evaluation.name})`)
      .join(', ');

    return {
      ...state,
      players: updatedPlayers,
      communityCards: community,
      street: 'hand_over',
      resolvedPots,
      winningMessage: `🏆 Showdown: ${mainWinners} won the pot!`,
    };
  }

  private static findFirstToAct(players: PokerPlayerState[], dealerIndex: number): number {
    let idx = (dealerIndex + 1) % players.length;
    while (players[idx].isFolded || players[idx].isAllIn) {
      idx = (idx + 1) % players.length;
    }
    return idx;
  }
}
