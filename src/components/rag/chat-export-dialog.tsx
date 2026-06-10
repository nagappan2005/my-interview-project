'use client';

import React, { useState, useCallback } from 'react';
import { ChatMessage } from '@/store/chat-store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Download,
  FileText,
  FileDown,
  MessageSquare,
  BookOpen,
  Clock,
  Sparkles,
  Loader2,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

interface ChatExportDialogProps {
  messages: ChatMessage[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExportFormat = 'pdf' | 'txt';

export function ChatExportDialog({ messages, open, onOpenChange }: ChatExportDialogProps) {
  const [includeSources, setIncludeSources] = useState(true);
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [isGenerating, setIsGenerating] = useState(false);

  // Compute stats for preview
  const totalMessages = messages.length;
  const totalSources = messages.reduce((sum, m) => sum + (m.sources?.length ?? 0), 0);
  const userMessages = messages.filter((m) => m.role === 'user').length;
  const assistantMessages = messages.filter((m) => m.role === 'assistant').length;
  // Calculate average from source scores (not message confidence which is a different metric)
  const avgConfidence = React.useMemo(() => {
    const allSourceScores: number[] = [];
    for (const m of messages) {
      if (m.role === 'assistant' && m.sources && m.sources.length > 0) {
        for (const s of m.sources) {
          if (s.score > 0) allSourceScores.push(s.score);
        }
      }
    }
    if (allSourceScores.length === 0) return 0;
    return allSourceScores.reduce((sum, s) => sum + s, 0) / allSourceScores.length;
  }, [messages]);

  const handleExport = useCallback(async () => {
    if (messages.length === 0) {
      toast.error('No messages to export');
      return;
    }

    setIsGenerating(true);

    try {
      const serializedMessages = messages.map((m) => ({
        ...m,
        timestamp:
          m.timestamp instanceof Date ? m.timestamp.toISOString() : String(m.timestamp),
      }));

      const response = await fetch('/api/chat/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: serializedMessages,
          options: {
            includeSources,
            includeTimestamps,
            format,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(data.error || 'Export failed');
      }

      if (format === 'pdf') {
        // Open the HTML in a new tab for printing to PDF
        const htmlBlob = await response.blob();
        const url = URL.createObjectURL(htmlBlob);
        const newWindow = window.open(url, '_blank');

        if (!newWindow) {
          // Fallback: create a link and click it
          const a = document.createElement('a');
          a.href = url;
          a.download = `docqa-export-${new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)}.html`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }

        // Clean up the object URL after a delay
        setTimeout(() => URL.revokeObjectURL(url), 60000);

        toast.success('Export opened in new tab — use Print to save as PDF');
      } else {
        // Download the TXT file
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const disposition = response.headers.get('Content-Disposition');
        const filenameMatch = disposition?.match(/filename="?(.+?)"?$/);
        const filename = filenameMatch
          ? filenameMatch[1]
          : `docqa-export-${new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)}.txt`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success('Chat exported as TXT');
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to export chat');
    } finally {
      setIsGenerating(false);
    }
  }, [messages, includeSources, includeTimestamps, format, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#161923] border-white/[0.08] text-white sm:max-w-[440px] p-0 gap-0 overflow-hidden"
        aria-label="Export chat conversation"
      >
        {/* Gradient accent top */}
        <div className="h-0.5 bg-gradient-to-r from-purple-500/0 via-purple-500/60 to-purple-500/0" />

        <DialogHeader className="p-5 pb-0">
          <DialogTitle className="text-white/90 text-base font-semibold flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-500/5 flex items-center justify-center border border-purple-500/15">
              <Download size={13} className="text-purple-400" />
            </div>
            Export Conversation
          </DialogTitle>
          <DialogDescription className="text-white/65 text-xs mt-1.5">
            Generate a formatted document of your chat conversation with sources and metadata.
          </DialogDescription>
        </DialogHeader>

        {/* Preview Stats */}
        <div className="px-5 pt-4">
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.05] p-3.5">
            <div className="text-[10px] text-white/55 uppercase tracking-wider font-medium mb-3">
              Export Preview
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center">
                <div className="text-lg font-bold text-purple-400/80">{totalMessages}</div>
                <div className="text-[9px] text-white/55 flex items-center justify-center gap-1 mt-0.5">
                  <MessageSquare size={7} />
                  Messages
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white/80">{userMessages}</div>
                <div className="text-[9px] text-white/55 mt-0.5">Questions</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white/80">{assistantMessages}</div>
                <div className="text-[9px] text-white/55 mt-0.5">Responses</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-emerald-400/70">
                  {includeSources ? totalSources : '—'}
                </div>
                <div className="text-[9px] text-white/55 flex items-center justify-center gap-1 mt-0.5">
                  <BookOpen size={7} />
                  Sources
                </div>
              </div>
            </div>
            {avgConfidence > 0 && (
              <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[10px] text-white/55 flex items-center gap-1.5">
                  <Sparkles size={8} className="text-purple-400/50" />
                  Avg. Confidence
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-purple-400/40 transition-all duration-300"
                      style={{ width: `${Math.round(avgConfidence * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-purple-400/50 font-mono">
                    {Math.round(avgConfidence * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Options */}
        <div className="px-5 pt-4 space-y-1">
          <div className="text-[10px] text-white/55 uppercase tracking-wider font-medium mb-2.5">
            Export Options
          </div>

          {/* Include Sources */}
          <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/[0.04] transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
                <BookOpen size={11} className="text-emerald-400/60" />
              </div>
              <div>
                <div className="text-xs text-white/70 font-medium">Include Sources</div>
                <div className="text-[10px] text-white/55">
                  Show document citations below responses
                </div>
              </div>
            </div>
            <Switch
              checked={includeSources}
              onCheckedChange={setIncludeSources}
              className="data-[state=checked]:bg-purple-500/70"
              aria-label="Include source citations in export"
            />
          </div>

          {/* Include Timestamps */}
          <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/[0.04] transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center">
                <Clock size={11} className="text-amber-400/60" />
              </div>
              <div>
                <div className="text-xs text-white/70 font-medium">Include Timestamps</div>
                <div className="text-[10px] text-white/55">
                  Show message time for each entry
                </div>
              </div>
            </div>
            <Switch
              checked={includeTimestamps}
              onCheckedChange={setIncludeTimestamps}
              className="data-[state=checked]:bg-purple-500/70"
              aria-label="Include timestamps in export"
            />
          </div>

          {/* Format Selection */}
          <div className="py-2.5 px-3">
            <div className="text-xs text-white/70 font-medium mb-2.5">Format</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setFormat('pdf')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border transition-all ${
                  format === 'pdf'
                    ? 'border-purple-500/30 bg-purple-500/[0.08] text-purple-300'
                    : 'border-white/[0.08] bg-white/[0.01] text-white/70 hover:border-white/[0.1] hover:bg-white/[0.05]'
                }`}
                aria-label="Export as PDF"
                aria-pressed={format === 'pdf'}
              >
                <FileText
                  size={14}
                  className={format === 'pdf' ? 'text-purple-400' : 'text-white/55'}
                />
                <div className="text-left">
                  <div className="text-xs font-medium">PDF</div>
                  <div className="text-[9px] text-white/55">Print-ready format</div>
                </div>
                {format === 'pdf' && (
                  <Check size={12} className="text-purple-400 ml-auto" />
                )}
              </button>
              <button
                onClick={() => setFormat('txt')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border transition-all ${
                  format === 'txt'
                    ? 'border-purple-500/30 bg-purple-500/[0.08] text-purple-300'
                    : 'border-white/[0.08] bg-white/[0.01] text-white/70 hover:border-white/[0.1] hover:bg-white/[0.05]'
                }`}
                aria-label="Export as plain text"
                aria-pressed={format === 'txt'}
              >
                <FileDown
                  size={14}
                  className={format === 'txt' ? 'text-purple-400' : 'text-white/55'}
                />
                <div className="text-left">
                  <div className="text-xs font-medium">TXT</div>
                  <div className="text-[9px] text-white/55">Plain text file</div>
                </div>
                {format === 'txt' && (
                  <Check size={12} className="text-purple-400 ml-auto" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-5 pt-3 flex-row gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="flex-1 text-white/70 hover:text-white/70 hover:bg-white/[0.06] text-xs h-9"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={isGenerating || messages.length === 0}
            className="flex-1 bg-gradient-to-r from-purple-500/30 to-purple-600/20 hover:from-purple-500/50 hover:to-purple-600/35 text-purple-200 border border-purple-500/20 hover:border-purple-500/30 text-xs h-9 shadow-md shadow-purple-500/5 disabled:opacity-40"
          >
            {isGenerating ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download size={12} />
                Export as {format.toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
