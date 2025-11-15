import { useEffect, useState } from 'react';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import {
  PermissionName,
  checkUserPermission,
  getUserPermissionsAndRoles,
  Permission,
  Role,
} from '../lib/rbac';

// Legacy permission type for backward compatibility
export type LegacyPermission = 'view' | 'edit_org' | 'manage_team' | 'manage_billing' | 'delete_org';

/**
 * Hook to check if the current user has specific permissions
 *
 * This hook provides both the new granular RBAC permission system
 * and backward compatibility with legacy permissions.
 *
 * NEW USAGE:
 *   const { hasPermission } = usePermission();
 *   if (hasPermission('grants:create')) { ... }
 *
 * LEGACY USAGE (still supported):
 *   const { hasPermission } = usePermission();
 *   if (hasPermission('edit_org')) { ... }
 *
 * @returns {Object} Permission checking utilities and user role info
 */
export function usePermission() {
  const { currentOrg, userRole, isAdmin, isPlatformAdmin } = useOrganization();
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  // Load user's permissions and roles with single optimized query
  useEffect(() => {
    async function loadPermissions() {
      if (!user || !currentOrg) {
        setPermissions([]);
        setRoles([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Use combined RPC to fetch both permissions and roles in a single query
        // This eliminates the N+1 query issue
        const { permissions: userPerms, roles: userRoles } = await getUserPermissionsAndRoles(
          user.id,
          currentOrg.id
        );

        setPermissions(userPerms);
        setRoles(userRoles);
      } catch (error) {
        console.error('Error loading permissions:', error);
        setPermissions([]);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    }

    loadPermissions();
  }, [user, currentOrg]);

  /**
   * Map legacy permissions to new granular permissions
   */
  const mapLegacyPermission = (permission: LegacyPermission): PermissionName[] => {
    switch (permission) {
      case 'view':
        return ['grants:view', 'tasks:view', 'org:view_settings'];
      case 'edit_org':
        return ['org:edit_settings', 'org:edit_profile'];
      case 'manage_team':
        return ['team:invite', 'team:remove', 'team:edit_roles'];
      case 'manage_billing':
        return ['billing:manage'];
      case 'delete_org':
        return ['org:delete'];
      default:
        return [];
    }
  };

  /**
   * Check if user has a specific permission
   * Supports both new granular permissions and legacy permissions
   */
  const hasPermission = (permission: PermissionName | LegacyPermission): boolean => {
    if (!user || !currentOrg) return false;

    // Platform admins have all permissions
    if (isPlatformAdmin) return true;

    // Check if it's a legacy permission
    const legacyPermissions: LegacyPermission[] = [
      'view',
      'edit_org',
      'manage_team',
      'manage_billing',
      'delete_org',
    ];

    if (legacyPermissions.includes(permission as LegacyPermission)) {
      // Map to new permissions and check if user has ANY of them
      const mappedPermissions = mapLegacyPermission(permission as LegacyPermission);
      return mappedPermissions.some((p) =>
        permissions.some((userPerm) => userPerm.name === p)
      );
    }

    // Check new granular permission
    return permissions.some((p) => p.name === permission);
  };

  /**
   * Check if user has ANY of the specified permissions
   */
  const hasAnyPermission = (permissionList: PermissionName[]): boolean => {
    if (!user || !currentOrg) return false;
    if (isPlatformAdmin) return true;

    return permissionList.some((perm) => hasPermission(perm));
  };

  /**
   * Check if user has ALL of the specified permissions
   */
  const hasAllPermissions = (permissionList: PermissionName[]): boolean => {
    if (!user || !currentOrg) return false;
    if (isPlatformAdmin) return true;

    return permissionList.every((perm) => hasPermission(perm));
  };

  /**
   * Async version - checks permission directly from database
   * Use this when you need real-time permission checking
   */
  const checkPermission = async (permission: PermissionName): Promise<boolean> => {
    if (!user || !currentOrg) return false;
    if (isPlatformAdmin) return true;

    return await checkUserPermission(user.id, currentOrg.id, permission);
  };

  /**
   * Check if user has a specific role
   */
  const hasRole = (roleName: string): boolean => {
    return roles.some((r) => r.name === roleName);
  };

  /**
   * Get user's primary role (for display purposes)
   * Returns the first role, or 'org_admin' if user is admin
   */
  const getPrimaryRole = (): Role | null => {
    if (roles.length === 0) return null;

    // Prioritize org_admin if user has it
    const adminRole = roles.find((r) => r.name === 'org_admin');
    if (adminRole) return adminRole;

    return roles[0];
  };

  return {
    // Permission checking
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    checkPermission,

    // Role checking
    hasRole,
    roles,
    primaryRole: getPrimaryRole(),

    // User permissions list
    permissions,

    // Legacy support
    isAdmin,
    isPlatformAdmin,
    userRole,

    // Loading state
    loading,
  };
}

/**
 * Permission Groups - Common permission combinations
 * Use these for checking multiple related permissions at once
 */
export const PermissionGroups = {
  GRANT_FULL: ['grants:view', 'grants:create', 'grants:edit', 'grants:delete'] as PermissionName[],
  GRANT_EDIT: ['grants:view', 'grants:create', 'grants:edit'] as PermissionName[],
  GRANT_VIEW: ['grants:view'] as PermissionName[],

  TASK_FULL: ['tasks:view', 'tasks:create', 'tasks:assign', 'tasks:edit', 'tasks:delete'] as PermissionName[],
  TASK_MANAGE: ['tasks:view', 'tasks:create', 'tasks:assign', 'tasks:edit'] as PermissionName[],
  TASK_VIEW: ['tasks:view'] as PermissionName[],

  TEAM_FULL: ['team:view', 'team:invite', 'team:remove', 'team:edit_roles'] as PermissionName[],
  TEAM_MANAGE: ['team:view', 'team:invite', 'team:edit_roles'] as PermissionName[],
  TEAM_VIEW: ['team:view'] as PermissionName[],

  BILLING_FULL: ['billing:view', 'billing:manage', 'billing:view_invoices'] as PermissionName[],
  BILLING_VIEW: ['billing:view'] as PermissionName[],

  ORG_ADMIN: ['org:view_settings', 'org:edit_settings', 'org:edit_profile'] as PermissionName[],
  ORG_VIEW: ['org:view_settings'] as PermissionName[],
};
