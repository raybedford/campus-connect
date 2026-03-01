import { useRef, useState, useCallback } from 'react';

interface Props {
  onSend: (text: string, mentionedUserIds?: string[]) => void;
  onFileSelect?: (file: File) => void;
  onTyping?: () => void;
  conversationId: string;
  members?: any[];
}

const EMOJIS = ['😀', '😂', '😍', '👍', '🔥', '🙌', '🎉', '📚', '🎓', '💻', '🤔', '😎', '💯', '✨', '👋', '👀'];

export default function MessageInput({ onSend, onFileSelect, onTyping, conversationId: _, members = [] }: Props) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState(0);
  const mentionedUsersRef = useRef<{ id: string; name: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gifDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredMembers = mentionQuery !== null
    ? members.filter((m) => {
        const name = m.user?.display_name || m.display_name || '';
        return name.toLowerCase().includes(mentionQuery.toLowerCase());
      }).slice(0, 6)
    : [];

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (mentionQuery !== null && filteredMembers.length > 0) return; // let Enter select mention
    const trimmed = text.trim();
    if (!trimmed) return;
    const ids = mentionedUsersRef.current.map((u) => u.id);
    onSend(trimmed, ids.length > 0 ? ids : undefined);
    setText('');
    mentionedUsersRef.current = [];
    setMentionQuery(null);
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

  const checkForMention = (value: string, cursorPos: number) => {
    const before = value.slice(0, cursorPos);
    const atIdx = before.lastIndexOf('@');
    if (atIdx >= 0 && (atIdx === 0 || before[atIdx - 1] === ' ')) {
      const query = before.slice(atIdx + 1);
      setMentionQuery(query);
      setMentionStartPos(atIdx);
      setMentionIndex(0);
      return;
    }
    setMentionQuery(null);
  };

  const selectMention = (member: any) => {
    const name = member.user?.display_name || member.display_name || '';
    const userId = member.user?.id || member.user_id || member.id;
    const before = text.slice(0, mentionStartPos);
    const cursorPos = inputRef.current?.selectionStart || text.length;
    const after = text.slice(cursorPos);
    const newText = `${before}@${name} ${after}`;
    setText(newText);
    if (!mentionedUsersRef.current.some((u) => u.id === userId)) {
      mentionedUsersRef.current.push({ id: userId, name });
    }
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    if (onTyping) onTyping();
    const cursorPos = e.target.selectionStart || e.target.value.length;
    checkForMention(e.target.value, cursorPos);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % filteredMembers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + filteredMembers.length) % filteredMembers.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectMention(filteredMembers[mentionIndex]);
      } else if (e.key === 'Escape') {
        setMentionQuery(null);
      }
    }
  };

  return (
    <div className="chat-input-wrapper" style={{ position: 'relative' }}>
      {mentionQuery !== null && filteredMembers.length > 0 && (
        <div className="mention-dropdown">
          {filteredMembers.map((m, i) => {
            const name = m.user?.display_name || m.display_name || '';
            const email = m.user?.email || m.email || '';
            return (
              <button
                key={m.user?.id || m.user_id || m.id}
                className={`mention-item ${i === mentionIndex ? 'active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); selectMention(m); }}
              >
                <span className="mention-item-name">@{name}</span>
                <span className="mention-item-email">{email}</span>
              </button>
            );
          })}
        </div>
      )}

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
          ref={inputRef}
          type="text"
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleInputKeyDown}
          placeholder="Type a message... (@ to mention)"
        />
        <button type="submit" className="send-btn" disabled={!text.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
