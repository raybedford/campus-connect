import { supabase } from '../lib/supabase';

export async function uploadFile(
  file: Blob,
  _messageId: string, // Kept for signature, but use storage path
  conversationId: string,
  filename: string,
  _totalRecipients: number
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const filePath = `${conversationId}/${Date.now()}-${filename}`;

  // You must create a bucket named 'chat-files' in your Supabase storage!
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
