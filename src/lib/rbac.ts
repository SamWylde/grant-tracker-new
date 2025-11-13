/**
 * Role-Based Access Control (RBAC) Utilities
 *
 * This module provides utilities for checking permissions and managing roles
 * in the grant tracker application.
 */

import { supabase } from './supabase';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export type PermissionName =
  // Grant permissions
  | 'grants:view'
  | 'grants:create'
  | 'grants:edit'
  | 'grants:delete'
  | 'grants:export'
  // Task permissions
  | 'tasks:view'
  | 'tasks:create'
  | 'tasks:assign'
  | 'tasks:edit'
  | 'tasks:delete'
  | 'tasks:complete'
  // Document permissions
  | 'documents:view'
  | 'documents:upload'
  | 'documents:edit'
  | 'documents:delete'
  | 'documents:download'
  // Team permissions
  | 'team:view'
  | 'team:invite'
  | 'team:remove'
  | 'team:edit_roles'
  | 'team:view_performance'
  // Organization permissions
  | 'org:view_settings'
  | 'org:edit_settings'
  | 'org:edit_profile'
  | 'org:delete'
  // Billing permissions
  | 'billing:view'
  | 'billing:manage'
  | 'billing:view_invoices'
  // Integration permissions
  | 'integrations:view'
  | 'integrations:manage'
  | 'integrations:configure'
  // Reports permissions
  | 'reports:view'
  | 'reports:create'
  | 'reports:export'
  | 'reports:schedule'
  // Workflow permissions
  | 'workflows:view'
  | 'workflows:create'
  | 'workflows:edit'
  | 'workflows:delete'
  | 'workflows:approve'
  // CRM permissions
  | 'crm:view'
  | 'crm:create'
  | 'crm:edit'
  | 'crm:delete'
  // Admin permissions
  | 'admin:manage_roles'
  | 'admin:view_audit_logs'
  | 'admin:platform_access';

export type RoleName =
  | 'org_admin'
  | 'grant_creator'
  | 'grant_viewer'
  | 'task_manager'
  | 'billing_admin'
  | 'contributor'
  | 'platform_admin';

export interface Permission {
  id: string;
  name: PermissionName;
  description: string | null;
  category: string;
  created_at: string;
}

