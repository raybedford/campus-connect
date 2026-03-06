-- Add performance indexes for frequently queried columns

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
