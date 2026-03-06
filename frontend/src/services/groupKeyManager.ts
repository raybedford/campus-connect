/**
 * Group Key Manager Service
 *
 * Manages conversation group keys in memory for fast encryption/decryption.
 * Keys are cached after being unwrapped to avoid repeated database queries.
 */

import { unwrapGroupKey, groupKeyFromBase64, groupKeyToBase64 } from '../crypto/groupEncryption';
import { getWrappedGroupKey, getAllWrappedGroupKeys } from '../api/conversationKeys';
import { getPublicKey, getBatchPublicKeys } from '../api/keys';

// In-memory cache of unwrapped group keys
// Key: conversation_id, Value: Uint8Array (group key)
const groupKeyCache = new Map<string, Uint8Array>();

// Pending fetch promises to prevent duplicate fetches (race condition fix)
const pendingFetches = new Map<string, Promise<Uint8Array | null>>();

/**
 * Get group key for a conversation (from cache or fetch & unwrap)
 */
export async function getGroupKey(conversationId: string, userId: string): Promise<Uint8Array | null> {
  // Check cache first
  if (groupKeyCache.has(conversationId)) {
    return groupKeyCache.get(conversationId)!;
  }

  // Check if fetch is already in progress (prevents race condition)
  if (pendingFetches.has(conversationId)) {
    return pendingFetches.get(conversationId)!;
  }

  // Start new fetch
  const fetchPromise = (async () => {
    try {
      // Fetch wrapped key from database
      const wrappedKey = await getWrappedGroupKey(conversationId, userId);
      if (!wrappedKey) {
        console.warn(`No group key found for conversation ${conversationId}`);
        return null;
      }

      try {
        // Get the public key of the person who wrapped it
        const wrapperPublicKey = await getPublicKey(wrappedKey.wrapped_by_user_id);
        if (!wrapperPublicKey) {
          console.error('Could not find public key of key wrapper');
          return null;
        }

        // Unwrap the group key
        const groupKey = await unwrapGroupKey(
          wrappedKey.wrapped_key_b64,
          wrappedKey.nonce_b64,
          wrapperPublicKey.public_key_b64
        );

        // Validate key length
        if (groupKey.length !== 32) {
          console.error('Invalid group key length:', groupKey.length);
          return null;
        }

        // Cache it for future use
        groupKeyCache.set(conversationId, groupKey);

        console.log(`✅ Loaded group key for conversation ${conversationId}`);
        return groupKey;
      } catch (error) {
        console.error('Failed to unwrap group key:', error);
        return null;
      }
    } finally {
      // Clean up pending fetch
      pendingFetches.delete(conversationId);
    }
  })();

  pendingFetches.set(conversationId, fetchPromise);
  return fetchPromise;
}

/**
 * Store group key in cache (used when creating new conversation)
 */
export function cacheGroupKey(conversationId: string, groupKey: Uint8Array): void {
  groupKeyCache.set(conversationId, groupKey);
  console.log(`✅ Cached group key for conversation ${conversationId}`);
}

/**
 * Remove group key from cache (when leaving conversation)
 */
export function clearGroupKey(conversationId: string): void {
  groupKeyCache.delete(conversationId);
  console.log(`🗑️ Cleared group key for conversation ${conversationId}`);
}

/**
 * Clear all cached group keys (on logout)
 */
export function clearAllGroupKeys(): void {
  groupKeyCache.clear();
  console.log('🗑️ Cleared all cached group keys');
}

/**
 * Sync all group keys for the current user on login
 * This fetches and unwraps all keys from the database
 */
export async function syncAllGroupKeys(userId: string): Promise<void> {
  console.log('🔄 Syncing all group keys...');

  try {
    // Get all wrapped keys for this user
    const wrappedKeys = await getAllWrappedGroupKeys(userId);

    if (wrappedKeys.length === 0) {
      console.log('No group keys to sync');
      return;
    }

    console.log(`Found ${wrappedKeys.length} wrapped keys to sync`);

    // Batch fetch all wrapper public keys (fixes N+1 query problem)
    const wrapperUserIds = [...new Set(wrappedKeys.map(wk => wk.wrapped_by_user_id))];
    const publicKeys = await getBatchPublicKeys(wrapperUserIds);

    // Create map for fast lookup
    const publicKeyMap = new Map(
      publicKeys.map(pk => [pk.user, pk.publicKeyB64])
    );

    console.log(`Fetched ${publicKeys.length} unique wrapper public keys`);

    // Unwrap and cache each key
    let successCount = 0;
    let failedKeys: string[] = [];

    for (const wrappedKey of wrappedKeys) {
      try {
        const wrapperPublicKeyB64 = publicKeyMap.get(wrappedKey.wrapped_by_user_id);
        if (!wrapperPublicKeyB64) {
          console.warn(`Could not find public key for wrapper ${wrappedKey.wrapped_by_user_id}`);
          failedKeys.push(wrappedKey.conversation_id);
          continue;
        }

        // Unwrap the group key
        const groupKey = await unwrapGroupKey(
          wrappedKey.wrapped_key_b64,
          wrappedKey.nonce_b64,
          wrapperPublicKeyB64
        );

        // Validate key length
        if (groupKey.length !== 32) {
          console.error(`Invalid group key length for conversation ${wrappedKey.conversation_id}`);
          failedKeys.push(wrappedKey.conversation_id);
          continue;
        }

        // Cache it
        groupKeyCache.set(wrappedKey.conversation_id, groupKey);
        successCount++;
      } catch (error) {
        console.error(`Failed to unwrap key for conversation ${wrappedKey.conversation_id}:`, error);
        failedKeys.push(wrappedKey.conversation_id);
      }
    }

    console.log(`✅ Synced ${successCount}/${wrappedKeys.length} group keys`);

    if (failedKeys.length > 0) {
      console.warn(`⚠️ Failed to sync ${failedKeys.length} keys:`, failedKeys);
    }
  } catch (error) {
    console.error('Failed to sync group keys:', error);
    throw error;
  }
}

/**
 * Check if we have a group key cached for a conversation
 */
export function hasGroupKeyCached(conversationId: string): boolean {
  return groupKeyCache.has(conversationId);
}

/**
 * Get all cached conversation IDs (for debugging)
 */
export function getCachedConversationIds(): string[] {
  return Array.from(groupKeyCache.keys());
}

/**
 * Export group key as base64 (for key backup/transfer)
 */
export function exportGroupKey(conversationId: string): string | null {
  const groupKey = groupKeyCache.get(conversationId);
  if (!groupKey) return null;
  return groupKeyToBase64(groupKey);
}

/**
 * Import group key from base64 (for key restore/transfer)
 */
export function importGroupKey(conversationId: string, groupKeyB64: string): void {
  const groupKey = groupKeyFromBase64(groupKeyB64);
  groupKeyCache.set(conversationId, groupKey);
  console.log(`✅ Imported group key for conversation ${conversationId}`);
}
