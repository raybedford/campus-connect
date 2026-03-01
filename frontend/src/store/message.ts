import { create } from 'zustand';

interface MessageState {
  messages: Record<string, any[]>;
  setMessages: (conversationId: string, msgs: any[]) => void;
  addMessage: (conversationId: string, msg: any) => void;
  prependMessages: (conversationId: string, msgs: any[]) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<any>) => void;
}

export const useMessageStore = create<MessageState>((set) => ({
  messages: {},

  setMessages: (conversationId, msgs) =>
    set((state) => ({
      messages: { ...state.messages, [conversationId]: msgs },
    })),

  addMessage: (conversationId, msg) =>
    set((state) => {
      const existing = state.messages[conversationId] || [];
      const msgId = msg._id || msg.id;
      if (existing.some((m) => (m._id || m.id) === msgId)) return state;
      return {
        messages: { ...state.messages, [conversationId]: [...existing, msg] },
      };
    }),

  prependMessages: (conversationId, msgs) =>
    set((state) => {
      const existing = state.messages[conversationId] || [];
      return {
        messages: { ...state.messages, [conversationId]: [...msgs, ...existing] },
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
}));
