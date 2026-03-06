import { supabase } from '../lib/supabase';

// File upload limits
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_FILE_TYPES = [
  // Images
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  // Documents
  'application/pdf', 'text/plain', 'text/markdown',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Archives
  'application/zip', 'application/x-zip-compressed',
  // Videos
  'video/mp4', 'video/webm', 'video/ogg',
  // Audio
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'
];

export async function uploadFile(
  file: Blob,
  conversationId: string,
  filename: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // Validate file type
  if (file.type && !ALLOWED_FILE_TYPES.includes(file.type)) {
    throw new Error(`File type '${file.type}' is not allowed`);
  }

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
