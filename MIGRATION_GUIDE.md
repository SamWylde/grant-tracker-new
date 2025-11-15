# Type Safety Migration Guide

Quick reference for migrating to the new type-safe patterns.

## Import Patterns

### Using Constants

```typescript
// OLD - Magic strings
if (grant.status === 'researching') { ... }
if (priority === 'high') { ... }
if (role === 'admin') { ... }

// NEW - Type-safe constants
import { GRANT_STATUSES, GRANT_PRIORITIES, USER_ROLES } from '../constants';

if (grant.status === GRANT_STATUSES.RESEARCHING) { ... }
if (priority === GRANT_PRIORITIES.HIGH) { ... }
if (role === USER_ROLES.ADMIN) { ... }
```

### Using Status/Priority Options in UI

```typescript
// OLD - Hardcoded arrays
const options = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  // ...
];

// NEW - Use constant arrays
import { GRANT_PRIORITY_OPTIONS, GRANT_STATUS_OPTIONS } from '../constants';

<Select data={GRANT_PRIORITY_OPTIONS} />
<MultiSelect data={GRANT_STATUS_OPTIONS} />
```

## Supabase RPC Calls

### Type-Safe RPC Calls

```typescript
// OLD - Using 'as any'
const { data } = await (supabase.rpc as any)('get_org_team_members', {
  org_uuid: orgId
});
const members = data?.map((m: any) => ({
  id: m.user_id,
  name: m.full_name
}));

// NEW - Properly typed
import type { TeamMember } from '../types/api';

const { data } = await supabase.rpc('get_org_team_members', {
  org_uuid: orgId
});
const typedData = data as unknown as TeamMember[];
const members = typedData?.map(m => ({
  id: m.user_id,
  name: m.full_name
}));
```

### Permission Checking

```typescript
// OLD
const { data } = await supabase.rpc('user_has_permission' as any, {
  p_user_id: userId,
  p_org_id: orgId,
  p_permission_name: 'grants:edit'
} as any);

// NEW - No casts needed!
const { data } = await supabase.rpc('user_has_permission', {
  p_user_id: userId,
  p_org_id: orgId,
  p_permission_name: 'grants:edit'
});
```

## Database Queries

### Organization Settings

```typescript
// OLD
const { data } = await supabase
  .from('organization_settings')
  .select('*')
  .single();

const plan = (data as any)?.plan_name || 'free';
const status = (data as any)?.plan_status || 'active';

// NEW
import type { OrganizationSettings } from '../types/api';
import { PLAN_NAMES, PLAN_STATUSES } from '../constants';

const { data } = await supabase
  .from('organization_settings')
  .select('*')
  .single();

const settings = data as unknown as OrganizationSettings;
const plan = settings?.plan_name || PLAN_NAMES.FREE;
const status = settings?.plan_status || PLAN_STATUSES.ACTIVE;
```

### User Profiles

```typescript
// OLD
const { data } = await supabase
  .from('user_profiles')
  .select('*')
  .single();

const isAdmin = (data as any)?.is_platform_admin || false;

// NEW
import type { UserProfile } from '../types/api';

const { data } = await supabase
  .from('user_profiles')
  .select('*')
  .single();

const profile = data as unknown as UserProfile;
const isAdmin = profile?.is_platform_admin || false;
```

### Organization Members

```typescript
// OLD
const { data } = await supabase
  .from('org_members')
  .select('role')
  .single();

const role = (data as any)?.role as 'admin' | 'contributor';

// NEW
import type { OrgMember } from '../types/api';

const { data } = await supabase
  .from('org_members')
  .select('role')
  .single();

const member = data as unknown as OrgMember;
const role = member?.role; // Already typed as 'admin' | 'contributor'
```

## Component Imports

### Using Barrel Exports

```typescript
// OLD - Multiple import statements
import { GrantFilters } from '../components/GrantFilters';
import { TaskList } from '../components/TaskList';
import { UserMenu } from '../components/UserMenu';
import { GrantDetailDrawer } from '../components/GrantDetailDrawer';

// NEW - Single import
import {
  GrantFilters,
  TaskList,
  UserMenu,
  GrantDetailDrawer
} from '../components';
```

### Hook Imports

```typescript
// OLD
import { useAIFeatures } from '../hooks/useAIFeatures';
import { usePermission } from '../hooks/usePermission';
import { use2FA } from '../hooks/use2FA';

// NEW
import { useAIFeatures, usePermission, use2FA } from '../hooks';
```

## Type Guards and Narrowing

### Status-Based Type Narrowing

