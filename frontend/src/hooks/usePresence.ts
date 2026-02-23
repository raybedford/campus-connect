import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { usePresenceStore } from '../store/presence';
import { useAuthStore } from '../store/auth';

export function usePresence(conversationId: string | null) {
  const { user } = useAuthStore();
  const setTyping = usePresenceStore((s) => s.setTyping);
  const clearTyping = usePresenceStore((s) => s.clearTyping);
  const setOnline = usePresenceStore((s) => s.setOnline);
  const setOffline = usePresenceStore((s) => s.setOffline);

  useEffect(() => {
    if (!conversationId || !user) return;

    const channel = supabase.channel(`presence:${conversationId}`);

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        // Update online users
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
          // Auto-clear typing after 3 seconds
          setTimeout(() => {
            clearTyping(conversationId, user_id);
          }, 3000);
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
      supabase.removeChannel(channel);
    };
  }, [conversationId, user]);

  const sendTyping = (is_typing: boolean) => {
    if (!conversationId || !user) return;
    const channel = supabase.channel(`presence:${conversationId}`);
    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: user.id, is_typing },
    });
  };

  return { sendTyping };
}
