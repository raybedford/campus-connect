import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="page">
      <div className="header">
        <button className="icon-btn" onClick={() => navigate(-1)}>
          &#8592;
        </button>
        <h2>Settings</h2>
        <div style={{ width: 40 }} />
      </div>

      <div style={{ padding: '1rem 0' }}>
        <div className="form-group">
          <label>Display Name</label>
          <p style={{ padding: '0.75rem 0' }}>{user?.display_name}</p>
        </div>
        <div className="form-group">
          <label>Email</label>
          <p style={{ padding: '0.75rem 0' }}>{user?.email}</p>
        </div>
      </div>

      <button className="btn btn-secondary mt-2" onClick={handleLogout}>
        Sign Out
      </button>
    </div>
  );
}
