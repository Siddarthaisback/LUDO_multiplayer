import React, { useState } from 'react';
import { X, Send, MessageCircle } from 'lucide-react';
import { soundEffects } from '../../engine/soundEffects';
import { triggerHaptic } from '../../utils/haptics';

interface QuickChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (message?: string, emoji?: string) => void;
}

const QUICK_EMOJIS = ['😂', '😭', '🔥', '👑', '💣', '🎲', '👏', '💀'];

const QUICK_TAUNTS = [
  'Chito chal yar! ⏳',
  'Aba marxa! 🎯',
  'Kasto 6 aako! 🎲',
  'Bhaag! 🏃',
  'Hahaha 😂',
  'GG! 👑',
  'Ek chance deu na 🙏',
  'Dhunga pugyo! 🚀',
  'Oops! 🙊',
  'Lucky roll! 🍀',
];

export const QuickChatModal: React.FC<QuickChatModalProps> = ({
  isOpen,
  onClose,
  onSend,
}) => {
  const [customText, setCustomText] = useState('');

  if (!isOpen) return null;

  const handleSelectEmoji = (emoji: string) => {
    triggerHaptic('tap');
    soundEffects.playPop();
    onSend(undefined, emoji);
    onClose();
  };

  const handleSelectTaunt = (taunt: string) => {
    triggerHaptic('tap');
    soundEffects.playPop();
    onSend(taunt, undefined);
    onClose();
  };

  const handleSendCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customText.trim();
    if (!trimmed) return;
    triggerHaptic('tap');
    soundEffects.playPop();
    onSend(trimmed, undefined);
    setCustomText('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/30 rounded-3xl p-4 sm:p-5 shadow-2xl text-slate-100 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-amber-300">
                Quick Banter & Emojis
              </h3>
              <p className="text-[11px] text-slate-400">Tap to react across all players</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Emoji Reaction Grid */}
        <div>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Reactions
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleSelectEmoji(emoji)}
                className="h-11 rounded-2xl bg-slate-800/80 hover:bg-amber-500/20 border border-slate-700/60 hover:border-amber-400/60 text-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Nepali & English Banter Phrases */}
        <div>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Quick Banter
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
            {QUICK_TAUNTS.map((taunt) => (
              <button
                key={taunt}
                onClick={() => handleSelectTaunt(taunt)}
                className="px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/60 hover:border-amber-400/40 text-left text-xs font-semibold text-slate-200 transition-all hover:translate-x-0.5 active:scale-95 truncate"
              >
                {taunt}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Custom Chat Input */}
        <form onSubmit={handleSendCustom} className="flex items-center gap-2 pt-1 border-t border-slate-800">
          <input
            type="text"
            maxLength={60}
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Type your own message..."
            className="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            disabled={!customText.trim()}
            className="px-3 py-2 rounded-xl bg-amber-500 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-bold text-xs flex items-center gap-1 transition-all hover:brightness-110 active:scale-95 cursor-pointer disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
