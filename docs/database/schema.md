# Database Schema

## Overview

GrantCue uses PostgreSQL 15+ via Supabase with Row Level Security (RLS) for multi-tenant data isolation. The schema is organized into logical domains: core organization management, grant discovery, grant management, AI features, collaboration, post-award tracking, and integrations.

## Database Design Principles

1. **Multi-Tenancy**: All data scoped by `org_id` with RLS enforcement
2. **Normalization**: Third normal form (3NF) for data integrity
3. **Audit Trail**: Track creation and modification timestamps
4. **Soft Deletes**: Important data marked inactive rather than deleted
5. **Foreign Keys**: Enforce referential integrity
6. **Indexes**: All foreign keys and frequently queried columns indexed

## Core Tables

### organizations

Represents customer organizations (tenants).

```sql
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  primary_state TEXT,
  focus_areas TEXT[],
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT organizations_name_not_empty CHECK (length(trim(name)) > 0)
);
```

**Indexes**:
- `idx_organizations_slug` on `slug`

**Purpose**: Central tenant table for multi-tenant architecture. Each organization has isolated data.

**Relationships**:
- One-to-many: `org_members`, `org_grants_saved`, `webhooks`, `integrations`

### user_profiles

Extended user information beyond Supabase Auth.

```sql
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

**Purpose**: Store user profile information and preferences. Automatically created on user signup via trigger.

**Relationships**:
- One-to-one: `auth.users`
- One-to-many: `org_members`

### org_members

User membership in organizations with legacy roles.

```sql
CREATE TABLE public.org_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'contributor',
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  invited_by UUID REFERENCES auth.users(id),

  UNIQUE(org_id, user_id),
  CONSTRAINT org_members_role_check CHECK (role IN ('admin', 'contributor'))
);
```

**Indexes**:
- `idx_org_members_user_id` on `user_id`
- `idx_org_members_org_id` on `org_id`

**Purpose**: Links users to organizations. Used for multi-tenancy and basic authorization.

**Note**: Legacy `role` field maintained for backwards compatibility. RBAC system provides granular permissions via `user_role_assignments`.

### team_invitations

Pending invitations to join organizations.

```sql
CREATE TABLE public.team_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'contributor',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days') NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,

  CONSTRAINT team_invitations_role_check CHECK (role IN ('admin', 'contributor')),
  UNIQUE(org_id, email)
);
```

**Indexes**:
- `idx_team_invitations_email` on `email`
- `idx_team_invitations_org_id` on `org_id`

**Purpose**: Track team invitation lifecycle. Invitations expire after 7 days.

## Grant Discovery Tables

### grants_catalog

Unified catalog of grants from all sources.

```sql
CREATE TABLE public.grants_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES grant_sources(id),
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  agency TEXT,
  description TEXT,
  opportunity_number TEXT,
  cfda_number TEXT,
  open_date TIMESTAMPTZ,
  close_date TIMESTAMPTZ,
  award_ceiling NUMERIC,
  award_floor NUMERIC,
  estimated_funding NUMERIC,
  eligibility TEXT[],
  funding_category TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(source_id, external_id)
);
```

**Indexes**:
- `idx_grants_catalog_source_id` on `source_id`
- `idx_grants_catalog_external_id` on `external_id`
- `idx_grants_catalog_close_date` on `close_date`
- Full-text search index on `title`, `description`

**Purpose**: Central catalog of all grants from Grants.gov and other sources. Updated nightly via sync jobs.

### grant_sources

Configuration for grant data sources.

```sql
CREATE TABLE public.grant_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

**Purpose**: Configure multiple grant data sources. Currently supports Grants.gov, expandable to custom sources.

### sync_jobs

Track grant synchronization operations.

```sql
CREATE TABLE public.sync_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES grant_sources(id),
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ,
  grants_fetched INTEGER DEFAULT 0,
  grants_new INTEGER DEFAULT 0,
  grants_updated INTEGER DEFAULT 0,
  error_message TEXT
);
```

**Purpose**: Track nightly sync job performance and debugging.

### grant_duplicates

Track duplicate grants across sources.

