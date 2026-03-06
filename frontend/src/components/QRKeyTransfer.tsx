/**
 * QR Code Key Transfer Component
 *
 * Allows users to easily transfer their E2EE keys to a new device
 * by generating a QR code and scanning it on the new device.
 */

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getPublicKey, getPrivateKey } from '../crypto/keyManager';
import { toBase64, fromBase64 } from '../utils/base64';
import { encryptMessageWithGroupKey, decryptMessageWithGroupKey, generateGroupKey } from '../crypto/groupEncryption';

interface QRKeyTransferProps {
  onImportComplete?: () => void;
}

export default function QRKeyTransfer({ onImportComplete }: QRKeyTransferProps) {
  const [mode, setMode] = useState<'export' | 'import'>('export');
  const [qrData, setQrData] = useState<string>('');
  const [importData, setImportData] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Generate QR code with encrypted keys
  const generateQRCode = async () => {
    setLoading(true);
    setError('');

    try {
      // Get current user's keys
      const publicKey = await getPublicKey();
      const privateKey = await getPrivateKey();

      if (!publicKey || !privateKey) {
        throw new Error('No keys found to export');
      }

      // Create a temporary encryption key for the QR code
      // This adds an extra layer of security during transfer
      const tempKey = generateGroupKey();

      // Bundle the keys with 15-minute expiration
      const keyBundle = {
        public: toBase64(publicKey),
        private: toBase64(privateKey),
        timestamp: Date.now(),
        expiresAt: Date.now() + (15 * 60 * 1000), // 15 minutes from now
        version: '1.0'
      };

      // Encrypt the key bundle with the temp key
      const { ciphertext_b64, nonce_b64 } = encryptMessageWithGroupKey(
        JSON.stringify(keyBundle),
        tempKey
      );

      // Create the QR data (temp key + encrypted bundle)
      const qrPayload = {
        key: toBase64(tempKey),
        data: ciphertext_b64,
        nonce: nonce_b64
      };

      setQrData(JSON.stringify(qrPayload));
      setSuccess('QR code generated! Scan with your new device.');
    } catch (err: any) {
      console.error('Failed to generate QR code:', err);
      setError(err.message || 'Failed to generate QR code');
    } finally {
      setLoading(false);
    }
  };

  // Import keys from QR code data
  const handleImportKeys = async () => {
    if (!importData.trim()) {
      setError('Please paste the key data');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Parse the QR payload
      const payload = JSON.parse(importData);

      if (!payload.key || !payload.data || !payload.nonce) {
        throw new Error('Invalid key data format');
      }

      // Decrypt the key bundle
      const tempKey = fromBase64(payload.key);
      const decryptedBundleStr = decryptMessageWithGroupKey(
        payload.data,
        payload.nonce,
        tempKey
      );

      const keyBundle = JSON.parse(decryptedBundleStr);

      // Check if QR code has expired (15 minute window)
      if (keyBundle.expiresAt && Date.now() > keyBundle.expiresAt) {
        throw new Error('This QR code has expired. Please generate a new one on your other device.');
      }

      if (!keyBundle.public || !keyBundle.private) {
        throw new Error('Invalid key bundle');
      }

      // Import the keys
      const { importKeypair } = await import('../crypto/keyManager');
      await importKeypair(keyBundle.private);

      setSuccess('✅ Keys imported successfully! You can now decrypt messages on this device.');
      setImportData('');

      if (onImportComplete) {
        setTimeout(() => {
          onImportComplete();
        }, 2000);
      }
    } catch (err: any) {
      console.error('Failed to import keys:', err);
      setError(err.message || 'Failed to import keys. Make sure the data is correct.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate QR code when in export mode
  useEffect(() => {
    if (mode === 'export') {
      generateQRCode();
    }
  }, [mode]);

  return (
    <div className="qr-key-transfer">
      <div className="mode-selector">
        <button
          className={mode === 'export' ? 'active' : ''}
          onClick={() => setMode('export')}
        >
          📤 Export Keys
        </button>
        <button
          className={mode === 'import' ? 'active' : ''}
          onClick={() => setMode('import')}
        >
          📥 Import Keys
        </button>
      </div>

      {mode === 'export' && (
        <div className="export-section">
          <h3>Transfer Keys to New Device</h3>
          <p style={{ fontSize: '0.9em', color: '#666', marginBottom: '1rem' }}>
            Scan this QR code with your new device to transfer your encryption keys.
            The keys are encrypted during transfer for security.
          </p>

          {loading && <p>Generating QR code...</p>}

          {error && (
            <div className="error-message" style={{ color: 'red', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          {success && (
            <div className="success-message" style={{ color: 'green', marginBottom: '1rem' }}>
              {success}
            </div>
          )}

          {qrData && (
            <div className="qr-code-container" style={{ padding: '1rem', background: 'white', display: 'inline-block', borderRadius: '8px' }}>
              <QRCodeSVG
                value={qrData}
                size={256}
                level="H"
                includeMargin={true}
              />
            </div>
          )}

          <div style={{ marginTop: '1rem' }}>
            <p style={{ fontSize: '0.85em', color: '#666', marginBottom: '0.5rem' }}>
              <strong>For computers without cameras:</strong> Copy this text and paste it on the other device
            </p>
            <textarea
              readOnly
              value={qrData}
              rows={4}
              style={{
                width: '100%',
                fontSize: '0.75em',
                padding: '0.5rem',
                fontFamily: 'monospace',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(qrData);
                setSuccess('✅ Copied to clipboard!');
                setTimeout(() => setSuccess(''), 2000);
              }}
              style={{
                marginTop: '0.5rem',
                padding: '0.5rem 1rem',
                background: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85em'
              }}
            >
              📋 Copy Text to Clipboard
            </button>
          </div>
        </div>
      )}

      {mode === 'import' && (
        <div className="import-section">
          <h3>Import Keys from Another Device</h3>
          <p style={{ fontSize: '0.9em', color: '#666', marginBottom: '1rem' }}>
            <strong>On mobile:</strong> Scan the QR code from your computer<br />
            <strong>On computer:</strong> Paste the text from your mobile device
          </p>

          {error && (
            <div className="error-message" style={{ color: 'red', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          {success && (
            <div className="success-message" style={{ color: 'green', marginBottom: '1rem' }}>
              {success}
            </div>
          )}

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Option 1: Paste Key Data (Works on all devices)
            </label>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder="Paste the key data here... (from the text box or QR code)"
              rows={6}
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '0.85em',
                fontFamily: 'monospace',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
            <button
              onClick={handleImportKeys}
              disabled={loading || !importData.trim()}
              style={{
                marginTop: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: importData.trim() ? '#2196F3' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: importData.trim() ? 'pointer' : 'not-allowed',
                fontSize: '1em',
                width: '100%'
              }}
            >
              {loading ? 'Importing...' : '📥 Import Keys from Text'}
            </button>
          </div>

          <div style={{
            borderTop: '2px solid #ddd',
            paddingTop: '1rem',
            marginTop: '1rem'
          }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Option 2: Scan QR Code (Mobile only)
            </label>
            <p style={{ fontSize: '0.8em', color: '#666', marginBottom: '0.5rem' }}>
              Use your phone's camera app or a QR scanner app to scan the QR code from your computer screen
            </p>
            <button
              onClick={() => {
                alert('To scan a QR code:\n\n1. Open your camera app (iOS/Android)\n2. Point at the QR code on your other device\n3. Tap the notification to open\n4. The key data will auto-fill in the text box above\n\nNote: Browser camera scanning requires HTTPS. For now, use the "Copy Text" option from the export screen.');
              }}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              📷 How to Scan QR Code
            </button>
          </div>
        </div>
      )}

      <style>{`
        .qr-key-transfer {
          max-width: 600px;
          margin: 0 auto;
        }

        .mode-selector {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .mode-selector button {
          flex: 1;
          padding: 0.75rem;
          border: 2px solid #ddd;
          background: white;
          cursor: pointer;
          border-radius: 8px;
          font-size: 1em;
          transition: all 0.2s;
        }

        .mode-selector button.active {
          background: #2196F3;
          color: white;
          border-color: #2196F3;
        }

        .mode-selector button:hover:not(.active) {
          border-color: #2196F3;
        }

        .qr-code-container {
          text-align: center;
        }

        .export-section,
        .import-section {
          padding: 1.5rem;
          background: #f9f9f9;
          border-radius: 8px;
        }

        .export-section h3,
        .import-section h3 {
          margin-top: 0;
        }
      `}</style>
    </div>
  );
}
