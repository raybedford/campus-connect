-- Add RLS policies for storage bucket 'chat-files'
-- Ensures only conversation members can access files

-- Enable RLS on storage.objects (if not already enabled)
-- Note: This may already be enabled by default in Supabase

-- Policy: Users can upload files to conversations they're members of
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

-- Policy: Users can read files from conversations they're members of
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

-- Policy: Users can delete files they uploaded
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-files'
  AND owner = auth.uid()
);

-- Policy: Users can update their own files
CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'chat-files'
  AND owner = auth.uid()
);

COMMENT ON POLICY "Users can upload to conversations they're in" ON storage.objects
IS 'Restricts file uploads to conversations where user is a member';

COMMENT ON POLICY "Users can read files from their conversations" ON storage.objects
IS 'Restricts file access to conversation members only';
