-- Migration: Fix critical schema bugs
-- 1. Fix SECURITY DEFINER typo in handle_new_user trigger
-- 2. Add missing UPDATE RLS policies

-- 1.1: Fix handle_new_user function (recreate with correct SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    email_domain TEXT;
    base_domain TEXT;
    target_school_id UUID;
    school_name TEXT;
BEGIN
    email_domain := lower(split_part(new.email, '@', 2));

    IF email_domain LIKE '%.edu' THEN
        base_domain := regexp_replace(email_domain, '^(student\.|mail\.|my\.|email\.|webmail\.|live\.)', '');

        IF base_domain = 'coloradotech.edu' THEN
            base_domain := 'ctuonline.edu';
        END IF;

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

-- 1.2: Add UPDATE policy on conversations (needed for addMemberToConversation)
DO $$ BEGIN
  CREATE POLICY "Update conversation if member" ON conversations FOR UPDATE
  USING (id = ANY(public.get_my_conv_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1.3: Add UPDATE policy on conversation_members (needed for markAsRead)
DO $$ BEGIN
  CREATE POLICY "Update own membership" ON conversation_members FOR UPDATE
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1.4: Add UPDATE policy on messages (needed for re-encryption when adding members)
DO $$ BEGIN
  CREATE POLICY "Update messages if member" ON messages FOR UPDATE
  USING (conversation_id = ANY(public.get_my_conv_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enable realtime for conversation_members (for read receipt subscriptions)
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_members;
