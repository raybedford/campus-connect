import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { uploadKeysForTransfer } from '../api/keyTransfers';
import { getPublicKey, getPrivateKey } from '../crypto/keyManager';
import { toBase64 } from '../utils/base64';
import { encryptMessageWithGroupKey, generateGroupKey } from '../crypto/groupEncryption';
import CampusBuilding from '../components/CampusBuilding';

export default function KeyTransferPair() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const transferCode = searchParams.get('code');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleTransfer = async () => {
    if (!transferCode) {
      setError('Invalid transfer code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get current user's keys
      const publicKey = await getPublicKey();
      const privateKey = await getPrivateKey();

      if (!publicKey || !privateKey) {
        throw new Error('No keys found on this device');
      }

      // Create encrypted bundle (same as QR export)
      const tempKey = generateGroupKey();
      const keyBundle = {
        public: toBase64(publicKey),
        private: toBase64(privateKey),
        timestamp: Date.now(),
        expiresAt: Date.now() + (15 * 60 * 1000),
        version: '1.0'
      };

      const { ciphertext_b64, nonce_b64 } = encryptMessageWithGroupKey(
        JSON.stringify(keyBundle),
        tempKey
      );

      const qrPayload = {
        key: toBase64(tempKey),
        data: ciphertext_b64,
        nonce: nonce_b64
      };

      // Upload to server with transfer code
      await uploadKeysForTransfer(transferCode, JSON.stringify(qrPayload));

      setSuccess(true);
      setTimeout(() => navigate('/'), 3000);
    } catch (err: any) {
      console.error('Failed to transfer keys:', err);
      setError(err.message || 'Failed to transfer keys');
    } finally {
      setLoading(false);
    }
  };

  if (!transferCode) {
    return (
      <div className="page page-center">
        <div className="auth-card" style={{ maxWidth: '400px' }}>
          <CampusBuilding size={64} />
          <h2 style={{ color: 'var(--gold)', marginTop: '1rem' }}>Invalid Transfer Link</h2>
          <p>This key transfer link is invalid or has expired.</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="page page-center">
        <div className="auth-card" style={{ maxWidth: '400px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
            <h2 style={{ color: 'var(--gold)' }}>Keys Transferred!</h2>
            <p style={{ color: 'var(--cream)', marginTop: '1rem' }}>
              Your encryption keys have been securely transferred to your desktop.
            </p>
            <p style={{ color: 'var(--cream-dim)', fontSize: '0.9em', marginTop: '1rem' }}>
              Redirecting you back to the app...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page page-center">
      <div className="auth-card" style={{ maxWidth: '450px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <CampusBuilding size={64} />
          <h2 style={{ color: 'var(--gold)', marginTop: '1rem' }}>Transfer Keys to Desktop</h2>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '1.5rem',
          borderRadius: '12px',
          marginBottom: '2rem',
          border: '2px solid var(--gold)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.9em', color: 'var(--cream-dim)', marginBottom: '0.5rem' }}>
              Transfer Code
            </div>
            <div style={{
              fontSize: '2.5em',
              fontWeight: 'bold',
              color: 'var(--gold)',
              letterSpacing: '0.2em',
              fontFamily: 'monospace'
            }}>
              {transferCode}
            </div>
          </div>
          <p style={{ fontSize: '0.85em', color: 'var(--cream-dim)', margin: 0, textAlign: 'center' }}>
            Verify this code matches what's shown on your desktop
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(244, 67, 54, 0.1)',
            border: '1px solid #f44336',
            padding: '1rem',
            borderRadius: '8px',
            color: '#ff6b6b',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ color: 'var(--cream)', fontSize: '0.95em', marginBottom: '0.75rem' }}>
            This will transfer your encryption keys to the desktop device that's waiting for pairing.
          </p>
          <ul style={{ color: 'var(--cream-dim)', fontSize: '0.85em', paddingLeft: '1.5rem', margin: 0 }}>
            <li>Your keys are encrypted during transfer</li>
            <li>The transfer code expires in 5 minutes</li>
            <li>Only use this if you trust the desktop device</li>
          </ul>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleTransfer}
          disabled={loading}
          style={{ width: '100%', padding: '1rem', fontSize: '1.1em' }}
        >
          {loading ? '⏳ Transferring Keys...' : '🔐 Transfer My Keys'}
        </button>

        <button
          className="btn"
          onClick={() => navigate('/')}
          style={{
            width: '100%',
            marginTop: '1rem',
            background: 'transparent',
            border: '1px solid var(--black-border)'
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
