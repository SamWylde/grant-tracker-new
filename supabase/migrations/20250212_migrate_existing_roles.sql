-- =====================================================
-- Migrate Existing Roles to RBAC System
-- Created: 2025-02-12
-- Purpose: Convert existing admin/contributor roles in
--          org_members table to new RBAC system
-- =====================================================

-- =====================================================
-- 1. MIGRATE EXISTING ORG_MEMBERS TO USER_ROLE_ASSIGNMENTS
-- =====================================================

-- Map existing admins to org_admin role
INSERT INTO public.user_role_assignments (user_id, role_id, org_id, assigned_by, assigned_at)
SELECT
  om.user_id,
  r.id as role_id,
  om.org_id,
  om.invited_by,
  om.joined_at as assigned_at
FROM public.org_members om
CROSS JOIN public.roles r
WHERE om.role = 'admin'
  AND r.name = 'org_admin'
ON CONFLICT (user_id, role_id, org_id) DO NOTHING;

-- Map existing contributors to contributor role
INSERT INTO public.user_role_assignments (user_id, role_id, org_id, assigned_by, assigned_at)
SELECT
  om.user_id,
  r.id as role_id,
  om.org_id,
  om.invited_by,
  om.joined_at as assigned_at
FROM public.org_members om
CROSS JOIN public.roles r
WHERE om.role = 'contributor'
  AND r.name = 'contributor'
ON CONFLICT (user_id, role_id, org_id) DO NOTHING;

-- =====================================================
-- 2. ADD LEGACY ROLE TRACKING COLUMN (for backward compatibility)
-- Keep org_members.role for now to ensure smooth transition
-- =====================================================

-- Add a column to track if migration is complete
ALTER TABLE public.org_members
ADD COLUMN IF NOT EXISTS rbac_migrated BOOLEAN DEFAULT FALSE;

-- Mark migrated records
UPDATE public.org_members
SET rbac_migrated = TRUE
WHERE EXISTS (
  SELECT 1
  FROM public.user_role_assignments ura
  WHERE ura.user_id = org_members.user_id
    AND ura.org_id = org_members.org_id
);

-- =====================================================
-- 3. CREATE HELPER FUNCTION FOR BACKWARD COMPATIBILITY
-- Returns 'admin' or 'contributor' based on new RBAC roles
-- This allows existing code to continue working
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_legacy_role(
  p_user_id UUID,
  p_org_id UUID
)
RETURNS TEXT AS $$
DECLARE
  v_has_admin_role BOOLEAN;
BEGIN
  -- Check if user has org_admin role
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    JOIN public.roles r ON r.id = ura.role_id
    WHERE ura.user_id = p_user_id
      AND ura.org_id = p_org_id
      AND r.name = 'org_admin'
  ) INTO v_has_admin_role;

  IF v_has_admin_role THEN
    RETURN 'admin';
  ELSE
    RETURN 'contributor';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. UPDATE RPC FUNCTION get_org_team_members
-- Modify to return role information from RBAC system
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_org_team_members(org_uuid UUID)
RETURNS TABLE (
  id UUID,
  org_id UUID,
  user_id UUID,
  role TEXT,
  roles JSONB,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  joined_at TIMESTAMPTZ,
  invited_by UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    om.id,
    om.org_id,
    om.user_id,
    -- Use legacy role for backward compatibility
    public.get_legacy_role(om.user_id, om.org_id) as role,
    -- Include full RBAC role information
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'name', r.name,
          'display_name', r.display_name,
          'description', r.description
        )
      )
      FROM public.user_role_assignments ura
      JOIN public.roles r ON r.id = ura.role_id
      WHERE ura.user_id = om.user_id
        AND ura.org_id = om.org_id
    ) as roles,
    up.full_name,
    au.email,
    up.avatar_url,
    om.joined_at,
    om.invited_by
  FROM public.org_members om
  LEFT JOIN auth.users au ON au.id = om.user_id
  LEFT JOIN public.user_profiles up ON up.id = om.user_id
  WHERE om.org_id = org_uuid
  ORDER BY om.joined_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. CREATE TRIGGER TO SYNC ORG_MEMBERS WITH RBAC
-- When a new member is added via org_members (legacy),
-- automatically assign them the appropriate RBAC role
-- =====================================================

CREATE OR REPLACE FUNCTION public.sync_org_member_to_rbac()
RETURNS TRIGGER AS $$
DECLARE
  v_role_id UUID;
BEGIN
  -- Determine which role to assign based on legacy role
  IF NEW.role = 'admin' THEN
    SELECT id INTO v_role_id FROM public.roles WHERE name = 'org_admin' LIMIT 1;
  ELSE
    SELECT id INTO v_role_id FROM public.roles WHERE name = 'contributor' LIMIT 1;
  END IF;

  -- Insert or update role assignment
  INSERT INTO public.user_role_assignments (user_id, role_id, org_id, assigned_by, assigned_at)
  VALUES (NEW.user_id, v_role_id, NEW.org_id, NEW.invited_by, NEW.joined_at)
  ON CONFLICT (user_id, role_id, org_id) DO NOTHING;

  -- Mark as migrated
  NEW.rbac_migrated = TRUE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_org_member_insert ON public.org_members;
CREATE TRIGGER sync_org_member_insert
  BEFORE INSERT ON public.org_members
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_org_member_to_rbac();

DROP TRIGGER IF EXISTS sync_org_member_update ON public.org_members;
CREATE TRIGGER sync_org_member_update
  BEFORE UPDATE ON public.org_members
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION public.sync_org_member_to_rbac();

-- =====================================================
-- 6. VERIFICATION QUERY
-- Run this to verify migration succeeded
-- =====================================================

-- Count records that should be migrated
DO $$
DECLARE
  v_org_members_count INTEGER;
  v_role_assignments_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_org_members_count FROM public.org_members;
  SELECT COUNT(DISTINCT (user_id, org_id)) INTO v_role_assignments_count
  FROM public.user_role_assignments
  WHERE role_id IN (
    SELECT id FROM public.roles WHERE name IN ('org_admin', 'contributor')
  );

  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '  - Total org_members records: %', v_org_members_count;
  RAISE NOTICE '  - Total role assignments created: %', v_role_assignments_count;

  IF v_org_members_count = v_role_assignments_count THEN
    RAISE NOTICE '  ✓ Migration successful - all records migrated';
  ELSE
    RAISE WARNING '  ⚠ Some records may not have been migrated. Please investigate.';
  END IF;
END $$;
