import { supabase } from '../lib/supabase';

/**
 * Generate a random 6-character transfer code
 */
function generateTransferCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar looking chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Create a new key transfer (called by mobile device)
 * Returns the transfer code to display
 */
export async function createKeyTransfer(encryptedKeyData: string): Promise<string> {
  const transferCode = generateTransferCode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  const { error } = await supabase
    .from('key_transfers')
    .insert({
      transfer_code: transferCode,
      encrypted_key_data: encryptedKeyData,
      expires_at: expiresAt.toISOString()
    });

  if (error) throw error;

  return transferCode;
}

/**
 * Check if a transfer code has keys available (called by desktop)
 * Returns the encrypted key data if available, null if not yet uploaded
 */
export async function checkKeyTransfer(transferCode: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('key_transfers')
    .select('encrypted_key_data, claimed, expires_at')
    .eq('transfer_code', transferCode)
    .single();

  if (error || !data) {
    return null;
  }

  // Check if expired
  if (new Date(data.expires_at) < new Date()) {
    return null;
  }

  // Check if already claimed
  if (data.claimed) {
    return null;
  }

  return data.encrypted_key_data;
}

/**
 * Mark a transfer as claimed (after desktop successfully imports)
 */
export async function claimKeyTransfer(transferCode: string): Promise<void> {
  const { error } = await supabase
    .from('key_transfers')
    .update({ claimed: true })
    .eq('transfer_code', transferCode);

  if (error) throw error;
}

/**
 * Upload keys for a transfer code (called by mobile after scanning QR)
 */
export async function uploadKeysForTransfer(transferCode: string, encryptedKeyData: string): Promise<void> {
  // Check if transfer code exists and hasn't expired
  const { data: existing } = await supabase
    .from('key_transfers')
    .select('id, expires_at, claimed')
    .eq('transfer_code', transferCode)
    .single();

  if (!existing) {
    throw new Error('Invalid transfer code');
  }

  if (new Date(existing.expires_at) < new Date()) {
    throw new Error('Transfer code has expired');
  }

  if (existing.claimed) {
    throw new Error('Transfer code has already been used');
  }

  // Upload the encrypted key data
  const { error } = await supabase
    .from('key_transfers')
    .update({ encrypted_key_data: encryptedKeyData })
    .eq('transfer_code', transferCode);

  if (error) throw error;
}

/**
 * Initialize a transfer request (called by desktop)
 * Creates a pending transfer entry and returns the code
 */
export async function initializeTransferRequest(): Promise<string> {
  const transferCode = generateTransferCode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  const { error } = await supabase
    .from('key_transfers')
    .insert({
      transfer_code: transferCode,
      encrypted_key_data: '', // Will be filled by mobile
      expires_at: expiresAt.toISOString()
    });

  if (error) throw error;

  return transferCode;
}
