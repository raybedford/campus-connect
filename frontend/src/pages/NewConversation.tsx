import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchUsers, createConversation } from '../api/conversations';
import CampusBuilding from '../components/CampusBuilding';

export default function NewConversation() {
  const [mode, setMode] = useState<'dm' | 'group'>('dm');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (q.length < 2) {
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

  const toggleUserSelection = (user: any) => {
    const userId = user._id || user.id;
    if (selectedUsers.find(u => (u._id || u.id) === userId)) {
      setSelectedUsers(selectedUsers.filter(u => (u._id || u.id) !== userId));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleCreate = async (singleUserId?: string) => {
    setError('');
    const finalMemberIds = singleUserId ? [singleUserId] : selectedUsers.map(u => u._id || u.id);

    if (mode === 'group' && !groupName.trim()) {
      setError('Please enter a group name');
      return;
    }
    if (finalMemberIds.length === 0) {
      setError('Please select at least one person');
      return;
    }

    try {
      const conv = await createConversation(mode, finalMemberIds, groupName);
      navigate(`/conversations/${conv._id || conv.id}`);
    } catch (err: any) {
      setError(err.message || 'Could not create conversation');
    }
  };

  return (
    <div className="page">
      <div className="header" style={{ marginBottom: '1rem' }}>
        <button className="icon-btn" onClick={() => navigate(-1)}>&#8592;</button>
        <h2>New Chat</h2>
        <div style={{ width: 40 }} />
      </div>

      <div className="tab-container" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button 
          className={`btn ${mode === 'dm' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => { setMode('dm'); setSelectedUsers([]); }}
          style={{ flex: 1 }}
        >
          Direct Message
        </button>
        <button 
          className={`btn ${mode === 'group' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setMode('group')}
          style={{ flex: 1 }}
        >
          Group Chat
        </button>
      </div>

      {mode === 'group' && (
        <div className="form-group">
          <label className="form-label">Group Name</label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="e.g. CS499 Study Squad"
          />
        </div>
      )}

      <div className="form-group">
        <label className="form-label">{mode === 'group' ? 'Add Members' : 'Find Student'}</label>
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name or email..."
        />
      </div>

      {selectedUsers.length > 0 && (
        <div className="selected-users" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          {selectedUsers.map(u => (
            <div key={u._id || u.id} className="user-tag" style={{ background: 'var(--gold)', color: 'var(--black)', padding: '0.2rem 0.6rem', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {u.display_name}
              <span style={{ cursor: 'pointer' }} onClick={() => toggleUserSelection(u)}>&times;</span>
            </div>
          ))}
        </div>
      )}

      {error && <p className="error" style={{ marginBottom: '1rem' }}>{error}</p>}

      <div className="results-container" style={{ background: 'var(--black-card)', borderRadius: '12px', border: '1px solid var(--black-border)', overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--cream-dim)' }}>Searching...</p>
        ) : results.length > 0 ? (
          <ul className="search-results" style={{ margin: 0 }}>
            {results.map((user) => {
              const userId = user._id || user.id;
              const isSelected = selectedUsers.find(u => (u._id || u.id) === userId);
              return (
                <li
                  key={userId}
                  className="search-result-item"
                  onClick={() => mode === 'dm' ? handleCreate(userId) : toggleUserSelection(user)}
                  style={{ background: isSelected ? 'rgba(207,184,124,0.1)' : 'transparent', padding: '1.25rem 1rem' }}
                >
                  <div>
                    <div className="name">{user.display_name}</div>
                    <div className="email" style={{ fontSize: '0.7rem' }}>{user.email}</div>
                  </div>
                  {mode === 'group' ? (
                    <div className={`checkbox ${isSelected ? 'checked' : ''}`} style={{ width: 20, height: 20, border: '2px solid var(--gold)', borderRadius: '4px', background: isSelected ? 'var(--gold)' : 'transparent' }} />
                  ) : (
                    <span style={{ color: 'var(--gold)' }}>&#8594;</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : query.length >= 2 ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--cream-dim)' }}>No students found</p>
        ) : (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--cream-dim)' }}>
             <CampusBuilding size={48} />
             <p style={{ fontSize: '0.85rem' }}>Search for students in your school directory</p>
          </div>
        )}
      </div>

      {mode === 'group' && selectedUsers.length > 0 && (
        <button 
          className="btn btn-primary" 
          onClick={() => handleCreate()}
          style={{ width: '100%', marginTop: '2rem' }}
        >
          Create Group ({selectedUsers.length})
        </button>
      )}
    </div>
  );
}
