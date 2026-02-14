import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getConversations } from '../api/conversations';
import { getMe } from '../api/auth';
import { useAuthStore } from '../store/auth';
import { useConversationStore } from '../store/conversation';
import CampusBuilding from '../components/CampusBuilding';
import type { Conversation } from '../types';

function getConversationDisplayName(conv: Conversation, currentUserId: string): string {
  if (conv.type === 'group') return conv.name || 'Group Chat';
  const other = conv.members.find((m) => m.user_id !== currentUserId);
  return other?.display_name || 'Unknown';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function ConversationList() {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuthStore();
  const { conversations, setConversations } = useConversationStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        if (!user) {
          const me = await getMe();
          setUser(me);
        }
        const convs = await getConversations();
        setConversations(convs);
      } catch {
        logout();
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="page page-center">
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="header">
        <h2>Messages</h2>
        <div className="header-actions">
          <button className="icon-btn" onClick={() => navigate('/settings')} title="Settings">
            &#9881;
          </button>
          <button className="icon-btn" onClick={() => navigate('/conversations/new')} title="New conversation">
            +
          </button>
        </div>
      </div>

      {conversations.length === 0 ? (
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
            return (
              <li
                key={conv.id}
                className="conv-item"
                onClick={() => navigate(`/conversations/${conv.id}`)}
              >
                <div className="conv-avatar">{getInitials(displayName)}</div>
                <div className="conv-info">
                  <div className="conv-name">{displayName}</div>
                  <div className="conv-preview">
                    {conv.type === 'group'
                      ? `${conv.members.length} members`
                      : 'Tap to chat'}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
