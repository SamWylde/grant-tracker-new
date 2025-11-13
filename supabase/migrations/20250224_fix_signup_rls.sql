-- =====================================================
-- Fix handle_new_user to work with RLS
-- Created: 2025-02-23
-- Purpose: Update signup flow to properly handle RLS policies
-- =====================================================

-- Remove the previous insecure service_role policy
DROP POLICY IF EXISTS "Service role can manage org members" ON public.org_members;

-- Drop policies that depend on count_org_members function
DROP POLICY IF EXISTS "Admins can add members" ON public.org_members;

-- Drop existing function if it exists (may have different parameter name)
DROP FUNCTION IF EXISTS count_org_members(UUID) CASCADE;

-- Create a helper function to count org members (bypasses RLS)
CREATE OR REPLACE FUNCTION count_org_members(target_org_id UUID)
RETURNS INTEGER AS $$
DECLARE
  member_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO member_count
  FROM public.org_members
  WHERE org_id = target_org_id;

  RETURN member_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION count_org_members IS 'Helper function to count organization members, bypassing RLS. Used for signup flow validation.';

-- Create a secure policy that allows users to add themselves to empty orgs
DROP POLICY IF EXISTS "Users can join as first member of new orgs" ON public.org_members;
CREATE POLICY "Users can join as first member of new orgs"
  ON public.org_members
  FOR INSERT
  WITH CHECK (
    -- User can only add themselves
    user_id = auth.uid()
    -- And only to orgs with no existing members (checked via security definer function)
    AND count_org_members(org_id) = 0
  );

-- Drop and recreate the handle_new_user function with better error handling
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
  user_email TEXT;
  org_name TEXT;
  pending_invitation_count INTEGER;
BEGIN
  -- Get the user's email
  user_email := NEW.email;

  -- 1. Create user profile
  INSERT INTO public.user_profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');

  -- 2. Check if user has any pending invitations
  SELECT COUNT(*) INTO pending_invitation_count
  FROM public.team_invitations
  WHERE email = user_email
    AND accepted_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > NOW();

  -- 3. If user has pending invitations, don't create an organization
  -- They should accept their invitation instead
  IF pending_invitation_count > 0 THEN
    -- User will be directed to accept their invitation
    -- No organization created automatically
    RETURN NEW;
  END IF;

  -- 4. Create default organization name from email (only if no pending invitations)
  -- e.g., "john.doe@example.com" becomes "john.doe's Organization"
  org_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(user_email, '@', 1)
  ) || '''s Organization';

  -- 5. Create default organization for the user
  INSERT INTO public.organizations (name, slug)
  VALUES (
    org_name,
    lower(replace(split_part(user_email, '@', 1), '.', '-')) || '-' || substring(md5(random()::text), 1, 6)
  )
  RETURNING id INTO new_org_id;

  -- 6. Add user as admin of their new organization
  -- This uses the "Users can join as first member of new orgs" policy
  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'admin');

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error for debugging
    RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    -- Re-raise to fail the signup and return error to user
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

COMMENT ON FUNCTION handle_new_user IS 'Creates user profile and default organization on signup. If user has pending invitations, skips org creation so they can accept the invitation.';
