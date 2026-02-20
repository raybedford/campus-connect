interface MessageProps {
  message: any;
  isMine: boolean;
  senderName?: string;
}

export default function MessageBubble({ message, isMine, senderName }: MessageProps) {
  const time = new Date(message.createdAt || message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`message-bubble ${isMine ? 'mine' : 'theirs'}`}>
      {!isMine && senderName && <div className="msg-sender">{senderName}</div>}
      <div className="msg-content">
        {message.decrypted_text || message.decryptedText || (
          <span style={{ opacity: 0.5, fontStyle: 'italic' }}>[Encrypted Message]</span>
        )}
      </div>
      <div className="msg-time">{time}</div>
    </div>
  );
}
