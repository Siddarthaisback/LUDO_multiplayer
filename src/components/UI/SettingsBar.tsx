import React, { useState } from 'react';
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

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    soundEffects.setSoundEnabled(next);
  };

  return (
    <>
      {/* ── Compact Top Bar (Home + Title on Left, Settings on Right) ── */}
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2 bg-gradient-to-r from-slate-900/95 via-blue-950/90 to-slate-900/95 border-2 border-amber-400/30 rounded-2xl shadow-xl select-none">
        {/* Left: Home Navigation & Game Title */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onHome}
            title="Return to Main Hub / Lobby"
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/90 text-slate-300 hover:text-white transition-all active:scale-95 flex items-center gap-1.5 text-xs font-bold border border-slate-700/50"
          >
            <Home className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Hub</span>
          </button>

          {gameTitle && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] sm:text-xs font-black text-amber-400/95 uppercase tracking-wider shadow-inner">
              <span>{gameTitle}</span>
            </div>
          )}
        </div>

        {/* Right: Quick Auto-Play & Settings Buttons */}
        <div className="flex items-center gap-2">
          {onToggleAutoPlay && (
            <button
              onClick={onToggleAutoPlay}
              title={isAutoPlay ? 'Auto-Play is Active (Click to Pause)' : 'Click to Enable Auto-Play'}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 border cursor-pointer ${
                isAutoPlay
                  ? 'bg-purple-600/30 text-purple-300 border-purple-500 shadow-md animate-pulse'
                  : 'bg-slate-800/80 hover:bg-purple-900/40 text-slate-300 hover:text-purple-200 border-slate-700'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Auto-Play:</span>
              <span>{isAutoPlay ? 'ON' : 'OFF'}</span>
            </button>
          )}

          <button
            onClick={() => setShowSettingsModal(true)}
            title="Game Controls & Match Settings"
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-indigo-500/20 hover:from-amber-500/30 hover:to-indigo-500/30 text-amber-300 hover:text-white transition-all active:scale-95 flex items-center gap-1.5 text-xs font-black border border-amber-500/30 shadow-sm cursor-pointer"
          >
            <Settings className="w-4 h-4 text-amber-400 animate-[spin_12s_linear_infinite]" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>

      {/* ── Comprehensive In-Game Settings Modal ── */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 animate-fade-in select-none">
          <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-sm">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">{gameTitle || 'Match'} Settings</h3>
                  <p className="text-[11px] text-slate-400">Controls, players & board preferences</p>
                </div>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Actions Grid */}
            <div className="space-y-2.5">
              {/* 1. Restart Match */}
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  onRestart();
                }}
                className="w-full p-3 rounded-2xl bg-slate-950/70 hover:bg-indigo-600/20 border border-slate-800 hover:border-indigo-500/50 flex items-center justify-between transition-all group active:scale-98 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-white">Restart Match</div>
                    <div className="text-[10px] text-slate-400">Reset scores, reshuffle and start new round</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider px-2 py-1 rounded-lg bg-indigo-950/60 border border-indigo-800/40">Restart</span>
              </button>

              {/* 2. Player Setup */}
              {onOpenSetup && (
                <button
                  onClick={() => {
                    setShowSettingsModal(false);
                    onOpenSetup();
                  }}
                  className="w-full p-3 rounded-2xl bg-slate-950/70 hover:bg-emerald-600/20 border border-slate-800 hover:border-emerald-500/50 flex items-center justify-between transition-all group active:scale-98 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-white">Players & AI Lineup</div>
                      <div className="text-[10px] text-slate-400">Modify player count, AI bot difficulty, avatars</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider px-2 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/40">Setup</span>
                </button>
              )}

              {/* 3. Board Visual Style (if supported by game) */}
              {onToggleBoardStyle && (
                <button
                  onClick={onToggleBoardStyle}
                  className="w-full p-3 rounded-2xl bg-slate-950/70 hover:bg-amber-600/20 border border-slate-800 hover:border-amber-500/50 flex items-center justify-between transition-all group active:scale-98 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-600/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                      <Palette className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-white">Board Theme</div>
                      <div className="text-[10px] text-slate-400">
                        Currently: <span className="text-amber-300 font-bold capitalize">{boardStyle === 'luxury' ? 'Royal Gold Edition' : 'Classic Traditional'}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider px-2 py-1 rounded-lg bg-amber-950/60 border border-amber-800/40">Switch</span>
                </button>
              )}

              {/* 4. Auto-Play AI Toggle (if supported by game) */}
              {onToggleAutoPlay && (
                <button
                  onClick={onToggleAutoPlay}
                  className="w-full p-3 rounded-2xl bg-slate-950/70 hover:bg-purple-600/20 border border-slate-800 hover:border-purple-500/50 flex items-center justify-between transition-all group active:scale-98 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-600/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-white">Auto-Play Assistant</div>
                      <div className="text-[10px] text-slate-400">
                        {isAutoPlay ? 'AI is automatically playing your turns' : 'Manual user control'}
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border ${
                    isAutoPlay
                      ? 'text-purple-300 bg-purple-950/80 border-purple-600 shadow animate-pulse'
                      : 'text-slate-400 bg-slate-900 border-slate-800'
                  }`}>
                    {isAutoPlay ? 'Active ON' : 'Turn ON'}
                  </span>
                </button>
              )}

              {/* 5. Sound Effects Mute/Unmute */}
              <button
                onClick={handleToggleSound}
                className="w-full p-3 rounded-2xl bg-slate-950/70 hover:bg-slate-800/60 border border-slate-800 hover:border-slate-700 flex items-center justify-between transition-all group active:scale-98 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 group-hover:scale-110 transition-transform">
                    {soundOn ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
                  </div>
                  <div>
                    <div className="text-xs font-black text-white">Game Audio & SFX</div>
                    <div className="text-[10px] text-slate-400">{soundOn ? 'Dice rolls, card deals & victory audio ON' : 'All game sounds muted'}</div>
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
                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                      <FastForward className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-white">Animation Speed</div>
                      <div className="text-[10px] text-slate-400">Controls dealing and piece movement pace</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                    {(['normal', 'fast', 'turbo'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => onSpeedChange(s)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold capitalize transition-all ${
                          speed === s
                            ? 'bg-indigo-600 text-white shadow'
                            : 'text-slate-400 hover:text-white'
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
                className="w-full p-3 rounded-2xl bg-slate-950/70 hover:bg-slate-800/60 border border-slate-800 flex items-center justify-between transition-all group active:scale-98 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 group-hover:scale-110 transition-transform">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-white">Rules & Strategy Guide</div>
                    <div className="text-[10px] text-slate-400">Nepali canonical rules, scoring & payouts</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 rounded-lg bg-slate-900 border border-slate-800">View</span>
              </button>

              {/* 8. Exit to Hub */}
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  onHome();
                }}
                className="w-full p-3 rounded-2xl bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/40 hover:border-rose-700/60 flex items-center justify-between transition-all group active:scale-98 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-600/20 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
                    <Home className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-white">Exit Table to Hub</div>
                    <div className="text-[10px] text-slate-400">Leave current table and return to game hub</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider px-2 py-1 rounded-lg bg-rose-950/60 border border-rose-800/40">Exit</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
