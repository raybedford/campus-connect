import { get, set } from 'idb-keyval';
import nacl from 'tweetnacl';
import { toBase64, fromBase64 } from '../utils/base64';

const PRIVATE_KEY_STORE = 'campus_connect_private_key';
const PUBLIC_KEY_STORE = 'campus_connect_public_key';

export interface KeyPairB64 {
  publicKey: string;
  secretKey: string;
}

export async function generateAndStoreKeyPair(): Promise<KeyPairB64> {
  const keyPair = nacl.box.keyPair();
  const publicKeyB64 = toBase64(keyPair.publicKey);
  const secretKeyB64 = toBase64(keyPair.secretKey);

  await set(PRIVATE_KEY_STORE, secretKeyB64);
  await set(PUBLIC_KEY_STORE, publicKeyB64);

  return { publicKey: publicKeyB64, secretKey: secretKeyB64 };
}

export async function getStoredKeyPair(): Promise<KeyPairB64 | null> {
  const secretKey = await get<string>(PRIVATE_KEY_STORE);
  const publicKey = await get<string>(PUBLIC_KEY_STORE);
  if (!secretKey || !publicKey) return null;
  return { publicKey, secretKey };
}

export async function getPrivateKey(): Promise<Uint8Array | null> {
  const secretKeyB64 = await get<string>(PRIVATE_KEY_STORE);
  if (!secretKeyB64) return null;
  return fromBase64(secretKeyB64);
}

export async function getPublicKeyB64(): Promise<string | null> {
  return (await get<string>(PUBLIC_KEY_STORE)) || null;
}

export async function hasKeyPair(): Promise<boolean> {
  const sk = await get<string>(PRIVATE_KEY_STORE);
  return !!sk;
}
