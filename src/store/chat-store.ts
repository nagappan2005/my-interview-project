import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: {
    id: string;
    filename: string;
    chunkIndex: number;
    content: string;
    score: number;
  }[];
  confidence?: number;
  feedback?: 'positive' | 'negative';
  timestamp: Date;
}

export interface DocumentInfo {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  status: 'processing' | 'ready' | 'error';
  chunkCount: number;
  errorMessage?: string | null;
  createdAt: string;
  enabled?: boolean;
}

export interface ConversationMeta {
  id: string;
  title: string;
  timestamp: string;
  messageCount: number;
  tags?: string[];
}

// ─── localStorage helpers ─────────────────────────────────────────────
const MESSAGES_KEY = 'docqa-messages';
const CONVERSATIONS_KEY = 'docqa-conversations';
const BOOKMARKS_KEY = 'docqa-bookmarks';

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function serializeMessages(messages: ChatMessage[]): string {
  return JSON.stringify(
    messages.map((m) => ({
      ...m,
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
    }))
  );
}

function deserializeMessages(raw: string): ChatMessage[] {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((m: Record<string, unknown>) => ({
    ...m,
    timestamp: new Date(m.timestamp as string),
  }));
}

function loadMessagesFromStorage(): ChatMessage[] {
  const raw = safeGetItem(MESSAGES_KEY);
  if (!raw) return [];
  try {
    return deserializeMessages(raw);
  } catch {
    return [];
  }
}

function loadConversationsFromStorage(): ConversationMeta[] {
  const raw = safeGetItem(CONVERSATIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadBookmarksFromStorage(): string[] {
  const raw = safeGetItem(BOOKMARKS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function generateConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function generateTitleFromMessages(messages: ChatMessage[]): string {
  const firstUserMsg = messages.find((m) => m.role === 'user');
  if (!firstUserMsg) return 'New Conversation';
  const content = firstUserMsg.content.trim();
  return content.length > 50 ? content.substring(0, 47) + '...' : content;
}

// ─── localStorage Quota Management ──────────────────────────────────
const STORAGE_QUOTA_BYTES = 4 * 1024 * 1024; // 4MB safety limit (browsers typically allow 5-10MB)
const MAX_CONVERSATIONS = 50; // Maximum number of conversations to keep

function getLocalStorageUsageBytes(): number {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key) || '';
        // Each char is ~2 bytes in UTF-16
        total += (key.length + value.length) * 2;
      }
    }
  } catch {
    // ignore
  }
  return total;
}

function pruneOldConversations(conversations: ConversationMeta[], keepCount: number): ConversationMeta[] {
  // Sort by timestamp descending, keep the most recent
  const sorted = [...conversations].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const toRemove = sorted.slice(keepCount);

  // Remove old conversation data from localStorage
  for (const conv of toRemove) {
    safeRemoveItem(`docqa-conv-${conv.id}`);
  }

  return sorted.slice(0, keepCount);
}

function autoPruneIfNeeded(conversations: ConversationMeta[]): ConversationMeta[] {
  let result = conversations;

  // Prune by count
  if (result.length > MAX_CONVERSATIONS) {
    result = pruneOldConversations(result, MAX_CONVERSATIONS);
  }

  // Prune by storage size
  const usage = getLocalStorageUsageBytes();
  if (usage > STORAGE_QUOTA_BYTES && result.length > 5) {
    // Remove oldest conversations until we're under quota
    let pruned = [...result].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    while (getLocalStorageUsageBytes() > STORAGE_QUOTA_BYTES * 0.7 && pruned.length > 5) {
      const removed = pruned.shift();
      if (removed) {
        safeRemoveItem(`docqa-conv-${removed.id}`);
      }
    }
    result = pruned;
  }

  return result;
}

// ─── Store ─────────────────────────────────────────────────────────────
interface ChatStore {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  documents: DocumentInfo[];
  isUploading: boolean;
  uploadProgress: number;
  sidebarOpen: boolean;
  activeDocumentId: string | null;

  // Conversation persistence
  conversationId: string;
  conversationTitle: string;
  conversations: ConversationMeta[];
  isPersisted: boolean;

