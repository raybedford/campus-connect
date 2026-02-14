import type { Message } from '../types';

interface Props {
  message: Message;
  isMine: boolean;
  senderName: string;
}

export default function MessageBubble({ message, isMine, senderName }: Props) {
  const text =
    message.decrypted_text ||
    (() => {
      try {
        return atob(message.encrypted_payloads[0]?.ciphertext_b64 || '');
      } catch {
        return '[encrypted message]';
      }
    })();

  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`message-bubble ${isMine ? 'message-mine' : 'message-theirs'}`}>
      {!isMine && <div className="message-sender">{senderName}</div>}
      <div>{text}</div>
      <div className="message-time">{time}</div>
    </div>
  );
}
