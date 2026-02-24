import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getConversations } from '../api/conversations';
import { useAuthStore } from '../store/auth';
import { useConversationStore } from '../store/conversation';
import CampusBuilding from '../components/CampusBuilding';

function getConversationDisplayName(conv: any, currentUserId: string): string {
  if (conv.type === 'group') return conv.name || 'Group Chat';

  if (!conv.members || !Array.isArray(conv.members)) return 'Chat';

  const other = conv.members.find((m: any) => {
    const userId = m.user?.id || m.user_id || m.user;
    return userId !== currentUserId;
  });

  return other?.user?.display_name || other?.display_name || 'Student';
}

function getInitials(name: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

export default function ConversationList() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { setConversations } = useConversationStore();
  const [conversations, setLocalConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const convs = await getConversations();
        setConversations(convs);
        setLocalConversations(convs);
      } catch (err) {
        console.error('Failed to load conversations:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, setConversations]);

  if (loading) {
    return (
      <div className="page page-center">
        <p style={{ color: 'var(--cream-dim)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="header">
        <h2>Messages</h2>
        <div className="header-actions">
          <button className="icon-btn" onClick={() => navigate('/directory')} title="School Directory" style={{ fontSize: '1.1rem' }}>
            &#127891;
          </button>
          <button className="icon-btn" onClick={() => navigate('/settings')} title="Settings">
            &#9881;
          </button>
          <button className="icon-btn" onClick={() => navigate('/conversations/new')} title="New conversation">
            +
          </button>
        </div>
      </div>

      {!conversations || conversations.length === 0 ? (
        <div className="empty-state">
          <CampusBuilding size={80} />
          <p>No conversations yet</p>
          <button className="btn btn-primary" style={{ width: 'auto', padding: '0.5rem 1.5rem' }} onClick={() => navigate('/conversations/new')}>
            Start a conversation
          </button>
        </div>
      ) : (
        <ul className="conv-list">
          {conversations.map((conv) => {
            const displayName = getConversationDisplayName(conv, user!.id);
            const convId = conv._id || conv.id;
            return (
              <li
                key={convId}
                className="conv-item"
                onClick={() => navigate(`/conversations/${convId}`)}
              >
                <div className="conv-avatar">{getInitials(displayName)}</div>
                <div className="conv-info">
                  <div className="conv-name">{displayName}</div>
                  <div className="conv-preview">
                    {conv.type === 'group'
                      ? `${conv.members.length} members`
                      : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>&#128274; Encrypted message</span>}
                  </div>
                </div>
                {conv.updated_at && (
                  <div className="conv-time" style={{ fontSize: '0.7rem', color: 'var(--cream-dim)', whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>
                    {formatRelativeTime(conv.updated_at)}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
