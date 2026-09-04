import React, { useRef, useEffect } from 'react';
import { GameLogEntry, PlayerColor } from '../../types/game';
import { COLOR_MAP } from '../../utils/constants';
import { ScrollText } from 'lucide-react';

interface GameLogProps {
  logs: GameLogEntry[];
  onSendEmote?: (emote: string) => void;
  myColor?: PlayerColor;
}

const QUICK_EMOTES = ['🎲 Lucky!', '🔥 GG!', '🐍 Ouch!', '🪜 Let’s go!', '😱 No way!', '👑 Crown me!'];

export const GameLog: React.FC<GameLogProps> = ({ logs, onSendEmote, myColor: _myColor = 'red' }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogIcon = (type: GameLogEntry['type']) => {
    switch (type) {
      case 'roll': return '🎲';
      case 'move': return '👣';
      case 'ladder': return '🪜';
      case 'snake': return '🐍';
      case 'capture': return '💥';
      case 'win': return '👑';
      case 'chat': return '💬';
      default: return 'ℹ️';
    }
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-3.5 backdrop-blur-md flex flex-col h-full">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 text-xs font-bold uppercase tracking-wider text-slate-400">
        <div className="flex items-center gap-1.5">
          <ScrollText className="w-3.5 h-3.5 text-indigo-400" />
          <span>Live Match Feed</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">{logs.length} events</span>
      </div>

      {/* Log Entries */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[120px] max-h-[180px] text-xs"
      >
        {logs.length === 0 ? (
          <div className="text-center text-slate-500 italic py-6">Game ready. Roll the dice to start!</div>
        ) : (
          logs.map((log) => {
            const colorClass = log.playerColor ? COLOR_MAP[log.playerColor]?.text : 'text-slate-300';
            return (
              <div
                key={log.id}
                className="flex items-start gap-2 py-1 px-2 rounded-lg bg-slate-950/40 border border-slate-800/40 transition-colors"
              >
                <span className="text-sm shrink-0 mt-0.5">{getLogIcon(log.type)}</span>
                <span className={`leading-relaxed break-words font-medium ${colorClass}`}>
                  {log.text}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Emote Bar */}
      {onSendEmote && (
        <div className="mt-2.5 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
            {QUICK_EMOTES.map((emote) => (
              <button
                key={emote}
                onClick={() => onSendEmote(emote)}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-800/80 hover:bg-indigo-600/30 hover:border-indigo-500/50 border border-slate-700/60 text-slate-300 hover:text-indigo-200 transition-all shrink-0 active:scale-95"
              >
                {emote}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
