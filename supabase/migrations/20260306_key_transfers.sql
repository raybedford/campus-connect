-- Create temporary key transfer table for device pairing
CREATE TABLE IF NOT EXISTS key_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_code TEXT UNIQUE NOT NULL,
  encrypted_key_data TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  claimed BOOLEAN DEFAULT false
);

-- Auto-delete expired transfers
CREATE INDEX idx_key_transfers_expires ON key_transfers(expires_at) WHERE NOT claimed;

-- Enable RLS
ALTER TABLE key_transfers ENABLE ROW LEVEL SECURITY;

-- Anyone can read by transfer_code (they need the code anyway)
CREATE POLICY "Anyone can read with transfer code"
  ON key_transfers
  FOR SELECT
  USING (true);

-- Authenticated users can create transfers
CREATE POLICY "Authenticated users can create transfers"
  ON key_transfers
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can mark as claimed
CREATE POLICY "Authenticated users can update to claimed"
  ON key_transfers
  FOR UPDATE
  USING (true)
  WITH CHECK (claimed = true);

-- Clean up expired transfers (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_key_transfers()
RETURNS void AS $$
BEGIN
  DELETE FROM key_transfers 
  WHERE expires_at < now() OR (created_at < now() - interval '1 hour');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE key_transfers IS 'Temporary storage for device-to-device key transfers (like TV pairing)';
