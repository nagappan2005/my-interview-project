'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, FileText, ArrowRight } from 'lucide-react';
import type { DocumentInfo } from '@/store/chat-store';

// ─── Types ────────────────────────────────────────────────────────────────

interface Suggestion {
  id: string;
  text: string;
  category: 'document' | 'smart' | 'document-specific' | 'general';
  icon: React.ReactNode;
}

export interface ChatAutoSuggestProps {
  input: string;
  documents: DocumentInfo[];
  onSelect: (suggestion: string) => void;
  visible: boolean;
  onClose: () => void;
}

// ─── Suggestion Engine ─────────────────────────────────────────────────────

/** Extract a clean keyword from a filename, e.g. "annual-report.pdf" → "annual report" */
function extractKeywordFromFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '') // strip extension
    .replace(/[_-]+/g, ' ') // replace separators with spaces
    .replace(/\s+/g, ' ')   // collapse whitespace
    .trim();
}

/** Predefined suggestion templates */
const SMART_TEMPLATES = [
  'Explain the key concepts',
  'What conclusions are drawn?',
  'What are the main takeaways?',
  'What methodology is used?',
  'What evidence supports the claims?',
];

const GENERAL_TEMPLATES = [
  'Summarize the uploaded documents',
  'Compare the documents',
  'What are the common themes?',
  'List all key terms and definitions',
];

const DOC_TEMPLATES = [
  'What are the main topics in {doc}?',
  'Summarize {doc}',
  'What does {doc} say about...?',
  'Explain the key concepts in {doc}',
  'What are the main findings in {doc}?',
];

/** Load recent user questions from localStorage */
function loadRecentQuestions(): string[] {
  try {
    const raw = localStorage.getItem('docqa-messages');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const userMsgs = parsed
      .filter((m: { role: string }) => m.role === 'user')
      .map((m: { content: string }) => m.content)
      .reverse(); // most recent first
    // Deduplicate
    const seen = new Set<string>();
    return userMsgs.filter((q: string) => {
      if (seen.has(q)) return false;
      seen.add(q);
      return true;
    }).slice(0, 5);
  } catch {
    return [];
  }
}

/** Build suggestions based on input, documents, and recent history */
function buildSuggestions(
  input: string,
  documents: DocumentInfo[],
  recentQuestions: string[]
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const lowerInput = input.toLowerCase().trim();
  const readyDocs = documents.filter((d) => d.status === 'ready' && d.enabled !== false);
  const docKeywords = readyDocs.map((d) => ({
    id: d.id,
    keyword: extractKeywordFromFilename(d.filename),
    filename: d.filename,
  }));

  // ── 1. Recent questions that match the input ──
  if (lowerInput.length > 0) {
    recentQuestions.forEach((q) => {
      const lowerQ = q.toLowerCase();
      if (lowerQ.includes(lowerInput) || lowerInput.includes(lowerQ.slice(0, Math.min(lowerInput.length, 10)))) {
        suggestions.push({
          id: `recent-${q}`,
          text: q,
          category: 'smart',
          icon: <Search size={13} className="text-white/60" />,
        });
      }
    });
  }

  // ── 2. Document-specific suggestions ──
  if (readyDocs.length > 0) {
    // If input partially matches a document keyword, suggest document-specific queries
    const matchedDocs = lowerInput.length > 0
      ? docKeywords.filter((dk) =>
          dk.keyword.toLowerCase().includes(lowerInput) ||
          lowerInput.includes(dk.keyword.toLowerCase().split(' ')[0])
        )
      : docKeywords;

    matchedDocs.slice(0, 2).forEach((dk) => {
      DOC_TEMPLATES.slice(0, 2).forEach((template) => {
        const text = template.replace('{doc}', dk.filename);
        suggestions.push({
          id: `doc-${dk.id}-${template.slice(0, 10)}`,
          text,
          category: 'document-specific',
          icon: <FileText size={13} className="text-purple-400/50" />,
        });
      });
    });
  }

  // ── 3. Smart query suggestions ──
  SMART_TEMPLATES.forEach((template) => {
    const lowerTemplate = template.toLowerCase();
    const matches = lowerInput.length === 0 || lowerTemplate.includes(lowerInput) || lowerInput.split(' ').some((word) => word.length > 2 && lowerTemplate.includes(word));
    if (matches) {
      suggestions.push({
        id: `smart-${template}`,
        text: template,
        category: 'smart',
        icon: <Sparkles size={13} className="text-amber-400/50" />,
      });
    }
  });

  // ── 4. General suggestions (when no input) ──
  if (lowerInput.length === 0 && readyDocs.length > 0) {
    GENERAL_TEMPLATES.forEach((template) => {
      suggestions.push({
        id: `general-${template}`,
        text: template,
        category: 'general',
        icon: <ArrowRight size={13} className="text-emerald-400/50" />,
      });
    });
  }

  // ── Deduplicate by text ──
  const seen = new Set<string>();
  const unique = suggestions.filter((s) => {
    if (seen.has(s.text)) return false;
    seen.add(s.text);
    return true;
  });

  // ── Score & sort: prefer matches that start with the input ──
  if (lowerInput.length > 0) {
    unique.sort((a, b) => {
      const aStarts = a.text.toLowerCase().startsWith(lowerInput) ? 0 : 1;
      const bStarts = b.text.toLowerCase().startsWith(lowerInput) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      // Then prefer document-specific
      const catOrder: Record<string, number> = { 'document-specific': 0, document: 1, smart: 2, general: 3 };
      return (catOrder[a.category] ?? 4) - (catOrder[b.category] ?? 4);
    });
  }

  return unique.slice(0, 5);
}

