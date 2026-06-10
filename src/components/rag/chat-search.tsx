'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatSearchProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  currentResultIndex: number;
  totalResults: number;
  onPrevResult: () => void;
  onNextResult: () => void;
}

export function ChatSearch({
  isOpen,
  onClose,
  searchQuery,
  onSearchChange,
  currentResultIndex,
  totalResults,
  onPrevResult,
  onNextResult,
}: ChatSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure animation starts before focus
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          onPrevResult();
        } else {
          onNextResult();
        }
      }
    },
    [onClose, onNextResult, onPrevResult]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="overflow-hidden shrink-0"
        >
          <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] border-b border-white/[0.06]">
            <Search size={13} className="text-purple-400/50 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search in conversation..."
              className="flex-1 bg-transparent text-xs text-white/70 placeholder:text-white/50 focus:outline-none"
            />
            {searchQuery && (
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] text-white/60 min-w-[50px] text-center">
                  {totalResults > 0
                    ? `${currentResultIndex + 1} of ${totalResults}`
                    : 'No matches'}
                </span>
                <button
                  onClick={onPrevResult}
                  disabled={totalResults === 0}
                  className="p-0.5 rounded hover:bg-white/[0.08] text-white/60 hover:text-white/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Previous match (Shift+Enter)"
                >
                  <ChevronUp size={13} />
                </button>
                <button
                  onClick={onNextResult}
                  disabled={totalResults === 0}
                  className="p-0.5 rounded hover:bg-white/[0.08] text-white/60 hover:text-white/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Next match (Enter)"
                >
                  <ChevronDown size={13} />
                </button>
                <div className="w-px h-3.5 bg-white/[0.08] mx-0.5" />
                <button
                  onClick={onClose}
                  className="p-0.5 rounded hover:bg-white/[0.08] text-white/60 hover:text-white/60 transition-colors"
                  title="Close search (Escape)"
                >
                  <X size={13} />
                </button>
              </div>
            )}
            {!searchQuery && (
              <button
                onClick={onClose}
                className="p-0.5 rounded hover:bg-white/[0.08] text-white/60 hover:text-white/60 transition-colors"
                title="Close search (Escape)"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
