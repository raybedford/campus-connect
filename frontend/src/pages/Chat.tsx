import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getConversation } from '../api/conversations';
import { getMessages } from '../api/messages';
import { getBatchPublicKeys } from '../api/keys';
import { useAuthStore } from '../store/auth';
import { useMessageStore } from '../store/message';
import { usePresenceStore } from '../store/presence';
import { encryptForMultipleRecipients, decryptMessage } from '../crypto/encryption';
import { encryptFile } from '../crypto/fileEncryption';
import { getPrivateKey } from '../crypto/keyManager';
import { uploadFile } from '../api/files';
import type { Conversation, Message, PublicKeyInfo } from '../types';
import MessageBubble from '../components/MessageBubble';
import MessageInput from '../components/MessageInput';
import TypingIndicator from '../components/TypingIndicator';

export default function Chat() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const messages = useMessageStore((s) => s.messages[id!] || []);
  const setMessages = useMessageStore((s) => s.setMessages);
  const addMessage = useMessageStore((s) => s.addMessage);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [memberKeys, setMemberKeys] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingUsers = usePresenceStore((s) => s.typingUsers[id!]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [conv, msgs] = await Promise.all([
        getConversation(id),
        getMessages(id),
      ]);
      setConversation(conv);

      // Fetch public keys for all members
      const memberIds = conv.members.map((m) => m.user_id);
      try {
        const keys = await getBatchPublicKeys(memberIds);
        const keyMap: Record<string, string> = {};
        keys.forEach((k: PublicKeyInfo) => {
          keyMap[k.user_id] = k.public_key_b64;
        });
        setMemberKeys(keyMap);

        // Decrypt loaded messages
        const decrypted = await decryptMessages(msgs, keyMap);
        setMessages(id, decrypted);
      } catch {
        // If keys not available, show messages as-is (plaintext fallback)
        setMessages(id, msgs);
      }
    };
    load();
  }, [id]);

  async function decryptMessages(msgs: Message[], keys: Record<string, string>): Promise<Message[]> {
    const results: Message[] = [];
    for (const msg of msgs) {
      try {
        const myPayload = msg.encrypted_payloads.find(
          (p) => p.recipient_id === user?.id
        );
        if (myPayload && keys[msg.sender_id]) {
          const text = await decryptMessage(myPayload, keys[msg.sender_id]);
          results.push({ ...msg, decrypted_text: text });
        } else {
          // Fallback: try base64 decode (for pre-encryption messages)
          try {
            const text = atob(msg.encrypted_payloads[0]?.ciphertext_b64 || '');
            results.push({ ...msg, decrypted_text: text });
          } catch {
            results.push(msg);
          }
        }
      } catch {
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
      // E2EE: encrypt for each recipient
      const recipients = conversation.members
        .filter((m) => memberKeys[m.user_id])
        .map((m) => ({ userId: m.user_id, publicKeyB64: memberKeys[m.user_id] }));
      payloads = encryptForMultipleRecipients(text, recipients, secretKey);
    } else {
      // Fallback plaintext
      payloads = conversation.members.map((m) => ({
        recipient_id: m.user_id,
        ciphertext_b64: btoa(text),
        nonce_b64: btoa('0'.repeat(24)),
      }));
    }

    // Send via WebSocket
    const ws = (window as any).__campusWs as WebSocket | undefined;
    const tempMsg: Message = {
      id: crypto.randomUUID(),
      conversation_id: id,
      sender_id: user.id,
      created_at: new Date().toISOString(),
      message_type: 'text',
      encrypted_payloads: payloads,
      decrypted_text: text,
    };

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'send_message',
          conversation_id: id,
          message_type: 'text',
          encrypted_payloads: payloads,
        })
      );
    }
    addMessage(id, tempMsg);
  };

  const handleFileSelect = async (file: File) => {
    if (!id || !user || !conversation) return;

    const secretKey = await getPrivateKey();
    if (!secretKey) return;

    const fileData = new Uint8Array(await file.arrayBuffer());
    const recipients = conversation.members
      .filter((m) => memberKeys[m.user_id])
      .map((m) => ({ userId: m.user_id, publicKeyB64: memberKeys[m.user_id] }));

    const { encryptedBlob, keyPayloads } = encryptFile(fileData, recipients, secretKey);

    const messageId = crypto.randomUUID();

    // Upload encrypted file
    const blob = new Blob([encryptedBlob.buffer as ArrayBuffer]);
    await uploadFile(blob, messageId, id, file.name);

    // Send file message via WS
    const ws = (window as any).__campusWs as WebSocket | undefined;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'send_message',
          conversation_id: id,
          message_type: 'file',
          encrypted_payloads: keyPayloads,
        })
      );
    }

    const tempMsg: Message = {
      id: messageId,
      conversation_id: id,
      sender_id: user.id,
      created_at: new Date().toISOString(),
      message_type: 'file',
      encrypted_payloads: keyPayloads,
      decrypted_text: `[File: ${file.name}]`,
    };
    addMessage(id, tempMsg);
  };

  const displayName = conversation
    ? conversation.type === 'dm'
      ? conversation.members.find((m) => m.user_id !== user?.id)?.display_name || 'Chat'
      : conversation.name || 'Group Chat'
    : 'Loading...';

  return (
    <div className="chat-page">
      <div className="chat-header">
        <button className="back-btn" onClick={() => navigate('/conversations')}>
          &#8592;
        </button>
        <div>
          <div style={{ fontWeight: 600 }}>{displayName}</div>
          {conversation?.type === 'group' && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {conversation.members.length} members
            </div>
          )}
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isMine={msg.sender_id === user?.id}
            senderName={
              conversation?.members.find((m) => m.user_id === msg.sender_id)
                ?.display_name || 'Unknown'
            }
          />
        ))}
        <TypingIndicator
          typingUserIds={typingUsers}
          members={conversation?.members || []}
          currentUserId={user?.id || ''}
        />
        <div ref={messagesEndRef} />
      </div>

      <MessageInput onSend={handleSend} onFileSelect={handleFileSelect} conversationId={id!} />
    </div>
  );
}
