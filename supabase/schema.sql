-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- SCHOOLS
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PUBLIC PROFILES (Mirror of auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  school_id UUID REFERENCES schools(id),
  avatar_url TEXT,
  phone_number TEXT,
  preferred_language TEXT DEFAULT 'en',
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONVERSATIONS
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('dm', 'group')),
  name TEXT, -- Optional for DMs
  school_id UUID REFERENCES schools(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONVERSATION MEMBERS (Join table)
CREATE TABLE conversation_members (
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'admin', 'member'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

-- MESSAGES
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id),
  content TEXT, -- Can be encrypted JSON blob
  message_type TEXT DEFAULT 'text', -- 'text', 'image', 'file'
  file_url TEXT, -- For attachments
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PUBLIC KEYS (For E2EE)
CREATE TABLE public_keys (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Row Level Security) - This replaces your Backend API logic!
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY; -- Disabled for global visibility
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_keys ENABLE ROW LEVEL SECURITY;

-- POLICIES

-- Schools: Everyone can read schools
CREATE POLICY "Public schools are viewable by everyone" ON schools FOR SELECT USING (true);

-- Profiles: Viewable by all authenticated users
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Conversations: Viewable if you are a member and at the same school
CREATE POLICY "View conversations if member" ON conversations FOR SELECT
USING (
  school_id = public.get_my_school_id() AND
  EXISTS (
    SELECT 1 FROM conversation_members 
    WHERE conversation_id = id AND user_id = auth.uid()
  )
);
CREATE POLICY "Create conversation" ON conversations FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Members: Viewable if in same conversation
CREATE POLICY "View members if in conversation" ON conversation_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversation_members cm
    WHERE cm.conversation_id = conversation_id AND cm.user_id = auth.uid()
  )
);
CREATE POLICY "Join/Add members" ON conversation_members FOR INSERT WITH CHECK (true); -- Simplified for now

-- Messages: Viewable if in conversation
CREATE POLICY "View messages if member" ON messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    JOIN conversation_members cm ON c.id = cm.conversation_id
    WHERE c.id = messages.conversation_id 
    AND cm.user_id = auth.uid()
    AND c.school_id = public.get_my_school_id()
  )
);
CREATE POLICY "Send message if member" ON messages FOR INSERT 
WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM conversation_members 
    WHERE conversation_id = conversation_id AND user_id = auth.uid()
  )
);

-- Public Keys: Viewable by everyone (authenticated)
CREATE POLICY "View public keys" ON public_keys FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Upsert own public key" ON public_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own public key" ON public_keys FOR UPDATE USING (auth.uid() = user_id);

-- AUTOMATIC PROFILE CREATION TRIGGER
-- When a user signs up via Supabase Auth, create a profile entry automatically.
-- It also parses the .edu domain to find or create a school.
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    email_domain TEXT;
    base_domain TEXT;
    target_school_id UUID;
    school_name TEXT;
BEGIN
    -- Extract and lowercase domain
    email_domain := lower(split_part(new.email, '@', 2));

    -- Normalize .edu domains (e.g., student.ctuonline.edu -> ctuonline.edu)
    IF email_domain LIKE '%.edu' THEN
        base_domain := regexp_replace(email_domain, '^(student\.|mail\.|my\.|email\.|webmail\.|live\.)', '');
        
        -- Special Mapping for CTU (Normalize to ctuonline.edu)
        IF base_domain = 'coloradotech.edu' THEN
            base_domain := 'ctuonline.edu';
        END IF;

        -- Find or create school using the base domain
        SELECT id INTO target_school_id FROM public.schools WHERE domain = base_domain;
        
        IF target_school_id IS NULL THEN
            school_name := initcap(split_part(base_domain, '.', 1));
            
            INSERT INTO public.schools (domain, name, logo_url)
            VALUES (base_domain, school_name, 'https://logo.clearbit.com/' || base_domain)
            ON CONFLICT (domain) DO UPDATE SET domain = EXCLUDED.domain
            RETURNING id INTO target_school_id;
        END IF;
    ELSE
        base_domain := email_domain;
    END IF;

    INSERT INTO public.profiles (id, email, display_name, school_id, is_verified, preferred_language)
    VALUES (
        new.id, 
        new.email, 
        new.raw_user_meta_data->>'full_name', 
        target_school_id,
        TRUE, 
        COALESCE(new.raw_user_meta_data->>'preferred_language', 'en')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- FUNCTION TO UPDATE CONVERSATION TIMESTAMP
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update conversation updated_at when a new message is sent
CREATE TRIGGER on_message_inserted
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_timestamp();
