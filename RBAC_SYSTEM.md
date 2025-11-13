# Advanced Role-Based Access Control (RBAC) System

## Overview

The grant tracker application now implements a comprehensive Role-Based Access Control (RBAC) system that provides fine-grained permission management. This system allows organizations to:

- Assign multiple roles to users
- Create custom roles with specific permission sets
- Use granular permissions (e.g., `grants:create`, `tasks:assign`, `billing:manage`)
- Maintain backward compatibility with legacy admin/contributor roles

## Architecture

### Database Schema

#### Tables

1. **permissions** - Defines all available permissions in the system
   - `id` (UUID): Primary key
   - `name` (TEXT): Permission identifier (e.g., `grants:create`)
   - `description` (TEXT): Human-readable description
   - `category` (TEXT): Permission category (grants, tasks, team, etc.)

2. **roles** - Defines available roles
   - `id` (UUID): Primary key
   - `name` (TEXT): Role identifier (e.g., `org_admin`)
   - `display_name` (TEXT): Human-readable name
   - `description` (TEXT): Role description
   - `is_system_role` (BOOLEAN): System roles cannot be deleted
   - `org_id` (UUID): Organization ID (NULL for system-wide roles)

3. **role_permissions** - Junction table mapping permissions to roles
   - `role_id` (UUID): References roles table
   - `permission_id` (UUID): References permissions table

4. **user_role_assignments** - Maps users to roles within organizations
   - `user_id` (UUID): User ID
   - `role_id` (UUID): Role ID
   - `org_id` (UUID): Organization ID
   - `assigned_by` (UUID): User who assigned the role
   - `assigned_at` (TIMESTAMP): Assignment timestamp

### Database Functions

```sql
-- Check if user has a permission
user_has_permission(p_user_id UUID, p_org_id UUID, p_permission_name TEXT) -> BOOLEAN

-- Get all permissions for a user
get_user_permissions(p_user_id UUID, p_org_id UUID) -> TABLE

-- Get all roles for a user
get_user_roles(p_user_id UUID, p_org_id UUID) -> TABLE

-- Get legacy role (for backward compatibility)
get_legacy_role(p_user_id UUID, p_org_id UUID) -> TEXT
```

## Permissions System

### Permission Categories

All permissions follow the format: `category:action`

#### Grants (`grants:*`)
- `grants:view` - View grants and grant details
- `grants:create` - Create new grants
- `grants:edit` - Edit existing grants
- `grants:delete` - Delete grants
- `grants:export` - Export grant data

#### Tasks (`tasks:*`)
- `tasks:view` - View tasks
- `tasks:create` - Create new tasks
- `tasks:assign` - Assign tasks to team members
- `tasks:edit` - Edit existing tasks
- `tasks:delete` - Delete tasks
- `tasks:complete` - Mark tasks as complete

#### Documents (`documents:*`)
- `documents:view` - View documents
- `documents:upload` - Upload new documents
- `documents:edit` - Edit document metadata
- `documents:delete` - Delete documents
- `documents:download` - Download documents

#### Team (`team:*`)
- `team:view` - View team members
- `team:invite` - Invite new team members
- `team:remove` - Remove team members
- `team:edit_roles` - Modify team member roles
- `team:view_performance` - View team performance metrics

#### Organization (`org:*`)
- `org:view_settings` - View organization settings
- `org:edit_settings` - Edit organization settings
- `org:edit_profile` - Edit organization profile
- `org:delete` - Delete organization

#### Billing (`billing:*`)
- `billing:view` - View billing information
- `billing:manage` - Manage billing and subscriptions
- `billing:view_invoices` - View invoices

#### Integrations (`integrations:*`)
- `integrations:view` - View integrations
- `integrations:manage` - Manage integrations
- `integrations:configure` - Configure integration settings

#### Reports (`reports:*`)
- `reports:view` - View reports
- `reports:create` - Create custom reports
- `reports:export` - Export reports
- `reports:schedule` - Schedule automated reports

