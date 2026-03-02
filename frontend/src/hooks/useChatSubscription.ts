import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useMessageStore } from '../store/message';
import { decryptMessage } from '../crypto/encryption';
import { getPublicKey } from '../api/keys';

// Detect old encrypted message format (JSON array with ciphertext fields)
function isEncryptedContent(content: string): boolean {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0 && (parsed[0].ciphertext_b64 || parsed[0].ciphertextB64)) {
      return true;
    }
  } catch {}
  return false;
}

// Hook to subscribe to real-time chat updates
export function useChatSubscription(conversationId: string | null) {
  const addMessage = useMessageStore((state) => state.addMessage);
  const updateMessage = useMessageStore((state) => state.updateMessage);

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMsg = payload.new as any;

          // Fetch sender profile
          const { data: sender } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newMsg.sender_id)
            .single();

          let decrypted_text = null;

          // File messages: extract filename
          if (newMsg.message_type === 'file') {
            try {
              const parsed = JSON.parse(newMsg.content);
              decrypted_text = `[File: ${parsed.filename || 'File'}]`;
            } catch {
              decrypted_text = '[File: File]';
            }
          } else if (newMsg.content) {
            if (isEncryptedContent(newMsg.content)) {
              // Old encrypted format: best-effort decrypt
              try {
                const keyData = await getPublicKey(newMsg.sender_id);
                const payloads = JSON.parse(newMsg.content);
                const { data: { user } } = await supabase.auth.getUser();
                const myPayload = payloads.find((p: any) => (p.recipient_id || p.recipientId) === user?.id);

                if (myPayload && keyData) {
                  const effectiveEncryptorId = myPayload.encryptor_id || myPayload.encryptorId || newMsg.sender_id;
                  const encryptorKeyData = effectiveEncryptorId === newMsg.sender_id
                    ? keyData
                    : await getPublicKey(effectiveEncryptorId);

                  if (encryptorKeyData) {
                    decrypted_text = await decryptMessage(
                      {
                        recipient_id: myPayload.recipient_id || myPayload.recipientId,
                        ciphertext_b64: myPayload.ciphertext_b64 || myPayload.ciphertextB64,
                        nonce_b64: myPayload.nonce_b64 || myPayload.nonceB64
                      },
                      encryptorKeyData.publicKeyB64
                    );
                  }
                }
              } catch (err) {
                console.error('Legacy decryption failed for realtime message:', err);
              }
            } else {
              // New plaintext format
              decrypted_text = newMsg.content;
            }
          }

          addMessage(conversationId, {
            ...newMsg,
            sender,
            decrypted_text
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const updated = payload.new as any;

          // Soft-delete
          if (updated.is_deleted) {
            updateMessage(conversationId, updated.id, {
              is_deleted: true,
              decrypted_text: null,
              content: null,
              file_url: null,
            });
            return;
          }

          // Edit: read the new content
          if (updated.edited_at && updated.content) {
            let decrypted_text: string | null = null;

            if (isEncryptedContent(updated.content)) {
              // Old encrypted edit (unlikely but handle it)
              try {
                const payloads = JSON.parse(updated.content);
                const { data: { user } } = await supabase.auth.getUser();
                const myPayload = payloads.find(
                  (p: any) => (p.recipient_id || p.recipientId) === user?.id
                );
                if (myPayload) {
                  const effectiveEncryptorId =
                    myPayload.encryptor_id || myPayload.encryptorId || updated.sender_id;
                  const keyData = await getPublicKey(effectiveEncryptorId);
                  if (keyData) {
                    decrypted_text = await decryptMessage(
                      {
                        recipient_id: myPayload.recipient_id || myPayload.recipientId,
                        ciphertext_b64: myPayload.ciphertext_b64 || myPayload.ciphertextB64,
                        nonce_b64: myPayload.nonce_b64 || myPayload.nonceB64,
                      },
                      keyData.publicKeyB64
                    );
                  }
                }
              } catch (err) {
                console.error('Legacy decryption failed for edited message:', err);
              }
            } else {
              // New plaintext edit
              decrypted_text = updated.content;
            }

            updateMessage(conversationId, updated.id, {
              content: updated.content,
              edited_at: updated.edited_at,
              decrypted_text,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, addMessage, updateMessage]);
}
