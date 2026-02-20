import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSchoolDirectory, createConversation } from '../api/conversations';
import CampusBuilding from '../components/CampusBuilding';

export default function Directory() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getSchoolDirectory();
        setStudents(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const startDM = async (userId: string) => {
    try {
      const conv = await createConversation('dm', [userId]);
      navigate(`/conversations/${conv._id || conv.id}`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="page">
      <div className="header">
        <button className="icon-btn" onClick={() => navigate(-1)}>&#8592;</button>
        <h2>School Directory</h2>
        <div style={{ width: 40 }} />
      </div>

      <p className="auth-desc" style={{ marginBottom: '2rem', textAlign: 'left' }}>
        Discover and connect with verified students at your university.
      </p>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--cream-dim)', padding: '4rem' }}>Loading directory...</p>
      ) : students.length === 0 ? (
        <div className="empty-state">
          <CampusBuilding size={64} />
          <p>No other students registered yet.</p>
        </div>
      ) : (
        <ul className="search-results">
          {students.map((user) => {
            const userId = user._id || user.id;
            return (
                <li
                key={userId}
                className="search-result-item"
                style={{ padding: '1.25rem 1rem' }}
              >
                <div onClick={() => startDM(userId)} style={{ flex: 1, cursor: 'pointer' }}>
                  <div className="name">{user.displayName}</div>
                  <div className="email" style={{ fontSize: '0.75rem' }}>{user.email}</div>
                  {user.showPhoneInProfile && user.phoneNumber && (
                    <div style={{ marginTop: '0.4rem' }}>
                      <a 
                        href={`tel:${user.phoneNumber}`} 
                        className="auth-link" 
                        style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>&#128222;</span> {user.phoneNumber}
                      </a>
                    </div>
                  )}
                </div>
                <div onClick={() => startDM(userId)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--gold)', fontWeight: 600 }}>MESSAGE</span>
                  <span style={{ color: 'var(--gold)' }}>&#8594;</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
