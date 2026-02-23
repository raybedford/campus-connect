import nacl from 'tweetnacl';
import { toBase64, fromBase64 } from '../utils/base64';
import { getPrivateKey } from './keyManager';
import type { EncryptedPayload } from '../types';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encryptForRecipient(
  plaintext: string,
  recipientPublicKeyB64: string,
  senderSecretKey: Uint8Array,
  encryptorId?: string
): { recipient_id?: string; ciphertext_b64: string; nonce_b64: string; encryptor_id?: string } {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageBytes = encoder.encode(plaintext);
  const recipientPK = fromBase64(recipientPublicKeyB64);

  const encrypted = nacl.box(messageBytes, nonce, recipientPK, senderSecretKey);
  if (!encrypted) throw new Error('Encryption failed');

  return {
    ciphertext_b64: toBase64(encrypted),
    nonce_b64: toBase64(nonce),
    encryptor_id: encryptorId
  };
}

export function encryptForMultipleRecipients(
  plaintext: string,
  recipients: { userId: string; publicKeyB64: string }[],
  senderSecretKey: Uint8Array,
  encryptorId?: string
): EncryptedPayload[] {
  return recipients.map((r) => {
    const { ciphertext_b64, nonce_b64 } = encryptForRecipient(
      plaintext,
      r.publicKeyB64,
      senderSecretKey,
    );
    return {
      recipient_id: r.userId,
      ciphertext_b64,
      nonce_b64,
      encryptor_id: encryptorId
    };
  });
}

export async function decryptMessage(
  payload: EncryptedPayload,
  senderPublicKeyB64: string,
): Promise<string> {
  const secretKey = await getPrivateKey();
  if (!secretKey) throw new Error('No private key available');

  const ciphertext = fromBase64(payload.ciphertext_b64);
  const nonce = fromBase64(payload.nonce_b64);
  const senderPK = fromBase64(senderPublicKeyB64);

  const decrypted = nacl.box.open(ciphertext, nonce, senderPK, secretKey);
  if (!decrypted) throw new Error('Decryption failed');

  return decoder.decode(decrypted);
}