// ─── Highlight Matching Portion ────────────────────────────────────────────

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) {
    // Try matching individual words
    const words = lowerQuery.split(/\s+/).filter((w) => w.length > 1);
    if (words.length > 0) {
      // Find first matching word
      for (const word of words) {
        const wordIndex = lowerText.indexOf(word);
        if (wordIndex !== -1) {
          return (
            <>
              {text.slice(0, wordIndex)}
              <span className="text-white/90 font-medium">
                {text.slice(wordIndex, wordIndex + word.length)}
              </span>
              {text.slice(wordIndex + word.length)}
            </>
          );
        }
      }
    }
    return <>{text}</>;
  }

  return (
    <>
      {text.slice(0, index)}
      <span className="text-white/90 font-medium">
        {text.slice(index, index + lowerQuery.length)}
      </span>
      {text.slice(index + lowerQuery.length)}
    </>
  );
}

// ─── Category Badge ────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: Suggestion['category'] }) {
  const styles: Record<string, string> = {
    'document-specific': 'text-purple-400/60 bg-purple-500/10',
    document: 'text-purple-400/60 bg-purple-500/10',
    smart: 'text-amber-400/60 bg-amber-500/10',
    general: 'text-emerald-400/60 bg-emerald-500/10',
  };
  const labels: Record<string, string> = {
    'document-specific': 'Doc',
    document: 'Doc',
    smart: 'Smart',
    general: 'General',
  };

  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium ${styles[category] || 'text-white/60 bg-white/[0.06]'}`}>
      {labels[category] || category}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────

export function ChatAutoSuggest({ input, documents, onSelect, visible, onClose }: ChatAutoSuggestProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [prevInput, setPrevInput] = useState(input);
  const listRef = useRef<HTMLDivElement>(null);

  // Adjust selectedIndex when input changes (React-recommended pattern for derived state)
  // See: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (prevInput !== input) {
    setPrevInput(input);
    setSelectedIndex(0);
  }

  // Compute suggestions directly — load recent questions inline since localStorage is synchronous
  const recentQuestions = visible ? loadRecentQuestions() : [];
  const suggestions = buildSuggestions(input, documents, recentQuestions);

  // Clamp selectedIndex to valid range
  const effectiveIndex = suggestions.length > 0 ? Math.min(selectedIndex, suggestions.length - 1) : 0;

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!visible || suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % suggestions.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (suggestions[effectiveIndex]) {
            onSelect(suggestions[effectiveIndex].text);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [visible, suggestions, effectiveIndex, onSelect, onClose]
  );

  // Expose keyboard handler via a custom event so parent can delegate
  useEffect(() => {
    const handler = (e: Event) => {
      const ke = (e as CustomEvent).detail as React.KeyboardEvent;
      handleKeyDown(ke);
    };
    window.addEventListener('docqa:autosuggest:keydown', handler);
    return () => window.removeEventListener('docqa:autosuggest:keydown', handler);
  }, [handleKeyDown]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector(`[data-index="${effectiveIndex}"]`);
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [effectiveIndex]);

  // Don't render if not visible or no suggestions
  if (!visible || suggestions.length === 0) return null;

  return (
    <AnimatePresence>
      {visible && suggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.98 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="absolute bottom-full left-0 right-12 mb-2 z-50"
        >
          <div className="bg-[#161923]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
            {/* Header */}
            <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] text-white/55">
                <Sparkles size={10} className="text-purple-400/60" />
                <span>Suggestions</span>
              </div>
              <div className="flex items-center gap-2 text-[9px] text-white/40">
                <span className="flex items-center gap-0.5">
                  <kbd className="inline-flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-[3px] bg-white/[0.06] border border-white/[0.08] text-[8px] font-mono">↑</kbd>
                  <kbd className="inline-flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-[3px] bg-white/[0.06] border border-white/[0.08] text-[8px] font-mono">↓</kbd>
                  <span className="ml-0.5">navigate</span>
                </span>
                <span className="flex items-center gap-0.5">
                  <kbd className="inline-flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-[3px] bg-white/[0.06] border border-white/[0.08] text-[8px] font-mono">↵</kbd>
                  <span className="ml-0.5">select</span>
                </span>
                <span className="flex items-center gap-0.5">
                  <kbd className="inline-flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-[3px] bg-white/[0.06] border border-white/[0.08] text-[8px] font-mono">esc</kbd>
                  <span className="ml-0.5">close</span>
                </span>
              </div>
            </div>

            {/* Suggestion List */}
            <div ref={listRef} className="max-h-64 overflow-y-auto py-1" role="listbox" aria-label="Chat suggestions">
              {suggestions.map((suggestion, index) => (
                <motion.button
                  key={suggestion.id}
                  data-index={index}
                  role="option"
                  aria-selected={index === effectiveIndex}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03, duration: 0.12 }}
                  onClick={() => onSelect(suggestion.text)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`
                    w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all duration-100
                    ${index === effectiveIndex
                      ? 'bg-purple-500/10 text-white/90'
                      : 'text-white/60 hover:bg-white/[0.05] hover:text-white/75'
                    }
                  `}
                >
                  {/* Icon */}
                  <span className={`shrink-0 w-6 h-6 rounded-lg flex items-center justify-center border transition-colors ${
                    index === effectiveIndex
                      ? 'bg-purple-500/15 border-purple-500/20'
                      : 'bg-white/[0.05] border-white/[0.05]'
                  }`}>
                    {suggestion.icon}
                  </span>

                  {/* Text with highlight */}
                  <span className="flex-1 text-xs truncate">
                    <HighlightedText text={suggestion.text} query={input} />
                  </span>

                  {/* Category badge */}
                  <CategoryBadge category={suggestion.category} />

                  {/* Arrow indicator for selected */}
                  {index === effectiveIndex && (
                    <ArrowRight size={11} className="text-purple-400/50 shrink-0" />
                  )}
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
