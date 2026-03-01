import { supabase } from '../lib/supabase';

export async function uploadFile(
  file: Blob,
  conversationId: string,
  filename: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const fileExt = filename.split('.').pop();
  const randomId = Math.random().toString(36).substring(2, 11);
  const filePath = `${conversationId}/${Date.now()}-${randomId}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('chat-files')
    .upload(filePath, file);

  if (error) throw error;
  return { path: data.path };
}

export async function downloadFile(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage
    .from('chat-files')
    .download(path);

  if (error) throw error;
  return data;
}

export async function getFileUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('chat-files')
    .createSignedUrl(path, 3600); // 1 hour expiry

  if (error) {
    console.error('Failed to get signed URL:', error);
    return null;
  }
  return data.signedUrl;
}

export async function deleteFile(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from('chat-files')
    .remove([path]);

  if (error) throw error;
}
