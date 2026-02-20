import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useMessageStore } from '../store/message';

// Hook to subscribe to real-time chat updates
export function useChatSubscription(conversationId: string | null) {
  const addMessage = useMessageStore((state) => state.addMessage);

  useEffect(() => {
    if (!conversationId) return;

    // Create a channel for this conversation
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          // payload.new is the new message object
          console.log('New message received!', payload.new);
          addMessage(conversationId, payload.new);
        }
      )
      .subscribe();

    // Cleanup when component unmounts or conversation changes
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, addMessage]);
}
