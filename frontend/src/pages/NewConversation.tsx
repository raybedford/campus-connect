import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchUsers, createConversation } from '../api/conversations';
import type { UserSearch } from '../types';

export default function NewConversation() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (q.length < 1) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const users = await searchUsers(q);
      setResults(users);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const startDM = async (userId: string) => {
    setError('');
    try {
      const conv = await createConversation('dm', [userId]);
      navigate(`/conversations/${conv.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not create conversation');
    }
  };

  return (
    <div className="page">
      <div className="header">
        <button className="icon-btn" onClick={() => navigate(-1)}>
          &#8592;
        </button>
        <h2>New Conversation</h2>
        <div style={{ width: 40 }} />
      </div>

      <div className="form-group">
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name or email..."
          autoFocus
        />
      </div>

      {error && <p className="error">{error}</p>}

      {loading && <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Searching...</p>}

      <ul className="search-results">
        {results.map((user) => (
          <li
            key={user.id}
            className="search-result-item"
            onClick={() => startDM(user.id)}
          >
            <div>
              <div className="name">{user.display_name}</div>
              <div className="email">{user.email}</div>
            </div>
            <span style={{ color: 'var(--accent)' }}>&#8594;</span>
          </li>
        ))}
      </ul>

      {query && !loading && results.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2rem' }}>
          No users found
        </p>
      )}
    </div>
  );
}
