-- =====================================================
-- FIX FOREIGN KEY FROM GRANT_ACTIVITY_LOG TO USER_PROFILES
-- =====================================================
-- This migration fixes the foreign key relationship from grant_activity_log.user_id
-- to user_profiles.id to enable PostgREST joins and fix the schema cache issue.
--
-- Background: The activity API tries to join to user_profiles, but the foreign key
-- currently points to auth.users instead, causing PostgREST to fail with:
-- "Could not find a relationship between 'grant_activity_log' and 'user_profiles'"
-- =====================================================

-- First, ensure all grant_activity_log entries with non-null user_id have corresponding user_profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.grant_activity_log gal
    WHERE gal.user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.user_profiles up WHERE up.id = gal.user_id
    )
  ) THEN
    RAISE EXCEPTION 'Found grant_activity_log entries without corresponding user_profiles. Data consistency issue.';
  END IF;
END $$;

-- Drop the existing foreign key to auth.users if it exists
-- We'll replace it with a reference to user_profiles
ALTER TABLE public.grant_activity_log
  DROP CONSTRAINT IF EXISTS grant_activity_log_user_id_fkey;

-- Add foreign key from grant_activity_log.user_id to user_profiles.id
-- This enables PostgREST to resolve the relationship and join the tables
-- Note: user_id is nullable (for system-generated activities), so we use ON DELETE SET NULL
ALTER TABLE public.grant_activity_log
  ADD CONSTRAINT grant_activity_log_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.user_profiles(id)
  ON DELETE SET NULL;

-- Note: user_profiles.id still references auth.users.id, so the relationship chain is:
-- auth.users -> user_profiles -> grant_activity_log

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMENT ON CONSTRAINT grant_activity_log_user_id_fkey ON grant_activity_log IS
  'Foreign key to user_profiles (not auth.users) to enable PostgREST joins for activity feed display';
