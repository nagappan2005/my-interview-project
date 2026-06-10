'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DocumentInfo } from '@/store/chat-store';
import { ChevronDown, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────────────────────
interface TermDocument {
  filename: string;
  count: number;
}

interface TermAnalysis {
  term: string;
  count: number;
  documents: TermDocument[];
}

interface AnalysisResponse {
  terms: TermAnalysis[];
  totalTerms: number;
  uniqueTerms: number;
}

interface DocumentWordCloudProps {
  documents: DocumentInfo[];
}

// ─── Purple gradient opacity values for word cloud ──────────────────────
const PURPLE_OPACITIES = [
  'text-purple-400/90',
  'text-purple-400/80',
  'text-purple-400/70',
  'text-purple-400/60',
  'text-purple-400/50',
  'text-purple-300/80',
  'text-purple-300/70',
  'text-purple-300/60',
  'text-purple-500/70',
  'text-purple-500/60',
  'text-purple-500/50',
  'text-violet-400/70',
  'text-violet-400/60',
  'text-violet-300/60',
  'text-fuchsia-400/50',
];

// ─── Skeleton Loading ───────────────────────────────────────────────────
function SkeletonCloud() {
  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="skeleton rounded-md"
            style={{
              width: `${40 + Math.random() * 60}px`,
              height: `${14 + Math.random() * 14}px`,
            }}
          />
        ))}
      </div>
      <div className="space-y-2 mt-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="skeleton h-3 w-16 rounded" />
            <div className="flex-1 skeleton h-1 rounded-full" />
            <div className="skeleton h-3 w-6 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Word Cloud Item ────────────────────────────────────────────────────
function CloudWord({
  term,
  count,
  maxCount,
  index,
  isSelected,
  onSelect,
}: {
  term: string;
  count: number;
  maxCount: number;
  index: number;
  isSelected: boolean;
  onSelect: (term: string) => void;
}) {
  // Scale font size: min 10px, max 28px based on frequency
  const ratio = maxCount > 0 ? count / maxCount : 0;
  const fontSize = 10 + ratio * 18;

  // Pick a purple shade based on index for variety
  const colorClass = PURPLE_OPACITIES[index % PURPLE_OPACITIES.length];

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.3,
        delay: index * 0.03,
        ease: [0.16, 1, 0.3, 1],
      }}
      onClick={() => onSelect(isSelected ? '' : term)}
      className={`
        relative cursor-pointer transition-all duration-200 rounded-md px-1.5 py-0.5
        hover:bg-purple-400/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-400/40
        ${isSelected ? 'bg-purple-400/15 ring-1 ring-purple-400/30' : ''}
      `}
      style={{ fontSize: `${fontSize}px` }}
      aria-label={`${term}: ${count} occurrences`}
    >
      <span className={`font-medium ${colorClass} transition-opacity duration-200`}>
        {term}
      </span>
      {/* Hover tooltip showing count */}
      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] text-white/70 bg-black/80 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10" />
    </motion.button>
  );
}

