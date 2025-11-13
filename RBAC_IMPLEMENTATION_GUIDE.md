# RBAC Implementation Guide

## Quick Start

This guide will help you set up and use the new RBAC system in the grant tracker application.

## Setup Instructions

### 1. Run Database Migrations

```bash
# Navigate to your project directory
cd /home/user/grant-tracker-new

# Apply the RBAC schema migration
supabase migration up 20250211_add_rbac_system.sql

# Apply the data migration (converts existing roles)
supabase migration up 20250212_migrate_existing_roles.sql
```

### 2. Verify Migration

Check the migration logs for success:

```sql
-- Run this query to verify roles were migrated
SELECT
  om.user_id,
  om.role as legacy_role,
  jsonb_agg(r.display_name) as rbac_roles
FROM org_members om
LEFT JOIN user_role_assignments ura ON ura.user_id = om.user_id AND ura.org_id = om.org_id
LEFT JOIN roles r ON r.id = ura.role_id
GROUP BY om.user_id, om.role;
```

Expected output: Each user should have their legacy role (admin/contributor) and corresponding RBAC role (Organization Admin/Contributor).

### 3. Update Frontend Routes

Add the Role Management page to your routing:

```typescript
// In your main router file (e.g., App.tsx or routes.tsx)
import { RoleManagementPage } from './pages/settings/RoleManagementPage';

// Add to routes
<Route path="/settings/roles" element={<RoleManagementPage />} />
```

### 4. Update Navigation (Optional)

Add a link to Role Management in your settings navigation:

```typescript
// In SettingsLayout.tsx or similar
const navigationLinks = [
  // ... existing links
  {
    path: '/settings/roles',
    label: 'Role Management',
    icon: IconShieldCheck,
    requiredPermission: 'admin:manage_roles', // Only show to users with this permission
  },
];
```

## Using the New System

### For Developers

#### 1. Checking Permissions in Components

**Basic permission check:**
```typescript
import { usePermission } from '../hooks/usePermission';

function CreateGrantButton() {
  const { hasPermission } = usePermission();

  if (!hasPermission('grants:create')) {
    return null; // Don't render button if no permission
  }

  return <Button onClick={createGrant}>Create Grant</Button>;
}
```

**Multiple permission check:**
```typescript
import { usePermission, PermissionGroups } from '../hooks/usePermission';

function GrantManagementPanel() {
  const { hasAllPermissions, hasAnyPermission } = usePermission();

  // Check if user has ALL grant permissions
  const isFullGrantManager = hasAllPermissions(PermissionGroups.GRANT_FULL);

  // Check if user has ANY editing permission
  const canEdit = hasAnyPermission(['grants:edit', 'grants:delete']);

  return (
    <div>
      {isFullGrantManager && <FullManagementUI />}
      {canEdit && !isFullGrantManager && <EditOnlyUI />}
      {!canEdit && <ViewOnlyUI />}
    </div>
  );
}
```

**Loading state:**
```typescript
function ProtectedComponent() {
  const { hasPermission, loading } = usePermission();

  if (loading) {
    return <Spinner />;
  }

  if (!hasPermission('grants:view')) {
    return <AccessDenied />;
  }

  return <GrantsList />;
}
```

#### 2. Checking Permissions in API Routes

**Express.js middleware example:**
```typescript
// middleware/rbac.ts
import { checkUserPermission, PermissionName } from '../lib/rbac';

export function requirePermission(permission: PermissionName) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const orgId = req.params.orgId || req.body.orgId;

    if (!userId || !orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const hasPermission = await checkUserPermission(userId, orgId, permission);

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: permission,
      });
    }

    next();
  };
}

// Usage in routes
app.post(
  '/api/grants',
  authenticate,
  requirePermission('grants:create'),
  createGrant
);

app.delete(
  '/api/grants/:id',
  authenticate,
  requirePermission('grants:delete'),
  deleteGrant
);
```

**Next.js API route example:**
```typescript
// pages/api/grants/create.ts
import { checkUserPermission } from '../../../lib/rbac';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const orgId = req.body.orgId;
  const hasPermission = await checkUserPermission(session.user.id, orgId, 'grants:create');

  if (!hasPermission) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  // Create grant
  // ...
}
```

