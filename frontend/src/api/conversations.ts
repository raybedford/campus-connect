import { supabase } from '../lib/supabase';

export async function getConversations(): Promise<any[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      members:conversation_members (
        user_id,
        user:profiles (
          id,
          display_name,
          email,
          avatar_url
        )
      )
    `)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getConversation(id: string): Promise<any> {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      members:conversation_members (
        user_id,
        user:profiles (
          id,
          display_name,
          email,
          avatar_url
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createConversation(
  type: 'dm' | 'group',
  memberIds: string[],
  name?: string
): Promise<any> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Fetch current user's profile for school_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single();

  const allMembers = [...new Set([...memberIds, user.id])];

  // If DM, check if it already exists
  if (type === 'dm' && memberIds.length === 1) {
    const otherId = memberIds[0];
    
    // Find conversations where both are members
    const { data: existing } = await supabase
      .from('conversations')
      .select('*, members:conversation_members(user_id)')
      .eq('type', 'dm');

    const duplicate = existing?.find(conv => 
      conv.members.length === 2 && 
      conv.members.some((m: any) => m.user_id === user.id) &&
      conv.members.some((m: any) => m.user_id === otherId)
    );

    if (duplicate) return duplicate;
  }

  // 1. Create conversation
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .insert({
      type,
      name,
      created_by: user.id,
      school_id: profile?.school_id
    })
    .select()
    .single();

  if (convError) throw convError;

  // 2. Add members
  const memberEntries = allMembers.map(uid => ({
    conversation_id: conversation.id,
    user_id: uid
  }));

  const { error: memberError } = await supabase
    .from('conversation_members')
    .insert(memberEntries);

  if (memberError) throw memberError;

  return conversation;
}

export async function markAsRead(conversationId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id);
}

export async function searchUsers(query: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(20);

  if (error) throw error;
  return data || [];
}

export async function getSchoolDirectory(): Promise<any[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .neq('id', user.id) // Exclude self
    .order('display_name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function addMemberToConversation(
  conversationId: string,
  newMemberId: string,
  reEncryptedMessages?: { messageId: string; content: string }[]
): Promise<void> {
  // 1. Add member
  const { error: memberError } = await supabase
    .from('conversation_members')
    .insert({
      conversation_id: conversationId,
      user_id: newMemberId
    });

  if (memberError) throw memberError;

  // 2. If we have re-encrypted messages, update them
  if (reEncryptedMessages && reEncryptedMessages.length > 0) {
    // Perform updates in a loop (or batch if possible, but RPC is cleaner for batch)
    for (const item of reEncryptedMessages) {
      await supabase
        .from('messages')
        .update({ content: item.content })
        .eq('id', item.messageId);
    }
  }
}
