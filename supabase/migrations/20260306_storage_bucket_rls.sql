-- Add RLS policies for storage bucket 'chat-files'
-- Ensures only conversation members can access files

-- Drop existing policies if they exist (to make this script idempotent)
DROP POLICY IF EXISTS "Users can upload to conversations they're in" ON storage.objects;
DROP POLICY IF EXISTS "Users can read files from their conversations" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;

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