```sql
CREATE TABLE public.grant_duplicates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  master_grant_id UUID NOT NULL REFERENCES grants_catalog(id),
  duplicate_grant_id UUID NOT NULL REFERENCES grants_catalog(id),
  similarity_score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(master_grant_id, duplicate_grant_id)
);
```

**Purpose**: De-duplication tracking across different sources.

## Grant Management Tables

### org_grants_saved

Grants saved to organization pipelines.

```sql
CREATE TABLE public.org_grants_saved (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  external_source TEXT DEFAULT 'grants.gov',
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  agency TEXT,
  opportunity_number TEXT,
  cfda_number TEXT,
  program TEXT,
  description TEXT,
  open_date TIMESTAMPTZ,
  close_date TIMESTAMPTZ,
  loi_deadline TIMESTAMPTZ,
  award_ceiling NUMERIC,
  estimated_funding NUMERIC,
  status TEXT DEFAULT 'prospecting',
  priority TEXT DEFAULT 'medium',
  assigned_to UUID REFERENCES auth.users(id),
  fit_score INTEGER,
  success_score INTEGER,
  notes TEXT,
  saved_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(org_id, external_source, external_id)
);
```

**Indexes**:
- `idx_org_grants_saved_org_id` on `org_id`
- `idx_org_grants_saved_user_id` on `user_id`
- `idx_org_grants_saved_status` on `status`
- `idx_org_grants_saved_close_date` on `close_date`

**Status Values**: `prospecting`, `researching`, `preparing`, `submitted`, `awarded`, `declined`, `closed`

**Priority Values**: `low`, `medium`, `high`, `critical`

**Purpose**: Core table for grant pipeline management. Tracks grants through workflow stages.

**Example Query**:
```sql
-- Get all high-priority grants due in next 30 days
SELECT *
FROM org_grants_saved
WHERE org_id = $1
  AND priority = 'high'
  AND close_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
ORDER BY close_date ASC;
```

### grant_tasks

Task breakdown for grants.

```sql
CREATE TABLE public.grant_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grant_id UUID NOT NULL REFERENCES org_grants_saved(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  due_date TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  sort_order INTEGER,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ,

  CONSTRAINT grant_tasks_status_check CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked'))
);
```

**Indexes**:
- `idx_grant_tasks_grant_id` on `grant_id`
- `idx_grant_tasks_assigned_to` on `assigned_to`
- `idx_grant_tasks_due_date` on `due_date`

**Purpose**: Break down grant work into actionable tasks with assignments and deadlines.

**Example Query**:
```sql
-- Get overdue tasks for user
SELECT t.*, g.title as grant_title
FROM grant_tasks t
JOIN org_grants_saved g ON g.id = t.grant_id
WHERE t.assigned_to = $1
  AND t.status != 'completed'
  AND t.due_date < NOW()
ORDER BY t.due_date ASC;
```

### grant_activity_log

Audit trail for all grant changes.

