import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { verify, getMe } from '../api/auth';
import { publishKey } from '../api/keys';
import { generateAndStoreKeyPair, hasKeyPair } from '../crypto/keyManager';
import { useAuthStore } from '../store/auth';
import CampusBuilding from '../components/CampusBuilding';

export default function Verify() {
  const location = useLocation();
  const email = (location.state as any)?.email || '';
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setTokens, setUser } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const tokens = await verify(email, code);
      setTokens(tokens.access_token, tokens.refresh_token);
      const user = await getMe();
      setUser(user);

      // Generate E2EE keypair after first verification
      if (!(await hasKeyPair())) {
        const keyPair = await generateAndStoreKeyPair();
        await publishKey(keyPair.publicKey);
      }

      navigate('/conversations');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page page-center">
      <CampusBuilding size={100} />
      <h1>Verify Your Email</h1>
      <p className="subtitle">
        Enter the 6-digit code sent to {email || 'your email'}
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Verification Code</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="000000"
            maxLength={6}
            required
            style={{ textAlign: 'center', letterSpacing: '0.5rem', fontSize: '1.5rem' }}
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary mt-1" disabled={loading}>
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </form>
    </div>
  );
}
