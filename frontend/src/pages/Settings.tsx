import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { updateMe } from '../api/auth';
import { supabase } from '../lib/supabase';
import CampusBuilding from '../components/CampusBuilding';

import { getStoredKeyPair } from '../crypto/keyManager';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'zh', name: 'Chinese' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ar', name: 'Arabic' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
];

export default function Settings() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  
  const [displayName, setDisplayName] = useState(profile?.display_name || user?.user_metadata?.full_name || '');
  const [preferredLang, setPreferredLang] = useState(profile?.preferred_language || 'en');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [notifStatus, setNotifStatus] = useState<string>('');

  // E2EE Backup states
  const [showKey, setShowKey] = useState(false);
  const [mySecretKey, setMySecretKey] = useState('');
  const [myPublicKey, setMyPublicKey] = useState('');
  const [importKey, setImportKey] = useState('');

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name);
      setPreferredLang(profile.preferred_language || 'en');
    }
    // Check notification permission on load
    if (window.Notification) {
      setNotifStatus(Notification.permission);
    }

    // Load keys for backup/verification
    getStoredKeyPair().then(keys => {
      if (keys) {
        setMySecretKey(keys.secretKey);
        setMyPublicKey(keys.publicKey);
      }
    });
  }, [profile]);

  const handleSyncKey = async () => {
    if (!myPublicKey) return;
    setLoading(true);
    try {
      const { publishKey } = await import('../api/keys');
      await publishKey(myPublicKey);
      setMessage('Security key synced to server successfully!');
    } catch (err) {
      alert('Failed to sync key to server.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportKey = async () => {
    if (!importKey.trim()) return;
    try {
      const { set } = await import('idb-keyval');
      const { fromBase64, toBase64 } = await import('../utils/base64');
      const nacl = (await import('tweetnacl')).default;

      // Validate key format
      const skBytes = fromBase64(importKey);
      if (skBytes.length !== 32) throw new Error('Invalid key length');

      // Derive public key from secret key
      const keyPair = nacl.box.keyPair.fromSecretKey(skBytes);
      
      await set('campus_connect_private_key', importKey);
      await set('campus_connect_public_key', toBase64(keyPair.publicKey));
      
      setMessage('Security key imported successfully! Refreshing...');
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      alert('Invalid security key. Please check the code and try again.');
    }
  };

  const enableNotifications = async () => {
    if (!window.Notification) {
      alert('Notifications are not supported by this browser.');
      return;
    }

    const permission = await Notification.requestPermission();
    setNotifStatus(permission);

    if (permission === 'granted') {
      // In a real FCM/OneSignal app, you would get the token here.
      // For this prototype, we'll generate a dummy browser token 
      // to demonstrate the database and edge function logic.
      const dummyToken = 'web_' + Math.random().toString(36).substring(7);
      
      try {
        await supabase.from('push_tokens').upsert({
          user_id: user.id,
          token: dummyToken,
          device_type: 'web'
        });
        setMessage('Notifications enabled successfully');
      } catch (err) {
        console.error('Failed to save push token:', err);
      }
    }
  };

  const handleUpdate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await updateMe({ 
        full_name: displayName
      });
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          display_name: displayName,
          preferred_language: preferredLang
        })
        .eq('id', user.id);
        
      if (updateError) throw updateError;
      
      setMessage('Profile updated successfully');
    } catch (err: any) {
      setMessage(err.message || 'Failed to update profile');
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
          <div className="form-group">
            <label className="form-label">Institution</label>
            <input type="text" value={profile?.school?.name || 'Searching...'} disabled />
          </div>
          
          <div className="form-group">
            <label className="form-label">Preferred Translation Language</label>
            <select 
              value={preferredLang} 
              onChange={(e) => setPreferredLang(e.target.value)}
              style={{
                width: '100%',
                padding: '0.8rem',
                background: 'var(--black)',
                color: 'var(--cream)',
                border: '1px solid var(--black-border)',
                borderRadius: '8px'
              }}
            >
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
            <p style={{ fontSize: '0.7rem', color: 'var(--cream-dim)', marginTop: '0.4rem' }}>
              When set to a language other than English, incoming messages will be <strong>automatically translated</strong>.
            </p>
          </div>

          <button className="btn btn-primary" onClick={() => handleUpdate()} disabled={loading} style={{ width: '100%' }}>
            Save Basic Info
          </button>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: 'var(--gold)', fontFamily: 'var(--serif)', marginBottom: '1rem' }}>E2EE Security Backup</h3>
          <div style={{ background: 'var(--black)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--black-border)' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--cream-dim)', marginBottom: '1rem' }}>
              Your messages are encrypted. To read them on another device (like your phone), you must import your <strong>Recovery Code</strong>.
            </p>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Your Recovery Code</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type={showKey ? "text" : "password"} 
                  value={mySecretKey} 
                  readOnly 
                  style={{ fontSize: '0.75rem', fontFamily: 'var(--mono)', background: 'rgba(0,0,0,0.2)' }}
                />
                <button className="btn btn-outline" onClick={() => setShowKey(!showKey)} style={{ padding: '0.5rem 1rem', fontSize: '0.7rem' }}>
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <p style={{ fontSize: '0.6rem', color: 'var(--cream-dim)', marginTop: '0.5rem' }}>
                Public Key ID: <span style={{ fontFamily: 'var(--mono)' }}>{myPublicKey.substring(0, 12)}...</span>
              </p>
              <button 
                className="btn-nav-gold" 
                onClick={handleSyncKey} 
                style={{ marginTop: '0.75rem', fontSize: '0.65rem', padding: '0.3rem 0.8rem' }}
                disabled={loading}
              >
                ↻ Sync Key to Server
              </button>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--black-border)', margin: '1.5rem 0' }} />

            <div>
              <label className="form-label">Import Code from another device</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="password" 
                  placeholder="Paste recovery code here..." 
                  value={importKey}
                  onChange={(e) => setImportKey(e.target.value)}
                  style={{ fontSize: '0.75rem' }}
                />
                <button className="btn btn-primary" onClick={handleImportKey} style={{ padding: '0.5rem 1rem', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                  Import
                </button>
              </div>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: 'var(--gold)', fontFamily: 'var(--serif)', marginBottom: '1rem' }}>Notifications</h3>
          <div style={{ background: 'var(--black)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--black-border)' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--cream-dim)', marginBottom: '1rem' }}>
              Receive alerts for new messages when the app is in the background.
            </p>
            <button 
              className={`btn ${notifStatus === 'granted' ? 'btn-outline' : 'btn-primary'}`} 
              onClick={enableNotifications}
              disabled={notifStatus === 'granted'}
              style={{ width: '100%', fontSize: '0.8rem' }}
            >
              {notifStatus === 'granted' ? '✓ Notifications Enabled' : 'Enable Push Notifications'}
            </button>
          </div>
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
                <button className="btn btn-primary" onClick={() => { supabase.auth.signOut(); navigate('/login'); }} style={{ background: 'var(--error)', fontSize: '0.75rem', padding: '0.4rem 1rem' }}>
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
