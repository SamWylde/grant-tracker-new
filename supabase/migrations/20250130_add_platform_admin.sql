-- Add platform admin concept
-- Platform admins can access API testing and other system-level admin features
-- This is separate from organization admin role

-- Add is_platform_admin column to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT FALSE NOT NULL;

-- Create index for faster platform admin lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_platform_admin ON public.user_profiles(is_platform_admin) WHERE is_platform_admin = true;

COMMENT ON COLUMN public.user_profiles.is_platform_admin IS 'Platform/system administrators who can access API testing and system-level features. Separate from organization admin role.';

-- Set specific user as platform admin
UPDATE public.user_profiles
SET is_platform_admin = TRUE
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'tdarbylhu@gmail.com'
);
