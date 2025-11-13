-- =====================================================
-- Advanced Role-Based Access Control (RBAC) System
-- Created: 2025-02-11
-- Purpose: Implement granular permission system with
--          flexible roles and permission assignments
-- =====================================================

-- =====================================================
-- 1. PERMISSIONS TABLE
-- Defines all available permissions in the system
-- =====================================================
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL, -- e.g., 'grants', 'tasks', 'billing', 'admin'
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT permissions_name_format CHECK (name ~* '^[a-z_]+:[a-z_]+$')
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_permissions_category ON public.permissions(category);

-- =====================================================
-- 2. ROLES TABLE
-- Defines available roles in the system
-- =====================================================
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT FALSE, -- System roles can't be deleted
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE, -- NULL for system-wide roles
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT roles_name_format CHECK (name ~* '^[a-z_]+$')
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_roles_org_id ON public.roles(org_id);
CREATE INDEX IF NOT EXISTS idx_roles_is_system ON public.roles(is_system_role);

-- =====================================================
-- 3. ROLE_PERMISSIONS TABLE (Junction)
-- Maps permissions to roles
-- =====================================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(role_id, permission_id)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON public.role_permissions(permission_id);

-- =====================================================
-- 4. USER_ROLE_ASSIGNMENTS TABLE
-- Maps users to roles within organizations
-- Replaces the simple 'role' field in org_members
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_role_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(user_id, role_id, org_id)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user_id ON public.user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_role_id ON public.user_role_assignments(role_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_org_id ON public.user_role_assignments(org_id);

-- =====================================================
-- 5. SEED PERMISSIONS
-- Define all granular permissions
-- =====================================================
INSERT INTO public.permissions (name, description, category) VALUES
  -- Grant permissions
  ('grants:view', 'View grants and grant details', 'grants'),
  ('grants:create', 'Create new grants', 'grants'),
  ('grants:edit', 'Edit existing grants', 'grants'),
  ('grants:delete', 'Delete grants', 'grants'),
  ('grants:export', 'Export grant data', 'grants'),

  -- Task permissions
  ('tasks:view', 'View tasks', 'tasks'),
  ('tasks:create', 'Create new tasks', 'tasks'),
  ('tasks:assign', 'Assign tasks to team members', 'tasks'),
  ('tasks:edit', 'Edit existing tasks', 'tasks'),
  ('tasks:delete', 'Delete tasks', 'tasks'),
  ('tasks:complete', 'Mark tasks as complete', 'tasks'),

  -- Document permissions
  ('documents:view', 'View documents', 'documents'),
  ('documents:upload', 'Upload new documents', 'documents'),
  ('documents:edit', 'Edit document metadata', 'documents'),
  ('documents:delete', 'Delete documents', 'documents'),
  ('documents:download', 'Download documents', 'documents'),

  -- Team permissions
  ('team:view', 'View team members', 'team'),
  ('team:invite', 'Invite new team members', 'team'),
  ('team:remove', 'Remove team members', 'team'),
  ('team:edit_roles', 'Modify team member roles', 'team'),
  ('team:view_performance', 'View team performance metrics', 'team'),

  -- Organization permissions
  ('org:view_settings', 'View organization settings', 'organization'),
  ('org:edit_settings', 'Edit organization settings', 'organization'),
  ('org:edit_profile', 'Edit organization profile', 'organization'),
  ('org:delete', 'Delete organization', 'organization'),

  -- Billing permissions
  ('billing:view', 'View billing information', 'billing'),
  ('billing:manage', 'Manage billing and subscriptions', 'billing'),
  ('billing:view_invoices', 'View invoices', 'billing'),

  -- Integration permissions
  ('integrations:view', 'View integrations', 'integrations'),
  ('integrations:manage', 'Manage integrations (connect/disconnect)', 'integrations'),
  ('integrations:configure', 'Configure integration settings', 'integrations'),

  -- Reports permissions
  ('reports:view', 'View reports', 'reports'),
  ('reports:create', 'Create custom reports', 'reports'),
  ('reports:export', 'Export reports', 'reports'),
  ('reports:schedule', 'Schedule automated reports', 'reports'),

  -- Workflow permissions
  ('workflows:view', 'View approval workflows', 'workflows'),
  ('workflows:create', 'Create approval workflows', 'workflows'),
  ('workflows:edit', 'Edit approval workflows', 'workflows'),
  ('workflows:delete', 'Delete approval workflows', 'workflows'),
  ('workflows:approve', 'Approve workflow requests', 'workflows'),

  -- CRM permissions
  ('crm:view', 'View funder CRM data', 'crm'),
  ('crm:create', 'Create funder records', 'crm'),
  ('crm:edit', 'Edit funder records', 'crm'),
  ('crm:delete', 'Delete funder records', 'crm'),

  -- Admin permissions
  ('admin:manage_roles', 'Manage custom roles and permissions', 'admin'),
  ('admin:view_audit_logs', 'View system audit logs', 'admin'),
  ('admin:platform_access', 'Access platform admin features', 'admin')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 6. SEED SYSTEM ROLES
-- Define default role types
-- =====================================================
INSERT INTO public.roles (name, display_name, description, is_system_role, org_id) VALUES
  ('org_admin', 'Organization Admin', 'Full access to organization settings, team, billing, and all features', TRUE, NULL),
  ('grant_creator', 'Grant Creator', 'Can create, edit, and manage grants and related tasks', TRUE, NULL),
  ('grant_viewer', 'Grant Viewer', 'Read-only access to grants and reports', TRUE, NULL),
  ('task_manager', 'Task Manager', 'Can create, assign, and manage tasks', TRUE, NULL),
  ('billing_admin', 'Billing Admin', 'Manage billing, subscriptions, and view invoices', TRUE, NULL),
  ('contributor', 'Contributor', 'Standard team member with grant and task access', TRUE, NULL),
  ('platform_admin', 'Platform Admin', 'System-wide administrative access', TRUE, NULL)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 7. MAP PERMISSIONS TO ROLES
-- Define which permissions each role has
-- =====================================================

-- Organization Admin: Full access to everything
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'org_admin'
  AND p.name NOT IN ('admin:platform_access') -- Exclude platform admin permission
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant Creator: Full grant access, task management, documents, view reports
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'grant_creator'
  AND p.name IN (
    'grants:view', 'grants:create', 'grants:edit', 'grants:delete', 'grants:export',
    'tasks:view', 'tasks:create', 'tasks:assign', 'tasks:edit', 'tasks:delete', 'tasks:complete',
    'documents:view', 'documents:upload', 'documents:edit', 'documents:delete', 'documents:download',
    'team:view', 'team:view_performance',
    'org:view_settings',
    'reports:view', 'reports:export',
    'workflows:view', 'workflows:approve',
    'crm:view', 'crm:create', 'crm:edit'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant Viewer: Read-only access to grants, tasks, documents, reports
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'grant_viewer'
  AND p.name IN (
    'grants:view', 'grants:export',
    'tasks:view',
    'documents:view', 'documents:download',
    'team:view',
    'org:view_settings',
    'reports:view', 'reports:export',
    'workflows:view',
    'crm:view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Task Manager: Full task management, view grants, create documents
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'task_manager'
  AND p.name IN (
    'grants:view',
    'tasks:view', 'tasks:create', 'tasks:assign', 'tasks:edit', 'tasks:delete', 'tasks:complete',
    'documents:view', 'documents:upload', 'documents:download',
    'team:view', 'team:view_performance',
    'org:view_settings',
    'reports:view',
    'workflows:view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Billing Admin: Billing + view org settings + view grants/tasks
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'billing_admin'
  AND p.name IN (
    'grants:view',
    'tasks:view',
    'team:view',
    'org:view_settings',
    'billing:view', 'billing:manage', 'billing:view_invoices',
    'reports:view',
    'integrations:view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Contributor: Standard access - view/create grants, tasks, documents
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'contributor'
  AND p.name IN (
    'grants:view', 'grants:create', 'grants:edit',
    'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:complete',
    'documents:view', 'documents:upload', 'documents:download',
    'team:view',
    'org:view_settings',
    'reports:view',
    'workflows:view',
    'crm:view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Platform Admin: System-wide access (all permissions)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'platform_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =====================================================
-- 8. HELPER FUNCTIONS
-- =====================================================

-- Function to check if a user has a specific permission
CREATE OR REPLACE FUNCTION public.user_has_permission(
  p_user_id UUID,
  p_org_id UUID,
  p_permission_name TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    JOIN public.role_permissions rp ON rp.role_id = ura.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ura.user_id = p_user_id
      AND ura.org_id = p_org_id
      AND p.name = p_permission_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all permissions for a user in an org
CREATE OR REPLACE FUNCTION public.get_user_permissions(
  p_user_id UUID,
  p_org_id UUID
)
RETURNS TABLE (permission_name TEXT, permission_description TEXT, permission_category TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.name, p.description, p.category
  FROM public.user_role_assignments ura
  JOIN public.role_permissions rp ON rp.role_id = ura.role_id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ura.user_id = p_user_id
    AND ura.org_id = p_org_id
  ORDER BY p.category, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all roles for a user in an org
CREATE OR REPLACE FUNCTION public.get_user_roles(
  p_user_id UUID,
  p_org_id UUID
)
RETURNS TABLE (role_id UUID, role_name TEXT, role_display_name TEXT, role_description TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.name, r.display_name, r.description
  FROM public.user_role_assignments ura
  JOIN public.roles r ON r.id = ura.role_id
  WHERE ura.user_id = p_user_id
    AND ura.org_id = p_org_id
  ORDER BY r.display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;

-- Permissions: Everyone can view (they're system-wide)
DROP POLICY IF EXISTS "Anyone can view permissions" ON public.permissions;
CREATE POLICY "Anyone can view permissions"
  ON public.permissions
  FOR SELECT
  USING (true);

-- Roles: Users can view system roles and roles in their orgs
DROP POLICY IF EXISTS "Users can view roles" ON public.roles;
CREATE POLICY "Users can view roles"
  ON public.roles
  FOR SELECT
  USING (
    is_system_role = TRUE
    OR org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

-- Org admins can create custom roles
DROP POLICY IF EXISTS "Org admins can create roles" ON public.roles;
CREATE POLICY "Org admins can create roles"
  ON public.roles
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT ura.org_id
      FROM public.user_role_assignments ura
      JOIN public.role_permissions rp ON rp.role_id = ura.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ura.user_id = auth.uid()
        AND p.name = 'admin:manage_roles'
    )
  );

-- Org admins can update custom roles
DROP POLICY IF EXISTS "Org admins can update roles" ON public.roles;
CREATE POLICY "Org admins can update roles"
  ON public.roles
  FOR UPDATE
  USING (
    is_system_role = FALSE
    AND org_id IN (
      SELECT ura.org_id
      FROM public.user_role_assignments ura
      JOIN public.role_permissions rp ON rp.role_id = ura.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ura.user_id = auth.uid()
        AND p.name = 'admin:manage_roles'
    )
  );

-- Org admins can delete custom roles
DROP POLICY IF EXISTS "Org admins can delete roles" ON public.roles;
CREATE POLICY "Org admins can delete roles"
  ON public.roles
  FOR DELETE
  USING (
    is_system_role = FALSE
    AND org_id IN (
      SELECT ura.org_id
      FROM public.user_role_assignments ura
      JOIN public.role_permissions rp ON rp.role_id = ura.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ura.user_id = auth.uid()
        AND p.name = 'admin:manage_roles'
    )
  );

-- Role Permissions: Everyone can view (to check what roles have which permissions)
DROP POLICY IF EXISTS "Users can view role permissions" ON public.role_permissions;
CREATE POLICY "Users can view role permissions"
  ON public.role_permissions
  FOR SELECT
  USING (true);

-- Org admins can manage role permissions
DROP POLICY IF EXISTS "Org admins can manage role permissions" ON public.role_permissions;
CREATE POLICY "Org admins can manage role permissions"
  ON public.role_permissions
  FOR ALL
  USING (
    role_id IN (
      SELECT r.id
      FROM public.roles r
      JOIN public.user_role_assignments ura ON ura.org_id = r.org_id
      JOIN public.role_permissions rp ON rp.role_id = ura.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ura.user_id = auth.uid()
        AND p.name = 'admin:manage_roles'
        AND r.is_system_role = FALSE
    )
  );

-- User Role Assignments: Users can view assignments in their orgs
DROP POLICY IF EXISTS "Users can view role assignments" ON public.user_role_assignments;
CREATE POLICY "Users can view role assignments"
  ON public.user_role_assignments
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

-- Users with team:edit_roles permission can manage role assignments
DROP POLICY IF EXISTS "Users can manage role assignments" ON public.user_role_assignments;
CREATE POLICY "Users can manage role assignments"
  ON public.user_role_assignments
  FOR ALL
  USING (
    org_id IN (
      SELECT ura.org_id
      FROM public.user_role_assignments ura
      JOIN public.role_permissions rp ON rp.role_id = ura.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ura.user_id = auth.uid()
        AND p.name = 'team:edit_roles'
    )
  );

-- =====================================================
-- 10. TRIGGERS
-- =====================================================

-- Update updated_at on roles table
DROP TRIGGER IF EXISTS update_roles_updated_at ON public.roles;
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
