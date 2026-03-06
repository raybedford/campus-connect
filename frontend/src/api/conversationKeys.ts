/**
 * API for managing conversation group keys
 *
 * Each conversation has a group key that's wrapped (encrypted) for each member.
 * This allows new members to decrypt all past messages.
 */

import { supabase } from '../lib/supabase';

export interface WrappedGroupKey {
  id?: string;
  conversation_id: string;
  user_id: string;
  wrapped_key_b64: string;
  nonce_b64: string;
  wrapped_by_user_id: string;
  created_at?: string;
}

/**
 * Store wrapped group key for a user in a conversation
 */
export async function saveWrappedGroupKey(data: {
  conversation_id: string;
  user_id: string;
  wrapped_key_b64: string;
  nonce_b64: string;
  wrapped_by_user_id: string;
}): Promise<void> {
  const { error } = await supabase
    .from('conversation_keys')
    .upsert({
      conversation_id: data.conversation_id,
      user_id: data.user_id,
      wrapped_key_b64: data.wrapped_key_b64,
      nonce_b64: data.nonce_b64,
      wrapped_by_user_id: data.wrapped_by_user_id,
    }, {
      onConflict: 'conversation_id,user_id'
    });

  if (error) {
    console.error('Failed to save wrapped group key:', error);
    throw new Error('Failed to save conversation key');
  }
}

/**
 * Store wrapped group keys for multiple users at once
 * Used when creating a new conversation or adding multiple members
 */
export async function saveWrappedGroupKeys(
  keys: Array<{
    conversation_id: string;
    user_id: string;
    wrapped_key_b64: string;
    nonce_b64: string;
    wrapped_by_user_id: string;
  }>
): Promise<void> {
  const { error } = await supabase
    .from('conversation_keys')
    .upsert(keys, {
      onConflict: 'conversation_id,user_id'
    });

  if (error) {
    console.error('Failed to save wrapped group keys:', error);
    throw new Error('Failed to save conversation keys');
  }
}

/**
 * Get wrapped group key for current user in a conversation
 */
export async function getWrappedGroupKey(
  conversationId: string,
  userId: string
): Promise<WrappedGroupKey | null> {
  const { data, error } = await supabase
    .from('conversation_keys')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found - this is okay, might be a new conversation
      return null;
    }
    console.error('Failed to fetch wrapped group key:', error);
    throw new Error('Failed to fetch conversation key');
  }

  return data;
}

/**
 * Get all wrapped group keys for the current user across all their conversations
 * Used on login to sync all keys
 */
export async function getAllWrappedGroupKeys(
  userId: string
): Promise<WrappedGroupKey[]> {
  const { data, error } = await supabase
    .from('conversation_keys')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to fetch all wrapped group keys:', error);
    throw new Error('Failed to fetch conversation keys');
  }

  return data || [];
}

/**
 * Get all members' wrapped keys for a conversation
 * Used when a member needs to see who has access
 */
export async function getConversationWrappedKeys(
  conversationId: string
): Promise<WrappedGroupKey[]> {
  const { data, error } = await supabase
    .from('conversation_keys')
    .select('*')
    .eq('conversation_id', conversationId);

  if (error) {
    console.error('Failed to fetch conversation wrapped keys:', error);
    throw new Error('Failed to fetch conversation keys');
  }

  return data || [];
}

/**
 * Delete wrapped group key for a user (when they leave a conversation)
 */
export async function deleteWrappedGroupKey(
  conversationId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('conversation_keys')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to delete wrapped group key:', error);
    throw new Error('Failed to delete conversation key');
  }
}

/**
 * Check if a user has a group key for a conversation
 */
export async function hasGroupKey(
  conversationId: string,
  userId: string
): Promise<boolean> {
  const key = await getWrappedGroupKey(conversationId, userId);
  return key !== null;
}
