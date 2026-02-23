import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getConversation } from '../api/conversations';
import { getMessages, sendMessage } from '../api/messages';
import { getBatchPublicKeys } from '../api/keys';
import { useAuthStore } from '../store/auth';
import { useMessageStore } from '../store/message';
import { usePresenceStore } from '../store/presence';
import { encryptForMultipleRecipients, decryptMessage } from '../crypto/encryption';
import { encryptFile } from '../crypto/fileEncryption';
import { getPrivateKey } from '../crypto/keyManager';
import { uploadFile } from '../api/files';
import type { Conversation } from '../types';
import MessageBubble from '../components/MessageBubble';
import MessageInput from '../components/MessageInput';
import TypingIndicator from '../components/TypingIndicator';
import { useChatSubscription } from '../hooks/useChatSubscription';
import { usePresence } from '../hooks/usePresence';

export default function Chat() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const messages = useMessageStore((s) => s.messages[id!] || []);
  const setMessages = useMessageStore((s) => s.setMessages);
  const addMessage = useMessageStore((s) => s.addMessage);
  const [conversation, setConversation] = useState<Conversation | any>(null);
  const [memberKeys, setMemberKeys] = useState<Record<string, string>>({});
  const [showFiles, setShowFiles] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingUsers = usePresenceStore((s) => s.typingUsers[id!] || new Set());

  // Use the new Supabase Realtime hook
  useChatSubscription(id || null);
  const { sendTyping } = usePresence(id || null);

  const sharedFiles = messages.filter(m => m.message_type === 'file');

  useEffect(() => {
    if (!id || !user) return;
    const load = async () => {
      try {
        const [conv, msgs] = await Promise.all([
          getConversation(id),
          getMessages(id),
        ]);
        setConversation(conv);

        // Fetch public keys for all members
        const memberIds = conv.members.map((m: any) => m.user?.id || m.user_id || m.user);
        const keys = await getBatchPublicKeys(memberIds);
        const keyMap: Record<string, string> = {};
        keys.forEach((k: any) => {
          keyMap[k.user] = k.publicKeyB64;
        });
        setMemberKeys(keyMap);

        // Decrypt loaded messages
        const decrypted = await decryptMessagesList(msgs, keyMap);
        setMessages(id, decrypted);
      } catch (err) {
        console.error('Failed to load chat:', err);
      }
    };
    load();
  }, [id, user]);

  async function decryptMessagesList(msgs: any[], keys: Record<string, string>): Promise<any[]> {
    const results: any[] = [];

    for (const msg of msgs) {
      try {
        const payloads = msg.content ? JSON.parse(msg.content) : [];
        const senderId = msg.sender_id || (msg.sender?.id);

        const myPayload = payloads.find(
          (p: any) => p.recipient_id === user?.id || p.recipientId === user?.id
        );

        if (myPayload && keys[senderId]) {
          const text = await decryptMessage(
            {
              recipient_id: myPayload.recipient_id || myPayload.recipientId,
              ciphertext_b64: myPayload.ciphertext_b64 || myPayload.ciphertextB64,
              nonce_b64: myPayload.nonce_b64 || myPayload.nonceB64
            },
            keys[senderId]
          );
          results.push({ 
            ...msg, 
            decrypted_text: text 
          });
        } else {
          results.push(msg);
        }
      } catch (err) {
        console.error('Decryption failed for message:', msg.id, err);
        results.push(msg);
      }
    }
    return results;
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!id || !user || !conversation) return;

    const secretKey = await getPrivateKey();
    let payloads;

    if (secretKey && Object.keys(memberKeys).length > 0) {
      const recipients = conversation.members
        .map((m: any) => {
          const uid = m.user?.id || m.user_id || m.user;
          return { userId: uid, publicKeyB64: memberKeys[uid] };
        })
        .filter((r: any) => r.publicKeyB64);
      
      payloads = encryptForMultipleRecipients(text, recipients, secretKey);
    } else {
      payloads = conversation.members.map((m: any) => {
        const uid = m.user?.id || m.user_id || m.user;
        return {
          recipient_id: uid,
          ciphertext_b64: btoa(text),
          nonce_b64: btoa('0'.repeat(24)),
        };
      });
    }

    try {
      const msg = await sendMessage(id, 'text', JSON.stringify(payloads));
      // Optimistic UI update
      addMessage(id, { ...msg, decrypted_text: text });
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!id || !user || !conversation) return;

    const secretKey = await getPrivateKey();
    if (!secretKey) return;

    const fileData = new Uint8Array(await file.arrayBuffer());
    const recipients = conversation.members
      .map((m: any) => {
        const uid = m.user?.id || m.user_id || m.user;
        return { userId: uid, publicKeyB64: memberKeys[uid] };
      })
      .filter((r: any) => r.publicKeyB64);

    const { encryptedBlob, keyPayloads } = encryptFile(fileData, recipients, secretKey);

    try {
      const { path } = await uploadFile(new Blob([encryptedBlob as any]), 'temp', id, file.name, recipients.length);
      const msg = await sendMessage(id, 'file', JSON.stringify(keyPayloads), path);
      addMessage(id, { ...msg, decrypted_text: `[File: ${file.name}]` });
    } catch (err) {
      console.error('File upload failed:', err);
    }
  };

  const otherMember = conversation?.members?.find((m: any) => (m.user?.id || m.user_id || m.user) !== user?.id);
  const displayName = conversation
    ? conversation.type === 'dm'
      ? otherMember?.user?.display_name || otherMember?.display_name || 'Chat'
      : conversation.name || 'Group Chat'
    : 'Loading...';

  return (
    <div className="chat-page">
      <div className="chat-header">
        <button className="icon-btn" onClick={() => navigate('/conversations')}>
          &#8592;
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{displayName}</div>
          {conversation?.type === 'group' && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {conversation.members.length} members
            </div>
          )}
        </div>
        <button 
          className="icon-btn" 
          onClick={() => setShowFiles(!showFiles)} 
          title="Shared Files"
          style={{ color: showFiles ? 'var(--gold)' : 'var(--cream-dim)', fontSize: '1.5rem' }}
        >
          &#128193;
        </button>
      </div>

      {showFiles && (
        <div className="shared-files-panel" style={{ background: 'var(--black-card)', borderBottom: '1px solid var(--black-border)', padding: '1rem', maxHeight: '200px', overflowY: 'auto' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gold)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Shared Files</div>
          {sharedFiles.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--cream-dim)' }}>No files shared in this chat.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {sharedFiles.map((msg: any) => (
                <div key={msg.id} style={{ background: 'var(--black)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--black-border)', fontSize: '0.8rem' }}>
                  {msg.decrypted_text || '[Encrypted File]'}
                  <div style={{ fontSize: '0.65rem', color: 'var(--cream-dim)' }}>
                    {new Date(msg.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="chat-messages">
        {messages.map((msg: any) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isMine={(msg.sender_id || msg.sender?.id || msg.sender) === user?.id}
            senderName={msg.sender?.display_name || 'User'}
          />
        ))}
        <TypingIndicator
          typingUserIds={typingUsers}
          members={conversation?.members || []}
          currentUserId={user?.id || ''}
        />
        <div ref={messagesEndRef} />
      </div>

      <MessageInput 
        onSend={handleSend} 
        onFileSelect={handleFileSelect} 
        onTyping={() => sendTyping(true)}
        conversationId={id!} 
      />
    </div>
  );
}
