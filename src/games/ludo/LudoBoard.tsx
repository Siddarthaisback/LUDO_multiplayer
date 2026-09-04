import React from 'react';
import { PlayerColor, BoardStyleMode } from '../../types/game';
import { LudoPlayerState, MoveOption } from '../../types/ludo';
import {
  getLudoVisualPosition,
  getClusterOffset,
  LUDO_YARD_SOCKETS,
  BoardPoint,
} from './ludoGeometry';
import { LuxuryToken } from '../../components/UI/LuxuryToken';
import { PathPreviewLayer } from './PathPreviewLayer';
import { BoardEffectsLayer } from './BoardEffectsLayer';
import { BoardEffectItem, PathPreviewData } from './ludoAnimationTypes';
import { Star, Crown } from 'lucide-react';
import './ludoAnimations.css';

interface LudoBoardProps {
  players: LudoPlayerState[];
  activeColor: PlayerColor;
  validMoves: MoveOption[];
  onTokenClick: (tokenId: number) => void;
  onTokenHover?: (tokenId: number | null) => void;
  isRolling: boolean;
  boardStyle?: BoardStyleMode;
  isShaking?: boolean;
  effects?: BoardEffectItem[];
  pathPreview?: PathPreviewData | null;
}

// Memoized Static Background: 15x15 grid, corner yards, victory zone, and sockets
const LudoBoardBackground: React.FC = React.memo(() => {
  return (
    <>
      {/* 1. CENTER VICTORY ZONE */}
      <div className="col-start-7 col-span-3 row-start-7 row-span-3 relative bg-slate-900 border border-slate-300 flex items-center justify-center overflow-hidden z-10 shadow-md">
        <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="redTriangleGrad" x1="0%" y1="50%" x2="50%" y2="50%">
              <stop offset="0%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
            <linearGradient id="greenTriangleGrad" x1="50%" y1="0%" x2="50%" y2="50%">
              <stop offset="0%" stopColor="#15803d" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
            <linearGradient id="blueTriangleGrad" x1="100%" y1="50%" x2="50%" y2="50%">
              <stop offset="0%" stopColor="#1d4ed8" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
            <linearGradient id="yellowTriangleGrad" x1="50%" y1="100%" x2="50%" y2="50%">
              <stop offset="0%" stopColor="#ca8a04" />
              <stop offset="100%" stopColor="#eab308" />
            </linearGradient>
          </defs>

          {/* 4 Faceted Triangles with Soft Gold/Light Seams */}
          <polygon points="0,0 50,50 0,100" fill="url(#redTriangleGrad)" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" />
          <polygon points="0,0 100,0 50,50" fill="url(#greenTriangleGrad)" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" />
          <polygon points="100,0 100,100 50,50" fill="url(#blueTriangleGrad)" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" />
          <polygon points="0,100 100,100 50,50" fill="url(#yellowTriangleGrad)" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" />
        </svg>

        {/* Center Crown Medallion Crest */}
        <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 border-2 border-white shadow-md flex items-center justify-center animate-pulse z-20">
          <Crown className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-slate-950 fill-slate-950 filter drop-shadow" />
        </div>
      </div>

      {/* 2. RED CORNER YARD (TOP-LEFT) */}
      <div className="col-start-1 col-span-6 row-start-1 row-span-6 bg-[#dc2626] p-3 sm:p-4 md:p-5 flex items-center justify-center border-r border-b border-slate-300 relative">
        <div className="w-full h-full bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-[inset_0_2px_6px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.1)] relative flex items-center justify-center overflow-hidden" />
      </div>

      {/* 3. GREEN CORNER YARD (TOP-RIGHT) */}
      <div className="col-start-10 col-span-6 row-start-1 row-span-6 bg-[#16a34a] p-3 sm:p-4 md:p-5 flex items-center justify-center border-l border-b border-slate-300 relative">
        <div className="w-full h-full bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-[inset_0_2px_6px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.1)] relative flex items-center justify-center overflow-hidden" />
      </div>

      {/* 4. YELLOW CORNER YARD (BOTTOM-LEFT) */}
      <div className="col-start-1 col-span-6 row-start-10 row-span-6 bg-[#eab308] p-3 sm:p-4 md:p-5 flex items-center justify-center border-r border-t border-slate-300 relative">
        <div className="w-full h-full bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-[inset_0_2px_6px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.1)] relative flex items-center justify-center overflow-hidden" />
      </div>

      {/* 5. BLUE CORNER YARD (BOTTOM-RIGHT) */}
      <div className="col-start-10 col-span-6 row-start-10 row-span-6 bg-[#2563eb] p-3 sm:p-4 md:p-5 flex items-center justify-center border-l border-t border-slate-300 relative">
        <div className="w-full h-full bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-[inset_0_2px_6px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.1)] relative flex items-center justify-center overflow-hidden" />
      </div>

      {/* 6. 15x15 TACTILE TRACK CELLS */}
      {Array.from({ length: 15 }).map((_, r) =>
        Array.from({ length: 15 }).map((_, c) => {
          if ((r < 6 && c < 6) || (r < 6 && c > 8) || (r > 8 && c > 8) || (r > 8 && c < 6)) return null;
          if (r >= 6 && r <= 8 && c >= 6 && c <= 8) return null;

          const isRedRunway = r === 7 && c >= 1 && c <= 5;
          const isGreenRunway = c === 7 && r >= 1 && r <= 5;
          const isBlueRunway = r === 7 && c >= 9 && c <= 13;
          const isYellowRunway = c === 7 && r >= 9 && r <= 13;

          const isRedStart = r === 6 && c === 1;
          const isGreenStart = r === 1 && c === 8;
          const isBlueStart = r === 8 && c === 13;
          const isYellowStart = r === 13 && c === 6;

          const isSafeStarGreen = r === 2 && c === 6;
          const isSafeStarBlue = r === 6 && c === 12;
          const isSafeStarYellow = r === 12 && c === 8;
          const isSafeStarRed = r === 8 && c === 2;

          let cellBg = 'bg-white';
          let icon = null;

          if (isRedRunway) {
            cellBg = 'bg-[#dc2626] text-white';
          } else if (isGreenRunway) {
            cellBg = 'bg-[#16a34a] text-white';
          } else if (isBlueRunway) {
            cellBg = 'bg-[#2563eb] text-white';
          } else if (isYellowRunway) {
            cellBg = 'bg-[#eab308] text-slate-950';
          } else if (isRedStart) {
            cellBg = 'bg-[#dc2626] text-white';
            icon = <span className="text-white font-black text-xs sm:text-sm select-none">▶</span>;
          } else if (isGreenStart) {
            cellBg = 'bg-[#16a34a] text-white';
            icon = <span className="text-white font-black text-xs sm:text-sm select-none">▼</span>;
          } else if (isBlueStart) {
            cellBg = 'bg-[#2563eb] text-white';
            icon = <span className="text-white font-black text-xs sm:text-sm select-none">◀</span>;
          } else if (isYellowStart) {
            cellBg = 'bg-[#eab308] text-white';
            icon = <span className="text-white font-black text-xs sm:text-sm select-none">▲</span>;
          } else if (isSafeStarRed) {
            icon = <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500 fill-red-400 stroke-red-600 filter drop-shadow-sm" />;
          } else if (isSafeStarGreen) {
            icon = <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 fill-emerald-400 stroke-emerald-600 filter drop-shadow-sm" />;
          } else if (isSafeStarBlue) {
            icon = <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 fill-blue-400 stroke-blue-600 filter drop-shadow-sm" />;
          } else if (isSafeStarYellow) {
            icon = <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 fill-amber-400 stroke-amber-600 filter drop-shadow-sm" />;
          }

          return (
            <div
              key={`c-cell-${r}-${c}`}
              className={`relative flex items-center justify-center border border-slate-300/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] ${cellBg}`}
              style={{ gridRow: r + 1, gridColumn: c + 1 }}
            >
              {icon}
            </div>
          );
        })
      )}

      {/* 16 Recessed Socket Pedestals inside the 4 yards */}
      {Object.entries(LUDO_YARD_SOCKETS).flatMap(([colorKey, pts]) =>
        pts.map((pt, sIdx) => (
          <div
            key={`socket-pedestal-${colorKey}-${sIdx}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-10"
            style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%` }}
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-13 md:h-13 rounded-full bg-[#cbd5e1] border border-slate-300 shadow-[inset_0_2px_5px_rgba(0,0,0,0.22),0_1px_2px_rgba(255,255,255,0.85)] flex items-center justify-center" />
          </div>
        ))
      )}
    </>
  );
});

