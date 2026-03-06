import { supabase } from '../lib/supabase';
import type { Message } from '../types';

export async function getMessages(
  conversationId: string,
  before?: string,
  limit = 50
): Promise<Message[]> {
  let query = supabase
    .from('messages')
    .select(`
      *,
      sender:profiles (
        id,
        email,
        display_name,
        avatar_url
      )
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false }); // Most recent first

  // Pagination: load messages before a specific timestamp
  if (before) {
    query = query.lt('created_at', before);
  }

  query = query.limit(limit);

  const { data, error } = await query;

  if (error) throw error;

  // Reverse to show oldest at top, newest at bottom
  return ((data || []) as Message[]).reverse();
}

export async function sendMessage(
  conversationId: string,
  messageType: string,
  content: string,
  fileUrl?: string,
  mentionedUserIds?: string[]
): Promise<Message> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const row: Record<string, any> = {
    conversation_id: conversationId,
    sender_id: user.id,
    message_type: messageType,
    content: content,
    file_url: fileUrl,
  };
  if (mentionedUserIds && mentionedUserIds.length > 0) {
    row.mentioned_user_ids = mentionedUserIds;
  }

  const { data, error } = await supabase
    .from('messages')
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data as Message;
}

export async function editMessage(
  messageId: string,
  newContent: string
): Promise<Message> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('messages')
    .update({
      content: newContent,
      edited_at: new Date().toISOString(),
    })
    .eq('id', messageId)
    .eq('sender_id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data as Message;
}

export async function deleteMessage(messageId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('messages')
    .update({
      is_deleted: true,
      content: null,
      file_url: null,
    })
    .eq('id', messageId)
    .eq('sender_id', user.id);

  if (error) throw error;
}
