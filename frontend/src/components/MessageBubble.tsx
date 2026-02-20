import { useState } from 'react';
import { useAuthStore } from '../store/auth';

interface MessageProps {
  message: any;
  isMine: boolean;
  senderName?: string;
}

export default function MessageBubble({ message, isMine, senderName }: MessageProps) {
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const { profile } = useAuthStore();
  
  const time = new Date(message.createdAt || message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleTranslate = async () => {
    const textToTranslate = message.decrypted_text || message.decryptedText;
    if (!textToTranslate || isTranslating) return;

    setIsTranslating(true);
    try {
      const targetLang = profile?.preferred_language || 'en';
      // Using MyMemory Translation API (Free, no key required for basic usage)
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=auto|${targetLang}`
      );
      const data = await res.json();
      if (data.responseData) {
        setTranslatedText(data.responseData.translatedText);
      }
    } catch (err) {
      console.error('Translation failed:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  const hasText = message.decrypted_text || message.decryptedText;

  return (
    <div className={`message-bubble ${isMine ? 'mine' : 'theirs'}`}>
      {!isMine && senderName && <div className="msg-sender">{senderName}</div>}
      <div className="msg-content">
        {hasText ? (
          <>
            <div>{hasText}</div>
            {translatedText && (
              <div className="translated-text">
                <span style={{ fontSize: '0.65rem', display: 'block', opacity: 0.6, marginBottom: '2px' }}>Translated:</span>
                {translatedText}
              </div>
            )}
            {!isMine && !translatedText && (
              <button 
                className="translate-btn" 
                onClick={handleTranslate}
                disabled={isTranslating}
              >
                {isTranslating ? 'Translating...' : 'Translate'}
              </button>
            )}
          </>
        ) : (
          <span style={{ opacity: 0.5, fontStyle: 'italic' }}>[Encrypted Message]</span>
        )}
      </div>
      <div className="msg-time">{time}</div>
    </div>
  );
}