#### 3. Conditional Rendering Patterns

**Show/hide UI elements:**
```typescript
function GrantCard({ grant }) {
  const { hasPermission } = usePermission();

  return (
    <Card>
      <GrantInfo grant={grant} />

      {/* Only show edit button if user can edit */}
      {hasPermission('grants:edit') && (
        <Button onClick={() => editGrant(grant.id)}>Edit</Button>
      )}

      {/* Only show delete button if user can delete */}
      {hasPermission('grants:delete') && (
        <Button color="red" onClick={() => deleteGrant(grant.id)}>Delete</Button>
      )}

      {/* Show assign task button only if user can assign tasks */}
      {hasPermission('tasks:assign') && (
        <Button onClick={() => assignTask(grant.id)}>Assign Task</Button>
      )}
    </Card>
  );
}
```

**Conditional navigation:**
```typescript
function SettingsNav() {
  const { hasPermission } = usePermission();

  return (
    <nav>
      {/* Everyone can view settings */}
      <NavLink to="/settings/profile">Profile</NavLink>

      {/* Only users with billing permission */}
      {hasPermission('billing:view') && (
        <NavLink to="/settings/billing">Billing</NavLink>
      )}

      {/* Only users with team management permission */}
      {hasPermission('team:invite') && (
        <NavLink to="/settings/team">Team</NavLink>
      )}

      {/* Only role managers */}
      {hasPermission('admin:manage_roles') && (
        <NavLink to="/settings/roles">Role Management</NavLink>
      )}
    </nav>
  );
}
```

### For Administrators

#### 1. Accessing Role Management

1. Navigate to **Settings** → **Role Management**
2. You need the `admin:manage_roles` permission (included in Organization Admin role)

#### 2. Creating a Custom Role

Example: Creating a "Grant Reviewer" role

1. Click **"Create Custom Role"**
2. Fill in details:
   - **Role Name**: `grant_reviewer`
   - **Display Name**: `Grant Reviewer`
   - **Description**: `Can review and provide feedback on grants, but cannot create or delete`
3. Select permissions:
   - **Grants**: `grants:view`, `grants:export`
   - **Tasks**: `tasks:view`, `tasks:create`, `tasks:edit`, `tasks:complete`
   - **Documents**: `documents:view`, `documents:download`
   - **Reports**: `reports:view`, `reports:export`
   - **Team**: `team:view`
4. Click **"Create Role"**

#### 3. Assigning Roles to Users

1. Navigate to **Settings** → **Team**
2. Find the user you want to assign roles to
3. Click the **edit icon** (pencil)
4. In the modal:
   - **Legacy Role**: Select admin or contributor (for backward compatibility)
   - **RBAC Roles**: Select one or more roles from the dropdown
5. Click **"Update Roles"**

**Example Multi-Role Assignment:**
- User: Jane Doe
- Legacy Role: Contributor
- RBAC Roles:
  - Grant Creator
  - Task Manager
  - Grant Reviewer

Result: Jane can create/edit grants, manage tasks, and review other grants.

#### 4. Managing Existing Roles

**Edit a Custom Role:**
1. Go to **Role Management**
2. Click on **"Custom Roles"** tab
3. Find the role and click **"Edit"**
4. Modify display name, description, or permissions
5. Click **"Update Role"**

**Delete a Custom Role:**
1. Go to **Role Management**
2. Click on **"Custom Roles"** tab
3. Click the **trash icon** next to the role
4. Confirm deletion

**Note**: You can only delete custom roles. System roles cannot be modified or deleted.

## Common Use Cases

### Use Case 1: Finance Team Member

**Requirement**: User needs to view grants and manage billing, but not edit grants.

**Solution**:
- Create custom role "Finance Viewer" or use "Billing Admin"
- Assign permissions:
  - `grants:view`
  - `billing:view`, `billing:manage`
  - `reports:view`, `reports:export`

### Use Case 2: External Consultant

**Requirement**: Consultant needs to view grants and create tasks, but no access to team or billing.

**Solution**:
- Create custom role "Consultant"
- Assign permissions:
  - `grants:view`
  - `tasks:view`, `tasks:create`, `tasks:edit`
  - `documents:view`, `documents:download`

