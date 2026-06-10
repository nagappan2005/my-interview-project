'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { DocumentInfo } from '@/store/chat-store';
import { formatFileSize } from '@/lib/format';
import { ChevronDown, FileText, File, Database, HardDrive, Hash, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Animated Counter Hook ──────────────────────────────────────────────
function useAnimatedNumber(target: number, duration: number = 800) {
  const [current, setCurrent] = useState(0);
  const rafRef = React.useRef<number | null>(null);

  useEffect(() => {
    // Cancel any previous animation
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(target * eased);

      // Use functional update to avoid stale closure
      setCurrent(() => value);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, duration]);

  return current;
}

// ─── Mini Bar Chart (PDF vs TXT ratio) ──────────────────────────────────
function MiniBarChart({ pdfCount, txtCount }: { pdfCount: number; txtCount: number }) {
  const total = pdfCount + txtCount;
  if (total === 0) {
    return (
      <div className="flex items-end gap-1 h-8">
        <div className="flex-1 bg-white/[0.05] rounded-sm h-full" />
        <div className="flex-1 bg-white/[0.05] rounded-sm h-full" />
      </div>
    );
  }

  const pdfPct = (pdfCount / total) * 100;
  const txtPct = (txtCount / total) * 100;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end gap-1 h-8">
        {/* PDF bar */}
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: `${Math.max(pdfPct, 4)}%` }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 bg-red-400/20 rounded-sm relative group/bar min-h-[3px]"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-red-400/30 to-red-400/10 rounded-sm" />
        </motion.div>
        {/* TXT bar */}
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: `${Math.max(txtPct, 4)}%` }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 bg-blue-400/20 rounded-sm relative min-h-[3px]"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-blue-400/30 to-blue-400/10 rounded-sm" />
        </motion.div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5">
          <div className="w-1.5 h-1.5 rounded-[1px] bg-red-400/40" />
          <span className="text-[8px] text-white/50">PDF</span>
        </div>
        <div className="flex items-center gap-0.5">
          <div className="w-1.5 h-1.5 rounded-[1px] bg-blue-400/40" />
          <span className="text-[8px] text-white/50">TXT</span>
        </div>
      </div>
    </div>
  );
}

// ─── Mini Progress Ring (Ready vs Total) ────────────────────────────────
function MiniProgressRing({ ready, total }: { ready: number; total: number }) {
  const percentage = total > 0 ? (ready / total) * 100 : 0;
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative w-9 h-9 flex items-center justify-center">
      <svg
        className="w-9 h-9 -rotate-90"
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background ring */}
        <circle
          cx="18"
          cy="18"
          r={radius}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="2.5"
          fill="none"
        />
        {/* Progress arc */}
        <motion.circle
          cx="18"
          cy="18"
          r={radius}
          stroke="rgba(167, 139, 250, 0.5)"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <span className="absolute text-[8px] font-medium text-purple-400/60">
        {total > 0 ? Math.round(percentage) : 0}%
      </span>
    </div>
  );
}

// ─── Stat Item ──────────────────────────────────────────────────────────
function StatItem({
  icon: Icon,
  label,
  value,
  sub,
  delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-2 py-1"
    >
      <div className="w-5 h-5 rounded-md bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
        <Icon size={9} className="text-purple-400/60" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-white/60">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-[11px] font-semibold text-white/70">{value}</span>
          {sub && <span className="text-[9px] text-white/50">{sub}</span>}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────
interface DocumentStatsProps {
  documents: DocumentInfo[];
}

export function DocumentStats({ documents }: DocumentStatsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Compute stats
  const stats = useMemo(() => {
    const totalDocs = documents.length;
    const pdfCount = documents.filter((d) => d.fileType === 'pdf').length;
    const txtCount = documents.filter((d) => d.fileType === 'txt').length;
    const totalChunks = documents.reduce((sum, d) => sum + d.chunkCount, 0);
    const totalSize = documents.reduce((sum, d) => sum + d.fileSize, 0);
    const avgChunks = totalDocs > 0 ? Math.round(totalChunks / totalDocs) : 0;
    const readyCount = documents.filter((d) => d.status === 'ready').length;
    const processingCount = documents.filter((d) => d.status === 'processing').length;
    const errorCount = documents.filter((d) => d.status === 'error').length;

    return {
      totalDocs,
      pdfCount,
      txtCount,
      totalChunks,
      totalSize,
      avgChunks,
      readyCount,
      processingCount,
      errorCount,
    };
  }, [documents]);

  // Animated values
  const animatedTotalDocs = useAnimatedNumber(stats.totalDocs);
  const animatedTotalChunks = useAnimatedNumber(stats.totalChunks);
  const animatedAvgChunks = useAnimatedNumber(stats.avgChunks);

  // Don't render if no documents
  if (documents.length === 0) return null;

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/[0.04] transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Activity size={10} className="text-purple-400/60" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/60">
            Statistics
          </span>
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
            <div className="px-3 pb-3 space-y-2">
              {/* Top row: Visual charts side by side */}
              <div className="flex gap-3">
                {/* Mini Bar Chart — PDF vs TXT */}
                <div className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg p-2">
                  <p className="text-[8px] text-white/50 mb-1 uppercase tracking-wider">File Types</p>
                  <MiniBarChart pdfCount={stats.pdfCount} txtCount={stats.txtCount} />
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] font-semibold text-red-400/50">{stats.pdfCount}</span>
                    <span className="text-[10px] font-semibold text-blue-400/50">{stats.txtCount}</span>
                  </div>
                </div>

                {/* Mini Progress Ring — Ready Status */}
                <div className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg p-2 flex flex-col items-center">
                  <p className="text-[8px] text-white/50 mb-1 uppercase tracking-wider">Ready</p>
                  <MiniProgressRing ready={stats.readyCount} total={stats.totalDocs} />
                  <p className="text-[9px] text-white/50 mt-0.5">
                    {stats.readyCount}/{stats.totalDocs} docs
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-white/[0.06]" />

              {/* Stat items */}
              <div className="space-y-0">
                <StatItem
                  icon={FileText}
                  label="Total Documents"
                  value={String(animatedTotalDocs)}
                  sub={`PDF vs TXT`}
                  delay={0.1}
                />
                <StatItem
                  icon={Database}
                  label="Total Chunks"
                  value={String(animatedTotalChunks)}
                  sub="indexed"
                  delay={0.15}
                />
                <StatItem
                  icon={HardDrive}
                  label="Storage Used"
                  value={formatFileSize(stats.totalSize)}
                  delay={0.2}
                />
                <StatItem
                  icon={Hash}
                  label="Avg Chunks/Doc"
                  value={String(animatedAvgChunks)}
                  delay={0.25}
                />
              </div>

              {/* Status breakdown badges */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {stats.readyCount > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400/50 border border-emerald-500/10">
                    {stats.readyCount} ready
                  </span>
                )}
                {stats.processingCount > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400/50 border border-amber-500/10">
                    {stats.processingCount} processing
                  </span>
                )}
                {stats.errorCount > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-400/50 border border-red-500/10">
                    {stats.errorCount} error{stats.errorCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
