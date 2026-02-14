import client from './client';
import type { PublicKeyInfo } from '../types';

export async function publishKey(publicKeyB64: string): Promise<void> {
  await client.post('/keys/publish', { public_key_b64: publicKeyB64 });
}

export async function getPublicKey(userId: string): Promise<PublicKeyInfo> {
  const res = await client.get(`/keys/${userId}`);
  return res.data;
}

export async function getBatchPublicKeys(userIds: string[]): Promise<PublicKeyInfo[]> {
  const res = await client.get('/keys/batch', {
    params: { user_ids: userIds.join(',') },
  });
  return res.data;
}
