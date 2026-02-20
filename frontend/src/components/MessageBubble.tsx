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
              <div>{hasText}</div>
            )}
            
            {translatedText && (
              <div className="translated-text">
                <span style={{ fontSize: '0.65rem', display: 'block', opacity: 0.6, marginBottom: '2px' }}>Translated:</span>
                {translatedText}
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
          <span style={{ opacity: 0.5, fontStyle: 'italic' }}>[Encrypted Message]</span>
        )}
      </div>
      <div className="msg-time">{time}</div>
    </div>
  );
}
