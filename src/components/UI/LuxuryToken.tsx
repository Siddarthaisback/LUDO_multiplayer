import React from 'react';
import { PlayerColor } from '../../types/game';

interface LuxuryTokenProps {
  color: PlayerColor;
  tokenId?: number;
  isMovable?: boolean;
  avatar?: string;
  size?: number | string;
  className?: string;
  onClick?: () => void;
  count?: number;
  isHopping?: boolean;
  liftY?: number;
  scaleFactor?: number;
  rotateDeg?: number;
  isDefeated?: boolean;
}

export const LuxuryToken: React.FC<LuxuryTokenProps> = React.memo(({
  color,
  tokenId = 0,
  isMovable = false,
  size = '100%',
  className = '',
  onClick,
  count = 1,
  isHopping = false,
  liftY = 0,
  scaleFactor = 1,
  rotateDeg = 0,
}) => {
  // Ultra-vibrant jewel & 24K gold metallic theme palettes
  const colorThemes = {
    red: {
      light: '#ff8a80',
      mid: '#e53935',
      dark: '#b71c1c',
      deep: '#5f0909',
      highlight: '#ffebee',
      glow: 'rgba(239, 68, 68, 0.7)',
      shadow: 'rgba(127, 0, 0, 0.65)',
      goldLight: '#fef08a',
      goldMid: '#eab308',
      goldDark: '#854d0e',
    },
    green: {
      light: '#a7f3d0',
      mid: '#10b981',
      dark: '#047857',
      deep: '#022c22',
      highlight: '#ecfdf5',
      glow: 'rgba(16, 185, 129, 0.7)',
      shadow: 'rgba(4, 120, 87, 0.65)',
      goldLight: '#fef08a',
      goldMid: '#eab308',
      goldDark: '#854d0e',
    },
    yellow: {
      light: '#fef08a',
      mid: '#eab308',
      dark: '#ca8a04',
      deep: '#713f12',
      highlight: '#fefce8',
      glow: 'rgba(234, 179, 8, 0.8)',
      shadow: 'rgba(161, 98, 7, 0.65)',
      goldLight: '#ffffff',
      goldMid: '#facc15',
      goldDark: '#a16207',
    },
    blue: {
      light: '#93c5fd',
      mid: '#2563eb',
      dark: '#1d4ed8',
      deep: '#172554',
      highlight: '#eff6ff',
      glow: 'rgba(37, 99, 235, 0.7)',
      shadow: 'rgba(29, 78, 216, 0.65)',
      goldLight: '#fef08a',
      goldMid: '#eab308',
      goldDark: '#854d0e',
    },
  }[color];

  const sizeStyle =
    typeof size === 'number'
      ? { width: `${size}px`, height: `${size}px` }
      : { width: size, height: 'auto', aspectRatio: '1 / 1' };

  const motionTransform = `translate3d(0, ${liftY}px, 0) scale(${scaleFactor}) rotate(${rotateDeg}deg)`;

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center rounded-full select-none cursor-pointer ${
        isMovable
          ? 'token-highlight animate-bounce filter drop-shadow-[0_0_10px_rgba(250,204,21,0.9)] scale-110 z-40'
          : 'hover:scale-105 z-30'
      } ${
        isHopping ? 'z-50 animate-ludo-hop' : ''
      } ${className}`}
      style={{
        ...sizeStyle,
        transform: motionTransform,
        willChange: isHopping || isMovable ? 'transform' : 'auto',
        transition: isHopping ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full overflow-visible pointer-events-auto"
      >
        <defs>
          {/* 24K Polished Gold Metallic Rim Gradient */}
          <linearGradient id={`goldRimGrad-${color}-${tokenId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colorThemes.goldLight} />
            <stop offset="35%" stopColor={colorThemes.goldMid} />
            <stop offset="70%" stopColor={colorThemes.goldDark} />
            <stop offset="100%" stopColor={colorThemes.goldLight} />
          </linearGradient>

          {/* Deep Gemstone Refraction Radial Gradient */}
          <radialGradient
            id={`gemBaseGrad-${color}-${tokenId}`}
            cx="34%"
            cy="32%"
            r="68%"
            fx="26%"
            fy="24%"
          >
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="20%" stopColor={colorThemes.light} />
            <stop offset="55%" stopColor={colorThemes.mid} />
            <stop offset="82%" stopColor={colorThemes.dark} />
            <stop offset="100%" stopColor={colorThemes.deep} />
          </radialGradient>

          {/* Elevated Royal Crown Jewel Gradient */}
          <radialGradient
            id={`crownJewelGrad-${color}-${tokenId}`}
            cx="32%"
            cy="30%"
            r="65%"
            fx="24%"
            fy="22%"
          >
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="28%" stopColor={colorThemes.highlight} />
            <stop offset="60%" stopColor={colorThemes.mid} />
            <stop offset="88%" stopColor={colorThemes.dark} />
            <stop offset="100%" stopColor={colorThemes.deep} />
          </radialGradient>
        </defs>

        {/* 1. TIER 1: 24K POLISHED GOLD FLANGED BASE BEZEL */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill={`url(#goldRimGrad-${color}-${tokenId})`}
          stroke="#000000"
          strokeWidth="1.8"
        />

        {/* 3. TIER 2: GEMSTONE DISC TIER WITH INNER GOLD GROOVE */}
        <circle
          cx="50"
          cy="50"
          r="41"
          fill={`url(#gemBaseGrad-${color}-${tokenId})`}
          stroke={colorThemes.goldDark}
          strokeWidth="1"
        />

        {/* 4. TIER 3: MID CONICAL GOLD COLLAR STEP */}
        <circle
          cx="50"
          cy="50"
          r="30"
          fill={`url(#goldRimGrad-${color}-${tokenId})`}
          stroke={colorThemes.deep}
          strokeWidth="1.2"
        />

        {/* 5. TIER 4: GLOSSY ROYAL CROWN SPHERE (HEAD) */}
        <circle
          cx="50"
          cy="50"
          r="22"
          fill={`url(#crownJewelGrad-${color}-${tokenId})`}
          stroke={colorThemes.deep}
          strokeWidth="1.5"
        />

        {/* 6. CENTER ROYAL GOLD STAR INLAY */}
        <polygon
          points="50,38 52.8,45.5 60.5,45.5 54.2,50 56.6,57.5 50,53 43.4,57.5 45.8,50 39.5,45.5 47.2,45.5"
          fill={`url(#goldRimGrad-${color}-${tokenId})`}
          fillOpacity="0.85"
          stroke={colorThemes.goldDark}
          strokeWidth="0.6"
        />

        {/* 7. HIGH-GLOSS SPECULAR GLASS GLINTS */}
        <ellipse
          cx="42"
          cy="41"
          rx="6"
          ry="3.5"
          fill="#ffffff"
          opacity="0.95"
          transform="rotate(-30 42 41)"
        />
        <circle
          cx="39"
          cy="48"
          r="2"
          fill="#ffffff"
          opacity="0.8"
        />
      </svg>

      {/* Stacked count badge if > 1 */}
      {count > 1 && (
        <span className="absolute -top-1 -right-1 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-2xl border-2 border-white ring-1 ring-amber-600">
          {count}
        </span>
      )}
    </div>
  );
});
