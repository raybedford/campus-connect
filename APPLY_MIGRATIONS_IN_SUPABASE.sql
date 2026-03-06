-- ========================================
-- Campus Connect - Database Migration Script
-- Apply these migrations in Supabase SQL Editor
-- Date: March 5, 2026
-- ========================================

-- MIGRATION 1: Add Performance Indexes
-- File: 20260306_add_performance_indexes.sql
-- ========================================

-- Messages table indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);

-- Conversation members index
CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id ON conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation_id ON conversation_members(conversation_id);

-- Profiles index for search
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON profiles(display_name);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Composite index for unread messages query
CREATE INDEX IF NOT EXISTS idx_conversation_members_read_status ON conversation_members(user_id, last_read_at, conversation_id);

COMMENT ON INDEX idx_messages_conversation_id IS 'Optimize message queries by conversation';
COMMENT ON INDEX idx_messages_conversation_created IS 'Optimize pagination and ordering';
COMMENT ON INDEX idx_conversation_members_read_status IS 'Optimize unread count queries';


-- ========================================
-- MIGRATION 2: Fix Insecure key_transfers RLS
-- File: 20260306_fix_key_transfers_rls.sql
-- ========================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can read with transfer code" ON key_transfers;

-- Create a secure function to get transfer by code
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
AS $$
BEGIN
  -- Only return if:
  -- 1. Code matches exactly
  -- 2. Not expired
  -- 3. Not already claimed
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
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_key_transfer_by_code(TEXT) TO authenticated;

COMMENT ON FUNCTION get_key_transfer_by_code IS 'Securely retrieve key transfer by code, validating expiry and claimed status';


-- ========================================
-- MIGRATION 3: Add Storage Bucket RLS
-- File: 20260306_storage_bucket_rls.sql
-- ========================================

-- Policy: Users can upload files to conversations they're members of
CREATE POLICY IF NOT EXISTS "Users can upload to conversations they're in"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-files'
  AND (storage.foldername(name))[1] IN (
    SELECT conversation_id::text
    FROM conversation_members
    WHERE user_id = auth.uid()
  )
);

-- Policy: Users can read files from conversations they're members of
CREATE POLICY IF NOT EXISTS "Users can read files from their conversations"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-files'
  AND (storage.foldername(name))[1] IN (
    SELECT conversation_id::text
    FROM conversation_members
    WHERE user_id = auth.uid()
  )
);

-- Policy: Users can delete files they uploaded
CREATE POLICY IF NOT EXISTS "Users can delete their own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-files'
  AND owner = auth.uid()
);

-- Policy: Users can update their own files
CREATE POLICY IF NOT EXISTS "Users can update their own files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'chat-files'
  AND owner = auth.uid()
);

COMMENT ON POLICY "Users can upload to conversations they're in" ON storage.objects
IS 'Restricts file uploads to conversations where user is a member';

COMMENT ON POLICY "Users can read files from their conversations" ON storage.objects
IS 'Restricts file access to conversation members only';

-- ========================================
-- END OF MIGRATIONS
-- All migrations applied successfully!
-- ========================================
