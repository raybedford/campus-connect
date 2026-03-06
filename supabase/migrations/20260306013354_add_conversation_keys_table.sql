-- Create conversation_keys table for storing wrapped group keys
CREATE TABLE IF NOT EXISTS conversation_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wrapped_key_b64 TEXT NOT NULL,
  nonce_b64 TEXT NOT NULL,
  wrapped_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure each user only has one wrapped key per conversation
  UNIQUE(conversation_id, user_id)
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_conversation_keys_conversation ON conversation_keys(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_keys_user ON conversation_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_keys_lookup ON conversation_keys(conversation_id, user_id);

-- Enable RLS (Row Level Security)
ALTER TABLE conversation_keys ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read their own conversation keys" ON conversation_keys;
DROP POLICY IF EXISTS "Conversation members can insert keys" ON conversation_keys;
DROP POLICY IF EXISTS "Users can update their own keys" ON conversation_keys;
DROP POLICY IF EXISTS "Users can delete their own keys" ON conversation_keys;

-- Policy: Users can read their own wrapped keys
CREATE POLICY "Users can read their own conversation keys"
  ON conversation_keys
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Members of a conversation can insert wrapped keys for other members
CREATE POLICY "Conversation members can insert keys"
  ON conversation_keys
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_members.conversation_id = conversation_keys.conversation_id
        AND conversation_members.user_id = auth.uid()
    )
  );

-- Policy: Users can update their own wrapped keys
CREATE POLICY "Users can update their own keys"
  ON conversation_keys
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own wrapped keys
CREATE POLICY "Users can delete their own keys"
  ON conversation_keys
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_conversation_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_conversation_keys_updated_at ON conversation_keys;

CREATE TRIGGER update_conversation_keys_updated_at
  BEFORE UPDATE ON conversation_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_keys_updated_at();

-- Add comment for documentation
COMMENT ON TABLE conversation_keys IS 'Stores wrapped (encrypted) group keys for each conversation member. The group key encrypts all messages, and each member has their own wrapped copy.';
