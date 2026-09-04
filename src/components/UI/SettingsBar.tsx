import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Volume2, 
  VolumeX, 
  FastForward, 
  HelpCircle, 
  RotateCcw, 
  Home, 
  Sparkles, 
  Palette, 
  Settings, 
  Users, 
  X
} from 'lucide-react';
import { AnimationSpeed, BoardStyleMode } from '../../types/game';
import { soundEffects } from '../../engine/soundEffects';

interface SettingsBarProps {
  speed?: AnimationSpeed;
  onSpeedChange?: (speed: AnimationSpeed) => void;
  onRestart: () => void;
  onHome: () => void;
  onOpenRules: () => void;
  onOpenSetup?: () => void;
  isAutoPlay?: boolean;
  onToggleAutoPlay?: () => void;
  boardStyle?: BoardStyleMode;
  onToggleBoardStyle?: () => void;
  gameTitle?: string;
}

export const SettingsBar: React.FC<SettingsBarProps> = ({
  speed = 'normal',
  onSpeedChange,
  onRestart,
  onHome,
  onOpenRules,
  onOpenSetup,
  isAutoPlay,
  onToggleAutoPlay,
  boardStyle = 'luxury',
  onToggleBoardStyle,
  gameTitle,
}) => {
  const [soundOn, setSoundOn] = useState(soundEffects.getSoundEnabled());
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [headerTarget, setHeaderTarget] = useState<HTMLElement | null>(() =>
    typeof document !== 'undefined' ? document.getElementById('header-actions') : null
  );

  useEffect(() => {
    if (!headerTarget && typeof document !== 'undefined') {
      setHeaderTarget(document.getElementById('header-actions'));
    }
  }, [headerTarget]);

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    soundEffects.setSoundEnabled(next);
  };

  const headerControls = (
    <div className="flex items-center gap-2">
      {onToggleAutoPlay && (
        <button
          onClick={onToggleAutoPlay}
          title={isAutoPlay ? 'Auto-Play is Active (Click to Pause)' : 'Click to Enable Auto-Play'}
          className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-150 flex items-center gap-1.5 border cursor-pointer ${
            isAutoPlay
              ? 'bg-amber-600/30 text-amber-200 border-amber-500 shadow-md'
              : 'bg-[#241309] hover:bg-[#341b0e] text-[#cdb99d] border-[#5e381e]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-[#d6a85f]" />
          <span className="hidden sm:inline">Auto-Play:</span>
          <span>{isAutoPlay ? 'ON' : 'OFF'}</span>
        </button>
      )}

      <button
        onClick={() => setShowSettingsModal(true)}
        title="Game Controls & Match Settings"
        className="px-3 py-1.5 rounded-lg bg-[#241309] hover:bg-[#341b0e] text-[#f6ead7] transition-colors duration-150 flex items-center gap-1.5 text-xs font-bold border border-[#5e381e] cursor-pointer shadow-sm"
      >
        <Settings className="w-4 h-4 text-[#d6a85f]" />
        <span>Settings</span>
      </button>
    </div>
  );

  return (
    <>
      {/* Portal the game controls into the top app header, completely removing the redundant horizontal strip */}
      {headerTarget ? createPortal(headerControls, headerTarget) : headerControls}

      {/* ── Comprehensive In-Game Settings Modal ── */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 animate-fade-in select-none">
          <div className="relative w-full max-w-md bg-[#2a170c] border-2 border-[#5e381e] rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden flex flex-col gap-4 max-h-[90vh] overflow-y-auto text-[#f6ead7]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#4d2a15] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-[#d6a85f] shadow-sm">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#f6ead7]">{gameTitle || 'Match'} Settings</h3>
                  <p className="text-[11px] text-[#cdb99d]">Controls, players & board preferences</p>
                </div>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 rounded-xl bg-[#1c0f07] hover:bg-[#341b0e] text-[#cdb99d] hover:text-[#f6ead7] transition-all cursor-pointer border border-[#4a2b16]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Actions Grid */}
            <div className="space-y-2.5">
              {/* 1. Dedicated Back to Hub Action */}
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  onHome();
                }}
                className="w-full p-3 rounded-2xl bg-[#1c0f07] hover:bg-[#341b0e] border border-[#5e381e] flex items-center justify-between transition-all group active:scale-98 text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-600/20 flex items-center justify-center text-[#d6a85f] group-hover:scale-110 transition-transform">
                    <Home className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-[#f6ead7]">Back to Hub</div>
                    <div className="text-[10px] text-[#cdb99d]">Exit match and return to game selection</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-[#d6a85f] uppercase tracking-wider px-2 py-1 rounded-lg bg-[#241309] border border-[#5e381e]">Back</span>
              </button>

              {/* 2. Restart Match */}
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  onRestart();
                }}
                className="w-full p-3 rounded-2xl bg-[#1c0f07] hover:bg-[#341b0e] border border-[#4a2b16] hover:border-[#5e381e] flex items-center justify-between transition-all group active:scale-98 text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-[#f6ead7]">Restart Match</div>
                    <div className="text-[10px] text-[#cdb99d]">Reset scores, reshuffle and start new round</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider px-2 py-1 rounded-lg bg-[#241309] border border-indigo-800/40">Restart</span>
              </button>

              {/* 2. Player Setup */}
              {onOpenSetup && (
                <button
                  onClick={() => {
                    setShowSettingsModal(false);
                    onOpenSetup();
                  }}
                  className="w-full p-3 rounded-2xl bg-[#1c0f07] hover:bg-[#341b0e] border border-[#4a2b16] hover:border-[#5e381e] flex items-center justify-between transition-all group active:scale-98 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-[#f6ead7]">Players & AI Lineup</div>
                      <div className="text-[10px] text-[#cdb99d]">Modify player count, AI bot difficulty, avatars</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider px-2 py-1 rounded-lg bg-[#241309] border border-emerald-800/40">Setup</span>
                </button>
              )}

              {/* 3. Board Visual Style (if supported by game) */}
              {onToggleBoardStyle && (
                <button
                  onClick={onToggleBoardStyle}
                  className="w-full p-3 rounded-2xl bg-[#1c0f07] hover:bg-[#341b0e] border border-[#4a2b16] hover:border-[#5e381e] flex items-center justify-between transition-all group active:scale-98 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-600/20 flex items-center justify-center text-[#d6a85f] group-hover:scale-110 transition-transform">
                      <Palette className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-[#f6ead7]">Board Theme</div>
                      <div className="text-[10px] text-[#cdb99d]">
                        Currently: <span className="text-amber-300 font-bold capitalize">{boardStyle === 'luxury' ? 'Royal Gold Edition' : 'Classic Traditional'}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[#d6a85f] uppercase tracking-wider px-2 py-1 rounded-lg bg-[#241309] border border-[#5e381e]">Switch</span>
                </button>
              )}

              {/* 4. Auto-Play AI Toggle (if supported by game) */}
              {onToggleAutoPlay && (
                <button
                  onClick={onToggleAutoPlay}
                  className="w-full p-3 rounded-2xl bg-[#1c0f07] hover:bg-[#341b0e] border border-[#4a2b16] hover:border-[#5e381e] flex items-center justify-between transition-all group active:scale-98 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-600/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-[#f6ead7]">Auto-Play Assistant</div>
                      <div className="text-[10px] text-[#cdb99d]">
                        {isAutoPlay ? 'AI is automatically playing your turns' : 'Manual user control'}
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border ${
                    isAutoPlay
                      ? 'text-purple-300 bg-purple-950/80 border-purple-600 shadow animate-pulse'
                      : 'text-[#cdb99d] bg-[#241309] border-[#4a2b16]'
                  }`}>
                    {isAutoPlay ? 'Active ON' : 'Turn ON'}
                  </span>
                </button>
              )}

              {/* 5. Sound Effects Mute/Unmute */}
              <button
                onClick={handleToggleSound}
                className="w-full p-3 rounded-2xl bg-[#1c0f07] hover:bg-[#341b0e] border border-[#4a2b16] hover:border-[#5e381e] flex items-center justify-between transition-all group active:scale-98 text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#241309] border border-[#4a2b16] flex items-center justify-center text-[#d6a85f] group-hover:scale-110 transition-transform">
                    {soundOn ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
                  </div>
                  <div>
                    <div className="text-xs font-black text-[#f6ead7]">Game Audio & SFX</div>
                    <div className="text-[10px] text-[#cdb99d]">{soundOn ? 'Dice rolls, card deals & victory audio ON' : 'All game sounds muted'}</div>
                  </div>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border ${
                  soundOn ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40' : 'text-rose-400 bg-rose-950/60 border-rose-800/40'
                }`}>
                  {soundOn ? 'Mute' : 'Unmute'}
                </span>
              </button>

              {/* 6. Game Speed Switcher */}
              {onSpeedChange && (
                <div className="p-3 rounded-2xl bg-[#1c0f07] border border-[#4a2b16] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#241309] border border-[#4a2b16] flex items-center justify-center text-[#d6a85f]">
                      <FastForward className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-[#f6ead7]">Animation Speed</div>
                      <div className="text-[10px] text-[#cdb99d]">Controls dealing and piece movement pace</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-[#241309] p-1 rounded-xl border border-[#4a2b16]">
                    {(['normal', 'fast', 'turbo'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => onSpeedChange(s)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold capitalize transition-all cursor-pointer ${
                          speed === s
                            ? 'bg-amber-600 text-[#f6ead7] shadow'
                            : 'text-[#cdb99d] hover:text-[#f6ead7]'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 7. Rules & Strategy Guide */}
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  onOpenRules();
                }}
                className="w-full p-3 rounded-2xl bg-[#1c0f07] hover:bg-[#341b0e] border border-[#4a2b16] hover:border-[#5e381e] flex items-center justify-between transition-all group active:scale-98 text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#241309] border border-[#4a2b16] flex items-center justify-center text-[#d6a85f] group-hover:scale-110 transition-transform">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-[#f6ead7]">Rules & Strategy Guide</div>
                    <div className="text-[10px] text-[#cdb99d]">Nepali canonical rules, scoring & payouts</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-[#cdb99d] uppercase tracking-wider px-2 py-1 rounded-lg bg-[#241309] border border-[#4a2b16]">View</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
