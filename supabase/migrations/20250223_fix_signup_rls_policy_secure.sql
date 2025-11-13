-- =====================================================
-- SECURITY FIX: Properly fix signup RLS policy
-- Created: 2025-02-23
-- Purpose: Fix the privilege escalation vulnerability in
--          20250223_fix_signup_rls_policy.sql
-- =====================================================

-- ROLLBACK THE INSECURE POLICY
DROP POLICY IF EXISTS "Users can add themselves as first org member" ON public.org_members;

-- The previous policy had a critical flaw: it checked NOT EXISTS under RLS,
-- which meant users couldn't see existing members and could join any org.
--
-- CORRECT SOLUTION: Allow service_role (used by triggers) to insert members
-- This way, the handle_new_user() SECURITY DEFINER trigger can add users,
-- but regular users cannot exploit the policy.

DROP POLICY IF EXISTS "Service role can manage org members" ON public.org_members;
CREATE POLICY "Service role can manage org members"
  ON public.org_members
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- This policy allows the handle_new_user() trigger (which runs as service_role)
-- to add users to organizations during signup, while preventing privilege escalation.

COMMENT ON POLICY "Service role can manage org members" ON public.org_members IS
'Allows SECURITY DEFINER triggers like handle_new_user() to manage org membership without privilege escalation risk';
