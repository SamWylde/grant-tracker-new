# Permission Model (RBAC)

## Overview

GrantCue implements a comprehensive Role-Based Access Control (RBAC) system that provides granular permissions across all features. The system supports both system-wide roles and custom organization-specific roles.

## RBAC Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    RBAC System                            │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────┐      ┌─────────────┐      ┌──────────┐ │
│  │    User     │─────>│    Roles    │─────>│Permission││
│  │             │      │             │      │   Set    ││
│  └─────────────┘      └─────────────┘      └──────────┘ │
│         │                    │                    │      │
│         │                    │                    │      │
│  ┌──────▼─────────────┐     │             ┌──────▼────┐ │
│  │ user_role_         │     │             │permissions││ │
│  │ assignments        │     │             │           ││ │
│  └────────────────────┘     │             └───────────┘ │
│                              │                           │
│                       ┌──────▼──────────┐                │
│                       │ role_permissions│                │
│                       └─────────────────┘                │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

## Database Schema

### Core Tables

#### 1. Permissions

Defines all available permissions in the system.

```sql
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,           -- e.g., 'grants:view'
  description TEXT,
  category TEXT NOT NULL,               -- e.g., 'grants', 'tasks'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Permission Naming Convention**: `<category>:<action>`
- Category: Feature area (grants, tasks, documents, etc.)
- Action: Operation (view, create, edit, delete, etc.)

#### 2. Roles

Defines available roles (both system and custom).

```sql
CREATE TABLE public.roles (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT FALSE,
  org_id UUID REFERENCES organizations(id), -- NULL for system roles
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. Role Permissions

Maps permissions to roles (many-to-many).

```sql
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);
```

#### 4. User Role Assignments

Assigns roles to users within organizations.

```sql
CREATE TABLE public.user_role_assignments (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role_id, org_id)
);
```

## Permission Categories

### 1. Grants Permissions

Control access to grant discovery and management.

| Permission | Description |
|-----------|-------------|
| `grants:view` | View grants and grant details |
| `grants:create` | Create new grants (manual entry) |
| `grants:edit` | Edit existing grant information |
| `grants:delete` | Delete grants from pipeline |
| `grants:export` | Export grant data to CSV/Excel |

### 2. Tasks Permissions

Control access to task management.

| Permission | Description |
|-----------|-------------|
| `tasks:view` | View tasks for grants |
| `tasks:create` | Create new tasks |
| `tasks:assign` | Assign tasks to team members |
| `tasks:edit` | Edit existing tasks |
| `tasks:delete` | Delete tasks |
| `tasks:complete` | Mark tasks as complete |

### 3. Documents Permissions

Control access to document management.

| Permission | Description |
|-----------|-------------|
| `documents:view` | View document lists and metadata |
| `documents:upload` | Upload new documents |
| `documents:edit` | Edit document metadata |
| `documents:delete` | Delete documents |
| `documents:download` | Download documents |

### 4. Team Permissions

Control access to team management.

| Permission | Description |
|-----------|-------------|
| `team:view` | View team members list |
| `team:invite` | Invite new team members |
| `team:remove` | Remove team members |
| `team:edit_roles` | Modify team member roles |
| `team:view_performance` | View team performance metrics |

### 5. Organization Permissions

Control access to organization settings.

| Permission | Description |
|-----------|-------------|
| `org:view_settings` | View organization settings |
| `org:edit_settings` | Edit organization settings |
| `org:edit_profile` | Edit organization profile |
| `org:delete` | Delete organization |

### 6. Billing Permissions

Control access to billing and subscription management.

| Permission | Description |
|-----------|-------------|
| `billing:view` | View billing information |
| `billing:manage` | Manage billing and subscriptions |
| `billing:view_invoices` | View invoices |

### 7. Integration Permissions

Control access to third-party integrations.

| Permission | Description |
|-----------|-------------|
| `integrations:view` | View connected integrations |
| `integrations:manage` | Connect/disconnect integrations |
| `integrations:configure` | Configure integration settings |

### 8. Reports Permissions

Control access to reporting features.

| Permission | Description |
|-----------|-------------|
| `reports:view` | View reports |
| `reports:create` | Create custom reports |
| `reports:export` | Export reports |
| `reports:schedule` | Schedule automated reports |

### 9. Workflow Permissions

Control access to approval workflows.

| Permission | Description |
|-----------|-------------|
| `workflows:view` | View approval workflows |
| `workflows:create` | Create approval workflows |
| `workflows:edit` | Edit approval workflows |
| `workflows:delete` | Delete approval workflows |
| `workflows:approve` | Approve workflow requests |

### 10. CRM Permissions

Control access to funder CRM features.

| Permission | Description |
|-----------|-------------|
| `crm:view` | View funder CRM data |
| `crm:create` | Create funder records |
| `crm:edit` | Edit funder records |
| `crm:delete` | Delete funder records |

### 11. Admin Permissions

Control access to administrative features.

| Permission | Description |
|-----------|-------------|
| `admin:manage_roles` | Manage custom roles and permissions |
| `admin:view_audit_logs` | View system audit logs |
| `admin:platform_access` | Access platform admin features |

## System Roles

Pre-defined roles that cannot be modified or deleted.

### Organization Admin

**Name**: `org_admin`
**Description**: Full access to organization settings, team, billing, and all features

**Permissions**: All permissions except `admin:platform_access`

**Use Cases**:
- Organization owners
- Primary administrators
- Users managing billing and team

### Grant Creator

**Name**: `grant_creator`
**Description**: Can create, edit, and manage grants and related tasks

**Permissions**:
- All grant permissions
- All task permissions
- All document permissions
- View team, org settings, reports
- View and approve workflows
- View and edit CRM

**Use Cases**:
- Grant writers
- Program managers
- Development staff

### Grant Viewer

**Name**: `grant_viewer`
**Description**: Read-only access to grants and reports

**Permissions**:
- `grants:view`, `grants:export`
- `tasks:view`
- `documents:view`, `documents:download`
- `team:view`
- `org:view_settings`
- `reports:view`, `reports:export`
- `workflows:view`
- `crm:view`

**Use Cases**:
- Board members
- External consultants (read-only)
- Auditors

### Task Manager

**Name**: `task_manager`
**Description**: Can create, assign, and manage tasks

**Permissions**:
- `grants:view`
- All task permissions
- View/upload/download documents
- View team and performance
- View org settings and reports
- View workflows

**Use Cases**:
- Project coordinators
- Administrative staff
- Task coordinators

### Billing Admin

**Name**: `billing_admin`
**Description**: Manage billing, subscriptions, and view invoices

**Permissions**:
- View grants, tasks, team
- View org settings and integrations
- All billing permissions
- View reports

**Use Cases**:
- Finance team members
- Accountants
- CFO/Finance managers

### Contributor

**Name**: `contributor`
**Description**: Standard team member with grant and task access

**Permissions**:
- `grants:view`, `grants:create`, `grants:edit`
- `tasks:view`, `tasks:create`, `tasks:edit`, `tasks:complete`
- View/upload/download documents
- View team and org settings
- View reports and workflows
- View CRM

**Use Cases**:
- Standard team members
- Grant researchers
- Program staff

### Platform Admin

**Name**: `platform_admin`
**Description**: System-wide administrative access

**Permissions**: All permissions (including `admin:platform_access`)

**Use Cases**:
- System administrators
- Support staff
- Platform maintainers

## Custom Roles

Organizations can create custom roles with specific permission combinations.

### Creating Custom Roles

**Requirements**:
- User must have `admin:manage_roles` permission
- Role name must be unique within organization
- At least one permission must be assigned

**Example**:
```typescript
// Create custom "Finance Viewer" role
const { data, error } = await supabase
  .from('roles')
  .insert({
    name: 'finance_viewer',
    display_name: 'Finance Viewer',
    description: 'View grants and manage billing, but not edit grants',
    org_id: currentOrg.id,
    is_system_role: false
  })
  .select()
  .single();

// Assign permissions
const permissionIds = await supabase
  .from('permissions')
  .select('id')
  .in('name', [
    'grants:view',
    'billing:view',
    'billing:manage',
    'billing:view_invoices',
    'reports:view',
    'reports:export'
  ]);

await supabase
  .from('role_permissions')
  .insert(
    permissionIds.data.map(p => ({
      role_id: data.id,
      permission_id: p.id
    }))
  );
```

### Common Custom Role Examples

#### Grant Reviewer
- View and export grants
- View and complete tasks
- Upload and download documents
- View reports

#### External Consultant
- View grants
- Create and edit tasks
- View and download documents
- No access to team or billing

#### Finance Manager
- View grants and tasks
- Manage all billing
- View and export reports
- View team performance

## Permission Checking

### Frontend Permission Checks

#### Using the usePermission Hook

```typescript
import { usePermission } from '../hooks/usePermission';

function GrantCard({ grant }) {
  const { hasPermission } = usePermission();

  return (
    <Card>
      <GrantInfo grant={grant} />

      {hasPermission('grants:edit') && (
        <Button onClick={() => editGrant(grant.id)}>Edit</Button>
      )}

      {hasPermission('grants:delete') && (
        <Button color="red" onClick={() => deleteGrant(grant.id)}>
          Delete
        </Button>
      )}
    </Card>
  );
}
```

#### Multiple Permission Checks

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

#### Permission Groups

Pre-defined permission groups for common checks:

```typescript
export const PermissionGroups = {
  GRANT_FULL: ['grants:view', 'grants:create', 'grants:edit', 'grants:delete', 'grants:export'],
  GRANT_VIEW: ['grants:view', 'grants:export'],
  TASK_FULL: ['tasks:view', 'tasks:create', 'tasks:assign', 'tasks:edit', 'tasks:delete', 'tasks:complete'],
  DOCUMENT_FULL: ['documents:view', 'documents:upload', 'documents:edit', 'documents:delete', 'documents:download'],
  ADMIN: ['admin:manage_roles', 'admin:view_audit_logs'],
  ORG_ADMIN: ['org:view_settings', 'org:edit_settings', 'org:edit_profile']
};
```

### Backend Permission Checks

#### API Middleware

```typescript
import { checkUserPermission } from '../lib/rbac';

export async function handler(req: VercelRequest, res: VercelResponse) {
  // Authenticate user
  const authResult = await verifyUserAuth(req, supabase);
  if (!authResult.success) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = authResult.user!;
  const { org_id } = req.body;

  // Check permission
  const hasPermission = await checkUserPermission(
    user.id,
    org_id,
    'grants:create'
  );

  if (!hasPermission) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      required: 'grants:create'
    });
  }

  // Process request...
}
```

#### Database Function

```sql
-- Check if user has permission
SELECT user_has_permission(
  'user-uuid'::uuid,
  'org-uuid'::uuid,
  'grants:view'
);

-- Get all user permissions
SELECT * FROM get_user_permissions(
  'user-uuid'::uuid,
  'org-uuid'::uuid
);

-- Get all user roles
SELECT * FROM get_user_roles(
  'user-uuid'::uuid,
  'org-uuid'::uuid
);
```

## Row Level Security (RLS)

The RBAC system integrates with PostgreSQL Row Level Security.

### Example RLS Policy

```sql
-- Only allow users with grants:view permission to view grants
CREATE POLICY "Users can view grants with permission"
  ON public.org_grants_saved
  FOR SELECT
  USING (
    org_id IN (
      SELECT ura.org_id
      FROM public.user_role_assignments ura
      JOIN public.role_permissions rp ON rp.role_id = ura.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ura.user_id = auth.uid()
        AND p.name = 'grants:view'
    )
  );
```

### RLS Policies for RBAC Tables

**Permissions Table**:
- Anyone can view (system-wide permissions)

**Roles Table**:
- Users can view system roles and roles in their organizations
- Org admins can create/update/delete custom roles

**Role Permissions Table**:
- Anyone can view (to check role capabilities)
- Org admins can manage permissions for custom roles

**User Role Assignments Table**:
- Users can view assignments in their organizations
- Users with `team:edit_roles` can manage assignments

## Role Management UI

### Viewing Roles

Location: **Settings → Role Management**

**Required Permission**: `admin:manage_roles`

**Features**:
- View all system roles
- View custom organization roles
- See permission breakdown for each role
- View which users have each role

### Creating Custom Roles

**Steps**:
1. Navigate to **Settings → Role Management**
2. Click **"Create Custom Role"**
3. Enter role details:
   - Role Name (internal identifier)
   - Display Name (user-facing name)
   - Description
4. Select permissions from categorized list
5. Click **"Create Role"**

### Assigning Roles to Users

**Steps**:
1. Navigate to **Settings → Team**
2. Find user and click edit icon
3. In modal:
   - Select legacy role (admin/contributor) for backwards compatibility
   - Select one or more RBAC roles
4. Click **"Update Roles"**

**Multi-Role Assignment**:
Users can have multiple roles. Their effective permissions are the union of all assigned role permissions.

## Migration from Legacy Roles

### Legacy Role Mapping

The system maintains backwards compatibility with the original role system.

| Legacy Role | Mapped RBAC Role(s) |
|-------------|-------------------|
| `admin` | Organization Admin |
| `contributor` | Contributor |

### Migration Process

When the RBAC system was implemented:

1. All existing users kept their legacy role in `org_members.role`
2. Corresponding RBAC roles were automatically assigned
3. Flag `rbac_migrated` set to `true` in `org_members`
4. Legacy role still used for backwards compatibility

### Legacy Permission Mapping

The `usePermission` hook maps legacy permission checks:

```typescript
function mapLegacyPermission(permission: string): string[] {
  const mapping = {
    'manage_team': ['team:invite', 'team:remove', 'team:edit_roles'],
    'manage_settings': ['org:edit_settings', 'org:edit_profile'],
    'manage_billing': ['billing:manage'],
    // ... more mappings
  };

  return mapping[permission] || [permission];
}
```

## Best Practices

### Permission Design

1. **Principle of Least Privilege**: Grant only necessary permissions
2. **Role Composition**: Use multiple roles instead of one super-role
3. **Regular Audits**: Review role assignments quarterly
4. **Document Custom Roles**: Keep track of why each custom role exists

### Frontend Checks

1. **Always Check Permissions**: Don't assume based on UI state
2. **Graceful Degradation**: Hide or disable UI elements
3. **Loading States**: Show loading while permissions are being fetched
4. **Optimistic UI**: Update UI optimistically, rollback on error

### Backend Checks

1. **Never Trust Client**: Always verify permissions on server
2. **Defense in Depth**: Use both RBAC and RLS
3. **Fail Securely**: Deny by default, allow explicitly
4. **Log Permission Denials**: Track unauthorized access attempts

### Role Management

1. **Limit Custom Roles**: Too many roles become hard to manage
2. **Clear Naming**: Use descriptive role names
3. **Permission Groups**: Assign logically related permissions together
4. **Regular Cleanup**: Remove unused custom roles

## Troubleshooting

### Common Issues

#### User Can't Access Feature

1. Check user's role assignments
2. Verify role has required permission
3. Check RLS policies allow access
4. Verify user is member of organization

#### Permission Check Always Fails

1. Ensure user is authenticated
2. Check organization context is loaded
3. Verify permissions table has the permission
4. Check role_permissions mapping

#### Custom Role Not Appearing

1. Verify role was created successfully
2. Check org_id is set correctly
3. Ensure user has `admin:manage_roles` permission
4. Clear frontend query cache

## Related Documentation

- [System Overview](./system-overview.md)
- [Authentication](./authentication.md)
- [Data Flow](./data-flow.md)
- [Database Schema](../database/schema.md)
