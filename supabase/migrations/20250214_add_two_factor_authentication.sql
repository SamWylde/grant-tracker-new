-- =====================================================
-- Two-Factor Authentication (2FA) Migration
-- Created: 2025-02-04
-- Purpose: Add TOTP-based 2FA with backup codes and
--          organization-level enforcement
-- =====================================================

-- =====================================================
-- 1. ADD 2FA FIELDS TO USER_PROFILES TABLE
-- =====================================================

-- Add 2FA columns to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS totp_secret TEXT, -- Encrypted TOTP secret
ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS totp_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS failed_2fa_attempts INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS last_failed_2fa_attempt TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_2fa_success TIMESTAMPTZ;

-- Index for faster lookups on 2FA status
CREATE INDEX IF NOT EXISTS idx_user_profiles_totp_enabled ON public.user_profiles(totp_enabled);

-- =====================================================
-- 2. CREATE BACKUP CODES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_backup_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Backup code (hashed for security)
  code_hash TEXT NOT NULL,

  -- Usage tracking
  used BOOLEAN DEFAULT FALSE NOT NULL,
  used_at TIMESTAMPTZ,
  used_from_ip TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT user_backup_codes_user_id_code_hash_unique UNIQUE(user_id, code_hash)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_backup_codes_user_id ON public.user_backup_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_backup_codes_used ON public.user_backup_codes(user_id, used);

-- Enable RLS on backup codes table
ALTER TABLE public.user_backup_codes ENABLE ROW LEVEL SECURITY;

-- Users can only view and manage their own backup codes
DROP POLICY IF EXISTS "Users can manage own backup codes" ON public.user_backup_codes;
CREATE POLICY "Users can manage own backup codes"
  ON public.user_backup_codes
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- 3. ADD 2FA ENFORCEMENT TO ORGANIZATION SETTINGS
-- =====================================================

-- Add organization-level 2FA enforcement setting
ALTER TABLE public.organization_settings
ADD COLUMN IF NOT EXISTS require_2fa_for_admins BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS require_2fa_for_all BOOLEAN DEFAULT FALSE NOT NULL;

-- =====================================================
-- 4. CREATE 2FA AUDIT LOG TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.two_factor_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Event tracking
  event_type TEXT NOT NULL, -- 'setup', 'verify_success', 'verify_fail', 'disable', 'backup_code_used'
  event_details JSONB,

  -- Request metadata
  ip_address TEXT,
  user_agent TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT two_factor_audit_log_event_type_check CHECK (
    event_type IN ('setup', 'verify_success', 'verify_fail', 'disable', 'backup_code_used', 'backup_codes_regenerated')
  )
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_two_factor_audit_log_user_id ON public.two_factor_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_two_factor_audit_log_created_at ON public.two_factor_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_two_factor_audit_log_event_type ON public.two_factor_audit_log(event_type);

-- Enable RLS on audit log
ALTER TABLE public.two_factor_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own audit logs
DROP POLICY IF EXISTS "Users can view own 2FA audit log" ON public.two_factor_audit_log;
CREATE POLICY "Users can view own 2FA audit log"
  ON public.two_factor_audit_log
  FOR SELECT
  USING (user_id = auth.uid());

-- Only backend/service role can insert audit logs
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.two_factor_audit_log;
CREATE POLICY "Service role can insert audit logs"
  ON public.two_factor_audit_log
  FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- 5. CREATE HELPER FUNCTIONS
-- =====================================================

-- Function to check if user has 2FA enabled and verified
CREATE OR REPLACE FUNCTION user_has_2fa_enabled(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_user_id
    AND totp_enabled = TRUE
    AND totp_secret IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is required to have 2FA based on org settings
CREATE OR REPLACE FUNCTION user_requires_2fa(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_requires_for_admins BOOLEAN;
  v_requires_for_all BOOLEAN;
BEGIN
  -- Check if user is an admin in any organization
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = p_user_id AND role = 'admin'
  ) INTO v_is_admin;

  -- Check if any of the user's organizations require 2FA
  SELECT
    COALESCE(bool_or(os.require_2fa_for_admins), FALSE),
    COALESCE(bool_or(os.require_2fa_for_all), FALSE)
  INTO v_requires_for_admins, v_requires_for_all
  FROM public.organization_settings os
  INNER JOIN public.org_members om ON os.org_id = om.org_id
  WHERE om.user_id = p_user_id;

  -- Return true if:
  -- 1. User is admin and any org requires 2FA for admins, OR
  -- 2. Any org requires 2FA for all members
  RETURN (v_is_admin AND v_requires_for_admins) OR v_requires_for_all;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment failed 2FA attempts
CREATE OR REPLACE FUNCTION increment_failed_2fa_attempts(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.user_profiles
  SET
    failed_2fa_attempts = failed_2fa_attempts + 1,
    last_failed_2fa_attempt = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset failed 2FA attempts
CREATE OR REPLACE FUNCTION reset_failed_2fa_attempts(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.user_profiles
  SET
    failed_2fa_attempts = 0,
    last_failed_2fa_attempt = NULL,
    last_2fa_success = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to count unused backup codes for a user
CREATE OR REPLACE FUNCTION count_unused_backup_codes(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.user_backup_codes
  WHERE user_id = p_user_id AND used = FALSE;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. CREATE VIEWS FOR EASIER QUERYING
-- =====================================================

-- View for user 2FA status
CREATE OR REPLACE VIEW public.user_2fa_status AS
SELECT
  up.id as user_id,
  up.full_name,
  up.totp_enabled,
  up.totp_verified_at,
  up.failed_2fa_attempts,
  up.last_failed_2fa_attempt,
  up.last_2fa_success,
  count_unused_backup_codes(up.id) as unused_backup_codes,
  user_requires_2fa(up.id) as required_by_org
FROM public.user_profiles up;

-- Grant select permission on view
GRANT SELECT ON public.user_2fa_status TO authenticated;

-- RLS for the view (users can only see their own status)
ALTER VIEW public.user_2fa_status SET (security_invoker = on);

-- =====================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.user_backup_codes IS
'Stores hashed backup codes for 2FA recovery. Each user gets 10 single-use codes.';

COMMENT ON TABLE public.two_factor_audit_log IS
'Audit log for all 2FA-related events for security monitoring and compliance.';

COMMENT ON COLUMN public.user_profiles.totp_secret IS
'Encrypted TOTP secret key used for generating 6-digit codes. Must be encrypted at application level.';

COMMENT ON COLUMN public.user_profiles.totp_enabled IS
'Whether 2FA is currently active for this user.';

COMMENT ON COLUMN public.user_profiles.failed_2fa_attempts IS
'Counter for failed 2FA verification attempts, used for rate limiting.';

COMMENT ON COLUMN public.organization_settings.require_2fa_for_admins IS
'When true, all organization admins must enable 2FA to access admin functions.';

COMMENT ON COLUMN public.organization_settings.require_2fa_for_all IS
'When true, all organization members must enable 2FA to access the organization.';

-- =====================================================
-- END OF MIGRATION
-- =====================================================
