-- ========================================
-- Campus Connect - Database Migration Script
-- Apply these migrations in Supabase SQL Editor
-- Date: March 5, 2026
-- ========================================

-- MIGRATION 1: Add Performance Indexes
-- ========================================

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id ON conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation_id ON conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON profiles(display_name);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_conversation_members_read_status ON conversation_members(user_id, last_read_at, conversation_id);


-- MIGRATION 2: Fix Insecure key_transfers RLS
-- ========================================

DROP POLICY IF EXISTS "Anyone can read with transfer code" ON key_transfers;

CREATE OR REPLACE FUNCTION get_key_transfer_by_code(p_transfer_code TEXT)
RETURNS TABLE (
  id UUID,
  transfer_code TEXT,
  encrypted_key_data TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  claimed BOOLEAN
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kt.id,
    kt.transfer_code,
    kt.encrypted_key_data,
    kt.created_at,
    kt.expires_at,
    kt.claimed
  FROM key_transfers kt
  WHERE kt.transfer_code = p_transfer_code
    AND kt.expires_at > now()
    AND kt.claimed = false
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_key_transfer_by_code(TEXT) TO authenticated;


-- MIGRATION 3: Add Storage Bucket RLS
-- ========================================

DROP POLICY IF EXISTS "Users can upload to conversations they're in" ON storage.objects;
DROP POLICY IF EXISTS "Users can read files from their conversations" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;

CREATE POLICY "Users can upload to conversations they're in"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-files'
  AND (storage.foldername(name))[1] IN (
    SELECT conversation_id::text
    FROM conversation_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can read files from their conversations"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-files'
  AND (storage.foldername(name))[1] IN (
    SELECT conversation_id::text
    FROM conversation_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-files'
  AND owner = auth.uid()
);

CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'chat-files'
  AND owner = auth.uid()
);

-- ========================================
-- END OF MIGRATIONS - All Done!
-- ========================================
