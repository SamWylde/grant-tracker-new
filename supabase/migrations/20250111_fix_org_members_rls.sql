-- Fix infinite recursion in org_members RLS policies
-- Problem: Both SELECT and INSERT policies query org_members, creating infinite recursion

-- Solution: Use security definer functions to bypass RLS when checking membership

-- =====================================================
-- HELPER FUNCTION - Check if user is admin (bypasses RLS)
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_org_admin(check_org_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = check_org_id
      AND user_id = check_user_id
      AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTION - Check if user is org member (bypasses RLS)
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_org_member(check_org_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = check_org_id
      AND user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTION - Count org members (bypasses RLS)
-- =====================================================
CREATE OR REPLACE FUNCTION public.count_org_members(check_org_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM public.org_members WHERE org_id = check_org_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FIX SELECT POLICY - Use helper function
-- =====================================================
DROP POLICY IF EXISTS "Users can view org members" ON public.org_members;

CREATE POLICY "Users can view org members"
  ON public.org_members
  FOR SELECT
  USING (
    user_id = auth.uid()  -- Can always see yourself
    OR
    public.is_org_member(org_id, auth.uid())  -- Can see members of your orgs
  );

-- =====================================================
-- FIX INSERT POLICY - Use helper function
-- =====================================================
DROP POLICY IF EXISTS "Admins can add members" ON public.org_members;

CREATE POLICY "Admins can add members"
  ON public.org_members
  FOR INSERT
  WITH CHECK (
    -- Case 1: Adding yourself as first member of a new organization
    (
      user_id = auth.uid()
      AND public.count_org_members(org_id) = 0
    )
    OR
    -- Case 2: You're already an admin in this org
    public.is_org_admin(org_id, auth.uid())
  );

COMMENT ON FUNCTION public.is_org_admin IS 'Check if user is admin of org (bypasses RLS)';
COMMENT ON FUNCTION public.is_org_member IS 'Check if user is member of org (bypasses RLS)';
COMMENT ON FUNCTION public.count_org_members IS 'Count members in org (bypasses RLS)';

COMMENT ON POLICY "Users can view org members" ON public.org_members IS
  'Users can view themselves and members of organizations they belong to';

COMMENT ON POLICY "Admins can add members" ON public.org_members IS
  'Allows users to add themselves as first member to new orgs, or existing admins to add members';
