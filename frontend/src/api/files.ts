import client from './client';

export async function uploadFile(
  file: Blob,
  messageId: string,
  _conversationId: string, // Not strictly required by current Node.js file upload logic but kept for future scope
  filename: string,
  totalRecipients: number
) {
  const formData = new FormData();
  formData.append('file', file, filename);
  // Backend uses camelCase for the database model
  formData.append('messageId', messageId);
  formData.append('originalFilename', filename);
  formData.append('totalRecipients', totalRecipients.toString());

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
