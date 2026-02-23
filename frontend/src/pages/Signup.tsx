import { useState } from 'react';
import { Link } from 'react-router-dom';
import { signup } from '../api/auth';
import CampusBuilding from '../components/CampusBuilding';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [issubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.endsWith('.edu')) {
      setError('Please use a .edu email address');
      return;
    }
    setError('');
    setLoading(true);

    try {
      await signup(email, password, displayName);
      setIsSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  if (issubmitted) {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <CampusBuilding size={64} />
          </div>
          <h1 className="auth-title">Verify Your Email</h1>
          <p className="auth-desc">
            We've sent a confirmation link to <br />
            <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{email}</span>
          </p>
          <p style={{ fontSize: '0.9rem', color: 'var(--cream-dim)', marginTop: '1.5rem' }}>
            Please click the link in the email to activate your account. Once verified, you can sign in.
          </p>
          <div style={{ marginTop: '2rem' }}>
            <Link to="/login" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <CampusBuilding size={64} />
        </div>
        <h1 className="auth-title">Get Started</h1>
        <p className="auth-desc">Join your campus community.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="First Last"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email (.edu)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@university.edu"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
              />
              <button 
                type="button" 
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && <p className="error">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? 
          <Link to="/login" className="auth-link">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
