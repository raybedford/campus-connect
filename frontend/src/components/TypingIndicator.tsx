import type { ConversationMember } from '../types';

interface Props {
  typingUserIds: Set<string> | undefined;
  members: ConversationMember[];
  currentUserId: string;
}

export default function TypingIndicator({ typingUserIds, members, currentUserId }: Props) {
  if (!typingUserIds || typingUserIds.size === 0) return null;

  const typingNames = Array.from(typingUserIds)
    .filter((id) => id !== currentUserId)
    .map((id) => {
      const member = members.find((m) => (m.user_id || (m as any).user?.id) === id);
      return member?.user?.display_name || member?.display_name || 'Someone';
    });

  if (typingNames.length === 0) return null;

  const text =
    typingNames.length === 1
      ? `${typingNames[0]} is typing`
      : `${typingNames.join(', ')} are typing`;

  return (
    <div className="typing-indicator-container">
      <style>{`
        .typing-indicator-container {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          margin-bottom: 8px;
          font-size: 0.75rem;
          color: var(--gold-dim);
          font-weight: 500;
          font-family: var(--sans);
        }
        
        .typing-dots {
          display: flex;
          align-items: center;
          gap: 3px;
          background: var(--black-card);
          padding: 6px 10px;
          border-radius: 12px;
          border: 1px solid var(--black-border);
        }

        .dot {
          width: 4px;
          height: 4px;
          background: var(--gold);
          border-radius: 50%;
          animation: jump 1.4s infinite ease-in-out both;
        }

        .dot:nth-child(1) { animation-delay: -0.32s; }
        .dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes jump {
          0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
          40% { transform: scale(1) translateY(-3px); opacity: 1; }
        }
      `}</style>
      
      <div className="typing-dots">
        <div className="dot"></div>
        <div className="dot"></div>
        <div className="dot"></div>
      </div>
      
      <span className="typing-text">{text}</span>
    </div>
  );
}
