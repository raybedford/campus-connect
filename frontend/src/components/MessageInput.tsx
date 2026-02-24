import { useRef, useState, useCallback } from 'react';

interface Props {
  onSend: (text: string) => void;
  onFileSelect?: (file: File) => void;
  onTyping?: () => void;
  conversationId: string;
}

const EMOJIS = ['😀', '😂', '😍', '👍', '🔥', '🙌', '🎉', '📚', '🎓', '💻', '🤔', '😎', '💯', '✨', '👋', '👀'];

export default function MessageInput({ onSend, onFileSelect, onTyping, conversationId: _ }: Props) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gifDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    setShowEmoji(false);
    setShowGif(false);
  };

  const fetchGifs = useCallback(async (q: string) => {
    if (!q) return;
    const apiKey = import.meta.env.VITE_TENOR_API_KEY;
    if (!apiKey) return;
    try {
      const res = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${apiKey}&limit=8`);
      const data = await res.json();
      setGifs(data.results || []);
    } catch (err) {
      console.error('GIF search failed:', err);
    }
  }, []);

  const handleGifSearch = (q: string) => {
    setGifQuery(q);
    if (!q) { setGifs([]); return; }
    if (gifDebounceRef.current) clearTimeout(gifDebounceRef.current);
    gifDebounceRef.current = setTimeout(() => fetchGifs(q), 300);
  };

  const sendGif = (url: string) => {
    onSend(`[gif:${url}]`);
    setShowGif(false);
    setGifQuery('');
    setGifs([]);
  };

  const addEmoji = (emoji: string) => {
    setText(prev => prev + emoji);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    if (onTyping) onTyping();
  };

  return (
    <div className="chat-input-wrapper" style={{ position: 'relative' }}>
      {showEmoji && (
        <div className="picker-container">
          <div className="emoji-grid">
            {EMOJIS.map(e => (
              <div key={e} className="emoji-item" onClick={() => addEmoji(e)}>{e}</div>
            ))}
          </div>
        </div>
      )}

      {showGif && (
        <div className="picker-container">
          <div className="gif-search-bar">
            <input 
              type="text" 
              placeholder="Search GIFs..." 
              value={gifQuery} 
              onChange={(e) => handleGifSearch(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', background: 'var(--black)', color: 'white', border: '1px solid var(--black-border)', borderRadius: '6px' }}
            />
          </div>
          <div className="gif-grid">
            {gifs.map(g => (
              <img 
                key={g.id} 
                src={g.media_formats.tinygif.url} 
                className="gif-item" 
                onClick={() => sendGif(g.media_formats.gif.url)}
              />
            ))}
            {gifQuery && gifs.length === 0 && <p style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem' }}>No GIFs found</p>}
          </div>
        </div>
      )}

      <form className="chat-input-area" onSubmit={handleSubmit}>
        <button type="button" className="icon-btn" onClick={() => { setShowEmoji(!showEmoji); setShowGif(false); }}>😊</button>
        <button type="button" className="icon-btn" onClick={() => { setShowGif(!showGif); setShowEmoji(false); }} style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>GIF</button>
        
        {onFileSelect && (
          <>
            <button
              type="button"
              className="file-attach-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Attach file"
            >
              &#128206;
            </button>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && onFileSelect) onFileSelect(file);
                e.target.value = '';
              }}
            />
          </>
        )}
        <input
          type="text"
          value={text}
          onChange={handleTextChange}
          placeholder="Type a message..."
        />
        <button type="submit" className="send-btn" disabled={!text.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
