import client from './client';
// import type { Conversation, UserSearch } from '../types';

export async function getConversations(): Promise<any[]> {
  const res = await client.get('/conversations');
  return res.data;
}

export async function getConversation(id: string): Promise<any> {
  const res = await client.get(`/conversations/${id}`);
  return res.data;
}

export async function createConversation(
  type: 'dm' | 'group',
  memberIds: string[],
  name?: string
): Promise<any> {
  // Matching the Node.js backend signature: 
  // if dm: { type, recipientId }
  // if group: { type, name, memberIds }
  const payload: any = { type };
  if (type === 'dm') {
    payload.recipientId = memberIds[0];
  } else {
    payload.name = name;
    payload.memberIds = memberIds;
  }
  
  const res = await client.post('/conversations', payload);
  return res.data;
}

export async function searchUsers(query: string): Promise<any[]> {
  const res = await client.get('/users/search', { params: { q: query } });
  return res.data;
}

export async function getSchoolDirectory(): Promise<any[]> {
  const res = await client.get('/users/directory');
  return res.data;
}
