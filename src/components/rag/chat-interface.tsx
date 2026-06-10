'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useChatStore, ChatMessage } from '@/store/chat-store';
import { Send, Loader2, Sparkles, User, ChevronDown, BookOpen, FileText, Hash, AlertCircle, Copy, Check, ArrowRight, Paperclip, ThumbsUp, ThumbsDown, MessageSquare, MessageSquareQuote, Clock, Layers, Save, RefreshCw, Search, Zap, Brain, Bookmark, BookmarkCheck, GitBranch, AlignLeft, X, BarChart3, Mic } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { formatTime } from '@/lib/format';
import { toast } from 'sonner';
import { ChatAutoSuggest } from '@/components/rag/chat-auto-suggest';
import { QuickResponseBar } from '@/components/rag/quick-response-bar';
import { VoiceInput } from '@/components/rag/voice-input';
import { TtsButton } from '@/components/rag/tts-button';

// ─── Keyword Highlighter ──────────────────────────────────────────────
function highlightKeywords(text: string, query?: string): React.ReactNode {
  if (!query || !query.trim()) return text;
  const keywords = query.trim().split(/\s+/).filter(k => k.length > 2);
  if (keywords.length === 0) return text;

  // Build regex that matches any keyword (case-insensitive)
  const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) => {
    const isKeyword = keywords.some(k => part.toLowerCase() === k.toLowerCase());
    if (isKeyword) {
      return <span key={i} className="keyword-highlight">{part}</span>;
    }
    return part;
  });
}

