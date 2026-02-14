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
    .map((id) => members.find((m) => m.user_id === id)?.display_name || 'Someone');

  if (typingNames.length === 0) return null;

  const text =
    typingNames.length === 1
      ? `${typingNames[0]} is typing...`
      : `${typingNames.join(', ')} are typing...`;

  return <div className="typing-indicator">{text}</div>;
}
