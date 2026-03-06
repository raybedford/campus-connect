import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getConversation, addMemberToConversation, getSchoolDirectory, markAsRead } from '../api/conversations';
import { getMessages, sendMessage, editMessage, deleteMessage } from '../api/messages';
import { getBatchPublicKeys } from '../api/keys';
import { useAuthStore } from '../store/auth';
import { useMessageStore } from '../store/message';
import { usePresenceStore } from '../store/presence';
import { decryptMessage } from '../crypto/encryption';
import { getPrivateKey } from '../crypto/keyManager';
import { uploadFile, downloadFile, deleteFile } from '../api/files';
import { decryptFile } from '../crypto/fileEncryption';
import { encryptMessageWithGroupKey, encryptFileWithGroupKey, decryptFileWithGroupKey, decryptMessageWithGroupKey } from '../crypto/groupEncryption';
import { getGroupKey } from '../services/groupKeyManager';
import type { Conversation } from '../types';
import MessageBubble from '../components/MessageBubble';
import MessageInput from '../components/MessageInput';
import TypingIndicator from '../components/TypingIndicator';
import { useChatSubscription } from '../hooks/useChatSubscription';
import { usePresence } from '../hooks/usePresence';
import { useNotificationStore } from '../store/notification';

const EMPTY_ARRAY: any[] = [];
const EMPTY_SET = new Set<string>();

