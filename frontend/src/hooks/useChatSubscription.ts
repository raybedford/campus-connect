import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useMessageStore } from '../store/message';
import { decryptMessage } from '../crypto/encryption';
import { getPublicKey } from '../api/keys';

// Hook to subscribe to real-time chat updates
export function useChatSubscription(conversationId: string | null) {
  const addMessage = useMessageStore((state) => state.addMessage);

  useEffect(() => {
    if (!conversationId) return;

    // Create a channel for this conversation
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

          // 1. Fetch sender profile
          const { data: sender } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newMsg.sender_id)
            .single();

          // 2. Fetch sender public key
          const keyData = await getPublicKey(newMsg.sender_id);
          
          let decrypted_text = null;
          if (keyData && newMsg.content) {
            try {
              const payloads = JSON.parse(newMsg.content);
              const { data: { user } } = await supabase.auth.getUser();
              const myPayload = payloads.find((p: any) => (p.recipient_id || p.recipientId) === user?.id);
              
              if (myPayload) {
                // Use encryptor_id if present (for shared history), otherwise use sender public key
                const effectiveEncryptorId = myPayload.encryptor_id || myPayload.encryptorId || newMsg.sender_id;
                
                // Fetch effective encryptor's public key
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
              console.error('Decryption failed for realtime message:', err);
            }
          }

          addMessage(conversationId, { 
            ...newMsg, 
            sender, 
            decrypted_text 
          });
        }
      )
      .subscribe();

    // Cleanup when component unmounts or conversation changes
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, addMessage]);
}
