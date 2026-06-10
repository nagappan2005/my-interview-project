'use client';

import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useChatStore } from '@/store/chat-store';
import { FileUploadZone } from '@/components/rag/file-upload-zone';
import { ChatInterface } from '@/components/rag/chat-interface';
import { CommandPalette } from '@/components/rag/command-palette';
import { DocumentStats } from '@/components/rag/document-stats';
import { DocumentWordCloud } from '@/components/rag/document-word-cloud';
import { ChatExportDialog } from '@/components/rag/chat-export-dialog';
import { ConversationHistory } from '@/components/rag/conversation-history';
import { BookmarkPanel } from '@/components/rag/bookmark-panel';
import { ThemeToggle } from '@/components/rag/theme-toggle';
import { PanelLeftClose, PanelLeft, Sparkles, Trash2, Download, Circle, History, FileDown, Bookmark, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';

// ─── Storage Quota Indicator ──────────────────────────────────────────
function StorageQuotaIndicator() {
  const getStorageUsage = useChatStore((s) => s.getStorageUsage);
  const [usage, setUsage] = useState<{ usedBytes: number; totalBytes: number } | null>(null);

  useEffect(() => {
    const update = () => {
      try {
        const u = getStorageUsage();
        setUsage(u);
      } catch {
        // ignore
      }
    };
    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, [getStorageUsage]);

  if (!usage) return null;
  const percentage = Math.round((usage.usedBytes / usage.totalBytes) * 100);
  if (percentage < 50) return null; // Only show when > 50%

  const formatBytes = (b: number) => {
    if (b < 1024) return `${b}B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
    return `${(b / (1024 * 1024)).toFixed(1)}MB`;
  };

  const barColor = percentage > 80 ? 'bg-red-400/40' : percentage > 60 ? 'bg-amber-400/30' : 'bg-purple-400/25';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 cursor-default">
          <HardDrive size={8} className="text-muted-foreground/50" />
          <div className="w-12 h-1 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${percentage}%` }} />
          </div>
          <span className="text-[8px] text-muted-foreground/50">{percentage}%</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="bg-card border-border text-muted-foreground text-[10px]">
        {formatBytes(usage.usedBytes)} / {formatBytes(usage.totalBytes)} used
      </TooltipContent>
    </Tooltip>
  );
}