```typescript
import { GRANT_STATUSES, EXPORT_STATUSES } from '../constants';

// Type-safe status checks
function isActiveGrant(grant: SavedGrant): boolean {
  return ![
    GRANT_STATUSES.ARCHIVED,
    GRANT_STATUSES.REJECTED,
    GRANT_STATUSES.WITHDRAWN
  ].includes(grant.status as any); // Note: Will be improved with string literal types
}

// Export status checking
if (exportRequest.status === EXPORT_STATUSES.COMPLETED) {
  // TypeScript knows status is 'completed' here
  console.log(exportRequest.download_url);
}
```

## React Query with Types

### Typed Queries

```typescript
// OLD
const { data } = useQuery({
  queryKey: ['teamMembers', orgId],
  queryFn: async () => {
    const { data } = await supabase.rpc('get_org_team_members' as any, ...);
    return data?.map((m: any) => ({ ... }));
  }
});

// NEW
import type { TeamMember, TeamMemberOption } from '../types/api';

const { data } = useQuery<TeamMemberOption[]>({
  queryKey: ['teamMembers', orgId],
  queryFn: async () => {
    const { data } = await supabase.rpc('get_org_team_members', { org_uuid: orgId });
    const members = data as unknown as TeamMember[];
    return members?.map(m => ({
      value: m.user_id,
      label: m.full_name || m.email || 'Unknown'
    }));
  }
});
```

## Common Patterns

### Plan Checking

```typescript
import { PLAN_NAMES } from '../constants';
import type { OrganizationSettings } from '../types/api';

function hasFeatureAccess(settings: OrganizationSettings): boolean {
  return [PLAN_NAMES.PRO, PLAN_NAMES.ENTERPRISE].includes(settings.plan_name);
}
```

### Role Checking

```typescript
import { USER_ROLES } from '../constants';

function canManageTeam(userRole: string): boolean {
  return userRole === USER_ROLES.ADMIN;
}
```

### Status Transitions

```typescript
import { GRANT_STATUSES, APPROVAL_STATUSES } from '../constants';

const validTransitions = {
  [GRANT_STATUSES.RESEARCHING]: [
    GRANT_STATUSES.GO_NO_GO,
    GRANT_STATUSES.ARCHIVED
  ],
  [GRANT_STATUSES.GO_NO_GO]: [
    GRANT_STATUSES.DRAFTING,
    GRANT_STATUSES.REJECTED
  ],
  // ...
};
```

## API Response Handling

### Generic API Responses

```typescript
import type { APIResponse, PaginatedResponse } from '../types/api';

// Single item response
async function fetchGrant(id: string): Promise<APIResponse<SavedGrant>> {
  const response = await fetch(`/api/grants/${id}`);
  return response.json();
}

// Paginated response
async function fetchGrants(page: number): Promise<PaginatedResponse<SavedGrant>> {
  const response = await fetch(`/api/grants?page=${page}`);
  return response.json();
}
```

## Best Practices

### 1. Always Use Constants for Comparisons

```typescript
// GOOD
if (status === GRANT_STATUSES.SUBMITTED) { }

// BAD
if (status === 'submitted') { }
```

### 2. Use Type Assertions Carefully

```typescript
// GOOD - Uses unknown as intermediate
const member = data as unknown as OrgMember;

// AVOID - Direct any cast
const member = data as any;
```

### 3. Leverage TypeScript's Type Inference

```typescript
// GOOD - Let TypeScript infer
const members = data.map(m => m.user_id);

// UNNECESSARY - Explicit type when inferred
const members: string[] = data.map((m: TeamMember) => m.user_id);
```

### 4. Use Discriminated Unions

```typescript
type RequestStatus =
  | { status: 'pending'; progress: number }
  | { status: 'completed'; result: string }
  | { status: 'failed'; error: Error };

function handleStatus(req: RequestStatus) {
  switch (req.status) {
    case 'pending':
      console.log(req.progress); // TypeScript knows progress exists
      break;
    case 'completed':
      console.log(req.result); // TypeScript knows result exists
      break;
    case 'failed':
      console.log(req.error); // TypeScript knows error exists
      break;
  }
}
```

## Gradual Migration Strategy

1. **Start with high-traffic files** - Focus on frequently used utilities and contexts
2. **Use the new types in new code** - All new features should use typed constants
3. **Refactor during feature work** - When touching a file, migrate it to new patterns
4. **Batch similar changes** - Fix all status checks in one PR, all role checks in another
5. **Update tests** - Ensure tests use the new constants too

## Resources

- Constants: `/src/constants/index.ts`
- API Types: `/src/types/api.ts`
- Database Types: `/src/lib/database.types.ts`
- Barrel Exports: `/src/components/index.ts`, `/src/hooks/index.ts`, etc.
