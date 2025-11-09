-- Fix: Auto-create default organization for new users
-- This migration updates the signup flow to automatically create an organization
-- when a new user signs up, so they don't see "Loading..." on settings pages

-- Drop and recreate the handle_new_user function to include org creation
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
  user_email TEXT;
  org_name TEXT;
BEGIN
  -- Get the user's email
  user_email := NEW.email;

  -- Create default organization name from email
  -- e.g., "john.doe@example.com" becomes "john.doe's Organization"
  org_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(user_email, '@', 1)
  ) || '''s Organization';

  -- 1. Create user profile
  INSERT INTO public.user_profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');

  -- 2. Create default organization for the user
  INSERT INTO public.organizations (name, slug)
  VALUES (
    org_name,
    lower(replace(split_part(user_email, '@', 1), '.', '-')) || '-' || substring(md5(random()::text), 1, 6)
  )
  RETURNING id INTO new_org_id;

  -- 3. Add user as admin of their new organization
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

COMMENT ON FUNCTION handle_new_user IS 'Automatically creates user profile, default organization, and admin membership when a new user signs up';
