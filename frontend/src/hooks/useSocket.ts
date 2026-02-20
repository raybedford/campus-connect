import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE } from '../api/client';
import { useAuthStore } from '../store/auth';
import { useMessageStore } from '../store/message';
import { usePresenceStore } from '../store/presence';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const addMessage = useMessageStore((s) => s.addMessage);
  const { setOnline, setOffline, setTyping, clearTyping } = usePresenceStore();

  useEffect(() => {
    if (!isAuthenticated) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const token = localStorage.getItem('access_token') || 'demo-token';
    if (!token && !isAuthenticated) return;

    const socket = io(API_BASE, {
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    });

    socket.on('connect', () => {
      console.log('Socket connected');
      (window as any).__campusSocket = socket;
    });

    socket.on('new_message', (message) => {
      // Backend uses 'conversation', frontend expects 'conversation_id'
      // We should probably normalize this in the store or the backend.
      // For now, mapping it here.
      const conversation_id = message.conversation;
      addMessage(conversation_id, {
        ...message,
        conversation_id,
        decrypted_text: undefined,
      });
    });

    socket.on('user_typing', (data) => {
      setTyping(data.conversationId, data.userId);
      setTimeout(() => clearTyping(data.conversationId, data.userId), 3000);
    });

    socket.on('presence', (data) => {
      if (data.status === 'online') setOnline(data.userId);
      else setOffline(data.userId);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      (window as any).__campusSocket = undefined;
    };
  }, [isAuthenticated, addMessage, setOnline, setOffline, setTyping, clearTyping]);

  return socketRef;
}
