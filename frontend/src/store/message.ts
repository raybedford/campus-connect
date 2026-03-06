import { create } from 'zustand';

interface MessageState {
  messages: Record<string, any[]>;
  lastAccessed: Record<string, number>; // Track when conversation was last viewed
  setMessages: (conversationId: string, msgs: any[]) => void;
  addMessage: (conversationId: string, msg: any) => void;
  prependMessages: (conversationId: string, msgs: any[]) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<any>) => void;
  clearConversation: (conversationId: string) => void;
  pruneOldConversations: () => void; // Keep only recent 5 conversations in memory
  touchConversation: (conversationId: string) => void; // Update last accessed time
}

export const useMessageStore = create<MessageState>((set) => ({
  messages: {},
  lastAccessed: {},

  touchConversation: (conversationId) =>
    set((state) => ({
      lastAccessed: { ...state.lastAccessed, [conversationId]: Date.now() },
    })),

  setMessages: (conversationId, msgs) =>
    set((state) => ({
      messages: { ...state.messages, [conversationId]: msgs.slice(-200) }, // Cap at 200
      lastAccessed: { ...state.lastAccessed, [conversationId]: Date.now() },
    })),

  addMessage: (conversationId, msg) =>
    set((state) => {
      const existing = state.messages[conversationId] || [];
      const msgId = msg._id || msg.id;
      if (existing.some((m) => (m._id || m.id) === msgId)) return state;

      // Add and cap at 200 messages
      const updated = [...existing, msg].slice(-200);

      return {
        messages: { ...state.messages, [conversationId]: updated },
        lastAccessed: { ...state.lastAccessed, [conversationId]: Date.now() },
      };
    }),

  prependMessages: (conversationId, msgs) =>
    set((state) => {
      const existing = state.messages[conversationId] || [];
      // Prepend and cap at 200
      const updated = [...msgs, ...existing].slice(-200);
      return {
        messages: { ...state.messages, [conversationId]: updated },
        lastAccessed: { ...state.lastAccessed, [conversationId]: Date.now() },
      };
    }),

  updateMessage: (conversationId, messageId, updates) =>
    set((state) => {
      const existing = state.messages[conversationId] || [];
      return {
        messages: {
          ...state.messages,
          [conversationId]: existing.map((m) =>
            (m._id || m.id) === messageId ? { ...m, ...updates } : m
          ),
        },
      };
    }),

  clearConversation: (conversationId) =>
    set((state) => {
      const { [conversationId]: removed, ...restMessages } = state.messages;
      const { [conversationId]: removedAccess, ...restAccessed } = state.lastAccessed;
      return {
        messages: restMessages,
        lastAccessed: restAccessed,
      };
    }),

  pruneOldConversations: () =>
    set((state) => {
      const { messages, lastAccessed } = state;

      // Keep only 5 most recently accessed conversations
      const sortedConvIds = Object.keys(lastAccessed)
        .sort((a, b) => (lastAccessed[b] || 0) - (lastAccessed[a] || 0))
        .slice(0, 5);

      const prunedMessages: Record<string, any[]> = {};
      const prunedAccessed: Record<string, number> = {};

      sortedConvIds.forEach(convId => {
        if (messages[convId]) {
          prunedMessages[convId] = messages[convId];
          prunedAccessed[convId] = lastAccessed[convId];
        }
      });

      return {
        messages: prunedMessages,
        lastAccessed: prunedAccessed,
      };
    }),
}));
