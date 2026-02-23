import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/auth';

interface MessageProps {
  message: any;
  isMine: boolean;
  senderName?: string;
  members?: any[];
}

// Simple Markdown Parser for bold, italics, and code
function parseMarkdown(text: string) {
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

  // Handle newlines
  return html.replace(/\n/g, '<br />');
}

export default function MessageBubble({ message, isMine, senderName, members = [] }: MessageProps) {
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const { profile, user } = useAuthStore();
  
  const dateObj = new Date(message.created_at);
  const isToday = new Date().toDateString() === dateObj.toDateString();
  const time = dateObj.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateStr = isToday ? '' : dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ';

  const hasText = message.decrypted_text || message.decryptedText;

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

  return (
    <div className={`message-bubble ${isMine ? 'mine' : 'theirs'}`}>
      {!isMine && senderName && <div className="msg-sender">{senderName}</div>}
      <div className="msg-content">
        {hasText ? (
          <>
            {isGif ? (
              <img src={gifUrl!} alt="GIF" className="gif-msg-img" />
            ) : (
              <div 
                className="markdown-body"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(hasText) }}
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
          <div style={{ 
            background: 'rgba(207,184,124,0.1)', 
            border: '1px solid rgba(207,184,124,0.3)',
            padding: '0.75rem',
            borderRadius: '12px',
            marginTop: '0.25rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--gold)', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
              <span>🔒</span> ENCRYPTED MESSAGE
            </div>
            <p style={{ fontSize: '0.75rem', lineHeight: '1.4', color: 'var(--cream-dim)' }}>
              To read this on this device, you must import your <strong>Recovery Code</strong> in Settings.
            </p>
          </div>
        )}
      </div>
      <div className="msg-time" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
        {status && <span style={{ opacity: 0.8, fontWeight: 600 }}>{status} • </span>}
        {dateStr}{time}
      </div>
    </div>
  );
}
