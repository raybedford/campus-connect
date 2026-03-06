/**
 * Group Key Encryption System
 *
 * Each conversation has ONE symmetric group key that encrypts all messages.
 * The group key is "wrapped" (encrypted) separately for each member using their public key.
 *
 * Benefits:
 * - New members can decrypt all past messages (if given the group key)
 * - Efficient: encrypt once, not once per recipient
 * - Easy key distribution when adding members
 */

import nacl from 'tweetnacl';
import { toBase64, fromBase64 } from '../utils/base64';
import { getPrivateKey } from './keyManager';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ============================================
// GROUP KEY MANAGEMENT
// ============================================

/**
 * Generate a new random group key for a conversation
 * This key will be used to encrypt all messages in the conversation
 */
export function generateGroupKey(): Uint8Array {
  return nacl.randomBytes(nacl.secretbox.keyLength);
}

/**
 * Wrap (encrypt) a group key for a specific member using their public key
 * This allows each member to have their own encrypted copy of the group key
 */
export function wrapGroupKeyForMember(
  groupKey: Uint8Array,
  memberPublicKeyB64: string,
  senderSecretKey: Uint8Array
): { wrapped_key_b64: string; nonce_b64: string } {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const memberPK = fromBase64(memberPublicKeyB64);

  const wrapped = nacl.box(groupKey, nonce, memberPK, senderSecretKey);
  if (!wrapped) throw new Error('Failed to wrap group key');

  return {
    wrapped_key_b64: toBase64(wrapped),
    nonce_b64: toBase64(nonce),
  };
}

/**
 * Unwrap (decrypt) a group key using the current user's private key
 * This retrieves the group key that was wrapped for this user
 */
export async function unwrapGroupKey(
  wrappedKeyB64: string,
  nonceB64: string,
  wrapperPublicKeyB64: string
): Promise<Uint8Array> {
  const secretKey = await getPrivateKey();
  if (!secretKey) throw new Error('No private key available');

  const wrappedKey = fromBase64(wrappedKeyB64);
  const nonce = fromBase64(nonceB64);
  const wrapperPK = fromBase64(wrapperPublicKeyB64);

  const unwrapped = nacl.box.open(wrappedKey, nonce, wrapperPK, secretKey);
  if (!unwrapped) throw new Error('Failed to unwrap group key');

  return unwrapped;
}

// ============================================
// MESSAGE ENCRYPTION WITH GROUP KEY
// ============================================

/**
 * Encrypt a message using the conversation's group key
 * Much more efficient than encrypting separately for each recipient
 */
export function encryptMessageWithGroupKey(
  plaintext: string,
  groupKey: Uint8Array
): { ciphertext_b64: string; nonce_b64: string } {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const messageBytes = encoder.encode(plaintext);

  const encrypted = nacl.secretbox(messageBytes, nonce, groupKey);
  if (!encrypted) throw new Error('Message encryption failed');

  return {
    ciphertext_b64: toBase64(encrypted),
    nonce_b64: toBase64(nonce),
  };
}

/**
 * Decrypt a message using the conversation's group key
 */
export function decryptMessageWithGroupKey(
  ciphertextB64: string,
  nonceB64: string,
  groupKey: Uint8Array
): string {
  const ciphertext = fromBase64(ciphertextB64);
  const nonce = fromBase64(nonceB64);

  const decrypted = nacl.secretbox.open(ciphertext, nonce, groupKey);
  if (!decrypted) throw new Error('Message decryption failed');

  return decoder.decode(decrypted);
}

// ============================================
// FILE ENCRYPTION WITH GROUP KEY
// ============================================

/**
 * Encrypt a file using the conversation's group key
 */
export function encryptFileWithGroupKey(
  fileData: Uint8Array,
  groupKey: Uint8Array
): { encryptedFile: Uint8Array; nonce_b64: string } {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);

  const encrypted = nacl.secretbox(fileData, nonce, groupKey);
  if (!encrypted) throw new Error('File encryption failed');

  // Prepend nonce to encrypted data for convenience
  const encryptedFile = new Uint8Array(nonce.length + encrypted.length);
  encryptedFile.set(nonce);
  encryptedFile.set(encrypted, nonce.length);

  return {
    encryptedFile,
    nonce_b64: toBase64(nonce),
  };
}

/**
 * Decrypt a file using the conversation's group key
 */
export function decryptFileWithGroupKey(
  encryptedFile: Uint8Array,
  groupKey: Uint8Array
): Uint8Array {
  // Extract nonce from beginning of file
  const nonce = encryptedFile.slice(0, nacl.secretbox.nonceLength);
  const ciphertext = encryptedFile.slice(nacl.secretbox.nonceLength);

  const decrypted = nacl.secretbox.open(ciphertext, nonce, groupKey);
  if (!decrypted) throw new Error('File decryption failed');

  return decrypted;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convert group key to base64 for storage
 */
export function groupKeyToBase64(groupKey: Uint8Array): string {
  return toBase64(groupKey);
}

/**
 * Convert base64 string back to group key
 */
export function groupKeyFromBase64(groupKeyB64: string): Uint8Array {
  return fromBase64(groupKeyB64);
}

/**
 * Wrap group key for multiple members at once
 * Used when creating a new conversation or adding multiple members
 */
export function wrapGroupKeyForMembers(
  groupKey: Uint8Array,
  members: { userId: string; publicKeyB64: string }[],
  senderSecretKey: Uint8Array
): Array<{
  user_id: string;
  wrapped_key_b64: string;
  nonce_b64: string;
}> {
  return members.map(member => {
    const { wrapped_key_b64, nonce_b64 } = wrapGroupKeyForMember(
      groupKey,
      member.publicKeyB64,
      senderSecretKey
    );

    return {
      user_id: member.userId,
      wrapped_key_b64,
      nonce_b64,
    };
  });
}
