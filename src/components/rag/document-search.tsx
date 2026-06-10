'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, FileText, ChevronDown, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchResult {
  id: string;
  filename: string;
  chunkIndex: number;
  snippet: string;
  score: number;
  content: string;
}

interface DocumentSearchProps {
  onSelectChunk: (content: string) => void;
}

export function DocumentSearch({ onSelectChunk }: DocumentSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setIsExpanded(false);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/documents/search?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setIsExpanded((data.results || []).length > 0);
      }
    } catch {
      // ignore
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(val);
    }, 300);
  }, [doSearch]);

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setIsExpanded(false);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const highlightSnippet = (snippet: string, q: string) => {
    if (!q.trim()) return snippet;
    const terms = q.toLowerCase().split(/\s+/).filter(t => t.length > 1);
    if (terms.length === 0) return snippet;

    // Simple highlight: wrap matching terms in a mark
    let result = snippet;
    for (const term of terms) {
      const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      result = result.replace(regex, '§§$1§§');
    }
    const parts = result.split('§§');
    return parts.map((part, i) => {
      const isMatch = terms.some(t => part.toLowerCase() === t);
      if (isMatch) {
        return <mark key={i} className="bg-purple-500/25 text-purple-300 rounded px-0.5">{part}</mark>;
      }
      return part;
    });
  };

  return (
    <div className="relative">
      {/* Search input */}
      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder="Search documents..."
          className="w-full h-8 pl-7 pr-7 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-white/70 placeholder:text-white/50 focus:outline-none focus:border-purple-500/30 focus:bg-white/[0.06] focus:ring-1 focus:ring-purple-500/20 transition-all"
          aria-label="Search document content"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/[0.08] text-white/50 hover:text-white/65 transition-colors"
            aria-label="Clear search"
          >
            <X size={10} />
          </button>
        )}
        {isSearching && (
          <Loader2 size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-purple-400/50 animate-spin" />
        )}
      </div>

      {/* Search results */}
      <AnimatePresence>
        {isExpanded && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 flex flex-col gap-1 max-h-64 overflow-y-auto scroll-fade">
              <div className="flex items-center justify-between px-1">
                <span className="text-[9px] text-white/50 font-medium uppercase tracking-wider">
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-[9px] text-white/40 hover:text-white/60 transition-colors"
                >
                  Collapse
                </button>
              </div>
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => {
                    onSelectChunk(result.content);
                    handleClear();
                  }}
                  className="group/res text-left w-full rounded-lg bg-white/[0.04] border border-white/[0.06] hover:border-purple-500/15 hover:bg-white/[0.06] px-2.5 py-2 transition-all"
                  aria-label={`Use chunk from ${result.filename}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <FileText size={9} className="text-purple-400/50 shrink-0" />
                    <span className="text-[10px] text-white/70 truncate flex-1">{result.filename}</span>
                    <span className="text-[9px] px-1 py-0.5 rounded-md bg-purple-500/10 text-purple-400/60 font-medium shrink-0">
                      {Math.round(result.score * 100)}%
                    </span>
                  </div>
                  <p className="text-[10px] text-white/60 leading-relaxed line-clamp-2">
                    {highlightSnippet(result.snippet, query)}
                  </p>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
