import { create } from 'zustand';
import type { Conversation } from '../types';

interface ConversationState {
  conversations: Conversation[];
  activeConversationId: string | null;
  setConversations: (convs: Conversation[]) => void;
  addConversation: (conv: Conversation) => void;
  setActiveConversation: (id: string | null) => void;
}

export const useConversationStore = create<ConversationState>((set) => ({
  conversations: [],
  activeConversationId: null,

  setConversations: (conversations) => set({ conversations }),

  addConversation: (conv) =>
    set((state) => ({
      conversations: [conv, ...state.conversations.filter((c) => c.id !== conv.id)],
    })),

  setActiveConversation: (id) => set({ activeConversationId: id }),
}));
