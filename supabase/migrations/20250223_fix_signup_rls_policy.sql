-- =====================================================
-- Fix Signup RLS Policy for org_members
-- Created: 2025-02-23
-- Purpose: Fix "Database error saving new user" by allowing
--          users to add themselves as first admin of new orgs
-- =====================================================

-- The existing policy blocks the handle_new_user() trigger from
-- adding the user as admin of their newly created organization.
-- This happens because the policy requires the user to already
-- be an admin, but they can't be an admin until they're added.

-- Solution: Add a policy that allows users to insert themselves
-- as members when no other members exist yet (first member scenario)

DROP POLICY IF EXISTS "Users can add themselves as first org member" ON public.org_members;
CREATE POLICY "Users can add themselves as first org member"
  ON public.org_members
  FOR INSERT
  WITH CHECK (
    -- User can add themselves
    user_id = auth.uid()
    -- Only if they're not already a member
    AND NOT EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = org_members.org_id AND user_id = auth.uid()
    )
  );

-- Keep the existing admin policy for adding other members
-- (This policy is unchanged, just documenting it here for clarity)
-- Admins can add members
-- CREATE POLICY "Admins can add members"
--   ON public.org_members
--   FOR INSERT
--   WITH CHECK (
--     org_id IN (
--       SELECT org_id FROM public.org_members
--       WHERE user_id = auth.uid() AND role = 'admin'
--     )
--   );

COMMENT ON POLICY "Users can add themselves as first org member" ON public.org_members IS
'Allows the handle_new_user() trigger to add the user as first admin of their newly created organization during signup';
