import { supabase } from '../lib/supabase';
import type { Message } from '../types';

export async function getMessages(
  conversationId: string,
  _before?: string,
  limit = 50
): Promise<Message[]> {
  const { data, error } = await supabase
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
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data || []) as Message[];
}

export async function sendMessage(
  conversationId: string,
  messageType: string,
  content: string,
  fileUrl?: string
): Promise<Message> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      message_type: messageType,
      content: content,
      file_url: fileUrl
    })
    .select()
    .single();

  if (error) throw error;
  return data as Message;
}