#### Workflows (`workflows:*`)
- `workflows:view` - View approval workflows
- `workflows:create` - Create approval workflows
- `workflows:edit` - Edit approval workflows
- `workflows:delete` - Delete approval workflows
- `workflows:approve` - Approve workflow requests

#### CRM (`crm:*`)
- `crm:view` - View funder CRM data
- `crm:create` - Create funder records
- `crm:edit` - Edit funder records
- `crm:delete` - Delete funder records

#### Admin (`admin:*`)
- `admin:manage_roles` - Manage custom roles and permissions
- `admin:view_audit_logs` - View system audit logs
- `admin:platform_access` - Access platform admin features

## System Roles

### Organization Admin (`org_admin`)
**Full access to organization**
- All permissions except `admin:platform_access`
- Can manage team, billing, settings, grants, tasks, documents, reports, workflows, CRM

### Grant Creator (`grant_creator`)
**Full grant and task management**
- Grants: view, create, edit, delete, export
- Tasks: full access
- Documents: full access
- Team: view only
- Reports: view, export
- CRM: view, create, edit

### Grant Viewer (`grant_viewer`)
**Read-only access**
- Grants: view, export
- Tasks: view only
- Documents: view, download
- Reports: view, export
- CRM: view only

### Task Manager (`task_manager`)
**Task and workflow management**
- Tasks: full access
- Grants: view only
- Documents: view, upload, download
- Team: view, view performance

### Billing Admin (`billing_admin`)
**Billing and subscription management**
- Billing: full access
- Grants, tasks: view only
- Organization settings: view only

### Contributor (`contributor`)
**Standard team member**
- Grants: view, create, edit
- Tasks: view, create, edit, complete
- Documents: view, upload, download
- Reports: view
- CRM: view

### Platform Admin (`platform_admin`)
**System-wide access (for platform administrators)**
- All permissions including `admin:platform_access`

## Usage Examples

### Backend (TypeScript/Node.js)

```typescript
import { checkUserPermission, getUserPermissions, getUserRoles } from './lib/rbac';

// Check if user has a specific permission
const canCreateGrants = await checkUserPermission(userId, orgId, 'grants:create');

if (canCreateGrants) {
  // Allow grant creation
}

// Get all permissions for a user
const permissions = await getUserPermissions(userId, orgId);
console.log('User permissions:', permissions.map(p => p.name));

// Get all roles for a user
const roles = await getUserRoles(userId, orgId);
console.log('User roles:', roles.map(r => r.display_name));
```

### Frontend (React)

```typescript
import { usePermission, PermissionGroups } from '../hooks/usePermission';

function GrantsPage() {
  const { hasPermission, hasAnyPermission, hasAllPermissions, roles } = usePermission();

  // Check single permission
  if (hasPermission('grants:create')) {
    return <CreateGrantButton />;
  }

  // Check any of multiple permissions
  if (hasAnyPermission(['grants:edit', 'grants:delete'])) {
    return <EditGrantButton />;
  }

  // Check all permissions
  if (hasAllPermissions(PermissionGroups.GRANT_FULL)) {
    return <FullGrantManagement />;
  }

  // Check role
  const { hasRole } = usePermission();
  if (hasRole('org_admin')) {
    return <AdminPanel />;
  }

  return <ViewOnlyGrants />;
}

// Example: Conditional rendering based on permissions
function TaskAssignButton({ taskId }) {
  const { hasPermission } = usePermission();

  if (!hasPermission('tasks:assign')) {
    return null;
  }

  return <Button onClick={() => assignTask(taskId)}>Assign Task</Button>;
}

// Example: Using permission groups
function BillingSection() {
  const { hasAllPermissions } = usePermission();

  const canManageBilling = hasAllPermissions(PermissionGroups.BILLING_FULL);

  return (
    <div>
      <h2>Billing</h2>
      {canManageBilling ? (
        <BillingManagement />
      ) : (
        <BillingViewOnly />
      )}
    </div>
  );
}
```

### Legacy Permission Support

The new system maintains backward compatibility with legacy permissions:

