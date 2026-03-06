import { supabase } from '../lib/supabase';
import type { Conversation, Profile } from '../types';
import { generateGroupKey, wrapGroupKeyForMembers } from '../crypto/groupEncryption';
import { getPrivateKey } from '../crypto/keyManager';
import { getPublicKeys } from './keys';
import { saveWrappedGroupKeys } from './conversationKeys';
import { cacheGroupKey } from '../services/groupKeyManager';

export async function getConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      members:conversation_members (
        user_id,
        role,
        last_read_at,
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
  return (data || []) as Conversation[];
}

export async function getConversation(id: string): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      members:conversation_members (
        user_id,
        role,
        last_read_at,
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
  return data as Conversation;
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

  // 2. Generate and distribute group key for E2EE
  try {
    // Generate a new group key for this conversation
    const groupKey = generateGroupKey();
    console.log(`🔑 Generated group key for conversation ${conversation.id}`);

    // Get private key to wrap the group key
    const privateKey = await getPrivateKey();
    if (!privateKey) {
      console.warn('No private key available, skipping E2EE setup');
    } else {
      // Get public keys for all members
      const publicKeys = await getPublicKeys(allMembers);
      const membersWithKeys = allMembers
        .map(userId => {
          const pubKey = publicKeys.find((k: any) => k.user_id === userId);
          return pubKey ? {
            userId,
            publicKeyB64: pubKey.public_key_b64
          } : null;
        })
        .filter(Boolean) as Array<{ userId: string; publicKeyB64: string }>;

      if (membersWithKeys.length === 0) {
        console.warn('No public keys found for members, E2EE will not work');
      } else {
        // Wrap group key for each member
        const wrappedKeys = wrapGroupKeyForMembers(groupKey, membersWithKeys, privateKey);

        // Save wrapped keys to database
        await saveWrappedGroupKeys(
          wrappedKeys.map(wk => ({
            conversation_id: conversation.id,
            user_id: wk.user_id,
            wrapped_key_b64: wk.wrapped_key_b64,
            nonce_b64: wk.nonce_b64,
            wrapped_by_user_id: user.id,
          }))
        );

        // Cache the group key locally for immediate use
        cacheGroupKey(conversation.id, groupKey);

        console.log(`✅ Distributed group key to ${wrappedKeys.length} members`);
      }
    }
  } catch (error) {
    console.error('Failed to setup E2EE for conversation:', error);
    // Don't fail conversation creation if E2EE setup fails
  }

  // 3. Add members
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

export async function searchUsers(query: string): Promise<Profile[]> {
  // Escape special characters to prevent SQL injection
  const sanitizedQuery = query.replace(/%/g, '\\%').replace(/_/g, '\\_');

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`display_name.ilike.%${sanitizedQuery}%,email.ilike.%${sanitizedQuery}%`)
    .limit(20);

  if (error) throw error;
  return (data || []) as Profile[];
}

export async function getSchoolDirectory(limit = 100, offset = 0): Promise<Profile[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .neq('id', user.id) // Exclude self
    .order('display_name', { ascending: true })
    .range(offset, offset + limit - 1)
    .limit(limit);

  if (error) throw error;
  return (data || []) as Profile[];
}

export async function addMemberToConversation(
  conversationId: string,
  newMemberId: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // 1. Add member to conversation
  const { error: memberError } = await supabase
    .from('conversation_members')
    .insert({
      conversation_id: conversationId,
      user_id: newMemberId
    });

  if (memberError) throw memberError;

  // 2. Distribute group key to new member
  try {
    // Get the group key for this conversation
    const { getGroupKey } = await import('../services/groupKeyManager');
    const groupKey = await getGroupKey(conversationId, user.id);

    if (!groupKey) {
      console.warn('No group key found for conversation, new member won\'t be able to decrypt messages');
      return;
    }

    // Get new member's public key
    const newMemberKey = await getPublicKeys([newMemberId]);
    if (newMemberKey.length === 0 || !newMemberKey[0].public_key_b64) {
      console.warn('New member has no public key, cannot distribute group key');
      return;
    }

    // Get current user's private key to wrap the group key
    const privateKey = await getPrivateKey();
    if (!privateKey) {
      console.warn('No private key available to wrap group key');
      return;
    }

    // Wrap the group key for the new member
    const wrappedKey = wrapGroupKeyForMembers(
      groupKey,
      [{
        userId: newMemberId,
        publicKeyB64: newMemberKey[0].public_key_b64
      }],
      privateKey
    );

    // Save the wrapped key
    await saveWrappedGroupKeys(
      wrappedKey.map(wk => ({
        conversation_id: conversationId,
        user_id: wk.user_id,
        wrapped_key_b64: wk.wrapped_key_b64,
        nonce_b64: wk.nonce_b64,
        wrapped_by_user_id: user.id,
      }))
    );

    console.log(`✅ Distributed group key to new member ${newMemberId}`);
  } catch (error) {
    console.error('Failed to distribute group key to new member:', error);
    // Don't fail the member addition if key distribution fails
  }

  // 3. Update conversation type to 'group' since it now has 3+ people
  const { data: members } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', conversationId);

  if (members && members.length >= 3) {
    await supabase
      .from('conversations')
      .update({ type: 'group' })
      .eq('id', conversationId);
  }
}
