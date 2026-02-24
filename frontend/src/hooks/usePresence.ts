import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { usePresenceStore } from '../store/presence';
import { useAuthStore } from '../store/auth';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function usePresence(conversationId: string | null) {
  const { user } = useAuthStore();
  const setTyping = usePresenceStore((s) => s.setTyping);
  const clearTyping = usePresenceStore((s) => s.clearTyping);
  const setOnline = usePresenceStore((s) => s.setOnline);
  const setOffline = usePresenceStore((s) => s.setOffline);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!conversationId || !user) return;

    const channel = supabase.channel(`presence:${conversationId}`);
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        Object.keys(state).forEach((userId) => {
          setOnline(userId);
        });
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach((p: any) => setOnline(p.user_id));
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((p: any) => setOffline(p.user_id));
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const { user_id, is_typing } = payload;
        if (is_typing) {
          setTyping(conversationId, user_id);
        } else {
          clearTyping(conversationId, user_id);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [conversationId, user]);

  const sendTyping = useCallback((is_typing: boolean) => {
    if (!conversationId || !user || !channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: user.id, is_typing },
    });
  }, [conversationId, user]);

  return { sendTyping };
}