```typescript
// Legacy permission usage (still supported)
const { hasPermission } = usePermission();

// These legacy permissions are automatically mapped to new permissions
if (hasPermission('manage_team')) {
  // Mapped to: ['team:invite', 'team:remove', 'team:edit_roles']
}

if (hasPermission('edit_org')) {
  // Mapped to: ['org:edit_settings', 'org:edit_profile']
}

if (hasPermission('manage_billing')) {
  // Mapped to: ['billing:manage']
}
```

## Role Management

### Admin UI

Access role management at `/settings/roles`

**Features:**
- View all system and custom roles
- Create custom roles with specific permissions
- Edit custom role permissions
- Delete custom roles (if not in use)
- See how many users have each role

### Creating Custom Roles

1. Navigate to Settings > Role Management
2. Click "Create Custom Role"
3. Fill in:
   - **Role Name**: Internal identifier (lowercase_with_underscores)
   - **Display Name**: Human-readable name
   - **Description**: What this role does
   - **Permissions**: Select from categorized permission list
4. Click "Create Role"

### Assigning Roles to Users

1. Navigate to Settings > Team
2. Click the edit icon next to a team member
3. Select roles from the "Assign Roles" dropdown
4. Users can have multiple roles for combined permissions
5. Click "Update Roles"

## Migration from Old System

### Automatic Migration

The system automatically migrates existing admin/contributor roles:

- **admin** → `org_admin` role
- **contributor** → `contributor` role

### Migration Process

1. Run database migrations:
   ```bash
   # Apply RBAC schema
   supabase migration up 20250211_add_rbac_system.sql

   # Migrate existing roles
   supabase migration up 20250212_migrate_existing_roles.sql
   ```

2. The migration:
   - Creates all RBAC tables
   - Seeds permissions and system roles
   - Migrates existing org_members to user_role_assignments
   - Maintains backward compatibility

3. Verification:
   - Check migration logs for success message
   - Verify user permissions in Role Management page
   - Test permission checks in the application

### Backward Compatibility

The system maintains the `org_members.role` field for backward compatibility:

- Legacy code continues to work
- `get_legacy_role()` function maps RBAC roles to legacy roles
- Triggers automatically sync changes between old and new systems

## API Endpoints (Backend Implementation)

### Check Permission

```typescript
// Example API middleware
export async function requirePermission(permission: PermissionName) {
  return async (req, res, next) => {
    const userId = req.user.id;
    const orgId = req.params.orgId || req.body.orgId;

    const hasPermission = await checkUserPermission(userId, orgId, permission);

    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

// Usage in route
app.post('/api/grants', requirePermission('grants:create'), async (req, res) => {
  // Create grant
});
```

### Role Assignment API

```typescript
import { assignRoleToUser, removeRoleFromUser } from './lib/rbac';

// POST /api/organizations/:orgId/users/:userId/roles
async function assignRole(req, res) {
  const { orgId, userId } = req.params;
  const { roleId } = req.body;
  const assignedBy = req.user.id;

  const success = await assignRoleToUser(userId, roleId, orgId, assignedBy);

  if (success) {
    res.json({ message: 'Role assigned successfully' });
  } else {
    res.status(500).json({ error: 'Failed to assign role' });
  }
}

// DELETE /api/organizations/:orgId/users/:userId/roles/:roleId
async function removeRole(req, res) {
  const { orgId, userId, roleId } = req.params;

  const success = await removeRoleFromUser(userId, roleId, orgId);

  if (success) {
    res.json({ message: 'Role removed successfully' });
  } else {
    res.status(500).json({ error: 'Failed to remove role' });
  }
}
```

## Testing

### Unit Tests

```typescript
import { checkUserPermission, getUserPermissions } from './lib/rbac';

describe('RBAC System', () => {
  it('should check user permission correctly', async () => {
    const hasPermission = await checkUserPermission(userId, orgId, 'grants:create');
    expect(hasPermission).toBe(true);
  });

  it('should get all user permissions', async () => {
    const permissions = await getUserPermissions(userId, orgId);
    expect(permissions.length).toBeGreaterThan(0);
    expect(permissions[0]).toHaveProperty('name');
  });
});
```

