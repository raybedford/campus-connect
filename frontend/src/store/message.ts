import { create } from 'zustand';
import type { Message } from '../types';

interface MessageState {
  messages: Record<string, Message[]>; // conversationId -> messages
  setMessages: (conversationId: string, msgs: Message[]) => void;
  addMessage: (conversationId: string, msg: Message) => void;
  prependMessages: (conversationId: string, msgs: Message[]) => void;
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
      if (existing.some((m) => m.id === msg.id)) return state;
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
