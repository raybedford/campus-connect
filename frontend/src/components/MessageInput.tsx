import { useRef, useState } from 'react';

interface Props {
  onSend: (text: string) => void;
  onFileSelect?: (file: File) => void;
  conversationId: string;
}

export default function MessageInput({ onSend, onFileSelect, conversationId }: Props) {
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }

    // Send typing event
    const ws = (window as any).__campusWs as WebSocket | undefined;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'typing',
          conversation_id: conversationId,
        })
      );
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileSelect) {
      onFileSelect(file);
    }
    e.target.value = '';
  };

  return (
    <form className="chat-input-area" onSubmit={handleSubmit}>
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
            onChange={handleFileChange}
          />
        </>
      )}
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
      />
      <button type="submit" className="send-btn" disabled={!text.trim()}>
        Send
      </button>
    </form>
  );
}
