'use client';

import React, { useState } from 'react';
import { useChatStore, ConversationMeta } from '@/store/chat-store';
import { Plus, MessageSquare, Trash2, Pencil, Check, X, Clock, MessagesSquare, Tag, HardDrive, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const PREDEFINED_TAGS = ['Important', 'Research', 'Work', 'Personal', 'Study', 'Review'];

function formatDate(timestamp: string): string {
  try {
    const d = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return timestamp;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ConversationHistoryProps {
  onClose?: () => void;
}

export function ConversationHistory({ onClose }: ConversationHistoryProps) {
  const {
    conversations,
    conversationId,
    loadConversation,
    deleteConversation,
    renameConversation,
    startNewConversation,
    addConversationTag,
    removeConversationTag,
    getStorageUsage,
    pruneConversations,
  } = useChatStore();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [taggingConvId, setTaggingConvId] = useState<string | null>(null);
  const [customTag, setCustomTag] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);

  // Storage usage
  const storageUsage = getStorageUsage();
  const storagePercent = Math.round((storageUsage.usedBytes / storageUsage.totalBytes) * 100);
  const isStorageWarning = storagePercent > 70;

  // Get all unique tags across conversations
  const allTags = Array.from(
    new Set(conversations.flatMap((c) => c.tags || []))
  ).sort();

  // Filter conversations by tag
  const filteredConversations = filterTag
    ? conversations.filter((c) => (c.tags || []).includes(filterTag))
    : conversations;

  const handleNewConversation = () => {
    startNewConversation();
    onClose?.();
  };

  const handleLoadConversation = (id: string) => {
    loadConversation(id);
    onClose?.();
  };

  const handleDeleteConversation = (id: string, title: string) => {
    deleteConversation(id);
    toast.success(`"${title}" deleted`);
  };

  const handleStartRename = (conv: ConversationMeta) => {
    setRenamingId(conv.id);
    setRenameValue(conv.title);
  };

  const handleConfirmRename = () => {
    if (renamingId && renameValue.trim()) {
      renameConversation(renamingId, renameValue.trim());
      toast.success('Conversation renamed');
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const handleCancelRename = () => {
    setRenamingId(null);
    setRenameValue('');
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirmRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelRename();
    }
  };

  const handleAddTag = (convId: string, tag: string) => {
    addConversationTag(convId, tag);
    toast.success(`Tag "${tag}" added`);
  };

  const handleRemoveTag = (convId: string, tag: string) => {
    removeConversationTag(convId, tag);
  };

  const handleAddCustomTag = () => {
    if (!customTag.trim() || !taggingConvId) return;
    const tag = customTag.trim();
    addConversationTag(taggingConvId, tag);
    setCustomTag('');
    toast.success(`Tag "${tag}" added`);
  };

  const handlePrune = () => {
    pruneConversations();
    toast.success('Old conversations pruned');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with New Conversation button */}
      <div className="shrink-0 px-4 py-3 border-b border-white/[0.06]">
        <button
          onClick={handleNewConversation}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-br from-purple-500/15 to-purple-500/5 border border-purple-500/15 text-purple-400/80 hover:from-purple-500/25 hover:to-purple-500/10 hover:text-purple-400 transition-all text-xs font-medium active:scale-[0.98]"
        >
          <Plus size={14} />
          <span>New Conversation</span>
        </button>
      </div>

      {/* Storage usage indicator */}
      {storageUsage.conversationCount > 0 && (
        <div className="shrink-0 px-4 py-2 border-b border-white/[0.05]">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 text-[9px] text-white/50">
              <HardDrive size={8} className={isStorageWarning ? 'text-amber-400/50' : 'text-purple-400/50'} />
              <span>{formatBytes(storageUsage.usedBytes)} used</span>
              {isStorageWarning && <AlertTriangle size={8} className="text-amber-400/60" />}
            </div>
            <span className="text-[9px] text-white/40">
              {storageUsage.conversationCount} conversation{storageUsage.conversationCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${isStorageWarning ? 'bg-amber-400/50' : 'bg-purple-400/30'}`}
              style={{ width: `${Math.min(storagePercent, 100)}%` }}
            />
          </div>
          {isStorageWarning && (
            <button
              onClick={handlePrune}
              className="mt-1.5 text-[9px] text-amber-400/50 hover:text-amber-400/80 transition-colors underline underline-offset-2"
            >
              Free up space
            </button>
          )}
        </div>
      )}

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div className="shrink-0 px-4 py-2 border-b border-white/[0.05]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterTag(null)}
              className={`text-[9px] px-2 py-0.5 rounded-md transition-all ${
                filterTag === null
                  ? 'bg-purple-500/15 text-purple-400/70 border border-purple-500/15'
                  : 'bg-white/[0.04] text-white/50 border border-white/[0.06] hover:border-white/[0.1]'
              }`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                className={`text-[9px] px-2 py-0.5 rounded-md transition-all ${
                  filterTag === tag
                    ? 'bg-purple-500/15 text-purple-400/70 border border-purple-500/15'
                    : 'bg-white/[0.04] text-white/50 border border-white/[0.06] hover:border-white/[0.1]'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto min-h-0 px-2 py-2">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-3">
              <MessagesSquare size={18} className="text-white/25" />
            </div>
            <p className="text-xs text-white/50">No saved conversations</p>
            <p className="text-[10px] text-white/30 mt-1">
              Conversations are saved automatically
            </p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-xs text-white/50">No conversations with tag "{filterTag}"</p>
            <button
              onClick={() => setFilterTag(null)}
              className="mt-2 text-[10px] text-purple-400/50 hover:text-purple-400/80 transition-colors"
            >
              Clear filter
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {filteredConversations.map((conv, idx) => {
              const isActive = conv.id === conversationId;
              const isRenaming = renamingId === conv.id;
              const isTagging = taggingConvId === conv.id;
              const convTags = conv.tags || [];

              return (
                <motion.div
                  key={conv.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02, duration: 0.15 }}
                  className={`
                    group rounded-lg transition-all cursor-pointer
                    ${isActive
                      ? 'bg-purple-500/[0.08] border border-purple-500/15'
                      : 'border border-transparent hover:bg-white/[0.05] hover:border-white/[0.06]'
                    }
                  `}
                  onClick={() => !isRenaming && !isTagging && handleLoadConversation(conv.id)}
                  onMouseEnter={() => setHoveredId(conv.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <div className="flex items-start gap-2 px-2.5 py-2">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                      isActive
                        ? 'bg-purple-500/15 text-purple-400'
                        : 'bg-white/[0.05] text-white/50'
                    }`}>
                      <MessageSquare size={10} />
                    </div>
                    <div className="flex-1 min-w-0">
                      {isRenaming ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={handleRenameKeyDown}
                            autoFocus
                            className="flex-1 bg-white/[0.06] border border-white/[0.1] rounded-md px-1.5 py-0.5 text-[11px] text-white/70 focus:outline-none focus:border-purple-500/30"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); handleConfirmRename(); }}
                            className="p-0.5 rounded hover:bg-white/[0.08] text-emerald-400/60"
                          >
                            <Check size={10} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCancelRename(); }}
                            className="p-0.5 rounded hover:bg-white/[0.08] text-white/60"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ) : (
                        <p className={`text-[11px] font-medium truncate ${isActive ? 'text-white/70' : 'text-white/75'}`}>
                          {conv.title}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex items-center gap-1 text-[9px] text-white/40">
                          <Clock size={7} />
                          <span>{formatDate(conv.timestamp)}</span>
                        </div>
                        <span className="text-[9px] text-white/30">
                          {conv.messageCount} msg{conv.messageCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {/* Tags */}
                      {convTags.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {convTags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0 rounded-md bg-purple-500/10 text-purple-400/50 border border-purple-500/10"
                            >
                              <span>{tag}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveTag(conv.id, tag); }}
                                className="hover:text-red-400/60 transition-colors ml-0.5"
                              >
                                <X size={6} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Tag editor */}
                      {isTagging && (
                        <div className="mt-1.5 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-wrap gap-1">
                            {PREDEFINED_TAGS.filter((t) => !convTags.includes(t)).map((tag) => (
                              <button
                                key={tag}
                                onClick={() => handleAddTag(conv.id, tag)}
                                className="text-[8px] px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-white/55 hover:text-purple-400/80 hover:border-purple-500/15 transition-all"
                              >
                                + {tag}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={customTag}
                              onChange={(e) => setCustomTag(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomTag(); } }}
                              placeholder="Custom tag..."
                              className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-md px-1.5 py-0.5 text-[9px] text-white/70 focus:outline-none focus:border-purple-500/20 placeholder:text-white/30"
                              autoFocus
                            />
                            <button
                              onClick={handleAddCustomTag}
                              disabled={!customTag.trim()}
                              className="text-[9px] px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-400/50 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-purple-500/20 transition-colors"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Action buttons */}
                    {!isRenaming && !isTagging && (hoveredId === conv.id || isActive) && (
                      <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setTaggingConvId(conv.id)}
                          className="p-1 rounded hover:bg-white/[0.08] text-white/40 hover:text-purple-400/80 transition-colors"
                          title="Add tag"
                        >
                          <Tag size={9} />
                        </button>
                        <button
                          onClick={() => handleStartRename(conv)}
                          className="p-1 rounded hover:bg-white/[0.08] text-white/40 hover:text-white/60 transition-colors"
                          title="Rename"
                        >
                          <Pencil size={9} />
                        </button>
                        <button
                          onClick={() => handleDeleteConversation(conv.id, conv.title)}
                          className="p-1 rounded hover:bg-white/[0.08] text-white/40 hover:text-red-400/50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={9} />
                        </button>
                      </div>
                    )}
                    {isTagging && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setTaggingConvId(null); setCustomTag(''); }}
                        className="shrink-0 p-1 rounded hover:bg-white/[0.08] text-white/40 hover:text-white/60 transition-colors mt-0.5"
                        title="Close"
                      >
                        <X size={9} />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
