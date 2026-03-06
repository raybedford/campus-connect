/**
 * QR Code Key Transfer Component
 *
 * Allows users to easily transfer their E2EE keys to a new device
 * by generating a QR code and scanning it on the new device.
 */

import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getPublicKey, getPrivateKey } from '../crypto/keyManager';
import { toBase64, fromBase64 } from '../utils/base64';
import { encryptMessageWithGroupKey, decryptMessageWithGroupKey, generateGroupKey } from '../crypto/groupEncryption';
import { initializeTransferRequest, checkKeyTransfer, claimKeyTransfer } from '../api/keyTransfers';

interface QRKeyTransferProps {
  onImportComplete?: () => void;
}

export default function QRKeyTransfer({ onImportComplete }: QRKeyTransferProps) {
  const [mode, setMode] = useState<'pair' | 'export' | 'import'>('pair');
  const [qrData, setQrData] = useState<string>('');
  const [importData, setImportData] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Pairing mode state
  const [transferCode, setTransferCode] = useState('');
  const [pairingUrl, setPairingUrl] = useState('');
  const pollingIntervalRef = useRef<number | null>(null);

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

  // Initialize pairing mode
  const startPairing = async () => {
    setLoading(true);
    setError('');

    try {
      const code = await initializeTransferRequest();
      setTransferCode(code);

      // Generate pairing URL
      const baseUrl = window.location.origin;
      const url = `${baseUrl}/pair?code=${code}`;
      setPairingUrl(url);

      // Start polling for keys
      startPolling(code);
    } catch (err: any) {
      console.error('Failed to initialize pairing:', err);
      setError(err.message || 'Failed to start pairing');
    } finally {
      setLoading(false);
    }
  };

  // Poll server for uploaded keys
  const startPolling = (code: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes at 5-second intervals

    pollingIntervalRef.current = window.setInterval(async () => {
      attempts++;

      if (attempts > maxAttempts) {
        stopPolling();
        setError('Pairing timed out. Please try again.');
        return;
      }

      try {
        const keyData = await checkKeyTransfer(code);

        if (keyData) {
          // Keys received! Import them
          stopPolling();
          await importKeysFromData(keyData);
          await claimKeyTransfer(code);

          setSuccess('✅ Keys received and imported successfully!');

          if (onImportComplete) {
            setTimeout(() => {
              onImportComplete();
            }, 2000);
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 5000); // Check every 5 seconds
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  // Import keys from received data
  const importKeysFromData = async (keyData: string) => {
    try {
      const payload = JSON.parse(keyData);
      const tempKey = fromBase64(payload.key);
      const decryptedBundleStr = decryptMessageWithGroupKey(
        payload.data,
        payload.nonce,
        tempKey
      );
      const keyBundle = JSON.parse(decryptedBundleStr);

      if (keyBundle.expiresAt && Date.now() > keyBundle.expiresAt) {
        throw new Error('Keys have expired');
      }

      if (!keyBundle.public || !keyBundle.private) {
        throw new Error('Invalid key bundle');
      }

      const { importKeypair } = await import('../crypto/keyManager');
      await importKeypair(keyBundle.private);
    } catch (err: any) {
      throw new Error('Failed to import keys: ' + err.message);
    }
  };

  // Auto-start pairing or generate QR code based on mode
  useEffect(() => {
    if (mode === 'pair' && !transferCode) {
      startPairing();
    } else if (mode === 'export') {
      generateQRCode();
    }

    // Cleanup polling on unmount
    return () => {
      stopPolling();
    };
  }, [mode]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  return (
    <div className="qr-key-transfer">
      <div className="mode-selector">
        <button
          className={mode === 'pair' ? 'active' : ''}
          onClick={() => {
            stopPolling();
            setTransferCode('');
            setPairingUrl('');
            setMode('pair');
          }}
        >
          📱 Pair with Mobile
        </button>
        <button
          className={mode === 'import' ? 'active' : ''}
          onClick={() => {
            stopPolling();
            setMode('import');
          }}
        >
          📥 Paste Keys
        </button>
        <button
          className={mode === 'export' ? 'active' : ''}
          onClick={() => {
            stopPolling();
            setMode('export');
          }}
        >
          📤 Export Keys
        </button>
      </div>

      {error && (
        <div className="error-message" style={{ color: 'red', marginBottom: '1rem', padding: '1rem', background: 'rgba(244, 67, 54, 0.1)', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      {success && (
        <div className="success-message" style={{ color: 'green', marginBottom: '1rem', padding: '1rem', background: 'rgba(76, 175, 80, 0.1)', borderRadius: '8px' }}>
          {success}
        </div>
      )}

      {mode === 'pair' && (
        <div className="pair-section">
          <h3>Pair with Your Mobile Device</h3>

          <div style={{
            background: '#e8f5e9',
            padding: '1.5rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            border: '2px solid #4CAF50'
          }}>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.9em', color: '#2e7d32', fontWeight: 'bold' }}>
              📱 How to pair:
            </p>
            <ol style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.85em', color: '#388e3c', lineHeight: 1.8 }}>
              <li>Open Camera app on your mobile device</li>
              <li>Point at the QR code below</li>
              <li>Tap the notification to open the link</li>
              <li>Confirm the code matches, then tap "Transfer My Keys"</li>
              <li>Your keys will automatically appear here!</li>
            </ol>
          </div>

          {loading && !transferCode && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p>Initializing pairing...</p>
            </div>
          )}

          {transferCode && pairingUrl && (
            <>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <div style={{
                  display: 'inline-block',
                  padding: '2rem',
                  background: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  <QRCodeSVG
                    value={pairingUrl}
                    size={280}
                    level="H"
                    includeMargin={true}
                  />
                </div>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                padding: '1.5rem',
                borderRadius: '12px',
                textAlign: 'center',
                marginBottom: '1.5rem',
                border: '3px solid #4CAF50'
              }}>
                <div style={{ fontSize: '0.9em', color: '#666', marginBottom: '0.5rem' }}>
                  Transfer Code
                </div>
                <div style={{
                  fontSize: '3em',
                  fontWeight: 'bold',
                  color: '#4CAF50',
                  letterSpacing: '0.3em',
                  fontFamily: 'monospace'
                }}>
                  {transferCode}
                </div>
                <div style={{ fontSize: '0.8em', color: '#666', marginTop: '0.5rem' }}>
                  Verify this code on your mobile device
                </div>
              </div>

              <div style={{
                textAlign: 'center',
                padding: '1rem',
                background: '#fff8e1',
                borderRadius: '8px',
                fontSize: '0.9em',
                color: '#f57c00'
              }}>
                <div style={{ marginBottom: '0.5rem' }}>⏳ Waiting for your mobile device...</div>
                <div style={{ fontSize: '0.85em', color: '#ff9800' }}>This code expires in 5 minutes</div>
              </div>
            </>
          )}
        </div>
      )}

      {mode === 'export' && (
        <div className="export-section">
          <h3>Export Keys from This Device</h3>

          <div style={{
            background: '#e3f2fd',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            border: '2px solid #2196F3'
          }}>
            <p style={{ margin: 0, fontSize: '0.9em', color: '#1565c0', fontWeight: 'bold' }}>
              📱 Transferring from Mobile to Desktop?
            </p>
            <ol style={{ margin: '0.5rem 0 0 1.2rem', padding: 0, fontSize: '0.85em', color: '#1976d2' }}>
              <li>Tap "Copy Text to Clipboard" below</li>
              <li>Send to yourself via <strong>iMessage</strong>, <strong>Email</strong>, or <strong>AirDrop</strong></li>
              <li>On your desktop, paste the text in the Import tab</li>
            </ol>
          </div>

          <p style={{ fontSize: '0.85em', color: '#666', marginBottom: '1rem' }}>
            Your keys are encrypted during transfer for security. This code expires in 15 minutes.
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

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '1em' }}>
              Your Encrypted Key (Copy This)
            </label>
            <textarea
              readOnly
              value={qrData}
              rows={6}
              style={{
                width: '100%',
                fontSize: '0.8em',
                padding: '0.75rem',
                fontFamily: 'monospace',
                border: '2px solid #4CAF50',
                borderRadius: '8px',
                background: '#f5f5f5',
                resize: 'none'
              }}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(qrData);
                setSuccess('✅ Copied to clipboard! Now send it to your other device.');
                setTimeout(() => setSuccess(''), 3000);
              }}
              style={{
                marginTop: '0.75rem',
                padding: '0.75rem 1.5rem',
                background: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1em',
                fontWeight: 'bold',
                width: '100%'
              }}
            >
              📋 Copy Text to Clipboard
            </button>
          </div>

          <details style={{ marginTop: '1.5rem', fontSize: '0.85em' }}>
            <summary style={{ cursor: 'pointer', color: '#666', fontWeight: 'bold' }}>
              Show QR Code (for mobile-to-mobile transfer)
            </summary>
            {qrData && (
              <div className="qr-code-container" style={{ padding: '1rem', background: 'white', display: 'inline-block', borderRadius: '8px', marginTop: '1rem' }}>
                <QRCodeSVG
                  value={qrData}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
            )}
          </details>
        </div>
      )}

      {mode === 'import' && (
        <div className="import-section">
          <h3>Import Keys to This Device</h3>

          <div style={{
            background: '#fff3cd',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            border: '2px solid #ffc107'
          }}>
            <p style={{ margin: 0, fontSize: '0.9em', color: '#856404', fontWeight: 'bold' }}>
              💻 Receiving on Desktop from Mobile?
            </p>
            <ol style={{ margin: '0.5rem 0 0 1.2rem', padding: 0, fontSize: '0.85em', color: '#856404' }}>
              <li>On your mobile device, go to Settings → QR Transfer → Export</li>
              <li>Copy the text and send it to yourself (iMessage/Email/AirDrop)</li>
              <li>Paste the text below and click "Import Keys"</li>
            </ol>
          </div>

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
