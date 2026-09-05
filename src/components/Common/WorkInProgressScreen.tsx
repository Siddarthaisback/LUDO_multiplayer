import React from 'react';
import { Hammer, Sparkles, CheckCircle2, Clock } from 'lucide-react';

export const WorkInProgressScreen: React.FC = () => {
  return (
    <main
      role="status"
      aria-live="polite"
      className="min-h-screen flex flex-col justify-between bg-[#221309] bg-[radial-gradient(ellipse_at_50%_38%,_#7a4b26_0%,_#543217_40%,_#331d0d_80%,_#1f1006_100%)] text-[#f6ead7] selection:bg-amber-600 selection:text-white relative overflow-x-hidden select-none font-sans"
    >
      {/* Wood Tabletop Grain & Ambient Overhead Lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-[0.04] bg-[radial-gradient(#f6ead7_1px,transparent_1px),radial-gradient(#e2a865_1px,transparent_1px)] [background-size:20px_20px,32px_32px] [background-position:0_0,10px_10px]" />
      <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,228,185,0.08)_0%,transparent_65%)]" />

      {/* Top Header Bar */}
      <header className="sticky top-0 shrink-0 z-40 border-b border-[#4d2c16] bg-[#1e1007]/95 backdrop-blur-md px-4 sm:px-8 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2.5 text-left">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-700 flex items-center justify-center text-base shadow-md text-slate-950 font-black border border-amber-300/40">
            🎲
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-[#f6ead7] leading-none">
              LUDO <span className="text-[#d6a85f]">CLASSIC</span>
            </h1>
            <span className="text-[10px] text-[#cdb99d] font-bold uppercase tracking-wider">
              Royal Board Game • Active Development
            </span>
          </div>
        </div>

        <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse motion-reduce:animate-none" />
          <span>Work in Progress</span>
        </span>
      </header>

      {/* Main Content Container */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-xl mx-auto w-full my-auto">
        <div className="w-full bg-[#241309]/95 border-2 border-[#542f17] rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center">
          {/* Animated Emblem */}
          <div className="relative mb-5">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-amber-600 via-yellow-500 to-amber-700 shadow-2xl border-2 border-amber-300/50 flex items-center justify-center text-4xl sm:text-5xl">
              🎲
            </div>
            <div className="absolute -bottom-2 -right-2 w-9 h-9 rounded-2xl bg-[#1e1007] border border-amber-400/50 flex items-center justify-center shadow-lg">
              <Hammer className="w-5 h-5 text-amber-400 animate-bounce motion-reduce:animate-none" />
            </div>
          </div>

          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>🚧 Work in Progress</span>
          </div>

          {/* Heading & Notice */}
          <h2 className="text-2xl sm:text-3xl font-black text-[#f6ead7] tracking-tight mb-2">
            Game Arena Under Construction
          </h2>
          <p className="text-xs sm:text-sm text-[#cdb99d] max-w-md mb-6 leading-relaxed">
            We are currently tuning up Royal Ludo Classic for our upcoming official public launch.
            The live server is paused while we prepare real-time matchmaking, multiplayer synchronization, and offline modes.
          </p>

          {/* Feature Checklist */}
          <div className="w-full bg-[#180c05] border border-[#3f2210] rounded-2xl p-4 mb-6 text-left flex flex-col gap-2.5">
            <div className="text-[11px] font-black uppercase tracking-wider text-[#d6a85f] mb-1">
              Engine Milestone Status
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-[#f6ead7]">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Physics Dice Engine & Sound Effects</span>
              </span>
              <span className="text-[10px] font-bold text-emerald-400">Ready</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-[#f6ead7]">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Offline Pass & Play (2P - 4P)</span>
              </span>
              <span className="text-[10px] font-bold text-emerald-400">Ready</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-[#f6ead7]">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>AI Computer Bot Difficulties</span>
              </span>
              <span className="text-[10px] font-bold text-emerald-400">Ready</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-amber-200">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-spin motion-reduce:animate-none" />
                <span>Real-Time WebRTC Matchmaking Tuning</span>
              </span>
              <span className="text-[10px] font-bold text-amber-400">Final Stage</span>
            </div>
          </div>

          {/* Live Heartbeat Footer inside Card */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-[#a89073] font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping motion-reduce:animate-none" />
            <span>Development in active progress. Check back shortly!</span>
          </div>
        </div>
      </div>

      {/* Global Footer */}
      <footer className="relative z-10 border-t border-[#4d2c16] py-3 text-center text-[11px] text-[#8a7258] font-medium">
        Royal Ludo Classic &bull; Work in Progress &bull; All Rights Reserved
      </footer>
    </main>
  );
};
