import { create } from 'zustand';

interface PresenceState {
  onlineUsers: Set<string>;
  typingUsers: Record<string, Set<string>>; // conversationId -> set of user ids
  setOnline: (userId: string) => void;
  setOffline: (userId: string) => void;
  setTyping: (conversationId: string, userId: string) => void;
  clearTyping: (conversationId: string, userId: string) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineUsers: new Set(),
  typingUsers: {},

  setOnline: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUsers);
      next.add(userId);
      return { onlineUsers: next };
    }),

  setOffline: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUsers);
      next.delete(userId);
      return { onlineUsers: next };
    }),

  setTyping: (conversationId, userId) =>
    set((state) => {
      const current = state.typingUsers[conversationId] || new Set();
      const next = new Set(current);
      next.add(userId);
      return { typingUsers: { ...state.typingUsers, [conversationId]: next } };
    }),

  clearTyping: (conversationId, userId) =>
    set((state) => {
      const current = state.typingUsers[conversationId];
      if (!current) return state;
      const next = new Set(current);
      next.delete(userId);
      return { typingUsers: { ...state.typingUsers, [conversationId]: next } };
    }),
}));