### Integration Tests

```typescript
describe('Permission Middleware', () => {
  it('should allow access with correct permission', async () => {
    const response = await request(app)
      .post('/api/grants')
      .set('Authorization', `Bearer ${token}`)
      .send(grantData);

    expect(response.status).toBe(200);
  });

  it('should deny access without permission', async () => {
    const response = await request(app)
      .delete('/api/grants/123')
      .set('Authorization', `Bearer ${contributorToken}`);

    expect(response.status).toBe(403);
  });
});
```

## Best Practices

### Permission Naming

- Use lowercase
- Use category:action format
- Be specific but not too granular
- Examples:
  - ✅ `grants:create`
  - ✅ `tasks:assign`
  - ❌ `create_grant`
  - ❌ `grants:create_and_edit`

### Role Design

- Create roles based on job functions, not individuals
- Use descriptive display names
- Document role purposes clearly
- Examples:
  - ✅ Grant Writer, Financial Manager, Report Viewer
  - ❌ John's Role, Special Access, Custom Role 1

### Permission Checks

- Check permissions at both frontend and backend
- Use permission groups for related checks
- Cache permissions in frontend for performance
- Always check permissions before critical operations

### Custom Roles

- Limit custom roles to organization-specific needs
- Don't duplicate system roles
- Review and audit custom roles regularly
- Document why each custom role exists

## Troubleshooting

### Common Issues

**Issue**: User can't see certain features
- Check if user has required permissions
- Verify role assignments in Team page
- Check if organization has correct plan

**Issue**: Permission checks failing
- Verify user is logged in
- Check if organization context is loaded
- Ensure migrations have been run

**Issue**: Custom role not appearing
- Verify role was created successfully
- Check if role is system role (can't be modified)
- Ensure org_id is set correctly for org-specific roles

### Debug Queries

```sql
-- Check user's roles
SELECT r.display_name, r.name
FROM user_role_assignments ura
JOIN roles r ON r.id = ura.role_id
WHERE ura.user_id = '<user-id>'
  AND ura.org_id = '<org-id>';

-- Check user's permissions
SELECT DISTINCT p.name, p.description
FROM user_role_assignments ura
JOIN role_permissions rp ON rp.role_id = ura.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE ura.user_id = '<user-id>'
  AND ura.org_id = '<org-id>'
ORDER BY p.name;

-- Check specific permission
SELECT user_has_permission(
  '<user-id>'::uuid,
  '<org-id>'::uuid,
  'grants:create'
);
```

## Future Enhancements

### Planned Features

1. **Permission Hierarchies**
   - Parent/child permission relationships
   - Auto-grant child permissions with parent

2. **Temporary Roles**
   - Time-limited role assignments
   - Auto-expiration of temporary access

3. **Audit Logging**
   - Track all permission checks
   - Log role assignments/removals
   - Generate audit reports

4. **Advanced RLS**
   - Row-level permissions (view only your grants)
   - Field-level permissions (hide sensitive data)
   - Conditional permissions (based on grant status)

5. **Role Templates**
   - Pre-built role templates for common use cases
   - Industry-specific role sets
   - One-click role application

## Support

For questions or issues with the RBAC system:
1. Check this documentation
2. Review code examples in `/src/lib/rbac.ts`
3. Check migration logs in `/supabase/migrations/`
4. Open an issue on GitHub

## Files Modified/Created

### Database
- `/supabase/migrations/20250211_add_rbac_system.sql` - RBAC schema
- `/supabase/migrations/20250212_migrate_existing_roles.sql` - Migration script

### Backend
- `/src/lib/rbac.ts` - RBAC utilities and functions

### Frontend
- `/src/hooks/usePermission.ts` - Updated permission hook
- `/src/pages/settings/RoleManagementPage.tsx` - Role management UI
- `/src/pages/settings/TeamPage.tsx` - Updated team management

### Documentation
- `/RBAC_SYSTEM.md` - This file