export default function Chat() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const storeMessages = useMessageStore((s) => s.messages[id!] || EMPTY_ARRAY);
  const setMessages = useMessageStore((s) => s.setMessages);
  const addMessage = useMessageStore((s) => s.addMessage);
  const clearNotifs = useNotificationStore((s) => s.clearForConversation);

  // Clear notifications for this conversation when entering it
  useEffect(() => {
    if (id) clearNotifs(id);
  }, [id, clearNotifs]);

  const [displayMessages, setDisplayMessages] = useState<any[]>([]);
  const [conversation, setConversation] = useState<Conversation | any>(null);
  const [memberKeys, setMemberKeys] = useState<Record<string, string>>({});
  const [showFiles, setShowFiles] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [directory, setDirectory] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingMessage, setEditingMessage] = useState<any | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processingRef = useRef(false);
  const typingUsers = usePresenceStore((s) => s.typingUsers[id!] || EMPTY_SET);

  // Use the new Supabase Realtime hook
  useChatSubscription(id || null);
  const { sendTyping } = usePresence(id || null);
  const typingTimeoutRef = useRef<number | null>(null);

  const handleTyping = () => {
    sendTyping(true);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      sendTyping(false);
    }, 2500);
  };

  const sharedFiles = displayMessages.filter(m => m.message_type === 'file' && !m.is_deleted);

  useEffect(() => {
    if (showAddMember) {
      getSchoolDirectory().then(setDirectory).catch(console.error);
    }
  }, [showAddMember]);

  useEffect(() => {
    if (!id || !user) return;

    // Initial mark as read
    markAsRead(id);

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

      // Check for updated messages (edits/deletes from realtime)
      let hasUpdates = false;
      const updatedDisplay = displayMessages.map(dm => {
        const storeCopy = storeMessages.find(sm => sm.id === dm.id);
        if (storeCopy && (
          storeCopy.is_deleted !== dm.is_deleted ||
          storeCopy.edited_at !== dm.edited_at ||
          storeCopy.decrypted_text !== dm.decrypted_text
        )) {
          hasUpdates = true;
          return { ...dm, ...storeCopy };
        }
        return dm;
      });

      if (newMsgs.length > 0) {
        // Mark as read when new messages arrive and we are in the chat
        if (id) markAsRead(id);

        processingRef.current = true;
        try {
          const decryptedNew = await decryptMessagesList(newMsgs, memberKeys);
          setDisplayMessages(prev => {
            const base = hasUpdates ? updatedDisplay : prev;
            const uniqueNew = decryptedNew.filter(n => !base.some(p => p.id === n.id));
            return [...base, ...uniqueNew];
          });
        } finally {
          processingRef.current = false;
        }
      } else if (hasUpdates) {
        setDisplayMessages(updatedDisplay);
      }
    };
    sync();
  }, [storeMessages, memberKeys, displayMessages.length, id]);


  async function decryptMessagesList(msgs: any[], keys: Record<string, string>): Promise<any[]> {
    const results: any[] = [];

    for (const msg of msgs) {
      try {
        // If already processed
        if (msg.decrypted_text) {
          results.push(msg);
          continue;
        }

        // Deleted messages — just pass through
        if (msg.is_deleted) {
          results.push(msg);
          continue;
        }

        // File messages: extract filename and detect legacy encrypted format
        if (msg.message_type === 'file') {
          let filename = 'File';
          let isLegacyEncrypted = false;
          let legacyKeyPayload = null;
          const legacySenderId = msg.sender_id || msg.sender?.id;
          try {
            const parsed = JSON.parse(msg.content);
            if (parsed.filename) {
              filename = parsed.filename;
            }
            if (parsed.keys && Array.isArray(parsed.keys)) {
              isLegacyEncrypted = true;
              legacyKeyPayload = parsed.keys.find(
                (k: any) => (k.recipientId || k.recipient_id) === user?.id
              );
            } else if (Array.isArray(parsed)) {
              isLegacyEncrypted = true;
              legacyKeyPayload = parsed.find(
                (k: any) => (k.recipientId || k.recipient_id) === user?.id
              );
              if (!filename || filename === 'File') {
                const ext = msg.file_url?.split('.').pop() || '';
                filename = ext ? `file.${ext}` : 'File';
              }
            }
          } catch {}
          results.push({
            ...msg,
            decrypted_text: `[File: ${filename}]`,
            _legacyEncrypted: isLegacyEncrypted,
            _legacyKeyPayload: legacyKeyPayload,
            _legacySenderId: legacySenderId,
          });
          continue;
        }

        // Text messages: detect plaintext vs old encrypted format
        if (!msg.content) {
          results.push(msg);
          continue;
        }

        // Check if content is group-encrypted or old encrypted format
        let isOldEncrypted = false;
        let isGroupEncrypted = false;
        let encryptedData: any = null;

        try {
          const parsed = JSON.parse(msg.content);

          // Check for new group encryption format
          if (parsed.encrypted === true && parsed.ciphertext_b64 && parsed.nonce_b64) {
            isGroupEncrypted = true;
            encryptedData = parsed;
          }
          // Check for old per-recipient encryption
          else if (Array.isArray(parsed) && parsed.length > 0 && (parsed[0].ciphertext_b64 || parsed[0].ciphertextB64)) {
            isOldEncrypted = true;
          }
        } catch {
          // Not valid JSON — it's plaintext
        }

        if (isGroupEncrypted) {
          // New group key encryption: decrypt with group key
          try {
            const groupKey = await getGroupKey(id!, user.id);
            if (groupKey) {
              const text = decryptMessageWithGroupKey(
                encryptedData.ciphertext_b64,
                encryptedData.nonce_b64,
                groupKey
              );
              results.push({ ...msg, decrypted_text: text });
              continue;
            } else {
              console.warn('No group key available for message:', msg.id);
              results.push({ ...msg, decrypted_text: '[Encrypted - No key available]' });
              continue;
            }
          } catch (err) {
            console.error('Group key decryption failed:', msg.id, err);
            results.push({ ...msg, decrypted_text: '[Decryption failed]' });
            continue;
          }
        } else if (isOldEncrypted) {
          // Old encrypted format: best-effort decryption
          try {
            const payloads = JSON.parse(msg.content);
            const senderId = msg.sender_id || msg.sender?.id;
            const myPayload = payloads.find(
              (p: any) => p.recipient_id === user?.id || p.recipientId === user?.id
            );
            if (myPayload) {
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
                results.push({ ...msg, decrypted_text: text });
                continue;
              }
            }
          } catch (err) {
            console.error('Legacy decryption failed:', msg.id, err);
          }
          // Could not decrypt old message
          results.push(msg);
        } else {
          // New plaintext format: content IS the message
          results.push({ ...msg, decrypted_text: msg.content });
        }
      } catch (err) {
        console.error('Message processing failed:', msg.id, err);
        results.push(msg);
      }
    }
    return results;
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages]);

  // Realtime read receipt updates via Supabase Realtime
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`read-receipts:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_members',
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          const updated = payload.new as { user_id: string; last_read_at: string };
          setConversation((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              members: prev.members.map((m: any) =>
                m.user_id === updated.user_id
                  ? { ...m, last_read_at: updated.last_read_at }
                  : m
              ),
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const handleSend = async (text: string, mentionedUserIds?: string[]) => {
    if (!id || !user || !conversation) return;

    try {
      // Get group key and encrypt message
      const groupKey = await getGroupKey(id, user.id);

      let contentToSend = text;
      if (groupKey) {
        // Encrypt with group key
        const { ciphertext_b64, nonce_b64 } = encryptMessageWithGroupKey(text, groupKey);
        contentToSend = JSON.stringify({
          encrypted: true,
          ciphertext_b64,
          nonce_b64,
        });
        console.log('🔒 Message encrypted with group key');
      } else {
        console.warn('⚠️ No group key found, sending plaintext');
      }

      const msg = await sendMessage(id, 'text', contentToSend, undefined, mentionedUserIds);

      // Stop typing indicator immediately on send
      sendTyping(false);
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);

      // Optimistic UI update (show decrypted version locally)
      const optimisticMsg = { ...msg, decrypted_text: text, content: contentToSend };
      addMessage(id, optimisticMsg);
      setDisplayMessages(prev => [...prev, optimisticMsg]);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleEditMessage = async (message: any, newText: string) => {
    if (!id || !user || !conversation) return;

    try {
      // Get group key and encrypt edited message
      const groupKey = await getGroupKey(id, user.id);

      let contentToSend = newText;
      if (groupKey) {
        // Encrypt with group key
        const { ciphertext_b64, nonce_b64 } = encryptMessageWithGroupKey(newText, groupKey);
        contentToSend = JSON.stringify({
          encrypted: true,
          ciphertext_b64,
          nonce_b64,
        });
        console.log('🔒 Edited message encrypted with group key');
      } else {
        console.warn('⚠️ No group key found, sending plaintext');
      }

      await editMessage(message.id, contentToSend);

      // Optimistic UI update
      setDisplayMessages(prev =>
        prev.map(m =>
          m.id === message.id
            ? { ...m, content: contentToSend, decrypted_text: newText, edited_at: new Date().toISOString() }
            : m
        )
      );
      setEditingMessage(null);
    } catch (err) {
      console.error('Failed to edit message:', err);
      alert('Failed to edit message.');
    }
  };

  const handleDeleteMessage = async (message: any) => {
    if (!confirm('Delete this message? This cannot be undone.')) return;

    try {
      await deleteMessage(message.id);

      // Optimistic UI update
      setDisplayMessages(prev =>
        prev.map(m =>
          m.id === message.id
            ? { ...m, is_deleted: true, decrypted_text: null, content: null, file_url: null }
            : m
        )
      );
    } catch (err) {
      console.error('Failed to delete message:', err);
      alert('Failed to delete message.');
    }
  };

  const handleDeleteFileMessage = async (message: any) => {
    if (!confirm('Delete this file? The file will be permanently removed.')) return;

    try {
      // Delete file from storage
      if (message.file_url) {
        await deleteFile(message.file_url);
      }

      // Soft-delete the message
      await deleteMessage(message.id);

      // Optimistic UI update
      setDisplayMessages(prev =>
        prev.map(m =>
          m.id === message.id
            ? { ...m, is_deleted: true, decrypted_text: null, content: null, file_url: null }
            : m
        )
      );
    } catch (err) {
      console.error('Failed to delete file:', err);
      alert('Failed to delete file.');
    }
  };

  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (file: File) => {
    if (!id || !user || !conversation) return;

    setUploading(true);
    try {
      // Get group key
      const groupKey = await getGroupKey(id, user.id);

      if (groupKey) {
        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const fileData = new Uint8Array(arrayBuffer);

        // Encrypt file with group key
        const { encryptedFile, nonce_b64 } = encryptFileWithGroupKey(fileData, groupKey);

        // Create a blob from encrypted data (convert Uint8Array to regular Array)
        const encryptedArray = Array.from(encryptedFile);
        const encryptedBlob = new Blob([new Uint8Array(encryptedArray)], { type: 'application/octet-stream' });
        const encryptedFileObj = new File([encryptedBlob], file.name + '.enc', { type: 'application/octet-stream' });

        // Upload encrypted file
        const { path: uploadedPath } = await uploadFile(encryptedFileObj, id, file.name + '.enc');

        // Store encryption metadata in message content
        const contentPayload = {
          filename: file.name,
          encrypted: true,
          nonce_b64,
          original_type: file.type,
        };

        const msg = await sendMessage(id, 'file', JSON.stringify(contentPayload), uploadedPath);

        console.log('🔒 File encrypted and uploaded');

        // Stop typing
        sendTyping(false);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        const optimisticMsg = { ...msg, decrypted_text: `[File: ${file.name}]` };
        addMessage(id, optimisticMsg);
        setDisplayMessages(prev => [...prev, optimisticMsg]);
      } else {
        // No group key, upload plaintext
        console.warn('⚠️ No group key found, uploading file unencrypted');
        const { path } = await uploadFile(file, id, file.name);
        const contentPayload = { filename: file.name };
        const msg = await sendMessage(id, 'file', JSON.stringify(contentPayload), path);

        // Stop typing
        sendTyping(false);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        const optimisticMsg = { ...msg, decrypted_text: `[File: ${file.name}]` };
        addMessage(id, optimisticMsg);
        setDisplayMessages(prev => [...prev, optimisticMsg]);
      }
    } catch (err: any) {
      console.error('File upload failed:', err);
      alert(`File upload failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadFile = async (msg: any) => {
    if (!user || !msg.file_url) return;

    try {
      const blob = await downloadFile(msg.file_url);
      let downloadBlob = blob;

      // Try to parse content to check if file is encrypted
      let contentData;
      try {
        contentData = JSON.parse(msg.content || '{}');
      } catch {
        contentData = {};
      }

      // Group key encrypted file: decrypt before download
      if (contentData.encrypted && contentData.nonce_b64) {
        const groupKey = await getGroupKey(id!, user.id);
        if (groupKey) {
          const encryptedData = new Uint8Array(await blob.arrayBuffer());
          const decryptedData = decryptFileWithGroupKey(encryptedData, groupKey);
          const decryptedArray = Array.from(decryptedData);
          downloadBlob = new Blob([new Uint8Array(decryptedArray)], { type: contentData.original_type || 'application/octet-stream' });
          console.log('🔓 File decrypted with group key');
        } else {
          alert('Cannot decrypt file: No group key available');
          return;
        }
      }
      // Legacy encrypted file: decrypt before download
      else if (msg._legacyEncrypted && msg._legacyKeyPayload) {
        const encryptedData = new Uint8Array(await blob.arrayBuffer());
        const secretKey = await getPrivateKey();
        const senderPubKey = memberKeys[msg._legacySenderId || msg.sender_id];

        if (secretKey && senderPubKey) {
          const decryptedData = decryptFile(
            encryptedData,
            msg._legacyKeyPayload,
            senderPubKey,
            secretKey
          );
          downloadBlob = new Blob([new Uint8Array(decryptedData)]);
        }
      }

      // Extract original filename
      let filename = 'download';
      if (msg.decrypted_text) {
        const match = msg.decrypted_text.match(/\[File:\s*(.+)\]/);
        if (match) filename = match[1];
      } else {
        const parts = msg.file_url.split('/');
        filename = parts[parts.length - 1];
      }

      // Trigger browser download
      const url = URL.createObjectURL(downloadBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('File download failed:', err);
      alert(`Download failed: ${err?.message || 'Unknown error'}`);
    }
  };

  const handleAddMember = async (targetUser: any) => {
    if (!id || !user) return;

    setIsAdding(true);
    try {
      await addMemberToConversation(id, targetUser.id);

      // Update local state
      const updatedConv = await getConversation(id);
      setConversation(updatedConv);
      setShowAddMember(false);
      setSearchQuery('');
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
    ((u.display_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <>
      <div className="chat-page">
        <div className="chat-header">
          <button className="icon-btn" onClick={() => navigate('/conversations')}>
            &#8592;
          </button>
          <div className="chat-header-info">
            <div className="chat-header-name">{displayName}</div>
            {conversation?.type === 'group' && (
              <div className="chat-header-subtitle">
                {conversation.members.length} members
              </div>
            )}
          </div>
          <div className="chat-header-actions">
            <button
              className="icon-btn"
              onClick={() => setShowAddMember(true)}
              title="Add Student"
              style={{ fontSize: '1.1rem' }}
            >
              +
            </button>
            <button
              className="icon-btn"
              onClick={() => setShowFiles(!showFiles)}
              title="Shared Files"
              style={{ color: showFiles ? 'var(--gold)' : undefined }}
            >
              &#128193;
            </button>
          </div>
        </div>

        {showFiles && (
          <div style={{ background: 'var(--black-card)', borderBottom: '1px solid var(--black-border)', padding: '1rem', maxHeight: '200px', overflowY: 'auto', flexShrink: 0 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gold)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Shared Files</div>
            {sharedFiles.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--cream-dim)' }}>No files shared in this chat.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {sharedFiles.map((msg: any) => {
                  const isMyFile = (msg.sender_id || msg.sender?.id) === user?.id;
                  return (
                    <div key={msg.id} className="file-card-wrapper">
                      <button
                        className="file-card"
                        onClick={() => handleDownloadFile(msg)}
                        title="Click to download"
                      >
                        <div className="file-card-icon">&#128196;</div>
                        <div className="file-card-info">
                          <div className="file-card-name">
                            {msg.decrypted_text?.match(/\[File:\s*(.+)\]/)?.[1] || 'File'}
                          </div>
                          <div className="file-card-date">
                            {new Date(msg.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="file-card-dl">&#8595;</div>
                      </button>
                      {isMyFile && (
                        <button
                          className="file-card-delete"
                          onClick={(e) => { e.stopPropagation(); handleDeleteFileMessage(msg); }}
                          title="Delete this file"
                        >
                          &#x2715;
                        </button>
                      )}
                    </div>
                  );
                })}
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
              members={conversation?.members || EMPTY_ARRAY}
              memberKeys={memberKeys}
              onEdit={(m) => setEditingMessage(m)}
              onDelete={handleDeleteMessage}
              onDeleteFile={handleDeleteFileMessage}
            />
          ))}
          <TypingIndicator
            typingUserIds={typingUsers}
            members={conversation?.members || []}
            currentUserId={user?.id || ''}
          />
          <div ref={messagesEndRef} />
        </div>

        {editingMessage && (
          <div className="edit-bar">
            <div className="edit-bar-label">
              Editing message
              <button className="edit-bar-cancel" onClick={() => setEditingMessage(null)}>Cancel</button>
            </div>
          </div>
        )}

        <MessageInput
          onSend={(text, mentionedUserIds) => {
            if (editingMessage) {
              handleEditMessage(editingMessage, text);
            } else {
              handleSend(text, mentionedUserIds);
            }
          }}
          onFileSelect={editingMessage ? undefined : handleFileSelect}
          onTyping={handleTyping}
          conversationId={id!}
          members={conversation?.members || []}
          uploading={uploading}
          initialText={editingMessage?.decrypted_text || undefined}
          isEditing={!!editingMessage}
        />
      </div>

      {showAddMember && (
        <div className="modal-overlay">
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