```sql
CREATE TABLE public.grant_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grant_id UUID NOT NULL REFERENCES org_grants_saved(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

**Indexes**:
- `idx_grant_activity_log_grant_id` on `grant_id`
- `idx_grant_activity_log_created_at` on `created_at DESC`

**Purpose**: Complete audit trail of grant changes for compliance and debugging.

**Action Types**: `created`, `updated`, `status_changed`, `assigned`, `task_added`, `document_uploaded`, `comment_added`

## AI Features Tables

### grant_ai_summaries

AI-generated grant summaries.

```sql
CREATE TABLE public.grant_ai_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grant_id UUID NOT NULL REFERENCES org_grants_saved(id) ON DELETE CASCADE,
  summary_data JSONB NOT NULL,
  model_version TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(grant_id)
);
```

**Purpose**: Cache AI-generated NOFO summaries. `summary_data` contains structured sections: overview, eligibility, funding, timeline, requirements.

**Example Query**:
```sql
-- Get summary for grant
SELECT summary_data
FROM grant_ai_summaries
WHERE grant_id = $1;
```

### grant_tags

Tag taxonomy for categorization.

```sql
CREATE TABLE public.grant_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT grant_tags_category_check CHECK (category IN ('focus', 'eligibility', 'funding', 'geographic'))
);
```

**Tag Categories**:
- `focus`: Program focus areas (education, healthcare, environment)
- `eligibility`: Eligible entity types (nonprofits, municipalities)
- `funding`: Funding ranges (under-100k, 100k-500k, over-500k)
- `geographic`: Geographic restrictions (nationwide, regional, state-specific)

### grant_tag_assignments

Many-to-many mapping of tags to grants.

```sql
CREATE TABLE public.grant_tag_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grant_id UUID NOT NULL REFERENCES org_grants_saved(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES grant_tags(id) ON DELETE CASCADE,
  confidence_score NUMERIC,
  assigned_by TEXT,
  assigned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(grant_id, tag_id)
);
```

**Purpose**: AI or user-assigned tags. `assigned_by` can be 'ai' or user ID.

### grant_recommendations

Cached grant recommendations.

```sql
CREATE TABLE public.grant_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  grant_id UUID NOT NULL REFERENCES grants_catalog(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  score NUMERIC NOT NULL,
  reason TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(org_id, grant_id, user_id)
);
```

**Purpose**: Personalized grant recommendations using collaborative filtering and AI scoring.

### grant_success_scores

Success probability predictions.

```sql
CREATE TABLE public.grant_success_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grant_id UUID NOT NULL REFERENCES org_grants_saved(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  factors JSONB,
  calculated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(grant_id, org_id)
);
```

**Purpose**: AI-calculated success probability (0-100). Factors include organization fit, past performance, competition level.

## Collaboration Tables

### grant_comments

Threaded comments on grants.

```sql
CREATE TABLE public.grant_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grant_id UUID NOT NULL REFERENCES org_grants_saved(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES grant_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);
```

**Indexes**:
- `idx_grant_comments_grant_id` on `grant_id`
- `idx_grant_comments_parent_id` on `parent_comment_id`

**Purpose**: Threaded discussions on grants with soft delete support.

### mentions

User mentions in comments.

```sql
CREATE TABLE public.mentions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL REFERENCES grant_comments(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentioned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

**Indexes**:
- `idx_mentions_mentioned_user_id` on `mentioned_user_id`

**Purpose**: Track @mentions for notifications.

## Post-Award Management Tables

### grant_budgets

Budget tracking for awarded grants.

```sql
CREATE TABLE public.grant_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grant_id UUID NOT NULL REFERENCES org_grants_saved(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  total_proposed NUMERIC,
  total_awarded NUMERIC,
  total_spent NUMERIC DEFAULT 0,
  budget_period_start TIMESTAMPTZ,
  budget_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(grant_id)
);
```

**Purpose**: High-level budget tracking for awarded grants.

### budget_line_items

Detailed budget breakdown.

```sql
CREATE TABLE public.budget_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_id UUID NOT NULL REFERENCES grant_budgets(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT,
  proposed_amount NUMERIC,
  awarded_amount NUMERIC,
  spent_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

**Categories**: `personnel`, `fringe`, `travel`, `equipment`, `supplies`, `contractual`, `construction`, `other`, `indirect`

### grant_disbursements

Expense and payment tracking.

```sql
CREATE TABLE public.grant_disbursements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grant_id UUID NOT NULL REFERENCES org_grants_saved(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  disbursement_date TIMESTAMPTZ NOT NULL,
  category TEXT,
  description TEXT,
  vendor TEXT,
  receipt_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

**Purpose**: Track grant expenditures for compliance reporting.

### grant_payment_schedules

Drawdown schedule tracking.

```sql
CREATE TABLE public.grant_payment_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grant_id UUID NOT NULL REFERENCES org_grants_saved(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scheduled_date TIMESTAMPTZ NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  received_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

**Status Values**: `pending`, `requested`, `received`, `delayed`

### grant_compliance_requirements

Compliance tracking.

```sql
CREATE TABLE public.grant_compliance_requirements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grant_id UUID NOT NULL REFERENCES org_grants_saved(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requirement_type TEXT NOT NULL,
  description TEXT NOT NULL,
  due_date TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  completed_date TIMESTAMPTZ,
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

**Requirement Types**: `report`, `audit`, `certification`, `site_visit`, `other`

## Documents Tables

### grant_documents

Document metadata.

```sql
CREATE TABLE public.grant_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grant_id UUID NOT NULL REFERENCES org_grants_saved(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  document_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

**Purpose**: Track documents uploaded for grants. Actual files stored in Supabase Storage.

**Document Types**: `nofo`, `application`, `budget`, `supporting`, `award`, `report`, `other`

## Integration Tables

### integrations

OAuth-based third-party integrations.

```sql
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  webhook_url TEXT,
  channel_id TEXT,
  channel_name TEXT,
  connected_by UUID REFERENCES auth.users(id),
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, integration_type)
);
```

**Integration Types**: `slack`, `google_calendar`, `microsoft_teams`

**Security**: `access_token` and `refresh_token` encrypted at rest.

### webhooks

Custom webhook endpoints.

```sql
CREATE TABLE public.webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT,
  events TEXT[] NOT NULL DEFAULT ARRAY['grant.saved', 'grant.deadline_approaching'],
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_triggered_at TIMESTAMPTZ,
  total_deliveries INTEGER DEFAULT 0,
  failed_deliveries INTEGER DEFAULT 0
);
```

**Purpose**: Allow custom webhook integrations for event notifications.

### webhook_deliveries

Webhook delivery log.

```sql
CREATE TABLE public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  error_message TEXT
);
```

**Purpose**: Track webhook delivery success/failures for debugging.

## RBAC Tables

### permissions

System-wide permission definitions.

```sql
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT permissions_name_format CHECK (name ~* '^[a-z_]+:[a-z_]+$')
);
```

**Purpose**: Define all available permissions. Format: `category:action`.

### roles

Role definitions (system and custom).

```sql
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT FALSE,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

