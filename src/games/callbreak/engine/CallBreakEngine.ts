import { Card, Suit, CardId } from '../../../core/cards/Card';
import { Deck } from '../../../core/cards/Deck';
import { CallBreakRuleConfig, NEPAL_CLASSIC_CALLBREAK_RULES } from './CallBreakRules';
import { PlayerConfig } from '../../../types/game';

export interface TrickCard {
  readonly playerIndex: number;
  readonly card: Card;
}

export interface CallBreakPlayerState {
  readonly config: PlayerConfig;
  readonly hand: Card[];
  readonly bid: number;
  readonly tricksWon: number;
  readonly roundScores: number[];
  readonly totalScore: number;
}

export interface CallBreakState {
  readonly rules: CallBreakRuleConfig;
  readonly players: CallBreakPlayerState[];
  readonly currentRound: number; // 1..5
  readonly dealerIndex: number;
  readonly leaderIndex: number;
  readonly turnIndex: number;
  readonly phase: 'bidding' | 'playing' | 'round_end' | 'game_over';
  readonly currentTrick: TrickCard[];
  readonly completedTricks: TrickCard[][];
}

export class CallBreakEngine {
  /**
   * Initializes a fresh 4-player Call Break match
   */
    /**
   * Sorts a hand by suit (Spades, Hearts, Clubs, Diamonds) and descending rank (Ace down to 2)
   */
  public static sortHand(hand: Card[]): Card[] {
    const suitOrder: Record<Suit, number> = { S: 0, H: 1, C: 2, D: 3 };
    return [...hand].sort((a, b) => {
      if (a.suit !== b.suit) {
        return suitOrder[a.suit] - suitOrder[b.suit];
      }
      return b.rank - a.rank;
    });
  }

public static createMatch(
    players: PlayerConfig[],
    rules: CallBreakRuleConfig = NEPAL_CLASSIC_CALLBREAK_RULES,
    seed?: number
  ): CallBreakState {
    if (players.length !== 4) {
      throw new Error('Call Break requires exactly 4 players');
    }

    const deck = new Deck().shuffle(seed);
    const hands = deck.deal(4, 13);

    // Initial dealer is index 0, first leader/bidder is index 1 (next to dealer)
    const initialPlayers: CallBreakPlayerState[] = players.map((p, idx) => ({
      config: p,
      hand: CallBreakEngine.sortHand(hands[idx]),
      bid: 0,
      tricksWon: 0,
      roundScores: [],
      totalScore: 0,
    }));

    return {
      rules,
      players: initialPlayers,
      currentRound: 1,
      dealerIndex: 0,
      leaderIndex: 1,
      turnIndex: 1,
      phase: 'bidding',
      currentTrick: [],
      completedTricks: [],
    };
  }

  /**
   * Evaluates the legal cards a player can play for the current trick under Nepali strict rules
   */
  public static getLegalCards(
    hand: Card[],
    currentTrick: TrickCard[],
    rules: CallBreakRuleConfig = NEPAL_CLASSIC_CALLBREAK_RULES
  ): Card[] {
    if (hand.length === 0) return [];
    if (currentTrick.length === 0) {
      // Leader can play ANY card from their hand
      return [...hand];
    }

    const leadCard = currentTrick[0].card;
    const leadSuit = leadCard.suit;

    // Find cards of the lead suit in hand
    const sameSuitCards = hand.filter((c) => c.suit === leadSuit);

    // Determine current winning card in the trick so far
    const currentWinningCard = CallBreakEngine.determineCurrentWinnerCard(currentTrick);

    if (sameSuitCards.length > 0) {
      // Rule 1: MUST follow lead suit
      if (rules.forceHigherCard) {
        // If current winning card is also in lead suit, must try to beat it
        if (currentWinningCard.suit === leadSuit) {
          const higherCards = sameSuitCards.filter((c) => c.rank > currentWinningCard.rank);
          if (higherCards.length > 0) {
            return higherCards;
          }
        }
      }
      return sameSuitCards;
    }

    // Player is VOID in lead suit
    const spades = hand.filter((c) => c.suit === 'S');

    if (rules.forceTrump && spades.length > 0) {
      // Rule 2: MUST play a Spade trump if available
      if (rules.forceOverTrump && currentWinningCard.suit === 'S') {
        // If a spade was already played, must try to beat it if possible
        const higherSpades = spades.filter((c) => c.rank > currentWinningCard.rank);
        if (higherSpades.length > 0) {
          return higherSpades;
        }
      }
      return spades;
    }

    // Rule 3: No lead suit and no Spades (or trump not forced) -> can discard any card
    return [...hand];
  }

  /**
   * Determines the card currently winning the trick so far
   */
  public static determineCurrentWinnerCard(trick: TrickCard[]): Card {
    let winningCard = trick[0].card;

    for (let i = 1; i < trick.length; i++) {
      const candidate = trick[i].card;
      if (candidate.suit === 'S' && winningCard.suit !== 'S') {
        winningCard = candidate;
      } else if (candidate.suit === winningCard.suit && candidate.rank > winningCard.rank) {
        winningCard = candidate;
      }
    }

    return winningCard;
  }

  /**
   * Determines the winning player index for a completed trick of 4 cards
   */
  public static determineTrickWinner(trick: TrickCard[]): number {
    if (trick.length === 0) throw new Error('Cannot determine winner of empty trick');

    let winningPlay = trick[0];

    for (let i = 1; i < trick.length; i++) {
      const candidate = trick[i];
      if (candidate.card.suit === 'S' && winningPlay.card.suit !== 'S') {
        winningPlay = candidate;
      } else if (candidate.card.suit === winningPlay.card.suit && candidate.card.rank > winningPlay.card.rank) {
        winningPlay = candidate;
      }
    }

    return winningPlay.playerIndex;
  }

