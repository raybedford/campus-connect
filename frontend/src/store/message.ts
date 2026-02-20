import { create } from 'zustand';
// import type { Message } from '../types';

interface MessageState {
  messages: Record<string, any[]>; // conversationId -> messages
  setMessages: (conversationId: string, msgs: any[]) => void;
  addMessage: (conversationId: string, msg: any) => void;
  prependMessages: (conversationId: string, msgs: any[]) => void;
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
}));
