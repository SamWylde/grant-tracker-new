-- =====================================================
-- Combined User Permissions and Roles RPC
-- Created: 2025-03-16
-- Purpose: Fix N+1 query issue in usePermission hook
--          by combining getUserPermissions + getUserRoles
--          into a single RPC call
-- =====================================================

-- Function to get both permissions and roles for a user in a single query
-- Returns a JSON object with both permissions and roles arrays
CREATE OR REPLACE FUNCTION public.get_user_permissions_and_roles(
  p_user_id UUID,
  p_org_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'permissions', (
      SELECT COALESCE(json_agg(perm_obj), '[]'::json)
      FROM (
        SELECT DISTINCT
          p.id,
          p.name as permission_name,
          p.description as permission_description,
          p.category as permission_category
        FROM public.user_role_assignments ura
        JOIN public.role_permissions rp ON rp.role_id = ura.role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE ura.user_id = p_user_id
          AND ura.org_id = p_org_id
        ORDER BY p.category, p.name
      ) perm_obj
    ),
    'roles', (
      SELECT COALESCE(json_agg(role_obj), '[]'::json)
      FROM (
        SELECT
          r.id as role_id,
          r.name as role_name,
          r.display_name as role_display_name,
          r.description as role_description
        FROM public.user_role_assignments ura
        JOIN public.roles r ON r.id = ura.role_id
        WHERE ura.user_id = p_user_id
          AND ura.org_id = p_org_id
        ORDER BY r.display_name
      ) role_obj
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comment
COMMENT ON FUNCTION public.get_user_permissions_and_roles IS
  'Returns both permissions and roles for a user in a single query to avoid N+1 issues.
   Returns JSON: {permissions: [...], roles: [...]}';
