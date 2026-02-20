import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getConversation } from '../api/conversations';
import { getMessages } from '../api/messages';
import { getBatchPublicKeys } from '../api/keys';
import { useAuthStore } from '../store/auth';
import { useMessageStore } from '../store/message';
import { usePresenceStore } from '../store/presence';
import { encryptForMultipleRecipients, decryptMessage } from '../crypto/encryption';
// import { encryptFile } from '../crypto/fileEncryption'; // TODO: Implement if missing
import { getPrivateKey } from '../crypto/keyManager';
// import { uploadFile } from '../api/files'; // TODO: Implement if missing
import type { Conversation, Message, PublicKeyInfo } from '../types';
import MessageBubble from '../components/MessageBubble';
import MessageInput from '../components/MessageInput';
import TypingIndicator from '../components/TypingIndicator';
import { Socket } from 'socket.io-client';

export default function Chat() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const messages = useMessageStore((s) => s.messages[id!] || []);
  const setMessages = useMessageStore((s) => s.setMessages);
  const addMessage = useMessageStore((s) => s.addMessage);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [memberKeys, setMemberKeys] = useState<Record<string, string>>({});
  const [showFiles, setShowFiles] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingUsers = usePresenceStore((s) => s.typingUsers[id!] || []);

  const sharedFiles = messages.filter(m => m.messageType === 'file' || m.message_type === 'file');

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
        const memberIds = conv.members.map((m: any) => m.user._id || m.user);
        const keys = await getBatchPublicKeys(memberIds);
        const keyMap: Record<string, string> = {};
        keys.forEach((k: PublicKeyInfo | any) => {
          // Backend returns 'user' (ID string) and 'publicKeyB64'
          const uid = k.user._id || k.user;
          keyMap[uid] = k.publicKeyB64;
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

  async function decryptMessagesList(msgs: any[], keys: Record<string, string>): Promise<Message[]> {
    const results: Message[] = [];
    const myPrivateKey = await getPrivateKey();

    for (const msg of msgs) {
      try {
        // Backend uses 'encryptedPayloads' (camelCase)
        const payloads = msg.encryptedPayloads || msg.encrypted_payloads || [];
        const senderId = msg.sender._id || msg.sender;

        const myPayload = payloads.find(
          (p: any) => p.recipientId === user?.id || p.recipient_id === user?.id
        );

        if (myPayload && myPrivateKey && keys[senderId]) {
          const text = await decryptMessage(
            {
              ciphertextB64: myPayload.ciphertextB64 || myPayload.ciphertext_b64,
              nonceB64: myPayload.nonceB64 || myPayload.nonce_b64
            },
            keys[senderId],
            myPrivateKey
          );
          results.push({ 
            ...msg, 
            id: msg._id,
            conversation_id: msg.conversation,
            sender_id: senderId,
            decrypted_text: text 
          });
        } else {
          results.push({
            ...msg,
            id: msg._id,
            conversation_id: msg.conversation,
            sender_id: senderId
          });
        }
      } catch (err) {
        console.error('Decryption failed for message:', msg._id, err);
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
        .map((m: any) => {
          const uid = m.user._id || m.user;
          return { userId: uid, publicKeyB64: memberKeys[uid] };
        })
        .filter((r) => r.publicKeyB64);
      
      payloads = encryptForMultipleRecipients(text, recipients, secretKey);
    } else {
      // Fallback (should ideally not happen if keys are published)
      payloads = conversation.members.map((m: any) => {
        const uid = m.user._id || m.user;
        return {
          recipientId: uid,
          ciphertextB64: btoa(text),
          nonceB64: btoa('0'.repeat(24)),
        };
      });
    }

    // Send via Socket.io
    const socket = (window as any).__campusSocket as Socket | undefined;
    if (socket && socket.connected) {
      socket.emit('send_message', {
        conversationId: id,
        messageType: 'text',
        encryptedPayloads: payloads,
      }, (response: any) => {
        if (response.status === 'error') {
          console.error('Failed to send message:', response.message);
        }
      });
    } else {
      console.error('Socket not connected');
    }

    // Optimistic UI update
    const tempMsg: any = {
      _id: `temp-${Date.now()}`,
      conversation: id,
      sender: { _id: user.id, displayName: user.displayName },
      createdAt: new Date().toISOString(),
      messageType: 'text',
      encryptedPayloads: payloads,
      decrypted_text: text,
    };
    addMessage(id, tempMsg);
  };

  const handleFileSelect = async (file: File) => {
    if (!id || !user || !conversation) return;

    const secretKey = await getPrivateKey();
    if (!secretKey) {
      console.error('Private key not found, cannot encrypt file');
      return;
    }

    const fileData = new Uint8Array(await file.arrayBuffer());
    const recipients = conversation.members
      .map((m: any) => {
        const uid = m.user._id || m.user;
        return { userId: uid, publicKeyB64: memberKeys[uid] };
      })
      .filter((r) => r.publicKeyB64);

    const { encryptedBlob, keyPayloads } = encryptFile(fileData, recipients, secretKey);

    // 1. Create message first to get an ID for the attachment
    const socket = (window as any).__campusSocket as Socket | undefined;
    if (!socket || !socket.connected) {
      console.error('Socket not connected');
      return;
    }

    socket.emit('send_message', {
      conversationId: id,
      messageType: 'file',
      encryptedPayloads: keyPayloads,
    }, async (response: any) => {
      if (response.status === 'ok') {
        const messageId = response.messageId;
        
        // 2. Upload encrypted file blob
        const blob = new Blob([encryptedBlob]);
        try {
          await uploadFile(blob, messageId, id, file.name, recipients.length);
          
          // Optimistic UI update for the file message
          const tempMsg: any = {
            _id: messageId,
            conversation: id,
            sender: { _id: user.id, displayName: user.displayName },
            createdAt: new Date().toISOString(),
            messageType: 'file',
            encryptedPayloads: keyPayloads,
            decrypted_text: `[File: ${file.name}]`,
          };
          addMessage(id, tempMsg);
        } catch (err) {
          console.error('File upload failed:', err);
        }
      } else {
        console.error('Failed to create file message:', response.message);
      }
    });
  };

  const displayName = conversation
    ? conversation.type === 'dm'
      ? conversation.members.find((m: any) => (m.user._id || m.user) !== user?.id)?.user?.displayName || 'Chat'
      : conversation.name || 'Group Chat'
    : 'Loading...';

  return (
    <div className="chat-page">
      <div className="chat-header">
        <button className="back-btn" onClick={() => navigate('/conversations')}>
          &#8592;
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>{displayName}</div>
          {conversation?.type === 'group' && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {conversation.members.length} members
            </div>
          )}
        </div>
        <button 
          className="icon-btn" 
          onClick={() => setShowFiles(!showFiles)} 
          title="Shared Files"
          style={{ color: showFiles ? 'var(--gold)' : 'var(--cream-dim)' }}
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
                <div key={msg._id} style={{ background: 'var(--black)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--black-border)', fontSize: '0.8rem' }}>
                  {msg.decrypted_text || '[Encrypted File]'}
                  <div style={{ fontSize: '0.65rem', color: 'var(--cream-dim)' }}>
                    {new Date(msg.createdAt).toLocaleDateString()}
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
            key={msg._id || msg.id}
            message={msg}
            isMine={(msg.sender?._id || msg.sender_id || msg.sender) === user?.id}
            senderName={msg.sender?.displayName || 'User'}
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
