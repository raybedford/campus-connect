import client from './client';
import type { Message } from '../types';

export async function getMessages(
  conversationId: string,
  before?: string,
  limit = 50
): Promise<Message[]> {
  const params: Record<string, string | number> = { limit };
  if (before) params.before = before;
  const res = await client.get(`/conversations/${conversationId}/messages`, { params });
  return res.data;
}
