import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { getFileUrl } from '../api/files';

interface MessageProps {
  message: any;
  isMine: boolean;
  senderName?: string;
  members?: any[];
  onEdit?: (message: any) => void;
  onDelete?: (message: any) => void;
  onDeleteFile?: (message: any) => void;
}

// Simple Markdown Parser for bold, italics, code, and @mentions
function parseMarkdown(text: string, memberNames: string[] = [], currentUserName?: string) {
  // 0. Escape HTML to prevent XSS
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // 1. Code blocks: ```code```
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

  // 2. Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 3. Bold: **text** or __text__
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // 4. Italics: *text* or _text_
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // 5. @mentions: match @MemberName against known member names (longest first)
  const sorted = [...memberNames].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const isMe = currentUserName && name === currentUserName;
    const cls = isMe ? 'mention mention-me' : 'mention';
    html = html.replace(
      new RegExp(`@${escaped}(?=\\s|$|[.,!?;:])`, 'g'),
      `<span class="${cls}">@${name}</span>`
    );
  }

  // Handle newlines
  return html.replace(/\n/g, '<br />');
}

export default function MessageBubble({ message, isMine, senderName, members = [], onEdit, onDelete, onDeleteFile }: MessageProps) {
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const { profile, user } = useAuthStore();

  const dateObj = new Date(message.created_at);
  const isToday = new Date().toDateString() === dateObj.toDateString();
  const time = dateObj.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateStr = isToday ? '' : dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ';

  const hasText = message.decrypted_text || message.decryptedText;
  const isFile = message.message_type === 'file' && message.file_url;
  const fileName = hasText?.match(/\[File:\s*(.+)\]/)?.[1] || '';
  const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(fileName);

  // Get signed URL for image files (no encryption — direct display)
  useEffect(() => {
    if (!isFile || !isImage || filePreviewUrl) return;
    if (!message.file_url) return;

    let cancelled = false;
    getFileUrl(message.file_url).then((url) => {
      if (!cancelled && url) setFilePreviewUrl(url);
    });
    return () => { cancelled = true; };
  }, [isFile, isImage, message.file_url]);

  const memberNames = members.map((m: any) => m.user?.display_name || m.display_name || '').filter(Boolean);
  const currentUserName = profile?.display_name || '';

  // Read status logic
  const getReadStatus = () => {
    if (!isMine || !members.length) return null;

    const others = members.filter(m => (m.user_id || m.user?.id) !== user?.id);
    if (!others.length) return null;

    const readBy = others.filter(m => {
      const lastRead = new Date(m.last_read_at || 0);
      return lastRead >= dateObj;
    });

    if (readBy.length === 0) return 'Delivered';
    if (readBy.length === others.length) return 'Read';
    return `Read by ${readBy.length}`;
  };

  const status = getReadStatus();

  // Check if text is a GIF format: [gif:https://...]
  const isGif = hasText?.startsWith('[gif:') && hasText?.endsWith(']');
  const gifUrl = isGif ? hasText.slice(5, -1) : null;

  useEffect(() => {
    const userLang = profile?.preferred_language || 'en';
    const shouldAutoTranslate = !isMine && hasText && !translatedText && userLang !== 'en' && !isGif;

    if (shouldAutoTranslate) {
      handleTranslate();
    }
  }, [hasText, isMine, profile?.preferred_language]);

  const handleTranslate = async () => {
    const textToTranslate = hasText;
    if (!textToTranslate || isTranslating) return;

    setIsTranslating(true);
    try {
      const targetLang = profile?.preferred_language || 'en';
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=auto|${targetLang}`
      );
      const data = await res.json();

      if (data.responseData && data.responseData.translatedText) {
        const resultText = data.responseData.translatedText;
        if (resultText.toLowerCase().trim() !== textToTranslate.toLowerCase().trim()) {
          setTranslatedText(resultText);
        }
      }
    } catch (err) {
      console.error('Translation failed:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  // Close action menu on outside click
  useEffect(() => {
    if (!showActions) return;
    const close = () => setShowActions(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showActions]);

  // Deleted message placeholder
  if (message.is_deleted) {
    return (
      <div className={`message-bubble ${isMine ? 'mine' : 'theirs'} deleted-message`}>
        {!isMine && senderName && <div className="msg-sender">{senderName}</div>}
        <div className="msg-content msg-deleted">
          This message was deleted
        </div>
        <div className="msg-time">
          {dateStr}{time}
        </div>
      </div>
    );
  }

  return (
    <div className={`message-bubble ${isMine ? 'mine' : 'theirs'}`}>
      {!isMine && senderName && <div className="msg-sender">{senderName}</div>}

      {/* Action menu for own messages */}
      {isMine && (
        <div className="msg-actions-wrapper">
          <button
            className="msg-actions-trigger"
            onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
          >
            &#8942;
          </button>
          {showActions && (
            <div className="msg-actions-menu">
              {message.message_type === 'text' && !isGif && (
                <button
                  className="msg-action-item"
                  onClick={() => { setShowActions(false); onEdit?.(message); }}
                >
                  Edit
                </button>
              )}
              <button
                className="msg-action-item msg-action-delete"
                onClick={() => {
                  setShowActions(false);
                  if (message.message_type === 'file') {
                    onDeleteFile?.(message);
                  } else {
                    onDelete?.(message);
                  }
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}

      <div className="msg-content">
        {isFile && isImage && filePreviewUrl ? (
          <div className="file-preview">
            <img src={filePreviewUrl} alt={fileName} className="file-preview-img" />
            <div className="file-preview-name">{fileName}</div>
          </div>
        ) : isFile && isImage && !filePreviewUrl ? (
          <div className="file-loading">
            <span className="file-loading-spinner"></span>
            <span>Loading image...</span>
          </div>
        ) : isFile && hasText ? (
          <div className="file-attachment">
            <span className="file-attachment-icon">&#128196;</span>
            <span className="file-attachment-name">{fileName || 'File'}</span>
          </div>
        ) : hasText ? (
          <>
            {isGif ? (
              <img src={gifUrl!} alt="GIF" className="gif-msg-img" />
            ) : (
              <div
                className="markdown-body"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(hasText, memberNames, currentUserName) }}
              />
            )}

            {translatedText && (
              <div className="translated-text">
                <span style={{ fontSize: '0.65rem', display: 'block', opacity: 0.6, marginBottom: '2px' }}>Translated:</span>
                <div
                  className="markdown-body"
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(translatedText) }}
                />
              </div>
            )}
            {!isMine && !translatedText && !isTranslating && !isGif && (
              <button
                className="translate-btn"
                onClick={handleTranslate}
              >
                Translate
              </button>
            )}
            {isTranslating && !translatedText && (
              <span style={{ fontSize: '0.7rem', color: 'var(--gold)', opacity: 0.6 }}>Translating...</span>
            )}
          </>
        ) : (
          <div style={{ opacity: 0.5, fontStyle: 'italic', fontSize: '0.85rem', padding: '0.25rem 0' }}>
            Encrypted Message (Import key in Settings to read)
          </div>
        )}
      </div>
      <div className="msg-time" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
        {status && <span style={{ opacity: 0.8, fontWeight: 600 }}>{status} &bull; </span>}
        {message.edited_at && <span className="msg-edited-label">(edited)</span>}
        {dateStr}{time}
      </div>
    </div>
  );
}
