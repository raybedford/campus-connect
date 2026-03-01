import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { useNotificationStore } from '../store/notification';
import { getConversations } from '../api/conversations';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface ConvInfo {
  name: string;
  type: string;
  members: any[];
}

export function useNotifications() {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const msgChannelRef = useRef<RealtimeChannel | null>(null);
  const memberChannelRef = useRef<RealtimeChannel | null>(null);
  const convMapRef = useRef<Record<string, ConvInfo>>({});

  const buildChannel = useCallback(async () => {
    if (!user) return;

    // Tear down existing message channel
    if (msgChannelRef.current) {
      supabase.removeChannel(msgChannelRef.current);
      msgChannelRef.current = null;
    }

    const conversations = await getConversations();
    if (!conversations || conversations.length === 0) return;

    // Build lookup map
    const convMap: Record<string, ConvInfo> = {};
    conversations.forEach((conv: any) => {
      convMap[conv.id] = {
        name: conv.name || '',
        type: conv.type,
        members: conv.members || [],
      };
    });
    convMapRef.current = convMap;

    // Subscribe to messages across all conversations
    const convIds = conversations.map((c: any) => c.id);
    const filter = `conversation_id=in.(${convIds.join(',')})`;

    const channel = supabase
      .channel('global-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter,
        },
        (payload) => {
          const msg = payload.new as any;

          // Don't notify for own messages
          if (msg.sender_id === user.id) return;

          // Don't notify if currently viewing this conversation
          if (window.location.pathname === `/conversations/${msg.conversation_id}`) return;

          // Resolve sender name and conversation label
          const convInfo = convMapRef.current[msg.conversation_id];
          let senderName = 'Someone';
          let conversationLabel = senderName;

          if (convInfo) {
            const senderMember = convInfo.members.find(
              (m: any) => (m.user?.id || m.user_id) === msg.sender_id
            );
            senderName = senderMember?.user?.display_name || 'Someone';

            if (convInfo.type === 'group') {
              conversationLabel = convInfo.name || 'Group Chat';
            } else {
              conversationLabel = senderName;
            }
          }

          // Check if current user was @mentioned
          const mentionedIds: string[] = msg.mentioned_user_ids || [];
          const isMention = mentionedIds.includes(user.id);

          // Add to in-app notification store (bell icon)
          useNotificationStore.getState().addNotification({
            id: msg.id,
            conversationId: msg.conversation_id,
            senderName,
            conversationLabel,
            isGroup: convInfo?.type === 'group',
            isMention,
            timestamp: Date.now(),
          });

          // Show browser notification if permission granted
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const title = convInfo?.type === 'group' ? conversationLabel : senderName;
            const body = isMention
              ? `${senderName} mentioned you`
              : convInfo?.type === 'group'
                ? `${senderName} sent a message`
                : 'Sent you a new message';

            const notification = new Notification(title, {
              body,
              icon: '/vite.svg',
              tag: `msg-${msg.conversation_id}`,
            });

            notification.onclick = () => {
              window.focus();
              navigate(`/conversations/${msg.conversation_id}`);
              notification.close();
            };
          }
        }
      )
      .subscribe();

    msgChannelRef.current = channel;
  }, [user, navigate]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    let cancelled = false;

    const setup = async () => {
      await buildChannel();
      if (cancelled) return;

      // Listen for new conversation memberships to re-subscribe
      const memberChannel = supabase
        .channel('global-notif-members')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'conversation_members',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            // Rebuild message subscription with new conversation
            buildChannel().catch(console.error);
          }
        )
        .subscribe();

      memberChannelRef.current = memberChannel;
    };

    setup().catch(console.error);

    return () => {
      cancelled = true;
      if (msgChannelRef.current) {
        supabase.removeChannel(msgChannelRef.current);
        msgChannelRef.current = null;
      }
      if (memberChannelRef.current) {
        supabase.removeChannel(memberChannelRef.current);
        memberChannelRef.current = null;
      }
    };
  }, [isAuthenticated, user?.id, buildChannel]);
}
