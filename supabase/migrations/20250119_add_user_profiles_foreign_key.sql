-- =====================================================
-- ADD FOREIGN KEY FROM ORG_MEMBERS TO USER_PROFILES
-- =====================================================
-- This migration adds a foreign key relationship from org_members.user_id
-- to user_profiles.id to enable PostgREST joins and fix the schema cache issue.
--
-- Background: Both org_members.user_id and user_profiles.id reference auth.users.id,
-- but PostgREST requires an explicit foreign key to resolve joins.
-- =====================================================

-- First, ensure all org_members have corresponding user_profiles
-- (this should already be the case due to the signup trigger, but check anyway)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.org_members om
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_profiles up WHERE up.id = om.user_id
    )
  ) THEN
    RAISE EXCEPTION 'Found org_members without corresponding user_profiles. Data consistency issue.';
  END IF;
END $$;

-- Drop the existing foreign key to auth.users if it exists
-- We'll replace it with a reference to user_profiles
ALTER TABLE public.org_members
  DROP CONSTRAINT IF EXISTS org_members_user_id_fkey;

-- Add foreign key from org_members.user_id to user_profiles.id
-- This enables PostgREST to resolve the relationship and join the tables
ALTER TABLE public.org_members
  ADD CONSTRAINT org_members_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.user_profiles(id)
  ON DELETE CASCADE;

-- Note: user_profiles.id still references auth.users.id, so cascading
-- deletes will work correctly: auth.users -> user_profiles -> org_members

-- Refresh PostgREST schema cache (if using PostgREST)
NOTIFY pgrst, 'reload schema';

-- =====================================================
-- CREATE RPC FUNCTION TO FETCH TEAM MEMBERS
-- =====================================================
-- This function provides an alternative to the PostgREST join query
-- and can handle large organizations efficiently without URL length issues.
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_org_team_members(org_uuid UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  full_name TEXT,
  email TEXT,
  role TEXT,
  joined_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    om.id,
    om.user_id,
    up.full_name,
    COALESCE(up.full_name, au.email) AS email,
    om.role,
    om.joined_at
  FROM public.org_members om
  INNER JOIN public.user_profiles up ON up.id = om.user_id
  INNER JOIN auth.users au ON au.id = om.user_id
  WHERE om.org_id = org_uuid
  ORDER BY up.full_name NULLS LAST, au.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_org_team_members(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_org_team_members IS 'Fetches team members for an organization. Returns user_id, full_name, email, and role. Uses server-side join to avoid URL length issues with large teams.';