### Use Case 3: Grant Writing Team Lead

**Requirement**: Can do everything with grants and tasks, assign tasks to team, but cannot manage billing.

**Solution**:
- Assign multiple roles:
  - Grant Creator
  - Task Manager
- Or create custom role "Grant Team Lead" with:
  - All grant permissions
  - All task permissions
  - `team:view`, `team:view_performance`
  - `documents:*`

### Use Case 4: Read-Only Auditor

**Requirement**: Can view everything but cannot edit or delete anything.

**Solution**:
- Use "Grant Viewer" system role
- Or create "Auditor" role with all `:view` permissions

## Migration Checklist

- [ ] Run RBAC schema migration
- [ ] Run role migration script
- [ ] Verify all existing users have roles assigned
- [ ] Test permission checks in frontend
- [ ] Test permission checks in backend
- [ ] Update any hardcoded permission checks to use new system
- [ ] Add Role Management link to navigation
- [ ] Train administrators on new role system
- [ ] Create custom roles for your organization (if needed)
- [ ] Document your custom roles and their purposes

## Troubleshooting

### Users Can't See Features After Migration

**Symptoms**: After migration, users report they can't access features they could before.

**Solution**:
1. Check their role assignments:
   ```sql
   SELECT r.display_name
   FROM user_role_assignments ura
   JOIN roles r ON r.id = ura.role_id
   WHERE ura.user_id = '<user-id>' AND ura.org_id = '<org-id>';
   ```
2. Verify migration ran successfully (check for `rbac_migrated = true` in `org_members`)
3. Check frontend console for permission loading errors
4. Ensure `usePermission` hook is not showing loading state forever

### Custom Roles Not Appearing

**Symptoms**: Created a custom role but it doesn't show up in the team assignment dropdown.

**Solution**:
1. Verify role was created successfully (check database)
2. Ensure `org_id` is set correctly for org-specific roles
3. Clear frontend query cache (refresh page)
4. Check if user has `admin:manage_roles` permission

### Permission Checks Always Failing

**Symptoms**: Permission checks always return false even for admins.

**Solution**:
1. Check if user is logged in (`user` is not null)
2. Check if organization context is loaded (`currentOrg` is not null)
3. Verify database functions are working:
   ```sql
   SELECT user_has_permission(
     '<user-id>'::uuid,
     '<org-id>'::uuid,
     'grants:view'
   );
   ```
4. Check browser console for errors
5. Ensure migrations were applied successfully

### Legacy Code Not Working

**Symptoms**: Old permission checks (e.g., `hasPermission('manage_team')`) not working.

**Solution**:
1. Legacy permissions are still supported - check if migration mapping is working
2. Verify `mapLegacyPermission()` function in `usePermission.ts`
3. Ensure RLS policies allow reading from new tables
4. Check if user has corresponding RBAC permissions

## Performance Considerations

### Frontend Caching

Permissions are cached in the frontend using React Query:
- Cache duration: Follows React Query defaults
- Invalidation: When org switches or user role changes
- Manual refresh: Call `queryClient.invalidateQueries(['userPermissions'])`

### Database Optimization

- Indexes on all foreign keys
- Efficient RLS policies using EXISTS clauses
- Permissions loaded once per session

### Best Practices

1. **Minimize permission checks**: Cache results when checking same permission multiple times
2. **Use permission groups**: Instead of checking each permission individually
3. **Async checks for critical operations**: Use `checkPermission()` for real-time verification
4. **Frontend + Backend checks**: Always verify on backend even if frontend checks pass

## Support Resources

- **Documentation**: `/RBAC_SYSTEM.md`
- **Code Examples**: `/src/lib/rbac.ts`, `/src/hooks/usePermission.ts`
- **Database Schema**: `/supabase/migrations/20250211_add_rbac_system.sql`
- **Migration Guide**: This file

## Next Steps

After implementing the RBAC system:

1. **Review and optimize**: Audit your permission checks for performance
2. **Document custom roles**: Keep track of why each custom role exists
3. **Regular audits**: Review user role assignments quarterly
4. **Collect feedback**: Ask users if permissions make sense for their workflows
5. **Plan enhancements**: Consider time-based roles, role hierarchies, etc.
