import { useEffect, useRef, useCallback } from 'react';
import { API_BASE } from '../api/client';
import { useAuthStore } from '../store/auth';
import { useMessageStore } from '../store/message';
import { usePresenceStore } from '../store/presence';
import type { WsServerEvent, Message } from '../types';

const MAX_RECONNECT_DELAY = 30000;
const BASE_DELAY = 1000;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const addMessage = useMessageStore((s) => s.addMessage);
  const { setOnline, setOffline, setTyping, clearTyping } = usePresenceStore();

  const connect = useCallback(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const wsUrl = API_BASE.replace(/^http/, 'ws') + `/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      (window as any).__campusWs = ws;
      reconnectAttempt.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data: WsServerEvent = JSON.parse(event.data);

        switch (data.type) {
          case 'new_message': {
            const msg: Message = {
              ...data.message,
              decrypted_text: undefined, // Will be decrypted by Chat page
            };
            addMessage(data.message.conversation_id, msg);
            break;
          }
          case 'user_typing': {
            setTyping(data.conversation_id, data.user_id);
            setTimeout(() => clearTyping(data.conversation_id, data.user_id), 3000);
            break;
          }
          case 'presence': {
            if (data.status === 'online') setOnline(data.user_id);
            else setOffline(data.user_id);
            break;
          }
          case 'message_ack':
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = (event) => {
      (window as any).__campusWs = undefined;
      wsRef.current = null;

      // Don't reconnect if auth failed or intentional close
      if (event.code === 4001 || event.code === 1000) return;

      // Exponential backoff reconnection
      const delay = Math.min(BASE_DELAY * Math.pow(2, reconnectAttempt.current), MAX_RECONNECT_DELAY);
      reconnectAttempt.current++;
      reconnectTimer.current = setTimeout(() => {
        if (localStorage.getItem('access_token')) {
          connect();
        }
      }, delay);
    };

    ws.onerror = () => {
      // onclose will handle reconnection
    };

    wsRef.current = ws;
  }, [addMessage, setOnline, setOffline, setTyping, clearTyping]);

  useEffect(() => {
    if (!isAuthenticated) return;
    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close(1000);
        (window as any).__campusWs = undefined;
      }
    };
  }, [isAuthenticated, connect]);

  return wsRef;
}
