import { useState, useEffect } from 'react';
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

  const hasText = message.decrypted_text || message.decryptedText;

  useEffect(() => {
    // Automatic translation logic:
    // Only translate if:
    // 1. It's NOT my message
    // 2. There is text to translate
    // 3. We haven't already translated it
    // 4. The user has a preferred language other than English (default)
    const shouldAutoTranslate = !isMine && hasText && !translatedText && profile?.preferred_language && profile.preferred_language !== 'en';
    
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
      // Using MyMemory Translation API
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=auto|${targetLang}`
      );
      const data = await res.json();
      if (data.responseData && data.responseData.translatedText) {
        // Only set if the translation is different from original
        if (data.responseData.translatedText.toLowerCase().trim() !== textToTranslate.toLowerCase().trim()) {
          setTranslatedText(data.responseData.translatedText);
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
            <div>{hasText}</div>
            {translatedText && (
              <div className="translated-text">
                <span style={{ fontSize: '0.65rem', display: 'block', opacity: 0.6, marginBottom: '2px' }}>Translated:</span>
                {translatedText}
              </div>
            )}
            {/* Show manual button only if auto-translate didn't run or failed, and it's not mine */}
            {!isMine && !translatedText && !isTranslating && (
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
          <span style={{ opacity: 0.5, fontStyle: 'italic' }}>[Encrypted Message]</span>
        )}
      </div>
      <div className="msg-time">{time}</div>
    </div>
  );
}
