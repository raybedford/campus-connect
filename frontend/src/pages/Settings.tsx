import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { updateMe } from '../api/auth';
import client from '../api/client';
import CampusBuilding from '../components/CampusBuilding';

export default function Settings() {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [showPhone, setShowPhone] = useState(user?.showPhoneInProfile || false);
  const [mfaEnabled, setMfaEnabled] = useState(user?.mfaEnabled || false);
  
  const [phoneCode, setPhoneCode] = useState('');
  const [showVerifyPhone, setShowVerifyPhone] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setPhoneNumber(user.phoneNumber || '');
      setShowPhone(user.showPhoneInProfile || false);
      setMfaEnabled(user.mfaEnabled || false);
    }
  }, [user]);

  const handleUpdate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const updated = await updateMe({ 
        displayName, 
        showPhoneInProfile: showPhone,
        mfaEnabled
      });
      setUser(updated);
      setMessage('Profile updated successfully');
    } catch (err) {
      setMessage('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const requestPhoneVerify = async () => {
    setLoading(true);
    try {
      await client.post('/users/me/phone/request', { phoneNumber });
      setShowVerifyPhone(true);
      setMessage('Verification code sent to console');
    } catch (err) {
      setMessage('Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const verifyPhoneCode = async () => {
    setLoading(true);
    try {
      await client.post('/users/me/phone/verify', { code: phoneCode });
      setShowVerifyPhone(false);
      setMessage('Phone verified!');
      const me = await client.get('/users/me');
      setUser(me.data);
    } catch (err) {
      setMessage('Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const scheduleDeletion = async () => {
    setLoading(true);
    try {
      await client.delete('/users/me');
      const me = await client.get('/users/me');
      setUser(me.data);
      setShowDeleteConfirm(false);
      setMessage('Account scheduled for deletion (14 day grace period)');
    } catch (err) {
      setMessage('Failed to schedule deletion');
    } finally {
      setLoading(false);
    }
  };

  const cancelDeletion = async () => {
    setLoading(true);
    try {
      const res = await client.post('/users/me/cancel-deletion');
      setUser(res.data);
      setMessage('Account deletion cancelled!');
    } catch (err) {
      setMessage('Failed to cancel deletion');
    } finally {
      setLoading(false);
    }
  };

  const deletionDate = user?.deletionScheduledAt 
    ? new Date(new Date(user.deletionScheduledAt).getTime() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString()
    : null;

  return (
    <div className="page page-center" style={{ paddingBottom: '4rem' }}>
      {user?.deletionScheduledAt && (
        <div style={{ width: '100%', maxWidth: '550px', background: 'rgba(255,77,79,0.1)', border: '1px solid var(--error)', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--error)', fontWeight: 600, fontSize: '0.9rem' }}>
            Account scheduled for deletion on {deletionDate}
          </p>
          <button 
            onClick={cancelDeletion} 
            style={{ background: 'none', border: 'none', color: 'var(--gold)', fontWeight: 700, cursor: 'pointer', marginTop: '0.5rem', textDecoration: 'underline' }}
          >
            Cancel Deletion Request
          </button>
        </div>
      )}

      <div className="auth-card" style={{ width: '100%', maxWidth: '550px' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <CampusBuilding size={64} />
          <h2 className="auth-title">Settings & Security</h2>
        </div>

        <section style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: 'var(--gold)', fontFamily: 'var(--serif)', marginBottom: '1rem' }}>Personal Info</h3>
          <div className="form-group">
            <label className="form-label">Display Name</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={() => handleUpdate()} disabled={loading} style={{ width: '100%' }}>
            Save Basic Info
          </button>
        </section>

        <section style={{ marginBottom: '2rem', padding: '1.5rem', background: 'rgba(207,184,124,0.05)', borderRadius: '12px' }}>
          <h3 style={{ color: 'var(--gold)', fontFamily: 'var(--serif)', marginBottom: '1rem' }}>Phone & Privacy</h3>
          <div className="form-group">
            <label className="form-label">Mobile Number</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="tel" 
                value={phoneNumber} 
                onChange={(e) => setPhoneNumber(e.target.value)} 
                placeholder="+1 555 000 0000"
                disabled={user?.isPhoneVerified}
              />
              {!user?.isPhoneVerified ? (
                <button className="btn btn-primary" onClick={requestPhoneVerify} disabled={loading || !phoneNumber}>
                  Verify
                </button>
              ) : (
                <span style={{ color: '#52c41a', display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 600 }}>
                  VERIFIED
                </span>
              )}
            </div>
          </div>

          {showVerifyPhone && (
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">Enter 6-Digit Code</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="text" value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} placeholder="123456" />
                <button className="btn btn-primary" onClick={verifyPhoneCode}>Confirm</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
            <input 
              type="checkbox" 
              checked={showPhone} 
              onChange={(e) => {
                setShowPhone(e.target.checked);
                setTimeout(() => handleUpdate(), 0);
              }} 
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
            <label className="form-label" style={{ marginBottom: 0 }}>Show my number and call link to other students</label>
          </div>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: 'var(--gold)', fontFamily: 'var(--serif)', marginBottom: '1rem' }}>Two-Factor Auth</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <input 
              type="checkbox" 
              checked={mfaEnabled} 
              onChange={(e) => {
                setMfaEnabled(e.target.checked);
                setTimeout(() => handleUpdate(), 0);
              }}
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
            <label className="form-label" style={{ marginBottom: 0 }}>Enable Multi-Factor Authentication (MFA)</label>
          </div>
        </section>

        {message && <p className="success" style={{ textAlign: 'center', color: 'var(--gold)', marginBottom: '1rem' }}>{message}</p>}

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button className="btn btn-outline" onClick={() => navigate('/conversations')} style={{ flex: 1 }}>Back</button>
          <button className="btn btn-primary" onClick={() => { localStorage.clear(); navigate('/login'); }} style={{ flex: 1, background: 'var(--error)', color: 'white' }}>Logout</button>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--black-border)', marginBottom: '2rem' }} />

        <div style={{ textAlign: 'center' }}>
          {!showDeleteConfirm ? (
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              style={{ color: 'var(--cream-dim)', background: 'none', border: 'none', fontSize: '0.8rem', textDecoration: 'underline', cursor: 'pointer' }}
            >
              Delete Account
            </button>
          ) : (
            <div style={{ background: 'rgba(255,77,79,0.05)', padding: '1rem', borderRadius: '8px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--error)', marginBottom: '1rem' }}>
                Are you sure? Your data will be hidden and permanently deleted after 14 days.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <button className="btn btn-primary" onClick={scheduleDeletion} style={{ background: 'var(--error)', fontSize: '0.75rem', padding: '0.4rem 1rem' }}>
                  Confirm Deletion
                </button>
                <button className="btn btn-outline" onClick={() => setShowDeleteConfirm(false)} style={{ fontSize: '0.75rem', padding: '0.4rem 1rem' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
