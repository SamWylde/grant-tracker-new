-- Update signup flow to check for pending invitations
-- If user has a pending invitation, don't auto-create an organization
-- This prevents abuse and ensures invited users join the correct organization

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
  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'admin');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

COMMENT ON FUNCTION handle_new_user IS 'Creates user profile and default organization on signup. If user has pending invitations, skips org creation so they can accept the invitation.';
