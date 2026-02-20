import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { updateMe } from '../api/auth';
import { supabase } from '../lib/supabase';
import CampusBuilding from '../components/CampusBuilding';

export default function Settings() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  
  // Supabase user metadata is in user_metadata
  const [displayName, setDisplayName] = useState(user?.user_metadata?.full_name || user?.display_name || '');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.user_metadata?.full_name || user.display_name || '');
    }
  }, [user]);

  const handleUpdate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await updateMe({ 
        full_name: displayName
      });
      
      // Refresh user state
      const { data: { user: updatedUser } } = await supabase.auth.getUser();
      setUser(updatedUser);
      setMessage('Profile updated successfully');
    } catch (err: any) {
      setMessage(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const scheduleDeletion = async () => {
    setLoading(true);
    try {
      // Supabase doesn't have a simple 'delete self' for users without a specialized edge function
      // For this demo, we'll just sign out.
      await supabase.auth.signOut();
      navigate('/login');
    } catch (err) {
      setMessage('Failed to sign out');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page page-center" style={{ paddingBottom: '4rem' }}>
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
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="text" value={user?.email || ''} disabled />
          </div>
          <button className="btn btn-primary" onClick={() => handleUpdate()} disabled={loading} style={{ width: '100%' }}>
            Save Basic Info
          </button>
        </section>

        {message && <p className="success" style={{ textAlign: 'center', color: 'var(--gold)', marginBottom: '1rem' }}>{message}</p>}

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button className="btn btn-outline" onClick={() => navigate('/conversations')} style={{ flex: 1 }}>Back</button>
          <button className="btn btn-primary" onClick={() => { supabase.auth.signOut(); navigate('/login'); }} style={{ flex: 1, background: 'var(--error)', color: 'white' }}>Logout</button>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--black-border)', marginBottom: '2rem' }} />

        <div style={{ textAlign: 'center' }}>
          {!showDeleteConfirm ? (
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              style={{ color: 'var(--cream-dim)', background: 'none', border: 'none', fontSize: '0.8rem', textDecoration: 'underline', cursor: 'pointer' }}
            >
              Sign Out from all devices
            </button>
          ) : (
            <div style={{ background: 'rgba(255,77,79,0.05)', padding: '1rem', borderRadius: '8px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--error)', marginBottom: '1rem' }}>
                Are you sure you want to sign out?
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <button className="btn btn-primary" onClick={scheduleDeletion} style={{ background: 'var(--error)', fontSize: '0.75rem', padding: '0.4rem 1rem' }}>
                  Confirm
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
