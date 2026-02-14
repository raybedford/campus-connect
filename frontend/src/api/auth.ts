import client from './client';
import type { TokenResponse } from '../types';

export async function signup(email: string, password: string, display_name: string) {
  const res = await client.post('/auth/signup', { email, password, display_name });
  return res.data;
}

export async function verify(email: string, code: string): Promise<TokenResponse> {
  const res = await client.post('/auth/verify', { email, code });
  return res.data;
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const res = await client.post('/auth/login', { email, password });
  return res.data;
}

export async function getMe() {
  const res = await client.get('/users/me');
  return res.data;
}
