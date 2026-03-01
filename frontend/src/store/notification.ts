import { create } from 'zustand';

interface NotificationItem {
  id: string;
  conversationId: string;
  senderName: string;
  conversationLabel: string;
  isGroup: boolean;
  isMention?: boolean;
  timestamp: number;
}

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  addNotification: (notif: NotificationItem) => void;
  clearForConversation: (conversationId: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (notif) =>
    set((state) => {
      const updated = [notif, ...state.notifications].slice(0, 50);
      return { notifications: updated, unreadCount: updated.length };
    }),

  clearForConversation: (conversationId) =>
    set((state) => {
      const updated = state.notifications.filter(
        (n) => n.conversationId !== conversationId
      );
      return { notifications: updated, unreadCount: updated.length };
    }),

  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}));
