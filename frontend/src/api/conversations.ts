import { supabase } from '../lib/supabase';

export async function getConversations(): Promise<any[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      members:conversation_members (
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

  // 1. Create conversation
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .insert({
      type,
      name,
      created_by: user.id
    })
    .select()
    .single();

  if (convError) throw convError;

  // 2. Add members
  const allMembers = [...new Set([...memberIds, user.id])];
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

  // Get current user's school_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.school_id) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('school_id', profile.school_id)
    .neq('id', user.id) // Exclude self
    .eq('is_verified', true)
    .order('display_name', { ascending: true });

  if (error) throw error;
  return data || [];
}