export default function HomePage() {
  const {
    sidebarOpen,
    setSidebarOpen,
    setDocuments,
    documents,
    messages,
    clearChat,
    bookmarkedMessageIds,
  } = useChatStore();

  // On desktop, default sidebar to open; on mobile, closed
  const [isMobile, setIsMobile] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [bookmarkOpen, setBookmarkOpen] = useState(false);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Use getState to avoid stale closure
      const currentlyOpen = useChatStore.getState().sidebarOpen;
      if (mobile && currentlyOpen) {
        setSidebarOpen(false);
      } else if (!mobile && !currentlyOpen && documents.length === 0) {
        // On desktop with no docs, open sidebar to encourage upload
        setSidebarOpen(true);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [documents.length, setSidebarOpen]);

  // Load documents on mount
  const loadDocuments = useCallback(async () => {
    try {
      const response = await fetch('/api/documents');
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  }, [setDocuments]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const readyDocCount = documents.filter((d) => d.status === 'ready' && d.enabled !== false).length;
  const totalChunks = documents.filter((d) => d.enabled !== false).reduce((sum, d) => sum + d.chunkCount, 0);

  // Ref for triggering file upload from command palette
  const fileInputTriggerRef = useRef<(() => void) | null>(null);

  const handleExportChat = useCallback(() => {
    if (messages.length === 0) return;
    setExportDialogOpen(true);
  }, [messages]);

  const handleUploadDocument = useCallback(() => {
    fileInputTriggerRef.current?.();
  }, []);

  const handlePrefillQuestion = useCallback((question: string) => {
    // Dispatch custom event that ChatInterface can listen to
    window.dispatchEvent(new CustomEvent('docqa:prefill', { detail: question }));
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-screen flex flex-col bg-background overflow-hidden relative" suppressHydrationWarning>
        {/* Command Palette */}
        <CommandPalette
          onNewConversation={clearChat}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onUploadDocument={handleUploadDocument}
          onExportChat={handleExportChat}
          onPrefillQuestion={handlePrefillQuestion}
        />

        {/* Chat Export Dialog */}
        <ChatExportDialog
          messages={messages}
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
        />

        {/* Phase 8: Morphing gradient mesh background overlay */}
        <div className="animate-mesh-gradient" aria-hidden="true" />

        {/* Phase 9: Aurora borealis background overlay */}
        <div className="animate-aurora" aria-hidden="true" />

        {/* Phase 8: Floating particles */}
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
          <div className="particle" style={{ left: '8%', animationDuration: '22s', animationDelay: '0s', width: '2px', height: '2px', background: 'rgba(167, 139, 250, 0.2)' }} />
          <div className="particle" style={{ left: '22%', animationDuration: '18s', animationDelay: '-4s', width: '3px', height: '3px', background: 'rgba(45, 212, 191, 0.15)' }} />
          <div className="particle" style={{ left: '45%', animationDuration: '26s', animationDelay: '-9s', width: '1.5px', height: '1.5px', background: 'rgba(167, 139, 250, 0.25)' }} />
          <div className="particle" style={{ left: '63%', animationDuration: '20s', animationDelay: '-2s', width: '2px', height: '2px', background: 'rgba(139, 92, 246, 0.2)' }} />
          <div className="particle" style={{ left: '78%', animationDuration: '24s', animationDelay: '-7s', width: '2.5px', height: '2.5px', background: 'rgba(167, 139, 250, 0.18)' }} />
          <div className="particle" style={{ left: '91%', animationDuration: '19s', animationDelay: '-12s', width: '1px', height: '1px', background: 'rgba(45, 212, 191, 0.2)' }} />
          <div className="particle" style={{ left: '35%', animationDuration: '28s', animationDelay: '-15s', width: '2px', height: '2px', background: 'rgba(167, 139, 250, 0.15)' }} />
        </div>

        {/* Decorative background gradient orbs — more atmospheric with different colors */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
          {/* Primary purple orb — top left */}
          <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-purple-500/[0.06] blur-[120px] animate-ambient" />
          {/* Secondary purple orb — bottom right */}
          <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-purple-500/[0.04] blur-[120px] animate-ambient" style={{ animationDelay: '-7s' }} />
          {/* Center large orb */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-purple-500/[0.02] blur-[200px] animate-ambient" style={{ animationDelay: '-13s' }} />
          {/* Teal/emerald accent orb — bottom left */}
          <div className="absolute bottom-0 left-1/4 w-80 h-80 rounded-full bg-emerald-500/[0.03] blur-[150px] animate-ambient" style={{ animationDelay: '-5s' }} />
          {/* Subtle violet accent — top right */}
          <div className="absolute top-0 right-1/4 w-72 h-72 rounded-full bg-violet-600/[0.025] blur-[130px] animate-ambient" style={{ animationDelay: '-10s' }} />
          {/* Rose accent — center bottom */}
          <div className="absolute bottom-1/4 right-1/3 w-64 h-64 rounded-full bg-rose-500/[0.015] blur-[140px] animate-ambient" style={{ animationDelay: '-16s' }} />
        </div>

        {/* Header */}
        <header className="shrink-0 z-20 relative">
          <div className="glass-strong header-pattern">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setSidebarOpen(!sidebarOpen)}
                      className="w-8 h-8 rounded-xl hover:bg-muted flex items-center justify-center transition-all text-muted-foreground hover:text-foreground/80 active:scale-95"
                      aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                    >
                      {sidebarOpen && !isMobile ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-card border-border text-muted-foreground text-[10px]">
                    {sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                  </TooltipContent>
                </Tooltip>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 flex items-center justify-center border border-purple-500/10 animate-gradient-border">
                    <Sparkles size={15} className="text-purple-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h1 className="text-sm font-semibold text-foreground/80 leading-tight tracking-tight accent-underline">
                        DocQA
                      </h1>
                      {readyDocCount > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Circle size={5} className="text-emerald-400 fill-emerald-400/60 animate-glow-pulse cursor-default" />
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="bg-card border-border text-muted-foreground text-[10px]">
                            {readyDocCount} document{readyDocCount !== 1 ? 's' : ''} ready
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      RAG-powered Document Assistant
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <ThemeToggle />

                {/* Document status badge */}
                {readyDocCount > 0 && (
                  <div className="hidden sm:flex items-center gap-2 text-[10px] text-emerald-400/60 bg-emerald-500/[0.08] border border-emerald-500/15 px-3 py-1.5 rounded-lg mr-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 animate-pulse" />
                    <span className="font-medium">{readyDocCount} doc{readyDocCount !== 1 ? 's' : ''}</span>
                    <span className="text-muted-foreground/50">•</span>
                    <span>{totalChunks} chunks</span>
                  </div>
                )}

                {/* Bookmark button */}
                <Popover open={bookmarkOpen} onOpenChange={setBookmarkOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 px-2.5 text-xs ${bookmarkedMessageIds.length > 0 ? 'text-purple-400/60 hover:text-purple-400/80 hover:bg-purple-500/[0.06] notification-dot' : 'text-muted-foreground hover:text-foreground/80 hover:bg-muted'}`}
                      aria-label="Bookmarked messages"
                    >
                      <Bookmark size={12} className="mr-1.5" />
                      <span className="hidden sm:inline">Bookmarks</span>
                      {bookmarkedMessageIds.length > 0 && (
                        <span className="ml-1 text-[9px] px-1 py-0.5 rounded-md bg-purple-500/15 text-purple-400/80 font-medium">
                          {bookmarkedMessageIds.length}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom"
                    align="end"
                    className="w-80 bg-card border-border p-0 shadow-2xl shadow-black/50 rounded-xl"
                  >
                    <BookmarkPanel onClose={() => setBookmarkOpen(false)} />
                  </PopoverContent>
                </Popover>

                {/* History button */}
                <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2.5 text-muted-foreground hover:text-foreground/80 hover:bg-muted text-xs notification-dot"
                      aria-label="Conversation history"
                    >
                      <History size={12} className="mr-1.5" />
                      <span className="hidden sm:inline">History</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom"
                    align="end"
                    className="w-80 bg-card border-border p-0 shadow-2xl shadow-black/50 rounded-xl"
                  >
                    <ConversationHistory onClose={() => setHistoryOpen(false)} />
                  </PopoverContent>
                </Popover>

                {messages.length > 0 && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleExportChat}
                          className="h-7 px-2.5 text-muted-foreground hover:text-foreground/80 hover:bg-muted text-xs"
                          aria-label="Export conversation"
                        >
                          <FileDown size={12} className="mr-1.5" />
                          <span className="hidden sm:inline">Export</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="bg-card border-border text-muted-foreground text-[10px]">
                        Export as PDF or TXT
                      </TooltipContent>
                    </Tooltip>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2.5 text-muted-foreground hover:text-foreground/80 hover:bg-muted text-xs"
                          aria-label="Clear conversation"
                        >
                          <Trash2 size={12} className="mr-1.5" />
                          <span className="hidden sm:inline">Clear</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card border-border">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-foreground/80">Clear conversation?</AlertDialogTitle>
                          <AlertDialogDescription className="text-muted-foreground">
                            This will remove all messages from the current conversation. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-muted border-border text-muted-foreground hover:bg-muted/80">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={clearChat}
                            className="bg-red-500/20 text-red-500 dark:text-red-400 hover:bg-red-500/30 border-0"
                          >
                            Clear
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            </div>
            {/* Animated gradient border bottom — more visible and fluid */}
            <div className="h-[2px] animate-gradient-line" />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex min-h-0 overflow-hidden relative z-10">
          {/* Desktop Sidebar - File Upload */}
          <aside
            className={`
              hidden md:flex shrink-0 transition-all duration-300 ease-out overflow-hidden relative
              ${sidebarOpen ? 'w-80' : 'w-0'}
            `}
          >
            {/* Vertical separator line */}
            <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-white/[0.08] via-white/[0.06] to-white/[0.08] pointer-events-none z-10" />
            <div className={`w-80 h-full p-4 flex flex-col gap-3 transition-opacity duration-200 ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              {/* Document Statistics Dashboard */}
              <DocumentStats documents={documents} />
              {/* Document Word Cloud / Content Analysis */}
              <DocumentWordCloud documents={documents} />
              {/* File Upload Zone */}
              <div className="flex-1 min-h-0">
                <FileUploadZone fileInputTriggerRef={fileInputTriggerRef} />
              </div>
            </div>
          </aside>

          {/* Mobile Sidebar - Sheet */}
          <Sheet open={sidebarOpen && isMobile} onOpenChange={(open) => { if (isMobile) setSidebarOpen(open); }}>
            <SheetContent
              side="left"
              className="w-80 bg-card border-border p-0"
            >
              <SheetHeader className="px-4 pt-4 pb-2">
                <SheetTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Sparkles size={14} className="text-purple-400" />
                  Documents
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Upload and manage your documents for Q&A
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-4 flex-1 overflow-y-auto">
                {/* Document Statistics on mobile */}
                <div className="mb-3">
                  <DocumentStats documents={documents} />
                </div>
                {/* Document Word Cloud on mobile */}
                <div className="mb-3">
                  <DocumentWordCloud documents={documents} />
                </div>
                <FileUploadZone fileInputTriggerRef={fileInputTriggerRef} />
              </div>
            </SheetContent>
          </Sheet>

          {/* Chat Panel */}
          <section className="flex-1 min-w-0 spotlight-cursor" onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`); e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`); }}>
            <ChatInterface />
          </section>
        </main>

        {/* Footer bar with keyboard shortcuts */}
        <footer className="shrink-0 z-20 relative">
          {/* Phase 8: Subtle gradient progress indicator at top of footer */}
          <div className="h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
          <div className="h-7 flex items-center justify-center gap-4 px-4 border-t border-border bg-background/60 backdrop-blur-sm">
            <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="kbd-hint">⌘K</kbd>
                <span>Commands</span>
              </span>
              <span className="text-muted-foreground/40">•</span>
              <span className="flex items-center gap-1">
                <kbd className="kbd-hint">Enter</kbd>
                <span>Send</span>
              </span>
              <span className="text-muted-foreground/40">•</span>
              <span className="flex items-center gap-1">
                <kbd className="kbd-hint">Shift+Enter</kbd>
                <span>New line</span>
              </span>
              <span className="text-muted-foreground/40">•</span>
              <span className="flex items-center gap-1">
                <kbd className="kbd-hint">⌘F</kbd>
                <span>Search chat</span>
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-[9px] text-muted-foreground/70">
              <span>DocQA v2.1</span>
              <span className="text-muted-foreground/40">•</span>
              <span>RAG-Powered</span>
              <span className="text-muted-foreground/40">•</span>
              <StorageQuotaIndicator />
            </div>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}
