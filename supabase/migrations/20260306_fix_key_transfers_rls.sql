-- Fix insecure RLS policy on key_transfers table

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

-- Create more restrictive RLS policies
-- Only allow SELECT via the secure function (not directly on table)
-- This is enforced by not having any SELECT policy

-- Keep INSERT policy for authenticated users
-- Keep UPDATE policy for claiming

COMMENT ON FUNCTION get_key_transfer_by_code IS 'Securely retrieve key transfer by code, validating expiry and claimed status';