// ─── Source Card ──────────────────────────────────────────────────────
function SourceCard({
  source,
  index,
  query,
}: {
  source: {
    id: string;
    filename: string;
    chunkIndex: number;
    content: string;
    score: number;
  };
  index: number;
  query?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const scoreColor = source.score >= 0.5
    ? 'text-emerald-400/80 bg-emerald-500/10'
    : source.score >= 0.2
      ? 'text-amber-400/70 bg-amber-500/10'
      : 'text-white/60 bg-white/[0.06]';

  const scoreBarColor = source.score >= 0.5
    ? 'bg-emerald-400/50'
    : source.score >= 0.2
      ? 'bg-amber-400/40'
      : 'bg-white/15';

  // Gradient left-border accent based on score
  const borderAccent = source.score >= 0.5
    ? 'border-l-2 border-l-emerald-400/50'
    : source.score >= 0.2
      ? 'border-l-2 border-l-amber-400/40'
      : 'border-l-2 border-l-white/15';

  const isEven = index % 2 === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      className={`rounded-xl glass overflow-hidden transition-all duration-200 hover:border-purple-500/10 hover:-translate-y-px hover:shadow-md hover:shadow-purple-500/5 ${borderAccent} ${isEven ? 'bg-white/[0.03]' : ''}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/[0.04] transition-colors touch-target"
      >
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500/15 to-purple-500/5 flex items-center justify-center shrink-0 border border-purple-500/10">
          <span className="text-[10px] font-bold text-purple-400">{index + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <FileText size={11} className="text-white/60 shrink-0" />
            <span className="text-xs text-white/80 truncate">{source.filename}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-md whitespace-nowrap font-medium ${scoreColor}`}>
            {Math.round(source.score * 100)}%
          </span>
          <ChevronDown
            size={14}
            className={`text-white/50 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      {/* Score progress bar with shimmer */}
      <div className="px-3 pb-2">
        <div className="h-0.5 rounded-full bg-white/[0.05] overflow-hidden source-score-bar">
          <div
            className={`h-full rounded-full ${scoreBarColor} transition-all duration-500`}
            style={{ width: `${Math.max(Math.round(source.score * 100), 2)}%` }}
          />
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-1.5 text-[10px] text-white/60">
                  <Hash size={10} />
                  <span>Chunk {source.chunkIndex}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-white/50">
                  <FileText size={8} />
                  <span>{source.content.length} chars</span>
                </div>
              </div>
              <div className="text-xs text-white/75 leading-relaxed bg-white/[0.04] border border-white/[0.06] rounded-lg p-3 max-h-48 overflow-y-auto scroll-fade whitespace-pre-wrap break-words">
                {highlightKeywords(source.content, query)}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Copy Button ──────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/[0.08] text-white/50 hover:text-white/65"
      title="Copy response"
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </button>
  );
}

// ─── Regenerate Button ────────────────────────────────────────────────
function RegenerateButton({ messageId, onRegenerate }: { messageId: string; onRegenerate: (id: string) => void }) {
  return (
    <button
      onClick={() => onRegenerate(messageId)}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/[0.08] text-white/40 hover:text-purple-400/80"
      title="Regenerate response"
    >
      <RefreshCw size={11} />
    </button>
  );
}

// ─── Assistant Message ────────────────────────────────────────────────
function AssistantMessage({ message, isCurrentlyStreaming, messageIndex, onRegenerate, onQuoteReply, isBookmarked, onToggleBookmark, onBranch }: { message: ChatMessage; isCurrentlyStreaming: boolean; messageIndex: number; onRegenerate: (id: string) => void; onQuoteReply: (text: string) => void; isBookmarked: boolean; onToggleBookmark: (id: string) => void; onBranch: (id: string) => void }) {
  // undefined = auto-decide, true/false = user toggled
  const [userToggledSources, setUserToggledSources] = useState<boolean | undefined>(undefined);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  const shouldAutoExpand = !!(message.sources && message.sources.length > 0 && message.sources.length <= 2);
  const showSources = userToggledSources !== undefined ? userToggledSources : (shouldAutoExpand && !isCurrentlyStreaming);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex gap-3 group"
      id={`msg-${message.id}`}
    >
      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-purple-500/15 to-purple-500/5 flex items-center justify-center shrink-0 mt-0.5 border border-purple-500/10">
        <Sparkles size={13} className="text-purple-400" />
      </div>
      <div className={`flex-1 min-w-0 pl-3 animate-border-draw ${isBookmarked ? 'border-l-2 border-l-purple-400/50' : 'border-l border-purple-500/15'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="ai-response text-sm text-white/80 leading-relaxed flex-1">
            <ReactMarkdown>{message.content}</ReactMarkdown>
            {isCurrentlyStreaming && (
              <span className="typing-cursor" />
            )}
          </div>
          {!isCurrentlyStreaming && message.content && (
            <CopyButton text={message.content} />
          )}
        </div>
        {!isCurrentlyStreaming && message.sources && message.sources.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setUserToggledSources(!showSources)}
              className="flex items-center gap-1.5 text-xs text-purple-400/60 hover:text-purple-400/80 transition-colors py-1"
            >
              <BookOpen size={12} />
              <span>Sources Used</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-400/70 font-medium">{message.sources.length}</span>
              <ChevronDown
                size={12}
                className={`transition-transform duration-200 ${showSources ? 'rotate-180' : ''}`}
              />
            </button>
            <AnimatePresence>
              {showSources && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 flex flex-col gap-2">
                    {message.sources.map((source, index) => (
                      <SourceCard key={source.id} source={source} index={index} query={messages[messages.findIndex(m => m.id === message.id) - 1]?.content} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        {!isCurrentlyStreaming && message.confidence !== undefined && message.confidence < 0.15 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 flex items-center gap-1.5 text-xs text-amber-400/50 bg-amber-500/[0.04] border border-amber-500/10 rounded-lg px-2.5 py-1.5"
          >
            <AlertCircle size={12} />
            <span>Low confidence match — answer may not be fully accurate</span>
          </motion.div>
        )}
        {!isCurrentlyStreaming && (
          <div className="mt-1.5 flex items-center gap-3">
            <span className="text-[10px] text-white/55 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              {formatTime(message.timestamp)}
            </span>
            <span className="text-[10px] text-white/30 font-mono">
              #{messageIndex}
            </span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <RegenerateButton messageId={message.id} onRegenerate={onRegenerate} />
              <button
                onClick={() => {
                  const excerpt = message.content.slice(0, 100) + (message.content.length > 100 ? '...' : '');
                  onQuoteReply(`> ${excerpt}\n\n`);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/[0.08] text-white/40 hover:text-purple-400/80"
                title="Quote reply"
              >
                <MessageSquareQuote size={11} />
              </button>
              <button
                onClick={() => {
                  const { updateMessage } = useChatStore.getState();
                  updateMessage(message.id, {
                    feedback: message.feedback === 'positive' ? undefined : 'positive',
                  });
                  if (message.feedback !== 'positive') {
                    toast.success('Thanks for your feedback!');
                  }
                }}
                className={`p-1 rounded-md transition-all ${
                  message.feedback === 'positive'
                    ? 'text-emerald-400/80 bg-emerald-500/10'
                    : 'text-white/40 hover:text-white/60 hover:bg-white/[0.06]'
                }`}
                title="Helpful"
              >
                <ThumbsUp size={11} />
              </button>
              <button
                onClick={() => {
                  const { updateMessage } = useChatStore.getState();
                  updateMessage(message.id, {
                    feedback: message.feedback === 'negative' ? undefined : 'negative',
                  });
                  if (message.feedback !== 'negative') {
                    toast.success('Thanks for your feedback!');
                  }
                }}
                className={`p-1 rounded-md transition-all ${
                  message.feedback === 'negative'
                    ? 'text-red-400/80 bg-red-500/10'
                    : 'text-white/40 hover:text-white/60 hover:bg-white/[0.06]'
                }`}
                title="Not helpful"
              >
                <ThumbsDown size={11} />
              </button>
              <button
                onClick={() => onToggleBookmark(message.id)}
                className={`p-1 rounded-md transition-all ${
                  isBookmarked
                    ? 'text-purple-400/80 bg-purple-500/10'
                    : 'text-white/40 hover:text-purple-400/80 hover:bg-white/[0.06]'
                }`}
                title={isBookmarked ? 'Remove bookmark' : 'Bookmark message'}
                aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark message'}
              >
                {isBookmarked ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
              </button>
              <button
                onClick={() => onBranch(message.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/[0.08] text-white/40 hover:text-purple-400/80"
                title="Branch from here"
                aria-label="Branch from here"
              >
                <GitBranch size={11} />
              </button>
              <button
                onClick={async () => {
                  if (summarizing) return;
                  setSummarizing(true);
                  try {
                    const res = await fetch('/api/chat/summarize', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ content: message.content }),
                    });
                    const data = await res.json();
                    if (data.summary) setSummary(data.summary);
                  } catch {
                    toast.error('Failed to generate summary');
                  } finally {
                    setSummarizing(false);
                  }
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/[0.08] text-white/40 hover:text-purple-400/80"
                title="Summarize"
                aria-label="Summarize response"
              >
                {summarizing ? <Loader2 size={11} className="animate-spin" /> : <AlignLeft size={11} />}
              </button>
              <TtsButton text={message.content} />
            </div>
          </div>
        )}
        {/* Summary card */}
        <AnimatePresence>
          {summary && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-2 overflow-hidden"
            >
              <div className="glass rounded-lg px-3 py-2 border-l-2 border-l-purple-400/50 relative">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] text-purple-400/60 font-medium uppercase tracking-wider">Summary</span>
                    <p className="text-xs text-white/60 leading-relaxed mt-0.5">{summary}</p>
                  </div>
                  <button
                    onClick={() => setSummary(null)}
                    className="shrink-0 p-0.5 rounded-md hover:bg-white/[0.08] text-white/50 hover:text-white/65 transition-colors"
                    aria-label="Dismiss summary"
                  >
                    <X size={10} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── User Message ─────────────────────────────────────────────────────
function UserMessage({ message, messageIndex, onQuoteReply, isBookmarked, onToggleBookmark, onBranch }: { message: ChatMessage; messageIndex: number; onQuoteReply: (text: string) => void; isBookmarked: boolean; onToggleBookmark: (id: string) => void; onBranch: (id: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex gap-2 sm:gap-3 justify-end group"
      id={`msg-${message.id}`}
    >
      <div className="max-w-[85%] sm:max-w-[75%]">
        <div className="flex items-center justify-end gap-2 mb-0.5 mr-1">
          {isBookmarked && <Bookmark size={8} className="text-purple-400/60" />}
          <span className="text-[10px] text-white/30 font-mono">#{messageIndex}</span>
          <span className="text-[10px] text-white/50">You</span>
        </div>
        <div className={`user-msg-shimmer rounded-2xl rounded-tr-sm px-3.5 sm:px-4 py-2.5 text-sm text-white/80 break-words shadow-sm shadow-purple-500/5 ${isBookmarked ? 'bg-gradient-to-br from-purple-500/20 to-purple-500/8 border border-purple-400/25' : 'bg-gradient-to-br from-purple-500/15 to-purple-500/6 border border-purple-500/15'}`}>
          {message.content}
        </div>
        <div className="mt-1 flex items-center justify-end gap-2">
          <span className="text-[10px] text-white/55 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {formatTime(message.timestamp)}
          </span>
          <button
            onClick={() => onToggleBookmark(message.id)}
            className={`transition-opacity p-1 rounded-md ${isBookmarked ? 'text-purple-400/80' : 'opacity-0 group-hover:opacity-100 hover:bg-white/[0.08] text-white/40 hover:text-purple-400/80'}`}
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark message'}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark message'}
          >
            {isBookmarked ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
          </button>
          <button
            onClick={() => {
              const excerpt = message.content.slice(0, 100) + (message.content.length > 100 ? '...' : '');
              onQuoteReply(`> ${excerpt}\n\n`);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/[0.08] text-white/40 hover:text-purple-400/80"
            title="Quote reply"
          >
            <MessageSquareQuote size={11} />
          </button>
          <button
            onClick={() => onBranch(message.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/[0.08] text-white/40 hover:text-purple-400/80"
            title="Branch from here"
            aria-label="Branch from here"
          >
            <GitBranch size={11} />
          </button>
        </div>
      </div>
      <div className="w-7 h-7 rounded-xl bg-white/[0.08] border border-white/[0.1] flex items-center justify-center shrink-0 mt-7">
        <User size={13} className="text-white/70" />
      </div>
    </motion.div>
  );
}

// ─── SSE Parser Hook ──────────────────────────────────────────────────
function parseSSELines(buffer: string): { events: { event: string; data: string }[]; remaining: string } {
  const events: { event: string; data: string }[] = [];
  const parts = buffer.split('\n\n');
  const remaining = parts.pop() || '';

  for (const part of parts) {
    let event = 'message';
    let data = '';
    const lines = part.split('\n');
    for (const line of lines) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        data = line.slice(5).trim();
      }
    }
    if (data) {
      events.push({ event, data });
    }
  }

  return { events, remaining };
}

// ─── Typing Dots (3-wave pattern) ─────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex gap-1.5 items-center">
      <div className="w-2 h-2 rounded-full bg-purple-400/50 typing-dot" />
      <div className="w-2 h-2 rounded-full bg-purple-400/50 typing-dot" />
      <div className="w-2 h-2 rounded-full bg-purple-400/50 typing-dot" />
    </div>
  );
}

// ─── Main Chat Interface ──────────────────────────────────────────────
export function ChatInterface() {
  const { messages, isLoading, isStreaming, addMessage, updateMessage, setLoading, setStreaming, documents, isPersisted, bookmarkedMessageIds, toggleBookmark, branchFromMessage, conversations, loadConversation } = useChatStore();
  const [input, setInput] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [showAutoSuggest, setShowAutoSuggest] = useState(false);
  const [showScrollFab, setShowScrollFab] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamingMessageIdRef = useRef<string | null>(null);

  // Listen for prefill events from command palette
  useEffect(() => {
    const handler = (e: Event) => {
      const question = (e as CustomEvent).detail;
      if (question) {
        setInput(question);
        inputRef.current?.focus();
      }
    };
    window.addEventListener('docqa:prefill', handler);
    return () => window.removeEventListener('docqa:prefill', handler);
  }, []);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Track scroll position for FAB visibility
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollFab(distanceFromBottom > 150);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Focus input when chat is ready
  useEffect(() => {
    if (!isLoading && !isStreaming && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading, isStreaming]);

  // Regenerate handler — re-ask the last user question before this assistant message
  const handleRegenerate = useCallback(async (messageId: string) => {
    const msgIndex = messages.findIndex((m) => m.id === messageId);
    if (msgIndex < 0) return;

    // Find the user message right before this assistant message
    let userMsg: ChatMessage | null = null;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMsg = messages[i];
        break;
      }
    }
    if (!userMsg) return;

    // Reset the assistant message
    updateMessage(messageId, { content: '', sources: [], confidence: 0 });

    const history = messages.slice(0, messages.findIndex((m) => m.id === userMsg!.id)).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const enabledDocIds = documents
      .filter((d) => d.enabled !== false && d.status === 'ready')
      .map((d) => d.id);

    setStreaming(true);

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          history,
          docIds: enabledDocIds,
        }),
      });

      if (!response.ok) throw new Error(`Stream responded with ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No readable stream available');

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const { events, remaining } = parseSSELines(buffer);
        buffer = remaining;

        for (const evt of events) {
          try {
            const parsed = JSON.parse(evt.data);
            switch (evt.event) {
              case 'token': {
                accumulatedContent += parsed.content || '';
                updateMessage(messageId, { content: accumulatedContent });
                break;
              }
              case 'sources': {
                updateMessage(messageId, { sources: parsed.sources || [] });
                break;
              }
              case 'confidence': {
                updateMessage(messageId, { confidence: parsed.confidence || 0 });
                break;
              }
              case 'error': {
                console.error('Stream error event:', parsed.error);
                if (!accumulatedContent) {
                  updateMessage(messageId, {
                    content: `Sorry, I encountered an error: ${parsed.error}. Please try again.`,
                  });
                }
                break;
              }
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      if (!accumulatedContent) {
        throw new Error('No content received from stream');
      }
    } catch (streamError) {
      console.warn('Streaming failed on regenerate:', streamError);
      updateMessage(messageId, {
        content: `Sorry, I encountered an error regenerating the response. Please try again.`,
      });
    } finally {
      setStreaming(false);
    }
  }, [messages, documents, updateMessage, setStreaming]);

  // Fallback to non-streaming endpoint
  const fetchNonStreaming = async (trimmed: string, history: { role: string; content: string }[], enabledDocIds: string[], assistantMessageId: string) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: trimmed,
        history,
        docIds: enabledDocIds,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get response');
    }

    updateMessage(assistantMessageId, {
      content: data.answer,
      sources: data.sources || [],
      confidence: data.confidence || 0,
    });
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || isStreaming) return;

    const userMessage: ChatMessage = {
      id: Math.random().toString(36).substring(2, 15),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };
    addMessage(userMessage);
    setInput('');
    setShowAutoSuggest(false);
    setLoading(true);

    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    // Create an empty assistant message that will be updated via streaming
    const assistantMessageId = Math.random().toString(36).substring(2, 15);
    streamingMessageIdRef.current = assistantMessageId;

    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      sources: [],
      confidence: 0,
      timestamp: new Date(),
    };
    addMessage(assistantMessage);

    try {
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Get enabled document IDs for filtered search
      const enabledDocIds = documents
        .filter((d) => d.enabled !== false && d.status === 'ready')
        .map((d) => d.id);

      // Try streaming endpoint first
      try {
        setLoading(false);
        setStreaming(true);

        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            history,
            docIds: enabledDocIds,
          }),
        });

        if (!response.ok) {
          throw new Error(`Stream responded with ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No readable stream available');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const { events, remaining } = parseSSELines(buffer);
          buffer = remaining;

          for (const evt of events) {
            try {
              const parsed = JSON.parse(evt.data);

              switch (evt.event) {
                case 'token': {
                  accumulatedContent += parsed.content || '';
                  updateMessage(assistantMessageId, { content: accumulatedContent });
                  break;
                }
                case 'sources': {
                  updateMessage(assistantMessageId, { sources: parsed.sources || [] });
                  break;
                }
                case 'confidence': {
                  updateMessage(assistantMessageId, { confidence: parsed.confidence || 0 });
                  break;
                }
                case 'error': {
                  console.error('Stream error event:', parsed.error);
                  if (!accumulatedContent) {
                    updateMessage(assistantMessageId, {
                      content: `Sorry, I encountered an error: ${parsed.error}. Please try again.`,
                    });
                  }
                  break;
                }
                case 'done': {
                  // Streaming complete
                  break;
                }
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }

        // If we got no content at all, fall back
        if (!accumulatedContent) {
          throw new Error('No content received from stream');
        }
      } catch (streamError) {
        console.warn('Streaming failed, falling back to non-streaming:', streamError);
        setStreaming(false);
        setLoading(true);

        // Reset the assistant message content for fallback
        updateMessage(assistantMessageId, { content: '', sources: [], confidence: 0 });

        try {
          await fetchNonStreaming(trimmed, history, enabledDocIds, assistantMessageId);
        } catch (fallbackError) {
          updateMessage(assistantMessageId, {
            content: `Sorry, I encountered an error: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}. Please try again.`,
          });
        }
      }
    } catch (error) {
      updateMessage(assistantMessageId, {
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
      });
    } finally {
      setLoading(false);
      setStreaming(false);
      streamingMessageIdRef.current = null;
    }
  };

  const handleSuggestionSelect = useCallback((suggestion: string) => {
    setInput(suggestion);
    setShowAutoSuggest(false);
    inputRef.current?.focus();
  }, []);

  const handleQuoteReply = useCallback((quotedText: string) => {
    setInput(quotedText);
    inputRef.current?.focus();
  }, []);

  const handleVoiceTranscript = useCallback((text: string) => {
    setInput((prev) => prev ? `${prev} ${text}` : text);
    inputRef.current?.focus();
  }, []);

  const handleBranch = useCallback((messageId: string) => {
    const newId = branchFromMessage(messageId);
    toast.success('Branched conversation from message', {
      description: 'A new conversation has been created from this point',
    });
  }, [branchFromMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Delegate to auto-suggest if visible
    if (showAutoSuggest && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || (e.key === 'Enter' && input.trim()) || e.key === 'Escape')) {
      window.dispatchEvent(new CustomEvent('docqa:autosuggest:keydown', { detail: e }));
      if (e.defaultPrevented) return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    setShowAutoSuggest(e.target.value.trim().length > 0);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const readyDocs = documents.filter((d) => d.status === 'ready' && d.enabled !== false).length;

  // Compute conversation statistics
  const totalMessages = messages.length;
  const totalSources = messages.reduce(
    (sum, m) => sum + (m.sources?.length ?? 0),
    0
  );
  const totalWords = messages.reduce(
    (sum, m) => sum + m.content.split(/\s+/).filter(Boolean).length,
    0
  );
  const conversationDuration = React.useMemo(() => {
    if (messages.length < 2) return null;
    const first = messages[0].timestamp;
    const last = messages[messages.length - 1].timestamp;
    const diffMs = new Date(last).getTime() - new Date(first).getTime();
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }, [messages]);

  // Compute exchange pair index for message numbering
  // Each Q&A pair gets a sequential number; both the user and assistant message share the same number
  const getMessageIndex = (index: number) => {
    let pairCount = 0;
    for (let i = 0; i <= index; i++) {
      if (messages[i].role === 'user') pairCount++;
    }
    return pairCount;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Conversation Stats Bar */}
      {totalMessages > 0 && (
        <div className="shrink-0 flex items-center justify-center gap-0 px-4 py-1.5 border-b border-white/[0.04] glass-color-shift rounded-none">
          <div className="flex items-center gap-1 text-[10px] text-white/40 px-2.5">
            <MessageSquare size={9} className="text-purple-400/20" />
            <span>{totalMessages} message{totalMessages !== 1 ? 's' : ''}</span>
          </div>
          <div className="w-px h-2.5 bg-white/[0.08]" />
          {totalSources > 0 && (
            <>
              <div className="flex items-center gap-1 text-[10px] text-white/40 px-2.5">
                <Layers size={9} className="text-purple-400/20" />
                <span>{totalSources} source{totalSources !== 1 ? 's' : ''}</span>
              </div>
              <div className="w-px h-2.5 bg-white/[0.08]" />
            </>
          )}
          {totalWords > 0 && (
            <>
              <div className="flex items-center gap-1 text-[10px] text-white/40 px-2.5">
                <FileText size={9} className="text-purple-400/20" />
                <span>{totalWords > 999 ? `${(totalWords / 1000).toFixed(1)}k` : totalWords} words</span>
              </div>
              <div className="w-px h-2.5 bg-white/[0.08]" />
            </>
          )}
          {conversationDuration && (
            <>
              <div className="flex items-center gap-1 text-[10px] text-white/40 px-2.5">
                <Clock size={9} className="text-purple-400/20" />
                <span>{conversationDuration}</span>
              </div>
              <div className="w-px h-2.5 bg-white/[0.08]" />
            </>
          )}
          {isPersisted && (
            <div className="flex items-center gap-1 text-[10px] text-emerald-400/25 px-2.5" title="Conversation saved locally">
              <Save size={9} className="text-emerald-400/30" />
              <span>Saved</span>
            </div>
          )}
        </div>
      )}
      {/* Chat Messages */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto min-h-0 scroll-fade relative">
        <AnimatePresence mode="wait">
          {messages.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center h-full px-4 sm:px-6 dot-grid grid-pattern relative"
            >
              {/* Hero icon with animated orbit ring */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="relative mb-6"
              >
                {/* Outer orbit ring */}
                <div className="absolute -inset-6 rounded-full border border-purple-500/[0.08] animate-orbit">
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-purple-400/30 shadow-[0_0_6px_rgba(167,139,250,0.4)]" />
                </div>
                {/* Inner orbit ring — counter-rotating */}
                <div className="absolute -inset-3 rounded-full border border-purple-500/[0.12] animate-orbit-reverse">
                  <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-purple-300/20 shadow-[0_0_4px_rgba(167,139,250,0.3)]" />
                </div>
                <div className="absolute -inset-3 w-22 h-22 rounded-3xl bg-purple-500/10 blur-xl animate-pulse-soft" />
                <div className="relative w-16 h-16 rounded-3xl bg-gradient-to-br from-purple-500/15 to-purple-600/5 flex items-center justify-center border border-purple-500/20 animate-hero-glow">
                  <Sparkles size={28} className="text-purple-400" />
                </div>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                className="text-xl font-semibold text-white/80 mb-2 tracking-tight animate-shimmer-text"
              >
                Document Q&amp;A Assistant
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.4 }}
                className="text-sm text-white/60 text-center max-w-md mb-8 leading-relaxed"
              >
                Upload a PDF or TXT document, then ask questions. I&apos;ll search through your documents and provide answers with source citations.
              </motion.p>

              {readyDocs > 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="flex items-center gap-2 text-xs text-emerald-400/60 bg-emerald-500/[0.06] border border-emerald-500/10 px-3.5 py-2 rounded-xl"
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-400/60 animate-pulse" />
                  <span>{readyDocs} document{readyDocs > 1 ? 's' : ''} ready • Ask anything!</span>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="flex items-center gap-2 text-xs text-white/50 bg-white/[0.04] border border-white/[0.06] px-3.5 py-2 rounded-xl animate-float-label"
                >
                  <div className="w-2 h-2 rounded-full bg-white/10" />
                  <span>Upload a document to get started</span>
                </motion.div>
              )}

              {/* Suggested questions */}
              {readyDocs > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="mt-8 flex flex-wrap gap-2 justify-center max-w-lg"
                >
                  {[
                    { q: 'What are the main topics covered?', short: 'Main topics' },
                    { q: 'Explain the key concepts discussed', short: 'Key concepts' },
                    { q: 'What conclusions are drawn?', short: 'Conclusions' },
                    { q: 'What are the important definitions?', short: 'Definitions' },
                  ].map((item) => (
                    <button
                      key={item.q}
                      onClick={() => setInput(item.q)}
                      className="group/q text-xs text-white/60 hover:text-white/70 bg-white/[0.05] hover:bg-white/[0.08] px-3.5 py-2 rounded-xl transition-all border border-white/[0.06] hover:border-purple-500/20 hover:shadow-sm hover:shadow-purple-500/5 active:scale-[0.98] flex items-center gap-1.5 animate-liquid-border suggestion-card-hover"
                    >
                      <span className="sm:hidden">{item.short}</span>
                      <span className="hidden sm:inline">{item.q}</span>
                      <ArrowRight size={10} className="opacity-0 group-hover/q:opacity-100 -translate-x-1 group-hover/q:translate-x-0 transition-all text-purple-400/60" />
                    </button>
                  ))}
                </motion.div>
              )}

              {/* Feature cards grid */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                className="grid grid-cols-2 gap-2 mt-4 max-w-md w-full"
              >
                {[
                  { icon: Search, title: 'Smart Search', desc: 'TF-IDF retrieval finds relevant passages', color: 'text-blue-400 dark:text-blue-400' },
                  { icon: MessageSquare, title: 'AI Responses', desc: 'Grounded answers with source citations', color: 'text-purple-400 dark:text-purple-400' },
                  { icon: BarChart3, title: 'Analysis', desc: 'Word clouds & document statistics', color: 'text-emerald-400 dark:text-emerald-400' },
                  { icon: Mic, title: 'Voice Input', desc: 'Ask questions hands-free', color: 'text-amber-400 dark:text-amber-400' },
                ].map((feature, i) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + i * 0.08, duration: 0.3 }}
                    className="glass-card rounded-xl p-3 text-center hover:scale-[1.02] transition-transform"
                  >
                    <feature.icon size={18} className={`mx-auto mb-1.5 ${feature.color}`} />
                    <p className="text-xs font-medium text-foreground/80">{feature.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{feature.desc}</p>
                  </motion.div>
                ))}
              </motion.div>

              {/* Recent Conversations */}
              {conversations.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.4 }}
                  className="mt-6 max-w-md w-full"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={12} className="text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground/80">Recent Conversations</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {conversations.slice(0, 3).map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => loadConversation(conv.id)}
                        className="flex items-center gap-2.5 glass-card rounded-xl px-3 py-2.5 text-left hover:scale-[1.01] transition-all hover:border-purple-500/15 group/conv"
                      >
                        <MessageSquare size={12} className="text-purple-400/50 group-hover/conv:text-purple-400/80 transition-colors shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground/80 truncate">{conv.title}</p>
                          <p className="text-[10px] text-muted-foreground">{conv.messageCount} message{conv.messageCount !== 1 ? 's' : ''}</p>
                        </div>
                        <ArrowRight size={10} className="text-muted-foreground opacity-0 group-hover/conv:opacity-100 transition-opacity shrink-0" />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Powered by AI with enhanced styling */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="mt-6 flex flex-col items-center gap-2"
              >
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Sparkles size={8} className="text-purple-400/40 animate-sparkle" />
                  <span>Powered by AI</span>
                </div>
                <div className="flex items-center gap-3 text-[8px] text-muted-foreground/60">
                  <span>TF-IDF Retrieval</span>
                  <span className="text-muted-foreground/20">•</span>
                  <span>Stream Responses</span>
                  <span className="text-muted-foreground/20">•</span>
                  <span>Source Citations</span>
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <div className="p-3 sm:p-4 md:p-6 space-y-5">
              {messages.map((message, index) => (
                <div key={message.id}>
                  {message.role === 'user' ? (
                    <UserMessage message={message} messageIndex={getMessageIndex(index)} onQuoteReply={handleQuoteReply} isBookmarked={bookmarkedMessageIds.includes(message.id)} onToggleBookmark={toggleBookmark} onBranch={handleBranch} />
                  ) : (
                    <AssistantMessage
                      message={message}
                      isCurrentlyStreaming={isStreaming && message.id === streamingMessageIdRef.current}
                      messageIndex={getMessageIndex(index)}
                      onRegenerate={handleRegenerate}
                      onQuoteReply={handleQuoteReply}
                      isBookmarked={bookmarkedMessageIds.includes(message.id)}
                      onToggleBookmark={toggleBookmark}
                      onBranch={handleBranch}
                    />
                  )}
                </div>
              ))}

              {isLoading && !isStreaming && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-purple-500/15 to-purple-500/5 flex items-center justify-center shrink-0 border border-purple-500/10">
                    <Sparkles size={13} className="text-purple-400" />
                  </div>
                  <div className="flex items-center gap-3 py-2">
                    <TypingDots />
                    <span className="text-xs text-white/55">Searching documents...</span>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </AnimatePresence>

        {/* Scroll to Bottom FAB */}
        <AnimatePresence>
          {showScrollFab && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              onClick={scrollToBottom}
              className="absolute bottom-4 right-4 w-9 h-9 rounded-full bg-gradient-to-br from-purple-500/60 to-purple-600/40 flex items-center justify-center shadow-lg shadow-purple-500/20 hover:from-purple-500/80 hover:to-purple-600/60 transition-all animate-fab-bounce z-10 border border-purple-400/20"
              aria-label="Scroll to bottom"
            >
              <ChevronDown size={16} className="text-white/80" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <div className="p-3 sm:p-4 relative z-10">
        {/* Gradient border top */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        <QuickResponseBar
          hasDocuments={readyDocs > 0}
          onSelect={(text) => { setInput(text); inputRef.current?.focus(); }}
          disabled={isLoading || isStreaming}
        />
        <div className={`flex items-end gap-2 sm:gap-3 input-gradient-border rounded-2xl ${inputFocused ? 'shadow-[0_0_24px_rgba(167,139,250,0.08)]' : ''}`}>
          <div className="flex-1 relative">
            {/* Auto-suggest popup */}
            <ChatAutoSuggest
              input={input}
              documents={documents}
              onSelect={handleSuggestionSelect}
              visible={showAutoSuggest}
              onClose={() => setShowAutoSuggest(false)}
            />
            {readyDocs > 0 && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                <Paperclip size={12} className="text-purple-400/30" />
              </div>
            )}
            {/* Streaming recording dot */}
            {isStreaming && (
              <div className="absolute right-10 top-1/2 -translate-y-1/2 z-10">
                <div className="w-2 h-2 rounded-full bg-purple-400/60 animate-recording-pulse" />
              </div>
            )}
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                setInputFocused(true);
                setShowAutoSuggest(input.trim().length > 0);
              }}
              onBlur={() => {
                setInputFocused(false);
                setTimeout(() => setShowAutoSuggest(false), 200);
              }}
              placeholder={
                readyDocs > 0
                  ? 'Ask a question about your documents...'
                  : 'Upload a document first to start asking questions...'
              }
              disabled={isLoading || isStreaming}
              rows={1}
              aria-label="Chat message input"
              className={`w-full resize-none rounded-2xl bg-white/[0.05] border border-white/[0.08] py-3 text-sm text-white/80 placeholder:text-white/50 focus:outline-none focus:border-purple-500/30 focus:bg-white/[0.06] focus:ring-2 focus:ring-purple-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:saturate-0 ${inputFocused ? 'input-focus-glow input-ring-pulse' : ''} ${readyDocs > 0 ? 'pl-8 sm:pl-9 pr-10' : 'pl-3.5 sm:pl-4 pr-10'}`}
            />
            {input.length > 0 && (
              <div className="absolute right-3 bottom-2 text-[9px] text-white/40 pointer-events-none">
                {input.length}
              </div>
            )}
          </div>
          <VoiceInput onTranscript={handleVoiceTranscript} disabled={isLoading || isStreaming} />
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={handleSend}
            disabled={!input.trim() || isLoading || isStreaming}
            aria-label="Send message"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100 shrink-0 border ${input.trim() && !isLoading && !isStreaming ? 'bg-gradient-to-br from-purple-500/50 to-purple-600/35 hover:from-purple-500/70 hover:to-purple-600/50 text-purple-300 border-purple-400/30 hover:border-purple-400/40 shadow-md shadow-purple-500/15 send-button-active' : 'bg-gradient-to-br from-purple-500/25 to-purple-600/15 hover:from-purple-500/40 hover:to-purple-600/30 text-purple-400 border-purple-500/10 hover:border-purple-500/20 hover:shadow-md hover:shadow-purple-500/10'}`}
          >
            {isLoading || isStreaming ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </motion.button>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          {readyDocs > 0 && (
            <span className="text-[9px] text-purple-400/25 flex items-center gap-1">
              <Paperclip size={8} />
              {readyDocs} doc{readyDocs !== 1 ? 's' : ''} attached
            </span>
          )}
          <p className={`text-[10px] text-white/40 ${readyDocs > 0 ? '' : 'mx-auto'}`}>
            AI responses are based on your uploaded documents • Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
