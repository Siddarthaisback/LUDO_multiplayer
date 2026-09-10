/**
 * Strict Clockwise Dice-Corner Cheat Ritual State Machine
 *
 * Requirements:
 * 1. Eligible only after at least 4 turns have elapsed in the match (turnCount >= 4).
 * 2. User taps the 4 corners of the active player's dice in strict clockwise order:
 *    Top-Left (TL) -> Top-Right (TR) -> Bottom-Right (BR) -> Bottom-Left (BL).
 * 3. Strict state machine: if any step is broken (e.g. TL -> TR -> TL, or wrong corner),
 *    the sequence immediately resets to step 0.
 * 4. Once completed, the next roll is armed for the cheat (smart auto-capture / forced 6).
 * 5. Consumed atomically on the next roll; standard center taps or holds remain 100% fair RNG.
 */

import { LudoPlayerState, LudoGameOptions } from '../../types/ludo';
import { calculateSmartAutoCaptureRoll } from './LudoEngine';

export type DiceCorner = 'TL' | 'TR' | 'BR' | 'BL';

export const REQUIRED_TURNS_FOR_CHEAT = 4;

export const CLOCKWISE_CORNER_SEQUENCE: readonly DiceCorner[] = ['TL', 'TR', 'BR', 'BL'] as const;

export interface DiceCornerRitualState {
  step: number; // 0: expecting TL, 1: expecting TR, 2: expecting BR, 3: expecting BL
  cheatArmed: boolean;
}

export const INITIAL_RITUAL_STATE: DiceCornerRitualState = {
  step: 0,
  cheatArmed: false,
};

export interface CornerTapResult {
  nextState: DiceCornerRitualState;
  justArmed: boolean;
  wasReset: boolean;
}

/**
 * Handles a tap on one of the 4 dice corners.
 */
export function handleDiceCornerTap(
  corner: DiceCorner,
  currentState: DiceCornerRitualState,
  turnCount: number,
  isEligible: boolean = true
): CornerTapResult {
  // If not eligible (e.g. not active, bot turn, online opponent turn) or fewer than 4 turns elapsed:
  if (!isEligible || turnCount < REQUIRED_TURNS_FOR_CHEAT) {
    return {
      nextState: { step: 0, cheatArmed: false },
      justArmed: false,
      wasReset: currentState.step > 0 || currentState.cheatArmed,
    };
  }

  // If already armed, any further corner tap resets
  if (currentState.cheatArmed) {
    return {
      nextState: { step: 0, cheatArmed: false },
      justArmed: false,
      wasReset: true,
    };
  }

  const expectedCorner = CLOCKWISE_CORNER_SEQUENCE[currentState.step];

  if (corner === expectedCorner) {
    if (currentState.step === 3) {
      // Completed BL! Armed for the next roll.
      return {
        nextState: { step: 0, cheatArmed: true },
        justArmed: true,
        wasReset: false,
      };
    }

    // Advanced one step clockwise (TL -> TR -> BR -> BL)
    return {
      nextState: { step: currentState.step + 1, cheatArmed: false },
      justArmed: false,
      wasReset: false,
    };
  }

  // Broken ritual! Reset immediately to step 0.
  return {
    nextState: { step: 0, cheatArmed: false },
    justArmed: false,
    wasReset: true,
  };
}

/**
 * Handles rolling the dice. Returns whether the roll was armed,
 * and resets the armed state atomically.
 */
export function consumeArmedCheatOnRoll(
  currentState: DiceCornerRitualState
): { wasArmed: boolean; nextState: DiceCornerRitualState } {
  return {
    wasArmed: currentState.cheatArmed,
    nextState: { step: 0, cheatArmed: false },
  };
}

/**
 * Resets the ritual state completely (on turn handover, restart, etc.).
 */
export function resetDiceCornerRitual(): DiceCornerRitualState {
  return { step: 0, cheatArmed: false };
}

/**
 * Pure function to resolve roll outcome based on cheat armed status and game state.
 */
export function resolveRollOutcome(
  isArmed: boolean,
  activePlayer?: LudoPlayerState,
  players?: LudoPlayerState[],
  options?: LudoGameOptions
): { roll: number; isSmartAutoCapture: boolean } {
  if (isArmed && activePlayer && players && options) {
    const smartRoll = calculateSmartAutoCaptureRoll(activePlayer, players, options);
    return { roll: smartRoll, isSmartAutoCapture: true };
  }
  if (isArmed) {
    return { roll: 6, isSmartAutoCapture: true };
  }
  return { roll: Math.floor(Math.random() * 6) + 1, isSmartAutoCapture: false };
}
