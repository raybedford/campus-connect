import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getConversation, addMemberToConversation, getSchoolDirectory } from '../api/conversations';
import { getMessages, sendMessage } from '../api/messages';
import { getBatchPublicKeys, getPublicKey } from '../api/keys';
import { useAuthStore } from '../store/auth';
import { useMessageStore } from '../store/message';
import { usePresenceStore } from '../store/presence';
import { encryptForMultipleRecipients, decryptMessage, encryptForRecipient } from '../crypto/encryption';
import { encryptFile } from '../crypto/fileEncryption';
import { getPrivateKey } from '../crypto/keyManager';
import { uploadFile } from '../api/files';
import type { Conversation } from '../types';
import MessageBubble from '../components/MessageBubble';
import MessageInput from '../components/MessageInput';
import TypingIndicator from '../components/TypingIndicator';
import { useChatSubscription } from '../hooks/useChatSubscription';
import { usePresence } from '../hooks/usePresence';

const EMPTY_ARRAY: any[] = [];
const EMPTY_SET = new Set<string>();

export default function Chat() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const storeMessages = useMessageStore((s) => s.messages[id!] || EMPTY_ARRAY);
  const setMessages = useMessageStore((s) => s.setMessages);
  const addMessage = useMessageStore((s) => s.addMessage);
  
  const [displayMessages, setDisplayMessages] = useState<any[]>([]);
  const [conversation, setConversation] = useState<Conversation | any>(null);
  const [memberKeys, setMemberKeys] = useState<Record<string, string>>({});
  const [showFiles, setShowFiles] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [directory, setDirectory] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processingRef = useRef(false);
  const typingUsers = usePresenceStore((s) => s.typingUsers[id!] || EMPTY_SET);

  // Use the new Supabase Realtime hook
  useChatSubscription(id || null);
  const { sendTyping } = usePresence(id || null);

  const sharedFiles = displayMessages.filter(m => m.message_type === 'file');

  useEffect(() => {
    if (showAddMember) {
      getSchoolDirectory().then(setDirectory).catch(console.error);
    }
  }, [showAddMember]);

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
        const memberIds = (conv?.members || []).map((m: any) => m.user?.id || m.user_id || m.user);
        const keys = await getBatchPublicKeys(memberIds);
        const keyMap: Record<string, string> = {};
        keys.forEach((k: any) => {
          keyMap[k.user] = k.publicKeyB64;
        });
        setMemberKeys(keyMap);

        // Decrypt loaded messages
        const decrypted = await decryptMessagesList(msgs, keyMap);
        setMessages(id, decrypted);
        setDisplayMessages(decrypted);
      } catch (err) {
        console.error('Failed to load chat:', err);
      }
    };
    load();
  }, [id, user]);

  // Sync display messages when store updates (realtime)
  useEffect(() => {
    const sync = async () => {
      if (processingRef.current) return;
      
      const newMsgs = storeMessages.filter(sm => !displayMessages.some(dm => dm.id === sm.id));
      if (newMsgs.length > 0) {
        processingRef.current = true;
        try {
          const decryptedNew = await decryptMessagesList(newMsgs, memberKeys);
          setDisplayMessages(prev => {
            // Re-check inside setter to be absolutely sure no duplicates are added
            const uniqueNew = decryptedNew.filter(n => !prev.some(p => p.id === n.id));
            return [...prev, ...uniqueNew];
          });
        } finally {
          processingRef.current = false;
        }
      }
    };
    sync();
  }, [storeMessages, memberKeys, displayMessages.length]);

  async function decryptMessagesList(msgs: any[], keys: Record<string, string>): Promise<any[]> {
    const results: any[] = [];

    for (const msg of msgs) {
      try {
        // If already decrypted by another hook/process
        if (msg.decrypted_text) {
          results.push(msg);
          continue;
        }

        const payloads = msg.content ? JSON.parse(msg.content) : [];
        const senderId = msg.sender_id || (msg.sender?.id);

        const myPayload = payloads.find(
          (p: any) => p.recipient_id === user?.id || p.recipientId === user?.id
        );

        if (myPayload) {
          // Use encryptor_id if present (for re-encrypted messages), otherwise fallback to senderId
          const effectiveSenderId = myPayload.encryptor_id || myPayload.encryptorId || senderId;
          
          if (keys[effectiveSenderId]) {
            const text = await decryptMessage(
              {
                recipient_id: myPayload.recipient_id || myPayload.recipientId,
                ciphertext_b64: myPayload.ciphertext_b64 || myPayload.ciphertextB64,
                nonce_b64: myPayload.nonce_b64 || myPayload.nonceB64
              },
              keys[effectiveSenderId]
            );
            results.push({ 
              ...msg, 
              decrypted_text: text 
            });
          } else {
            results.push(msg);
          }
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
  }, [displayMessages]);

  const handleSend = async (text: string) => {
    if (!id || !user || !conversation) return;

    const secretKey = await getPrivateKey();
    let payloads;

    if (secretKey && Object.keys(memberKeys).length > 0 && conversation?.members) {
      const recipients = conversation.members
        .map((m: any) => {
          const uid = m.user?.id || m.user_id || m.user;
          return { userId: uid, publicKeyB64: memberKeys[uid] };
        })
        .filter((r: any) => r.publicKeyB64);
      
      payloads = encryptForMultipleRecipients(text, recipients, secretKey);
    } else {
      payloads = (conversation?.members || []).map((m: any) => {
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
      const optimisticMsg = { ...msg, decrypted_text: text };
      addMessage(id, optimisticMsg);
      setDisplayMessages(prev => [...prev, optimisticMsg]);
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
      const optimisticMsg = { ...msg, decrypted_text: `[File: ${file.name}]` };
      addMessage(id, optimisticMsg);
      setDisplayMessages(prev => [...prev, optimisticMsg]);
    } catch (err) {
      console.error('File upload failed:', err);
    }
  };

  const handleAddMember = async (targetUser: any) => {
    if (!id || !user) return;
    
    const shareHistory = window.confirm(`Would you like to share the entire conversation history with ${targetUser.display_name}? This will allow them to decrypt previous messages.`);
    
    setIsAdding(true);
    try {
      let reEncrypted: any[] = [];

      if (shareHistory) {
        const secretKey = await getPrivateKey();
        const targetPublicKey = await getPublicKey(targetUser.id);

        if (secretKey && targetPublicKey) {
          // Re-encrypt all decryptable messages for the new user
          for (const msg of displayMessages) {
            if (msg.decrypted_text) {
              const payloads = JSON.parse(msg.content);
              const newPayload = encryptForRecipient(
                msg.decrypted_text,
                targetPublicKey.publicKeyB64,
                secretKey,
                user.id // We are the encryptor
              );
              
              // Add recipient_id to match structure
              (newPayload as any).recipient_id = targetUser.id;
              
              payloads.push(newPayload);
              reEncrypted.push({
                messageId: msg.id,
                content: JSON.stringify(payloads)
              });
            }
          }
        }
      }

      await addMemberToConversation(id, targetUser.id, reEncrypted);
      
      // Update local state
      const updatedConv = await getConversation(id);
      setConversation(updatedConv);
      setShowAddMember(false);
      setSearchQuery('');
      
      // Optimistic key map update
      const targetKey = await getPublicKey(targetUser.id);
      if (targetKey) {
        setMemberKeys(prev => ({ ...prev, [targetUser.id]: targetKey.publicKeyB64 }));
      }

    } catch (err) {
      console.error('Failed to add member:', err);
      alert('Failed to add member to conversation.');
    } finally {
      setIsAdding(false);
    }
  };

  const otherMember = conversation?.members?.find((m: any) => (m.user?.id || m.user_id || m.user) !== user?.id);
  const displayName = conversation
    ? conversation.type === 'dm'
      ? otherMember?.user?.display_name || otherMember?.display_name || 'Chat'
      : conversation.name || 'Group Chat'
    : 'Loading...';

  const filteredDirectory = directory.filter(u => 
    !conversation?.members?.some((m: any) => (m.user?.id || m.user_id || m.user) === u.id) &&
    (u.display_name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <>
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
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {conversation?.type === 'group' && (
              <button 
                className="icon-btn" 
                onClick={() => setShowAddMember(true)}
                title="Add Member"
              >
                +
              </button>
            )}
            <button 
              className="icon-btn" 
              onClick={() => setShowFiles(!showFiles)} 
              title="Shared Files"
              style={{ color: showFiles ? 'var(--gold)' : 'var(--cream-dim)', fontSize: '1.5rem' }}
            >
              &#128193;
            </button>
          </div>
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
          {displayMessages.map((msg: any) => (
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

      {showAddMember && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="auth-card" style={{ width: '100%', maxWidth: '400px' }}>
            <h3 style={{ color: 'var(--gold)', marginBottom: '1rem' }}>Add to Chat</h3>
            <input 
              type="text" 
              placeholder="Search students..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ marginBottom: '1rem' }}
            />
            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
              {filteredDirectory.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--cream-dim)', fontSize: '0.8rem' }}>No students found</p>
              ) : (
                filteredDirectory.map(u => (
                  <div key={u.id} className="search-result-item" style={{ padding: '0.75rem', marginBottom: '0.5rem', borderRadius: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{u.display_name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--cream-dim)' }}>{u.email}</div>
                    </div>
                    <button 
                      className="btn-nav-gold" 
                      onClick={() => handleAddMember(u)}
                      disabled={isAdding}
                      style={{ fontSize: '0.7rem' }}
                    >
                      {isAdding ? '...' : 'ADD'}
                    </button>
                  </div>
                ))
              )}
            </div>
            <button className="btn btn-outline" onClick={() => setShowAddMember(false)} style={{ width: '100%', marginTop: '1rem' }}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}
