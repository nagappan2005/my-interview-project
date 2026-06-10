'use client';

import React, { useCallback } from 'react';
import { useChatStore, ChatMessage } from '@/store/chat-store';
import { Bookmark, Sparkles, User, X, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatTime } from '@/lib/format';

interface BookmarkPanelProps {
  onClose?: () => void;
}

export function BookmarkPanel({ onClose }: BookmarkPanelProps) {
  const { messages, bookmarkedMessageIds, toggleBookmark } = useChatStore();

  // Get bookmarked messages in order
  const bookmarkedMessages = bookmarkedMessageIds
    .map((id) => messages.find((m) => m.id === id))
    .filter((m): m is ChatMessage => !!m);

  const handleScrollToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Brief highlight effect
      el.classList.add('ring-2', 'ring-purple-400/40', 'rounded-xl');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-purple-400/40', 'rounded-xl');
      }, 2000);
    }
    onClose?.();
  }, [onClose]);

  const handleRemoveBookmark = useCallback((e: React.MouseEvent, messageId: string) => {
    e.stopPropagation();
    toggleBookmark(messageId);
  }, [toggleBookmark]);

  const truncateText = (text: string, maxLen: number) => {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen).trim() + '...';
  };

  // Empty state
  if (bookmarkedMessages.length === 0) {
    return (
      <div className="p-4 flex flex-col items-center justify-center py-10">
        <div className="w-10 h-10 rounded-2xl bg-white/[0.05] border border-white/[0.05] flex items-center justify-center mb-3">
          <Bookmark size={18} className="text-white/40" />
        </div>
        <p className="text-xs text-white/60 mb-1">No bookmarked messages</p>
        <p className="text-[10px] text-white/40 text-center max-w-[200px]">
          Click the bookmark icon on any message to save it here for quick reference
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col max-h-80 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="shrink-0 px-3 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bookmark size={12} className="text-purple-400/60" />
          <span className="text-[11px] font-medium text-white/80">Bookmarks</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-400/70 font-medium">
            {bookmarkedMessages.length}
          </span>
        </div>
      </div>

      {/* Bookmarked messages list */}
      <div className="p-1.5 flex flex-col gap-0.5">
        <AnimatePresence>
          {bookmarkedMessages.map((message) => (
            <motion.button
              key={message.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
              onClick={() => handleScrollToMessage(message.id)}
              className="w-full text-left group/bm flex items-start gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[0.05] transition-colors"
              aria-label={`Jump to bookmarked ${message.role} message`}
            >
              {/* Role icon */}
              <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                message.role === 'assistant'
                  ? 'bg-purple-500/10 border border-purple-500/10'
                  : 'bg-white/[0.06] border border-white/[0.08]'
              }`}>
                {message.role === 'assistant'
                  ? <Sparkles size={9} className="text-purple-400/70" />
                  : <User size={9} className="text-white/60" />
                }
              </div>

              {/* Content preview */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-white/60 leading-snug break-words">
                  {truncateText(message.content, 80)}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Clock size={7} className="text-white/40" />
                  <span className="text-[9px] text-white/50">
                    {formatTime(message.timestamp)}
                  </span>
                  <span className="text-[9px] text-white/30">
                    {message.role === 'assistant' ? 'AI' : 'You'}
                  </span>
                </div>
              </div>

              {/* Remove bookmark button */}
              <button
                onClick={(e) => handleRemoveBookmark(e, message.id)}
                className="opacity-0 group-hover/bm:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/[0.08] text-white/40 hover:text-red-400/50 shrink-0"
                title="Remove bookmark"
                aria-label="Remove bookmark"
              >
                <X size={10} />
              </button>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