  // Bookmarks
  bookmarkedMessageIds: string[];

  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  setLoading: (loading: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setDocuments: (docs: DocumentInfo[]) => void;
  addDocument: (doc: DocumentInfo) => void;
  removeDocument: (id: string) => void;
  updateDocumentStatus: (id: string, status: string, errorMessage?: string) => void;
  toggleDocumentEnabled: (id: string) => void;
  enableAllDocuments: () => void;
  setUploading: (uploading: boolean) => void;
  setUploadProgress: (progress: number) => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveDocumentId: (id: string | null) => void;
  clearChat: () => void;

  // Conversation persistence actions
  saveCurrentConversation: () => void;
  loadConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  startNewConversation: () => void;

  // Bookmark actions
  toggleBookmark: (messageId: string) => void;

  // Branching
  branchFromMessage: (messageId: string) => string;

  // Conversation tags/labels
  addConversationTag: (conversationId: string, tag: string) => void;
  removeConversationTag: (conversationId: string, tag: string) => void;

  // Storage management
  getStorageUsage: () => { usedBytes: number; totalBytes: number; conversationCount: number };
  pruneConversations: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => {
  // Initialize from localStorage
  const initialMessages = loadMessagesFromStorage();
  const initialConversations = loadConversationsFromStorage();
  const initialConversationId = generateConversationId();
  const initialConversationTitle = initialMessages.length > 0
    ? generateTitleFromMessages(initialMessages)
    : 'New Conversation';
  const initialIsPersisted = initialMessages.length > 0;
  const initialBookmarks = loadBookmarksFromStorage();

  return {
    messages: initialMessages,
    isLoading: false,
    isStreaming: false,
    documents: [],
    isUploading: false,
    uploadProgress: 0,
    sidebarOpen: false,
    activeDocumentId: null,

    conversationId: initialConversationId,
    conversationTitle: initialConversationTitle,
    conversations: initialConversations,
    isPersisted: initialIsPersisted,

    bookmarkedMessageIds: initialBookmarks,

    addMessage: (message) =>
      set((state) => {
        const newMessages = [...state.messages, message];
        const title = state.messages.length === 0 && message.role === 'user'
          ? generateTitleFromMessages(newMessages)
          : state.conversationTitle;

        // Auto-save to localStorage
        if (newMessages.length > 0) {
          safeSetItem(MESSAGES_KEY, serializeMessages(newMessages));
        }

        // Auto-save conversation to history
        const meta: ConversationMeta = {
          id: state.conversationId,
          title: title || state.conversationTitle,
          timestamp: new Date().toISOString(),
          messageCount: newMessages.length,
        };
        safeSetItem(`docqa-conv-${state.conversationId}`, serializeMessages(newMessages));

        const existingIdx = state.conversations.findIndex((c) => c.id === state.conversationId);
        let newConversations: ConversationMeta[];
        if (existingIdx >= 0) {
          newConversations = [...state.conversations];
          newConversations[existingIdx] = meta;
        } else {
          newConversations = [meta, ...state.conversations];
        }
        safeSetItem(CONVERSATIONS_KEY, JSON.stringify(newConversations));

        // Auto-prune if needed
        const pruned = autoPruneIfNeeded(newConversations);
        if (pruned.length !== newConversations.length) {
          safeSetItem(CONVERSATIONS_KEY, JSON.stringify(pruned));
        }

        return {
          messages: newMessages,
          conversationTitle: title,
          isPersisted: true,
          conversations: pruned,
        };
      }),

    updateMessage: (id, updates) =>
      set((state) => {
        const newMessages = state.messages.map((m) =>
          m.id === id ? { ...m, ...updates } : m
        );

        // Auto-save after update (e.g., streaming content, feedback)
        if (newMessages.length > 0) {
          safeSetItem(MESSAGES_KEY, serializeMessages(newMessages));
          // Also update the conversation-specific copy
          safeSetItem(`docqa-conv-${state.conversationId}`, serializeMessages(newMessages));
        }

        return { messages: newMessages };
      }),

    setLoading: (loading) => set({ isLoading: loading }),

    setStreaming: (streaming) => set({ isStreaming: streaming }),

    setDocuments: (docs) => set({ documents: docs.map(d => ({ ...d, enabled: d.enabled ?? true })) }),

    addDocument: (doc) =>
      set((state) => ({ documents: [{ ...doc, enabled: true }, ...state.documents] })),

    removeDocument: (id) =>
      set((state) => ({ documents: state.documents.filter((d) => d.id !== id) })),

    updateDocumentStatus: (id, status, errorMessage) =>
      set((state) => ({
        documents: state.documents.map((d) =>
          d.id === id ? { ...d, status: status as DocumentInfo['status'], errorMessage } : d
        ),
      })),

    toggleDocumentEnabled: (id) =>
      set((state) => ({
        documents: state.documents.map((d) =>
          d.id === id ? { ...d, enabled: !d.enabled } : d
        ),
      })),

    enableAllDocuments: () =>
      set((state) => ({
        documents: state.documents.map((d) => ({ ...d, enabled: true })),
      })),

    setUploading: (uploading) => set({ isUploading: uploading }),

    setUploadProgress: (progress) => set({ uploadProgress: progress }),

    setSidebarOpen: (open) => set({ sidebarOpen: open }),

    setActiveDocumentId: (id) => set({ activeDocumentId: id }),

    clearChat: () => {
      // Save current conversation before clearing
      const state = get();
      if (state.messages.length > 0) {
        get().saveCurrentConversation();
      }

      // Clear messages from localStorage
      safeRemoveItem(MESSAGES_KEY);

      set({
        messages: [],
        isStreaming: false,
        conversationId: generateConversationId(),
        conversationTitle: 'New Conversation',
        isPersisted: false,
      });
    },

    saveCurrentConversation: () => {
      const state = get();
      if (state.messages.length === 0) return;

      const title = state.conversationTitle || generateTitleFromMessages(state.messages);
      const meta: ConversationMeta = {
        id: state.conversationId,
        title,
        timestamp: new Date().toISOString(),
        messageCount: state.messages.length,
      };

      // Save messages under conversation-specific key
      safeSetItem(`docqa-conv-${state.conversationId}`, serializeMessages(state.messages));

      // Update conversations list
      const existing = state.conversations.findIndex((c) => c.id === state.conversationId);
      let newConversations: ConversationMeta[];

      if (existing >= 0) {
        newConversations = [...state.conversations];
        newConversations[existing] = meta;
      } else {
        newConversations = [meta, ...state.conversations];
      }

      safeSetItem(CONVERSATIONS_KEY, JSON.stringify(newConversations));
      set({ conversations: newConversations, conversationTitle: title });
    },

    loadConversation: (id: string) => {
      // Save current conversation first
      const state = get();
      if (state.messages.length > 0) {
        get().saveCurrentConversation();
      }

      // Load messages for the selected conversation
      const raw = safeGetItem(`docqa-conv-${id}`);
      if (!raw) return;

      try {
        const messages = deserializeMessages(raw);
        const meta = state.conversations.find((c) => c.id === id);

        // Also set as current messages in main key
        safeSetItem(MESSAGES_KEY, raw);

        set({
          messages,
          conversationId: id,
          conversationTitle: meta?.title || generateTitleFromMessages(messages),
          isPersisted: true,
        });
      } catch {
        // Failed to load, ignore
      }
    },

    deleteConversation: (id: string) => {
      safeRemoveItem(`docqa-conv-${id}`);

      set((state) => {
        const newConversations = state.conversations.filter((c) => c.id !== id);
        safeSetItem(CONVERSATIONS_KEY, JSON.stringify(newConversations));

        // If deleting current conversation, clear chat
        if (state.conversationId === id) {
          safeRemoveItem(MESSAGES_KEY);
          return {
            conversations: newConversations,
            messages: [],
            conversationId: generateConversationId(),
            conversationTitle: 'New Conversation',
            isPersisted: false,
          };
        }

        return { conversations: newConversations };
      });
    },

    renameConversation: (id: string, title: string) => {
      set((state) => {
        const newConversations = state.conversations.map((c) =>
          c.id === id ? { ...c, title } : c
        );
        safeSetItem(CONVERSATIONS_KEY, JSON.stringify(newConversations));

        const conversationTitle = state.conversationId === id ? title : state.conversationTitle;

        return { conversations: newConversations, conversationTitle };
      });
    },

    startNewConversation: () => {
      const state = get();
      // Save current conversation first
      if (state.messages.length > 0) {
        get().saveCurrentConversation();
      }

      // Clear messages from localStorage and start fresh
      safeRemoveItem(MESSAGES_KEY);

      set({
        messages: [],
        isStreaming: false,
        conversationId: generateConversationId(),
        conversationTitle: 'New Conversation',
        isPersisted: false,
      });
    },

    toggleBookmark: (messageId: string) => {
      set((state) => {
        const isCurrentlyBookmarked = state.bookmarkedMessageIds.includes(messageId);
        const newBookmarks = isCurrentlyBookmarked
          ? state.bookmarkedMessageIds.filter((id) => id !== messageId)
          : [...state.bookmarkedMessageIds, messageId];
        safeSetItem(BOOKMARKS_KEY, JSON.stringify(newBookmarks));
        return { bookmarkedMessageIds: newBookmarks };
      });
    },

    branchFromMessage: (messageId: string) => {
      const state = get();
      const messageIndex = state.messages.findIndex((m) => m.id === messageId);
      if (messageIndex < 0) return state.conversationId;

      // Save current conversation first
      if (state.messages.length > 0) {
        get().saveCurrentConversation();
      }

      // Create new conversation with messages up to and including the target message
      const branchedMessages = state.messages.slice(0, messageIndex + 1);
      const newConversationId = generateConversationId();
      const newTitle = generateTitleFromMessages(branchedMessages);

      // Save branched messages
      safeSetItem(MESSAGES_KEY, serializeMessages(branchedMessages));
      safeSetItem(`docqa-conv-${newConversationId}`, serializeMessages(branchedMessages));

      // Add new conversation to history
      const meta: ConversationMeta = {
        id: newConversationId,
        title: newTitle,
        timestamp: new Date().toISOString(),
        messageCount: branchedMessages.length,
      };

      const newConversations = [meta, ...state.conversations];
      safeSetItem(CONVERSATIONS_KEY, JSON.stringify(newConversations));

      set({
        messages: branchedMessages,
        conversationId: newConversationId,
        conversationTitle: newTitle,
        isPersisted: true,
        conversations: newConversations,
        isStreaming: false,
      });

      return newConversationId;
    },

    addConversationTag: (conversationId: string, tag: string) => {
      set((state) => {
        const newConversations = state.conversations.map((c) => {
          if (c.id === conversationId) {
            const existingTags = c.tags || [];
            if (existingTags.includes(tag)) return c;
            return { ...c, tags: [...existingTags, tag] };
          }
          return c;
        });
        safeSetItem(CONVERSATIONS_KEY, JSON.stringify(newConversations));
        return { conversations: newConversations };
      });
    },

    removeConversationTag: (conversationId: string, tag: string) => {
      set((state) => {
        const newConversations = state.conversations.map((c) => {
          if (c.id === conversationId) {
            return { ...c, tags: (c.tags || []).filter((t) => t !== tag) };
          }
          return c;
        });
        safeSetItem(CONVERSATIONS_KEY, JSON.stringify(newConversations));
        return { conversations: newConversations };
      });
    },

    getStorageUsage: () => {
      const usedBytes = getLocalStorageUsageBytes();
      const state = get();
      return {
        usedBytes,
        totalBytes: STORAGE_QUOTA_BYTES,
        conversationCount: state.conversations.length,
      };
    },

    pruneConversations: () => {
      const state = get();
      const pruned = autoPruneIfNeeded(state.conversations);
      safeSetItem(CONVERSATIONS_KEY, JSON.stringify(pruned));
      set({ conversations: pruned });
    },
  };
});