  /**
   * Pure calculation of score for a round according to Nepali rules
   */
  public static calculateRoundScore(bid: number, tricksWon: number, multiplier: number = 0.1): number {
    if (tricksWon >= bid) {
      const overtricks = tricksWon - bid;
      return Math.round((bid + overtricks * multiplier) * 10) / 10;
    }
    return -bid;
  }

  /**
   * Applies a bid action from the current player
   */
  public static applyBid(state: CallBreakState, playerIndex: number, bid: number): CallBreakState {
    if (state.phase !== 'bidding') {
      throw new Error('Not in bidding phase');
    }
    if (state.turnIndex !== playerIndex) {
      throw new Error(`Not player ${playerIndex}'s turn to bid`);
    }
    if (bid < state.rules.minimumBid || bid > 13) {
      throw new Error(`Invalid bid ${bid}. Must be between ${state.rules.minimumBid} and 13`);
    }

    const updatedPlayers = state.players.map((p, idx) =>
      idx === playerIndex ? { ...p, bid } : p
    );

    const nextTurn = (playerIndex + 1) % 4;
    const allBidsComplete = updatedPlayers.every((p) => p.bid > 0);

    return {
      ...state,
      players: updatedPlayers,
      turnIndex: allBidsComplete ? state.leaderIndex : nextTurn,
      phase: allBidsComplete ? 'playing' : 'bidding',
    };
  }

  /**
   * Applies a card play from the current player
   */
  public static applyPlayCard(state: CallBreakState, playerIndex: number, cardId: CardId): CallBreakState {
    if (state.phase !== 'playing') {
      throw new Error('Not in playing phase');
    }
    if (state.turnIndex !== playerIndex) {
      throw new Error(`Not player ${playerIndex}'s turn to play`);
    }

    const player = state.players[playerIndex];
    const card = player.hand.find((c) => c.id === cardId);
    if (!card) {
      throw new Error(`Player ${playerIndex} does not have card ${cardId}`);
    }

    const legalCards = CallBreakEngine.getLegalCards(player.hand, state.currentTrick, state.rules);
    if (!legalCards.some((c) => c.id === cardId)) {
      throw new Error(`Card ${cardId} is not a legal play under Nepali Call Break rules`);
    }

    // Remove card from hand
    const updatedHand = player.hand.filter((c) => c.id !== cardId);
    const updatedTrick: TrickCard[] = [...state.currentTrick, { playerIndex, card }];

    const updatedPlayers = state.players.map((p, idx) =>
      idx === playerIndex ? { ...p, hand: updatedHand } : p
    );

    if (updatedTrick.length < 4) {
      // Next player in trick
      return {
        ...state,
        players: updatedPlayers,
        currentTrick: updatedTrick,
        turnIndex: (playerIndex + 1) % 4,
      };
    }

    // Trick is complete (4 cards)
    const trickWinner = CallBreakEngine.determineTrickWinner(updatedTrick);
    const scoredPlayers = updatedPlayers.map((p, idx) =>
      idx === trickWinner ? { ...p, tricksWon: p.tricksWon + 1 } : p
    );

    const isRoundComplete = scoredPlayers[0].hand.length === 0;

    if (!isRoundComplete) {
      // Trick winner leads the next trick
      return {
        ...state,
        players: scoredPlayers,
        currentTrick: [],
        completedTricks: [...state.completedTricks, updatedTrick],
        leaderIndex: trickWinner,
        turnIndex: trickWinner,
      };
    }

    // Round is complete (all 13 tricks played)
    const roundScoredPlayers = scoredPlayers.map((p) => {
      const rScore = CallBreakEngine.calculateRoundScore(p.bid, p.tricksWon, state.rules.overtrickMultiplier);
      const newRoundScores = [...p.roundScores, rScore];
      const newTotalScore = Math.round(newRoundScores.reduce((a, b) => a + b, 0) * 10) / 10;
      return {
        ...p,
        roundScores: newRoundScores,
        totalScore: newTotalScore,
      };
    });

    const isGameOver = state.currentRound >= state.rules.roundCount;

    return {
      ...state,
      players: roundScoredPlayers,
      currentTrick: [],
      completedTricks: [...state.completedTricks, updatedTrick],
      phase: isGameOver ? 'game_over' : 'round_end',
    };
  }

  /**
   * Starts the next round in a match
   */
  public static nextRound(state: CallBreakState, seed?: number): CallBreakState {
    if (state.phase !== 'round_end') {
      throw new Error('Can only advance round when current round has ended');
    }

    const nextRoundNum = state.currentRound + 1;
    const nextDealer = (state.dealerIndex + 1) % 4;
    const nextLeader = (nextDealer + 1) % 4;

    const deck = new Deck().shuffle(seed);
    const hands = deck.deal(4, 13);

    const resetPlayers = state.players.map((p, idx) => ({
      ...p,
      hand: CallBreakEngine.sortHand(hands[idx]),
      bid: 0,
      tricksWon: 0,
    }));

    return {
      ...state,
      currentRound: nextRoundNum,
      dealerIndex: nextDealer,
      leaderIndex: nextLeader,
      turnIndex: nextLeader,
      phase: 'bidding',
      players: resetPlayers,
      currentTrick: [],
      completedTricks: [],
    };
  }
}
