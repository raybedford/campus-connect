import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login, getMe } from '../api/auth';
import { publishKey } from '../api/keys';
import { generateAndStoreKeyPair, hasKeyPair } from '../crypto/keyManager';
import { useAuthStore } from '../store/auth';
import CampusBuilding from '../components/CampusBuilding';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setTokens, setUser } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const tokens = await login(email, password);
      setTokens(tokens.access_token, tokens.refresh_token);
      const user = await getMe();
      setUser(user);

      // Ensure keypair exists on this device
      if (!(await hasKeyPair())) {
        const keyPair = await generateAndStoreKeyPair();
        await publishKey(keyPair.publicKey);
      }

      navigate('/conversations');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page page-center">
      <CampusBuilding size={120} />
      <h1>Campus Connect</h1>
      <p className="subtitle">Sign in to your account</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@school.edu"
            required
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            required
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary mt-1" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p className="text-center mt-2">
        Don't have an account? <Link to="/signup" className="link">Sign up</Link>
      </p>
    </div>
  );
}
