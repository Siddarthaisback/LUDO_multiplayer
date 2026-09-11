import React from 'react';
import { PlayerColor } from '../../types/game';
import { LudoPlayerState } from '../../types/ludo';
import { COLOR_MAP } from '../../utils/constants';
import { Dice3D } from '../../components/UI/Dice3D';

interface PlayerCornerDockProps {
  color: PlayerColor;
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  playerState?: LudoPlayerState;
  isActive: boolean;
  diceValue: number;
  isRolling: boolean;
  canRoll: boolean;
  hasRolled: boolean;
  isAnimatingMove: boolean;
  isAutomatedTurn: boolean;
  isOnline: boolean;
  isMyOnlineTurn: boolean;
  onRollPointerDown: (e: React.PointerEvent) => void;
  onRollPointerUp: (e: React.PointerEvent) => void;
  onRollPointerCancel: (e: React.PointerEvent) => void;
  onRollKeyDown: (e: React.KeyboardEvent) => void;
  onRollKeyUp: (e: React.KeyboardEvent) => void;
  onRollClick: () => void;
  onTriggerAutoCapture?: () => void;
  onCornerTap?: (corner: 'TL' | 'TR' | 'BR' | 'BL') => void;
  turnTimeRemaining?: number;
}

export function getDockDiceAriaLabel({
  isRolling,
  isInteractive,
  hasRolled,
  diceValue,
  isAutomatedTurn,
  isOnline,
  isMyOnlineTurn,
}: {
  isRolling: boolean;
  isInteractive: boolean;
  hasRolled: boolean;
  diceValue: number;
  isAutomatedTurn: boolean;
  isOnline: boolean;
  isMyOnlineTurn: boolean;
}): string {
  if (isRolling) return 'Dice rolling';
  if (isInteractive) return 'Roll dice (tap or hold)';
  if (hasRolled) return `Rolled ${diceValue}`;
  if (isAutomatedTurn) return 'Bot turn in progress';
  if (isOnline && !isMyOnlineTurn) return 'Waiting for opponent';
  return 'Dice waiting';
}

