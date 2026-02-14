import client from './client';

export async function uploadFile(
  file: Blob,
  messageId: string,
  conversationId: string,
  filename: string,
) {
  const formData = new FormData();
  formData.append('file', file, filename);
  formData.append('message_id', messageId);
  formData.append('conversation_id', conversationId);

  const res = await client.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function downloadFile(attachmentId: string): Promise<Blob> {
  const res = await client.get(`/files/${attachmentId}/download`, {
    responseType: 'blob',
  });
  return res.data;
}
