import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { verifyEmail } from '../api/auth';
import CampusBuilding from '../components/CampusBuilding';

export default function Verify() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await verifyEmail(email, code);
      // Since Supabase usually verifies via email links, this is just to keep the UI flow for the bypass code
      navigate('/conversations');
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <CampusBuilding size={64} />
        </div>
        <h1 className="auth-title">Verify Email</h1>
        <p className="auth-desc">Enter the 6-digit code sent to<br/><span style={{ color: 'var(--cream)' }}>{email}</span></p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Verification Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              maxLength={6}
              style={{ textAlign: 'center', letterSpacing: '0.2em', fontSize: '1.25rem' }}
              required
            />
          </div>

          {error && <p className="error" style={{ textAlign: 'center' }}>{error}</p>}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={loading || code.length !== 6}
          >
            {loading ? 'Verifying...' : 'Verify & Continue'}
          </button>
        </form>

        <div className="auth-footer" style={{ marginTop: '2rem' }}>
          Didn't receive a code?
          <button className="auth-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>
            Resend
          </button>
        </div>
      </div>
    </div>
  );
}