**Purpose**: Define roles. System roles (org_admin, contributor, etc.) cannot be modified. Custom roles are organization-specific.

### role_permissions

Maps permissions to roles.

```sql
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(role_id, permission_id)
);
```

### user_role_assignments

Assigns roles to users.

```sql
CREATE TABLE public.user_role_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(user_id, role_id, org_id)
);
```

**Purpose**: Multi-role support. Users can have multiple roles, effective permissions are union of all assigned roles.

## Helper Functions

### user_has_permission

Check if user has specific permission.

```sql
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
```

**Usage**:
```sql
SELECT user_has_permission(
  'user-uuid'::uuid,
  'org-uuid'::uuid,
  'grants:edit'
);
```

### get_user_permissions

Get all permissions for user in organization.

```sql
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
```

## Row Level Security (RLS)

All tables have RLS enabled with policies based on organization membership and permissions.

### Example RLS Policy

```sql
-- Users can view grants in their organizations
CREATE POLICY "Users can view org grants"
  ON public.org_grants_saved
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

-- Users with grants:create permission can save grants
CREATE POLICY "Users can save grants with permission"
  ON public.org_grants_saved
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT ura.org_id
      FROM public.user_role_assignments ura
      JOIN public.role_permissions rp ON rp.role_id = ura.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ura.user_id = auth.uid()
        AND p.name = 'grants:create'
    )
  );
```

## Migrations

All schema changes tracked in numbered migration files in `/supabase/migrations/`.

**Migration Naming**: `YYYYMMDD_description.sql`

**Example**: `20250218_add_rbac_system.sql`

**Running Migrations**: Apply in order via Supabase SQL editor or CLI.

## Performance Considerations

### Indexes

All foreign keys automatically indexed. Additional indexes on:
- Frequently filtered columns (status, close_date)
- Full-text search columns (title, description)
- Sorted columns (created_at, updated_at)

### Query Optimization

```sql
-- GOOD: Uses indexes
SELECT *
FROM org_grants_saved
WHERE org_id = $1
  AND status = 'submitted'
ORDER BY close_date ASC
LIMIT 50;

-- BAD: Table scan
SELECT *
FROM org_grants_saved
WHERE LOWER(title) LIKE '%grant%';

-- BETTER: Full-text search
SELECT *
FROM org_grants_saved
WHERE to_tsvector('english', title || ' ' || description) @@ to_tsquery('grant');
```

### Connection Pooling

Supabase uses PgBouncer for connection pooling. Max 100 connections per instance.

## Related Documentation

- [System Overview](../architecture/system-overview.md)
- [Authentication](../architecture/authentication.md)
- [Permissions (RBAC)](../architecture/permissions.md)
- [Data Flow](../architecture/data-flow.md)