export const LudoBoard: React.FC<LudoBoardProps> = React.memo(({
  players,
  activeColor,
  validMoves,
  onTokenClick,
  onTokenHover,
  isRolling,
  boardStyle = 'classic',
  isShaking = false,
  effects = [],
  pathPreview = null,
}) => {
  const boardRef = React.useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = React.useState<number>(0);

  React.useEffect(() => {
    if (!boardRef.current) return;
    const updateSize = () => {
      if (boardRef.current) {
        setBoardWidth(boardRef.current.clientWidth);
      }
    };
    updateSize();

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setBoardWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(boardRef.current);
    return () => ro.disconnect();
  }, []);

  const movableTokenIds = new Set(validMoves.map((m) => m.tokenId));

  // Collect all player tokens with their visual coordinates
  const tokensToRender: {
    color: PlayerColor;
    tokenId: number;
    step: number;
    isMovable: boolean;
    avatar: string;
    point: BoardPoint;
  }[] = [];

  players.forEach((player) => {
    player.tokens.forEach((token) => {
      const isMovable =
        player.config.color === activeColor &&
        movableTokenIds.has(token.id) &&
        !isRolling;

      const point = getLudoVisualPosition(player.config.color, token.id, token.step, boardStyle);

      tokensToRender.push({
        color: player.config.color,
        tokenId: token.id,
        step: token.step,
        isMovable,
        avatar: player.config.avatar,
        point,
      });
    });
  });

  // Render tokens using compositor-only transform positioning
  const renderTokens = () => {
    return tokensToRender.map((token) => {
      // Check cluster peers on same cell
      const peers =
        token.step >= 0
          ? tokensToRender.filter(
              (t) =>
                t.step >= 0 &&
                Math.abs(t.point.x - token.point.x) < 0.008 &&
                Math.abs(t.point.y - token.point.y) < 0.008
            )
          : [token];

      const peerIndex = peers.findIndex(
        (p) => p.color === token.color && p.tokenId === token.tokenId
      );
      const offset = getClusterOffset(peerIndex >= 0 ? peerIndex : 0, peers.length);

      const rawX = token.point.x + offset.dx;
      const rawY = token.point.y + offset.dy;

      const isMovableToken = token.isMovable;

      // Pure compositor transform: no continuous left/top layout updates during animation
      const transformStyle =
        boardWidth > 0
          ? `translate3d(${rawX * boardWidth}px, ${rawY * boardWidth}px, 0) translate(-50%, -50%)`
          : `translate3d(${rawX * 100}%, ${rawY * 100}%, 0) translate(-50%, -50%)`;

      return (
        <div
          key={`token-${token.color}-${token.tokenId}`}
          id={`ludo-token-${token.color}-${token.tokenId}`}
          onClick={() => isMovableToken && onTokenClick(token.tokenId)}
          onMouseEnter={() => isMovableToken && onTokenHover && onTokenHover(token.tokenId)}
          onMouseLeave={() => onTokenHover && onTokenHover(null)}
          className={`absolute flex items-center justify-center rounded-full pointer-events-auto after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:min-w-[44px] after:min-h-[44px] after:w-[calc(100%_+_8px)] after:h-[calc(100%_+_8px)] after:content-[''] ${
            isMovableToken ? 'cursor-pointer z-40' : 'z-30'
          }`}
          style={{
            left: 0,
            top: 0,
            width: 'var(--ludo-token-size, 7.2%)',
            height: 'var(--ludo-token-size, 7.2%)',
            transform: transformStyle,
            willChange: isMovableToken ? 'transform' : 'auto',
          }}
        >
          <LuxuryToken
            color={token.color}
            tokenId={token.tokenId}
            isMovable={isMovableToken}
            avatar={token.avatar}
            size="100%"
            count={peers.length > 1 && peerIndex === peers.length - 1 ? peers.length : 1}
          />
        </div>
      );
    });
  };

  return (
    <div
      className={`ludo-board-container ${isShaking ? 'animate-shake' : ''}`}
    >
      {/* ── CLEAN MODERN LUDO BOARD (Zero Gap Outer Border) ── */}
      <div
        ref={boardRef}
        className="w-full h-full grid grid-cols-15 grid-rows-15 rounded-3xl overflow-hidden border-3 sm:border-4 border-slate-800 bg-white relative shadow-2xl"
      >
        {/* Memoized Static Background: Grid, Yards, Victory Zone, Sockets */}
        <LudoBoardBackground />

        {/* Path Preview Layer */}
        <PathPreviewLayer preview={pathPreview} />

        {/* Board Effects Layer */}
        <BoardEffectsLayer effects={effects} />

        {/* Unified Board Coordinate Layer for Tokens */}
        <div className="absolute inset-0 pointer-events-none">
          {renderTokens()}
        </div>
      </div>
    </div>
  );
});
