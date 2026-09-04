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
  isAnimatingMove: _isAnimatingMove,
  isAutomatedTurn,
  isOnline,
  isMyOnlineTurn,
  onRollPointerDown,
  onRollPointerUp,
  onRollPointerCancel,
  onRollKeyDown,
  onRollKeyUp,
  onRollClick,
}) => {
  const colorInfo = COLOR_MAP[color];

  // Unoccupied seat in 2-player or 3-player match
  if (!playerState) {
    return (
      <div
        data-testid={`corner-dock-${color}`}
        data-corner={corner}
        className="h-[58px] sm:h-[64px] lg:h-[72px] w-full min-w-0 rounded-2xl bg-[#1c0f07]/40 border border-[#3b1f10]/30 px-3 flex items-center justify-center text-[11px] text-[#7a4f32] font-semibold select-none"
      >
        <span>Empty Seat</span>
      </div>
    );
  }

  // Active Player Dock: Contains 3D Dice and Roll Controls
  if (isActive) {
    return (
      <div
        data-testid={`corner-dock-${color}`}
        data-corner={corner}
        data-active="true"
        className="h-[58px] sm:h-[64px] lg:h-[72px] w-full min-w-0 rounded-2xl bg-[#2e190e] border-2 px-2.5 sm:px-3 lg:px-4 flex items-center justify-between shadow-xl select-none transition-all z-20"
        style={{
          borderColor: colorInfo.primary,
          boxShadow: `0 0 20px -2px ${colorInfo.primary}55`,
        }}
      >
        {/* Player Avatar & Identity */}
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-base shadow-inner border border-white/30 shrink-0 relative"
            style={{ backgroundColor: colorInfo.primary }}
          >
            {playerState.config.avatar}
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-white animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="text-xs font-black text-[#f6ead7] truncate block"
              title={playerState.config.name}
            >
              {playerState.config.name}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">
              Turn
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="h-7 w-[1px] bg-white/10 shrink-0 mx-0.5" />

        {/* Shifting 3D Dice & Roll Trigger / Status */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Interactive 3D Dice in Reserved Clipped Slot */}
          <div
            role="button"
            tabIndex={canRoll && !hasRolled && !isRolling && !isAutomatedTurn && (!isOnline || isMyOnlineTurn) ? 0 : -1}
            aria-label="Roll Dice"
            onPointerDown={onRollPointerDown}
            onPointerUp={onRollPointerUp}
            onPointerCancel={onRollPointerCancel}
            onKeyDown={onRollKeyDown}
            onKeyUp={onRollKeyUp}
            onClick={onRollClick}
            onContextMenu={(e) => e.preventDefault()}
            className="w-[52px] h-[52px] flex items-center justify-center shrink-0 rounded-xl bg-[#1a0e07]/60 border border-white/10 hover:border-amber-400/50 touch-none select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400 overflow-hidden shadow-inner transition-colors"
            title="Tap or Hold to Roll"
          >
            <Dice3D
              value={diceValue}
              isRolling={isRolling}
              canRoll={canRoll}
              activeColor={color}
              onRoll={() => {}}
              size={24}
              showButton={false}
            />
          </div>

          {/* Action Button or State Label */}
          {isOnline && !isMyOnlineTurn ? (
            <span className="text-[10px] font-bold text-[#cdb99d] px-2 py-1 rounded-lg bg-[#1c0f07] border border-[#4a2b16] shrink-0">
              ⏳ Wait
            </span>
          ) : isAutomatedTurn ? (
            <span className="text-[10px] font-bold text-purple-300 px-2 py-1 rounded-lg bg-purple-950/80 border border-purple-700/60 animate-pulse shrink-0">
              🤖 Bot Roll
            </span>
          ) : isRolling ? (
            <span className="text-[10px] font-bold text-amber-300 px-2 py-1 rounded-lg bg-amber-950/80 border border-amber-700/60 animate-pulse shrink-0">
              Rolling...
            </span>
          ) : !hasRolled && canRoll ? (
            <button
              onPointerDown={onRollPointerDown}
              onPointerUp={onRollPointerUp}
              onPointerCancel={onRollPointerCancel}
              onKeyDown={onRollKeyDown}
              onKeyUp={onRollKeyUp}
              onClick={onRollClick}
              onContextMenu={(e) => e.preventDefault()}
              className="py-1.5 px-2.5 sm:px-3.5 rounded-xl text-white font-black text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center gap-1 border border-white/30 cursor-pointer select-none touch-none hover:brightness-110 shrink-0"
              style={{
                background: `linear-gradient(180deg, ${colorInfo.light || colorInfo.primary} 0%, ${colorInfo.primary} 60%, ${colorInfo.dark} 100%)`,
              }}
            >
              <span>ROLL</span>
            </button>
          ) : hasRolled ? (
            <div className="py-1 px-2 rounded-lg bg-[#1c0f07] border border-[#4a2b16] text-center shadow-inner shrink-0">
              <span className="text-[10px] text-[#cdb99d]">Rolled: </span>
              <span className="text-[#d6a85f] font-black text-sm">{diceValue}</span>
            </div>
          ) : null}
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
      className="h-[58px] sm:h-[64px] lg:h-[72px] w-full min-w-0 rounded-2xl bg-[#241309]/90 border border-[#4d2c16] px-2.5 sm:px-3 lg:px-4 flex items-center justify-between shadow-md select-none transition-all opacity-85 hover:opacity-100"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-base shadow-inner border border-white/20 shrink-0"
          style={{ backgroundColor: `${colorInfo.primary}33` }}
        >
          {playerState.config.avatar}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-xs font-bold text-[#f6ead7] truncate block"
            title={playerState.config.name}
          >
            {playerState.config.name}
          </div>
          <div className="text-[10px] text-[#cdb99d] flex items-center gap-1 font-medium">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colorInfo.primary }} />
            <span>{playerState.tokensHome}/4 Home</span>
          </div>
        </div>
      </div>
      {playerState.rank && (
        <span className="text-[10px] font-black text-amber-300 px-1.5 py-0.5 rounded-md bg-amber-950/80 border border-amber-800/60 shrink-0">
          #{playerState.rank}
        </span>
      )}
    </div>
  );
};