// ─── Term Bar Item ──────────────────────────────────────────────────────
function TermBar({
  term,
  count,
  maxCount,
  index,
  isSelected,
  onSelect,
}: {
  term: string;
  count: number;
  maxCount: number;
  index: number;
  isSelected: boolean;
  onSelect: (term: string) => void;
}) {
  const widthPct = maxCount > 0 ? (count / maxCount) * 100 : 0;

  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.25,
        delay: 0.1 + index * 0.03,
        ease: [0.16, 1, 0.3, 1],
      }}
      onClick={() => onSelect(isSelected ? '' : term)}
      className={`
        w-full flex items-center gap-2 py-1 px-1.5 rounded-md transition-colors duration-200
        hover:bg-white/[0.05] cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-400/40
        ${isSelected ? 'bg-purple-400/[0.08]' : ''}
      `}
      aria-label={`${term}: ${count} occurrences`}
    >
      <span className="text-[10px] text-white/80 w-20 text-left truncate font-mono">
        {term}
      </span>
      <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${widthPct}%` }}
          transition={{
            duration: 0.5,
            delay: 0.2 + index * 0.03,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="h-full rounded-full bg-purple-400/30"
        />
      </div>
      <span className="text-[9px] text-white/55 w-6 text-right tabular-nums">
        {count}
      </span>
    </motion.button>
  );
}

// ─── Document Breakdown ─────────────────────────────────────────────────
function DocumentBreakdown({
  termData,
}: {
  termData: TermAnalysis;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden"
    >
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2 mt-2">
        <p className="text-[9px] text-white/60 uppercase tracking-wider mb-1.5">
          &ldquo;{termData.term}&rdquo; in documents
        </p>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {termData.documents.map((doc, i) => (
            <motion.div
              key={doc.filename}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
              className="flex items-center gap-2"
            >
              <span className="text-[9px] text-white/70 truncate flex-1">
                {doc.filename}
              </span>
              <span className="text-[9px] text-purple-400/50 font-mono tabular-nums">
                {doc.count}×
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────
export function DocumentWordCloud({ documents }: DocumentWordCloudProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState('');

  // Fetch analysis data
  const fetchAnalysis = useCallback(async () => {
    // Only fetch when there are documents
    const hasReadyDocs = documents.some((d) => d.status === 'ready');
    if (!hasReadyDocs) {
      setAnalysis(null);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/documents/analyze');
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
      }
    } catch (error) {
      console.error('Failed to fetch word analysis:', error);
    } finally {
      setIsLoading(false);
    }
  }, [documents]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  // Don't render if no documents
  const readyDocs = documents.filter((d) => d.status === 'ready');
  if (readyDocs.length === 0) return null;

  // Don't render if analysis came back empty
  if (!isLoading && analysis && analysis.terms.length === 0) return null;

  const maxCount = analysis?.terms[0]?.count ?? 0;
  const top15Terms = analysis?.terms.slice(0, 15) ?? [];

  // Find selected term data for document breakdown
  const selectedTermData = analysis?.terms.find(
    (t) => t.term === selectedTerm
  );

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/[0.04] transition-colors"
        aria-expanded={isExpanded}
        aria-label="Content Analysis panel"
      >
        <div className="flex items-center gap-1.5">
          <Sparkles size={10} className="text-purple-400/60" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
            Content Analysis
          </span>
          {analysis && analysis.uniqueTerms > 0 && (
            <span className="text-[8px] text-white/40 ml-1">
              {analysis.uniqueTerms} terms
            </span>
          )}
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={12} className="text-white/50" />
        </motion.div>
      </button>

      {/* Expandable Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              {isLoading ? (
                <SkeletonCloud />
              ) : analysis ? (
                <div className="space-y-3">
                  {/* Word Cloud */}
                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3">
                    <p className="text-[8px] text-white/50 uppercase tracking-wider mb-2">
                      Word Cloud
                    </p>
                    <div className="flex flex-wrap gap-1.5 items-center justify-center min-h-[60px]">
                      {analysis.terms.map((t, i) => (
                        <CloudWord
                          key={t.term}
                          term={t.term}
                          count={t.count}
                          maxCount={maxCount}
                          index={i}
                          isSelected={selectedTerm === t.term}
                          onSelect={setSelectedTerm}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Document Breakdown for Selected Term */}
                  <AnimatePresence>
                    {selectedTermData && (
                      <DocumentBreakdown termData={selectedTermData} />
                    )}
                  </AnimatePresence>

                  {/* Divider */}
                  <div className="h-px bg-white/[0.06]" />

                  {/* Top Terms List */}
                  <div>
                    <p className="text-[8px] text-white/50 uppercase tracking-wider mb-1.5">
                      Top Terms
                    </p>
                    <div className="space-y-0">
                      {top15Terms.map((t, i) => (
                        <TermBar
                          key={t.term}
                          term={t.term}
                          count={t.count}
                          maxCount={maxCount}
                          index={i}
                          isSelected={selectedTerm === t.term}
                          onSelect={setSelectedTerm}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Summary stats */}
                  {analysis.totalTerms > 0 && (
                    <div className="flex items-center gap-3 text-[8px] text-white/40">
                      <span>{analysis.totalTerms} total words</span>
                      <span>•</span>
                      <span>{analysis.uniqueTerms} unique</span>
                      <span>•</span>
                      <span>Top 30 shown in cloud</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 text-center text-[10px] text-white/50">
                  No analysis available
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
