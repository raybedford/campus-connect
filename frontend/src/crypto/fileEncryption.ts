import nacl from 'tweetnacl';
import { toBase64, fromBase64 } from '../utils/base64';
import type { EncryptedPayload } from '../types';

/**
 * Encrypt a file with a random symmetric key (nacl.secretbox),
 * then encrypt that key per-recipient with nacl.box.
 */
export function encryptFile(
  fileData: Uint8Array,
  recipients: { userId: string; publicKeyB64: string }[],
  senderSecretKey: Uint8Array,
): { encryptedBlob: Uint8Array; keyPayloads: EncryptedPayload[] } {
  // Generate random symmetric key
  const symmetricKey = nacl.randomBytes(nacl.secretbox.keyLength);
  const fileNonce = nacl.randomBytes(nacl.secretbox.nonceLength);

  // Encrypt file with symmetric key
  const encryptedFile = nacl.secretbox(fileData, fileNonce, symmetricKey);

  // Prepend nonce to encrypted file for self-contained blob
  const encryptedBlob = new Uint8Array(fileNonce.length + encryptedFile.length);
  encryptedBlob.set(fileNonce, 0);
  encryptedBlob.set(encryptedFile, fileNonce.length);

  // Encrypt symmetric key per recipient
  const keyPayloads: EncryptedPayload[] = recipients.map((r) => {
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const recipientPK = fromBase64(r.publicKeyB64);
    const encrypted = nacl.box(symmetricKey, nonce, recipientPK, senderSecretKey);
    if (!encrypted) throw new Error('Key encryption failed');
    return {
      recipient_id: r.userId,
      ciphertext_b64: toBase64(encrypted),
      nonce_b64: toBase64(nonce),
    };
  });

  return { encryptedBlob, keyPayloads };
}

/**
 * Decrypt a file: first decrypt the symmetric key, then decrypt the file.
 */
export function decryptFile(
  encryptedBlob: Uint8Array,
  keyPayload: EncryptedPayload,
  senderPublicKeyB64: string,
  recipientSecretKey: Uint8Array,
): Uint8Array {
  // Decrypt symmetric key
  const keyCiphertext = fromBase64(keyPayload.ciphertext_b64);
  const keyNonce = fromBase64(keyPayload.nonce_b64);
  const senderPK = fromBase64(senderPublicKeyB64);

  const symmetricKey = nacl.box.open(keyCiphertext, keyNonce, senderPK, recipientSecretKey);
  if (!symmetricKey) throw new Error('Key decryption failed');

  // Extract file nonce and ciphertext
  const fileNonce = encryptedBlob.slice(0, nacl.secretbox.nonceLength);
  const fileCiphertext = encryptedBlob.slice(nacl.secretbox.nonceLength);

  const decrypted = nacl.secretbox.open(fileCiphertext, fileNonce, symmetricKey);
  if (!decrypted) throw new Error('File decryption failed');

  return decrypted;
}