export const PlayerCornerDock: React.FC<PlayerCornerDockProps> = ({
  color,
  corner,
  playerState,
  isActive,
  diceValue,
  isRolling,
  canRoll,
  hasRolled,
  isAnimatingMove,
  isAutomatedTurn,
  isOnline,
  isMyOnlineTurn,
  onRollPointerDown,
  onRollPointerUp,
  onRollPointerCancel,
  onRollKeyDown,
  onRollKeyUp,
  onRollClick,
  onTriggerAutoCapture,
  onCornerTap,
  turnTimeRemaining,
}) => {
  const colorInfo = COLOR_MAP[color];

  // Unoccupied seat in 2-player or 3-player match
  if (!playerState) {
    return (
      <div
        data-testid={`corner-dock-${color}`}
        data-corner={corner}
        className="h-[64px] sm:h-[72px] lg:h-[76px] w-full min-w-0 rounded-2xl bg-[#1c0f07]/40 border border-[#3b1f10]/30 px-3 flex items-center justify-center text-xs text-[#7a4f32] font-semibold select-none"
      >
        <span>Empty Seat</span>
      </div>
    );
  }

  // Active Player Dock: Contains 3D Dice (Primary Roll Trigger) and Player Identity
  if (isActive) {
    const isInteractive = canRoll && !hasRolled && !isRolling && !isAutomatedTurn && (!isOnline || isMyOnlineTurn);
    const diceAriaLabel = getDockDiceAriaLabel({
      isRolling,
      isInteractive,
      hasRolled,
      diceValue,
      isAutomatedTurn,
      isOnline,
      isMyOnlineTurn,
    });

    return (
      <div
        data-testid={`corner-dock-${color}`}
        data-corner={corner}
        data-active="true"
        className="h-[64px] sm:h-[72px] lg:h-[76px] w-full min-w-0 rounded-2xl bg-[#2e190e] border-2 px-2.5 sm:px-3.5 lg:px-4 flex items-center justify-between shadow-xl select-none transition-all z-20"
        style={{
          borderColor: colorInfo.primary,
          boxShadow: `0 0 24px -2px ${colorInfo.primary}66`,
        }}
      >
        {/* Player Avatar & Identity */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 mr-1.5 sm:mr-2">
          <div className="relative shrink-0 flex items-center justify-center">
            {typeof turnTimeRemaining === 'number' && turnTimeRemaining >= 0 && (
              <svg className="absolute -inset-1.5 w-11 h-11 sm:w-13 sm:h-13 -rotate-90 pointer-events-none" viewBox="0 0 44 44">
                <circle
                  cx="22"
                  cy="22"
                  r="19"
                  fill="none"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="2.5"
                />
                <circle
                  cx="22"
                  cy="22"
                  r="19"
                  fill="none"
                  stroke={turnTimeRemaining <= 4 ? '#ef4444' : turnTimeRemaining <= 8 ? '#f59e0b' : '#10b981'}
                  strokeWidth="2.5"
                  strokeDasharray={119.4}
                  strokeDashoffset={119.4 * (1 - Math.max(0, Math.min(15, turnTimeRemaining)) / 15)}
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />
              </svg>
            )}
            <div
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-base sm:text-lg shadow-inner border border-white/30 shrink-0 relative"
              style={{ backgroundColor: colorInfo.primary }}
            >
              {playerState.config.avatar}
              {typeof turnTimeRemaining === 'number' && turnTimeRemaining <= 5 ? (
                <span className="absolute -top-1.5 -right-1.5 px-1 rounded-full bg-red-600 text-white text-[9px] font-black border border-white animate-pulse">
                  {turnTimeRemaining}s
                </span>
              ) : (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-white animate-pulse" />
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="text-xs sm:text-sm font-black text-[#f6ead7] truncate block"
              title={playerState.config.name}
            >
              {playerState.config.name}
            </div>
            {isRolling ? (
              <div className="text-[11px] sm:text-xs font-bold text-amber-300 flex items-center gap-1.5 mt-0.5">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                <span className="truncate">Rolling...</span>
              </div>
            ) : isAnimatingMove ? (
              <div className="text-[11px] sm:text-xs font-bold text-emerald-300 flex items-center gap-1.5 mt-0.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-bounce shrink-0" />
                <span className="truncate">Moving...</span>
              </div>
            ) : isOnline && !isMyOnlineTurn ? (
              <div className="text-[11px] sm:text-xs font-bold text-amber-400 flex items-center gap-1.5 mt-0.5">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <span className="truncate">Thinking...</span>
              </div>
            ) : isAutomatedTurn ? (
              <div className="text-[11px] sm:text-xs font-bold text-purple-300 flex items-center gap-1 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shrink-0" />
                <span className="truncate">Bot Turn</span>
              </div>
            ) : (
              <div className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mt-0.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse shrink-0" />
                <span>Turn</span>
              </div>
            )}
          </div>
        </div>

        {/* Shifting 3D Dice: The single primary interactive roll trigger (No separate ROLL button) */}
        <div className="shrink-0 flex items-center relative">
          {/* Strict Clockwise Dice-Corner Cheat Ritual Zones */}
          {isInteractive && (onCornerTap || onTriggerAutoCapture) && (
            <div className="absolute inset-0 z-30 pointer-events-none">
              <button
                type="button"
                data-testid={`dice-corner-${color}-TL`}
                onClick={(e) => {
                  e.stopPropagation();
                  onCornerTap?.('TL');
                }}
                aria-label="Corner TL"
                tabIndex={-1}
                className="absolute top-0 left-0 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-transparent border-0 cursor-pointer pointer-events-auto select-none"
              />
              <button
                type="button"
                data-testid={`dice-corner-${color}-TR`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onCornerTap) {
                    onCornerTap('TR');
                  } else {
                    onTriggerAutoCapture?.();
                  }
                }}
                aria-label="Corner TR"
                tabIndex={-1}
                className="absolute top-0 right-0 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-transparent border-0 cursor-pointer pointer-events-auto select-none"
              />
              {/* Backwards compatibility hook for auto-capture-trigger */}
              <button
                type="button"
                data-testid={`auto-capture-trigger-${color}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onCornerTap) {
                    onCornerTap('TR');
                  } else {
                    onTriggerAutoCapture?.();
                  }
                }}
                aria-label="Action"
                tabIndex={-1}
                className="hidden bg-transparent pointer-events-none"
              />
              <button
                type="button"
                data-testid={`dice-corner-${color}-BR`}
                onClick={(e) => {
                  e.stopPropagation();
                  onCornerTap?.('BR');
                }}
                aria-label="Corner BR"
                tabIndex={-1}
                className="absolute bottom-0 right-0 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-transparent border-0 cursor-pointer pointer-events-auto select-none"
              />
              <button
                type="button"
                data-testid={`dice-corner-${color}-BL`}
                onClick={(e) => {
                  e.stopPropagation();
                  onCornerTap?.('BL');
                }}
                aria-label="Corner BL"
                tabIndex={-1}
                className="absolute bottom-0 left-0 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-transparent border-0 cursor-pointer pointer-events-auto select-none"
              />
            </div>
          )}

          {/* Interactive 3D Die */}
          <button
            type="button"
            data-testid={`dice-button-${color}`}
            disabled={!isInteractive}
            aria-label={diceAriaLabel}
            aria-busy={isRolling}
            onPointerDown={onRollPointerDown}
            onPointerUp={onRollPointerUp}
            onPointerCancel={onRollPointerCancel}
            onKeyDown={onRollKeyDown}
            onKeyUp={onRollKeyUp}
            onClick={onRollClick}
            onContextMenu={(e) => e.preventDefault()}
            className={`relative rounded-2xl flex items-center justify-center p-0.5 transition-transform touch-none select-none focus:outline-none focus:ring-2 focus:ring-amber-400 ${
              isInteractive
                ? 'cursor-pointer hover:scale-105 active:scale-95'
                : 'cursor-default'
            }`}
            style={{
              boxShadow: isInteractive ? `0 0 14px -1px ${colorInfo.primary}88` : undefined,
            }}
            title={isInteractive ? 'Tap to roll' : undefined}
          >
            <Dice3D
              value={diceValue}
              isRolling={isRolling}
              canRoll={isInteractive}
              activeColor={color}
              onRoll={() => {}}
              size={44}
              showButton={false}
            />
          </button>
        </div>
      </div>
    );
  }

  // Inactive Player Dock: Clean overview of occupant and home count
  return (
    <div
      data-testid={`corner-dock-${color}`}
      data-corner={corner}
      data-active="false"
      className="h-[64px] sm:h-[72px] lg:h-[76px] w-full min-w-0 rounded-2xl bg-[#241309]/90 border border-[#4d2c16] px-2.5 sm:px-3.5 lg:px-4 flex items-center justify-between shadow-md select-none transition-all opacity-85 hover:opacity-100"
    >
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 mr-1.5 sm:mr-2">
        <div
          className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-base sm:text-lg shadow-inner border border-white/20 shrink-0"
          style={{ backgroundColor: `${colorInfo.primary}33` }}
        >
          {playerState.config.avatar}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-xs sm:text-sm font-bold text-[#f6ead7] truncate block"
            title={playerState.config.name}
          >
            {playerState.config.name}
          </div>
          <div className="text-xs text-[#cdb99d] flex items-center gap-1.5 font-medium mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colorInfo.primary }} />
            <span>{playerState.tokensHome}/4 Home</span>
          </div>
        </div>
      </div>
      {playerState.rank && (
        <span className="text-xs font-black text-amber-300 px-2 py-0.5 rounded-md bg-amber-950/80 border border-amber-800/60 shrink-0">
          #{playerState.rank}
        </span>
      )}
    </div>
  );
};