export interface Role {
  id: string;
  name: RoleName;
  display_name: string;
  description: string | null;
  is_system_role: boolean;
  org_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export interface UserRoleAssignment {
  id: string;
  user_id: string;
  role_id: string;
  org_id: string;
  assigned_by: string | null;
  assigned_at: string;
  role?: Role;
}

// =====================================================
// PERMISSION CHECKING FUNCTIONS
// =====================================================

/**
 * Check if a user has a specific permission in an organization
 *
 * @param userId - The user's ID
 * @param orgId - The organization's ID
 * @param permission - The permission to check
 * @returns Promise<boolean> - True if user has permission, false otherwise
 */
export async function checkUserPermission(
  userId: string,
  orgId: string,
  permission: PermissionName
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('user_has_permission', {
      p_user_id: userId,
      p_org_id: orgId,
      p_permission_name: permission,
    });

    if (error) {
      console.error('Error checking permission:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Check if a user has ANY of the specified permissions
 *
 * @param userId - The user's ID
 * @param orgId - The organization's ID
 * @param permissions - Array of permissions to check
 * @returns Promise<boolean> - True if user has at least one permission
 */
export async function checkUserPermissionAny(
  userId: string,
  orgId: string,
  permissions: PermissionName[]
): Promise<boolean> {
  const checks = await Promise.all(
    permissions.map((p) => checkUserPermission(userId, orgId, p))
  );
  return checks.some((result) => result === true);
}

/**
 * Check if a user has ALL of the specified permissions
 *
 * @param userId - The user's ID
 * @param orgId - The organization's ID
 * @param permissions - Array of permissions to check
 * @returns Promise<boolean> - True if user has all permissions
 */
export async function checkUserPermissionAll(
  userId: string,
  orgId: string,
  permissions: PermissionName[]
): Promise<boolean> {
  const checks = await Promise.all(
    permissions.map((p) => checkUserPermission(userId, orgId, p))
  );
  return checks.every((result) => result === true);
}

/**
 * Get all permissions for a user in an organization
 *
 * @param userId - The user's ID
 * @param orgId - The organization's ID
 * @returns Promise<Permission[]> - Array of permissions
 */
export async function getUserPermissions(
  userId: string,
  orgId: string
): Promise<Permission[]> {
  try {
    const { data, error } = await supabase.rpc('get_user_permissions', {
      p_user_id: userId,
      p_org_id: orgId,
    });

    if (error) {
      console.error('Error fetching permissions:', error);
      return [];
    }

    return (data || []).map((p: any) => ({
      id: p.id || '',
      name: p.permission_name,
      description: p.permission_description,
      category: p.permission_category,
      created_at: '',
    }));
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return [];
  }
}

// =====================================================
// ROLE MANAGEMENT FUNCTIONS
// =====================================================

/**
 * Get all roles for a user in an organization
 *
 * @param userId - The user's ID
 * @param orgId - The organization's ID
 * @returns Promise<Role[]> - Array of roles
 */
export async function getUserRoles(
  userId: string,
  orgId: string
): Promise<Role[]> {
  try {
    const { data, error } = await supabase.rpc('get_user_roles', {
      p_user_id: userId,
      p_org_id: orgId,
    });

    if (error) {
      console.error('Error fetching roles:', error);
      return [];
    }

    return (data || []).map((r: any) => ({
      id: r.role_id,
      name: r.role_name,
      display_name: r.role_display_name,
      description: r.role_description,
      is_system_role: true, // Assume system role for now
      org_id: orgId,
      created_at: '',
      updated_at: '',
    }));
  } catch (error) {
    console.error('Error fetching roles:', error);
    return [];
  }
}

/**
 * Get all available roles (system + org-specific)
 *
 * @param orgId - Optional organization ID to include org-specific roles
 * @returns Promise<Role[]> - Array of available roles
 */
export async function getAvailableRoles(orgId?: string): Promise<Role[]> {
  try {
    let query = supabase
      .from('roles')
      .select('*')
      .or('is_system_role.eq.true' + (orgId ? `,org_id.eq.${orgId}` : ''))
      .order('display_name');

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching available roles:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching available roles:', error);
    return [];
  }
}

/**
 * Get a role with its permissions
 *
 * @param roleId - The role's ID
 * @returns Promise<RoleWithPermissions | null>
 */
export async function getRoleWithPermissions(
  roleId: string
): Promise<RoleWithPermissions | null> {
  try {
    // Get role details
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('*')
      .eq('id', roleId)
      .single();

    if (roleError || !role) {
      console.error('Error fetching role:', roleError);
      return null;
    }

    // Get permissions for this role
    const { data: rolePermissions, error: permError } = await supabase
      .from('role_permissions')
      .select('permissions(*)')
      .eq('role_id', roleId);

    if (permError) {
      console.error('Error fetching role permissions:', permError);
      return { ...role, permissions: [] };
    }

    const permissions = (rolePermissions || [])
      .map((rp: any) => rp.permissions)
      .filter(Boolean);

    return {
      ...role,
      permissions,
    };
  } catch (error) {
    console.error('Error fetching role with permissions:', error);
    return null;
  }
}

/**
 * Assign a role to a user in an organization
 *
 * @param userId - The user's ID
 * @param roleId - The role's ID
 * @param orgId - The organization's ID
 * @param assignedBy - The ID of the user assigning the role
 * @returns Promise<boolean> - True if successful
 */
export async function assignRoleToUser(
  userId: string,
  roleId: string,
  orgId: string,
  assignedBy: string
): Promise<boolean> {
  try {
    const { error } = await supabase.from('user_role_assignments').insert({
      user_id: userId,
      role_id: roleId,
      org_id: orgId,
      assigned_by: assignedBy,
    });

    if (error) {
      console.error('Error assigning role:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error assigning role:', error);
    return false;
  }
}

/**
 * Remove a role from a user in an organization
 *
 * @param userId - The user's ID
 * @param roleId - The role's ID
 * @param orgId - The organization's ID
 * @returns Promise<boolean> - True if successful
 */
export async function removeRoleFromUser(
  userId: string,
  roleId: string,
  orgId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_role_assignments')
      .delete()
      .eq('user_id', userId)
      .eq('role_id', roleId)
      .eq('org_id', orgId);

    if (error) {
      console.error('Error removing role:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error removing role:', error);
    return false;
  }
}

/**
 * Get all role assignments for an organization
 *
 * @param orgId - The organization's ID
 * @returns Promise<UserRoleAssignment[]>
 */
export async function getOrgRoleAssignments(
  orgId: string
): Promise<UserRoleAssignment[]> {
  try {
    const { data, error } = await supabase
      .from('user_role_assignments')
      .select('*, roles(*)')
      .eq('org_id', orgId)
      .order('assigned_at', { ascending: false });

    if (error) {
      console.error('Error fetching role assignments:', error);
      return [];
    }

    return (data || []).map((ra: any) => ({
      id: ra.id,
      user_id: ra.user_id,
      role_id: ra.role_id,
      org_id: ra.org_id,
      assigned_by: ra.assigned_by,
      assigned_at: ra.assigned_at,
      role: ra.roles,
    }));
  } catch (error) {
    console.error('Error fetching role assignments:', error);
    return [];
  }
}

// =====================================================
// CUSTOM ROLE MANAGEMENT (for org admins)
// =====================================================

/**
 * Create a custom role for an organization
 *
 * @param orgId - The organization's ID
 * @param name - Role name (slug format: lowercase_with_underscores)
 * @param displayName - Human-readable role name
 * @param description - Role description
 * @param permissionIds - Array of permission IDs to assign
 * @returns Promise<Role | null>
 */
export async function createCustomRole(
  orgId: string,
  name: string,
  displayName: string,
  description: string,
  permissionIds: string[]
): Promise<Role | null> {
  try {
    // Create the role
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .insert({
        name,
        display_name: displayName,
        description,
        is_system_role: false,
        org_id: orgId,
      })
      .select()
      .single();

    if (roleError || !role) {
      console.error('Error creating role:', roleError);
      return null;
    }

    // Assign permissions to the role
    if (permissionIds.length > 0) {
      const rolePermissions = permissionIds.map((permId) => ({
        role_id: role.id,
        permission_id: permId,
      }));

      const { error: permError } = await supabase
        .from('role_permissions')
        .insert(rolePermissions);

      if (permError) {
        console.error('Error assigning permissions to role:', permError);
        // Rollback: delete the role
        await supabase.from('roles').delete().eq('id', role.id);
        return null;
      }
    }

    return role;
  } catch (error) {
    console.error('Error creating custom role:', error);
    return null;
  }
}

/**
 * Update a custom role
 *
 * @param roleId - The role's ID
 * @param displayName - Updated display name
 * @param description - Updated description
 * @param permissionIds - Updated array of permission IDs
 * @returns Promise<boolean>
 */
export async function updateCustomRole(
  roleId: string,
  displayName: string,
  description: string,
  permissionIds: string[]
): Promise<boolean> {
  try {
    // Update role details
    const { error: roleError } = await supabase
      .from('roles')
      .update({
        display_name: displayName,
        description,
      })
      .eq('id', roleId)
      .eq('is_system_role', false); // Only allow updating custom roles

    if (roleError) {
      console.error('Error updating role:', roleError);
      return false;
    }

    // Delete existing permissions
    const { error: deleteError } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId);

    if (deleteError) {
      console.error('Error deleting old permissions:', deleteError);
      return false;
    }

    // Add new permissions
    if (permissionIds.length > 0) {
      const rolePermissions = permissionIds.map((permId) => ({
        role_id: roleId,
        permission_id: permId,
      }));

      const { error: permError } = await supabase
        .from('role_permissions')
        .insert(rolePermissions);

      if (permError) {
        console.error('Error assigning new permissions:', permError);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error updating custom role:', error);
    return false;
  }
}

/**
 * Delete a custom role
 *
 * @param roleId - The role's ID
 * @returns Promise<boolean>
 */
export async function deleteCustomRole(roleId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', roleId)
      .eq('is_system_role', false); // Only allow deleting custom roles

    if (error) {
      console.error('Error deleting role:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting role:', error);
    return false;
  }
}

/**
 * Get all permissions (for UI)
 *
 * @returns Promise<Permission[]>
 */
export async function getAllPermissions(): Promise<Permission[]> {
  try {
    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .order('category')
      .order('name');

    if (error) {
      console.error('Error fetching permissions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return [];
  }
}
