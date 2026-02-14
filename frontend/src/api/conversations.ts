import client from './client';
import type { Conversation, UserSearch } from '../types';

export async function getConversations(): Promise<Conversation[]> {
  const res = await client.get('/conversations');
  return res.data;
}

export async function getConversation(id: string): Promise<Conversation> {
  const res = await client.get(`/conversations/${id}`);
  return res.data;
}

export async function createConversation(
  type: 'dm' | 'group',
  memberIds: string[],
  name?: string
): Promise<Conversation> {
  const res = await client.post('/conversations', {
    type,
    member_ids: memberIds,
    name,
  });
  return res.data;
}

export async function searchUsers(query: string): Promise<UserSearch[]> {
  const res = await client.get('/users/search', { params: { q: query } });
  return res.data;
}
