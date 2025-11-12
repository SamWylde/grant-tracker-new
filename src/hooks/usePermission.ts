import { useOrganization } from '../contexts/OrganizationContext';

export type Permission = 'view' | 'edit_org' | 'manage_team' | 'manage_billing' | 'delete_org';

/**
 * Hook to check if the current user has a specific permission
 *
 * Permission levels:
 * - 'view': All members (both admin and contributor)
 * - 'edit_org': Admin only
 * - 'manage_team': Admin only
 * - 'manage_billing': Admin only
 * - 'delete_org': Admin only
 */
export function usePermission() {
  const { userRole, isAdmin, isPlatformAdmin } = useOrganization();

  const hasPermission = (permission: Permission): boolean => {
    if (!userRole) return false;

    switch (permission) {
      case 'view':
        return true; // All members can view
      case 'edit_org':
      case 'manage_team':
      case 'manage_billing':
      case 'delete_org':
        return isAdmin;
      default:
        return false;
    }
  };

  return { hasPermission, isAdmin, isPlatformAdmin, userRole };
}
