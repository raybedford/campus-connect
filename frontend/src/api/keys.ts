import client from './client';
// import type { PublicKeyInfo } from '../types';

export async function publishKey(publicKeyB64: string): Promise<void> {
  // Matching Node.js backend: { publicKeyB64 }
  await client.post('/keys/publish', { publicKeyB64 });
}

export async function getPublicKey(userId: string): Promise<any> {
  const res = await client.get(`/keys/${userId}`);
  return res.data;
}

export async function getBatchPublicKeys(userIds: string[]): Promise<any[]> {
  const res = await client.get('/keys/batch', {
    params: { user_ids: userIds.join(',') },
  });
  return res.data;
}
