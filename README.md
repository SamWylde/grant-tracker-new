# Grant Tracker - Discover Federal Grants

A grant discovery and tracking platform that helps organizations find and manage federal grant opportunities from Grants.gov.

## Features

### Grant Discovery & Details
- **Advanced Search**: Search federal grants by keyword, category, agency, and status
- **Smart Filters**: Filter by funding category, agency, opportunity status, and due date (≤ X days)
- **Multi-Sort**: Sort grants by relevance, due date, or newest first
- **Enhanced Grant Cards**: Hover effects and improved information hierarchy
- **Grant Details Modal**: Comprehensive grant information with HTML parsing for clean display
- **Quick Search (cmd/ctrl+K)**: Global quick search modal with keyboard shortcut
- **Recent Searches**: Track and reuse recent search queries with usage counts
- **Saved Views**: Save filter configurations and share with your team
- **Eligibility Profile**: Configure organization profile for personalized grant recommendations
- **Real-time Data**: Live data from Grants.gov Search2 API and fetchOpportunity API

### Authentication & Access
- **Secure Sign-In**: Email/password authentication via Supabase Auth
- **User Profiles**: Manage personal profile information and preferences
- **Protected Routes**: Role-based access control for sensitive features

### Pipeline & Workflow Management
- **Kanban Board**: Visual pipeline with 4 stages (Researching → Drafting → Submitted → Awarded)
- **Drag-and-Drop**: Native HTML5 drag-and-drop to move grants between stages
- **Status Tracking**: Automatic timestamp tracking when grants move between stages
- **Priority Levels**: Assign priority (low, medium, high, urgent) to saved grants
- **Deadline Indicators**: Color-coded visual indicators for approaching and overdue deadlines
- **Assignment**: Assign grants to team members for accountability
- **Stage Counts**: Real-time count of grants in each pipeline stage
- **Grant Detail Drawer**: Click any grant card to open detailed view with tasks and notes
- **Task Management**: Break down each grant into actionable subtasks with progress tracking
- **Default Task Templates**: Auto-created task list (Research, Narrative, Budget, Documents, Letters, Submission)
- **Task Checklist**: Mark tasks complete with visual progress indicator
- **Task Types**: Categorize tasks (research, budget, narrative, letters, documents, submission, custom)
- **Task Due Dates**: Set deadlines for individual tasks
- **Task Status**: Track task state (pending, in_progress, completed, blocked)
- **Task Assignments**: Assign specific tasks to team members (coming soon)

### Organization & Team Management
- **Multi-Organization Support**: Switch between multiple organizations with persistent context
- **Team Collaboration**: Invite team members with role-based permissions (Admin/Contributor)
- **Organization Settings**: Configure organization name, primary state, and focus areas
- **Admin Controls**: Admin-only features for sensitive operations

### Calendar & Integrations
- **ICS Calendar Feed**: Subscribe to grant deadlines in any calendar app (Google Calendar, Outlook, Apple Calendar)
- **Microsoft Teams**: Connect Teams channels for deadline notifications via incoming webhooks
- **Custom Webhooks**: Configure custom webhook endpoints to receive grant events
- **Webhook Events**: grant.saved, grant.deadline_approaching, grant.deadline_passed, grant.updated
- **Google Calendar**: OAuth integration (coming soon)
- **Slack**: OAuth integration (coming soon)

### Notifications & Reminders
- **Email Reminders**: Customizable deadline reminder cadence (30d, 14d, 7d, 3d, 1d, day-of)
- **Daily Task Emails**: Optional daily summary emails
- **User Preferences**: Control email notification preferences

### Settings & Management
- **7 Settings Pages**: Profile, Organization, Team, Notifications, Calendar & Integrations, Billing, Danger Zone
- **Responsive Design**: Built with Mantine UI for a modern, mobile-friendly experience
- **Mobile Navigation**: Burger menu with drawer navigation on mobile devices
- **Role-Based Access**: Admin-only controls for sensitive settings

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **UI Library**: Mantine v8
- **Routing**: React Router v7
- **Data Fetching**: TanStack Query v5
- **Drag & Drop**: @dnd-kit (core, sortable, utilities)
- **Backend**: Vercel Serverless Functions
- **Database**: Supabase (PostgreSQL with RLS)
- **Dates**: dayjs
- **Authentication**: Supabase Auth

## Getting Started

### Prerequisites

- Node.js 18+
- Yarn 4.10+
- Supabase account and project
- Vercel account (for deployment)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd grant-tracker-new
```

2. Install dependencies:
```bash
yarn install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Then edit `.env` and add your Supabase credentials:
```
VITE_SUPABASE_URL=your-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

For the API routes (serverless functions), also set:
```
SUPABASE_URL=your-project-url.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

4. Set up the database:

Run the migrations in your Supabase SQL editor (in order):

- `supabase/migrations/20250108_create_org_grants_saved.sql` - Creates the saved grants table
- `supabase/migrations/20250108_create_settings_and_org_schema.sql` - Creates organizations, user profiles, team members, invitations, preferences, and settings tables with RLS policies
- `supabase/migrations/add_integrations.sql` - Creates integrations, webhooks, and webhook_deliveries tables
- `supabase/migrations/20250112_add_search_features.sql` - Creates recent_searches, saved_views, and grant_interactions tables
- `supabase/migrations/20250113_add_eligibility_profile.sql` - Adds eligibility profile fields to organizations table and grant recommendations view
- `supabase/migrations/20250114_add_pipeline_fields.sql` - Adds pipeline status, priority, and assignment fields to saved grants
- `supabase/migrations/20250115_add_grant_tasks.sql` - Creates grant_tasks table for actionable task breakdown with auto-created templates

**Note**: All migrations are idempotent and can be run multiple times safely.

5. Create your first admin user:

After creating a user in Supabase Auth dashboard, run the SQL setup script (see Database Setup section below).

6. Start the development server:
```bash
yarn dev
```

Visit `http://localhost:5173` to see the app.

## Database Setup

### Creating Your First Admin User

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add user" → "Create new user"
3. Enter email and password, check "Auto Confirm User"
4. Copy the generated UUID
5. Run this SQL in Supabase SQL Editor:

```sql
-- Replace 'YOUR_USER_UUID' with the actual UUID from step 4
DO $$
DECLARE
  user_uuid uuid := 'YOUR_USER_UUID';
  org_uuid uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Create organization
  INSERT INTO organizations (id, name, slug, created_at, updated_at)
  VALUES (
    org_uuid,
    'My Organization',
    'my-org',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name, slug = EXCLUDED.slug, updated_at = now();

  -- Create user profile
  INSERT INTO user_profiles (id, full_name, created_at, updated_at)
  VALUES (user_uuid, 'Admin User', now(), now())
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name, updated_at = now();

  -- Add user to organization as admin
  INSERT INTO org_members (org_id, user_id, role, joined_at)
  VALUES (org_uuid, user_uuid, 'admin', now())
  ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'admin';
END $$;
```

## Project Structure

```
grant-tracker-new/
├── api/                      # Vercel serverless functions
│   ├── grants/
│   │   ├── search.ts        # Proxy to Grants.gov Search2 API
│   │   └── details.ts       # Proxy to Grants.gov fetchOpportunity API
│   ├── saved/
│   │   └── [id]/
│   │       └── status.ts    # Update grant status/priority/assignment
│   ├── saved.ts             # CRUD for saved grants (auto-creates default tasks)
│   ├── tasks.ts             # CRUD for grant tasks
│   ├── views.ts             # CRUD for saved filter views
│   ├── recent-searches.ts   # Recent search history tracking
│   ├── webhooks.ts          # CRUD for custom webhooks
│   └── integrations.ts      # CRUD for integrations (Teams, Slack, etc.)
├── src/
│   ├── components/
│   │   ├── AppHeader.tsx    # Global header with navigation & user menu
│   │   ├── OrgSwitcher.tsx  # Organization selector dropdown
│   │   ├── UserMenu.tsx     # User profile dropdown menu
│   │   ├── SettingsLayout.tsx # Settings page layout with tabs
│   │   ├── ProtectedRoute.tsx # Route guard with permission checks
│   │   ├── QuickSearchModal.tsx # cmd/ctrl+K quick search modal
│   │   ├── SavedViewsPanel.tsx  # Saved filter views panel
│   │   ├── GrantDetailDrawer.tsx # Grant details with tasks and notes
│   │   └── TaskList.tsx     # Task management component with progress tracking
│   ├── contexts/
│   │   ├── AuthContext.tsx  # Supabase authentication context
│   │   └── OrganizationContext.tsx # Multi-org state management
│   ├── hooks/
│   │   └── usePermission.ts # Role-based permission checks
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client config
│   │   └── database.types.ts # Database TypeScript types
│   ├── pages/
│   │   ├── HomePage.tsx     # Marketing/landing page with mobile nav
│   │   ├── SignInPage.tsx   # Sign-in page with email/password
│   │   ├── DiscoverPage.tsx # Grant search & discovery with filters/sort
│   │   ├── SavedGrantsPage.tsx # Saved grants list view
│   │   ├── PipelinePage.tsx # Kanban board for grant workflow
│   │   ├── MetricsPage.tsx  # Value metrics and analytics
│   │   ├── FeaturesPage.tsx # Product features and roadmap
│   │   └── settings/
│   │       ├── ProfilePage.tsx        # User profile settings
│   │       ├── OrganizationPage.tsx   # Organization details & eligibility profile
│   │       ├── TeamPage.tsx           # Team member management
│   │       ├── NotificationsPage.tsx  # Email reminder settings
│   │       ├── CalendarPage.tsx       # ICS feed & integrations
│   │       ├── BillingPage.tsx        # Plan & billing (stub)
│   │       └── DangerZonePage.tsx     # Data export & org deletion
│   ├── types/
│   │   └── grants.ts        # Grant-related TypeScript types
│   ├── App.tsx              # App router and providers
│   ├── main.tsx             # React entry point
│   └── theme.ts             # Mantine theme config
├── supabase/
│   └── migrations/
│       ├── 20250108_create_org_grants_saved.sql
│       ├── 20250108_create_settings_and_org_schema.sql
│       ├── add_integrations.sql
│       ├── 20250112_add_search_features.sql
│       ├── 20250113_add_eligibility_profile.sql
│       ├── 20250114_add_pipeline_fields.sql
│       └── 20250115_add_grant_tasks.sql
├── vercel.json              # Vercel deployment config
└── package.json
```

## API Routes

### Grant Discovery

#### `POST /api/grants/search`

Proxies requests to Grants.gov Search2 API with validation and normalization.

**Request body:**
```json
{
  "keyword": "climate",
  "fundingCategories": "EN",
  "agencies": "EPA",
  "oppStatuses": "posted|forecasted",
  "rows": 25,
  "startRecordNum": 0
}
```

**Response:**
```json
{
  "grants": [...],
  "totalCount": 1234,
  "startRecord": 0,
  "pageSize": 25
}
```

#### `POST /api/grants/details`

Fetch full grant details from Grants.gov fetchOpportunity API.

**Request body:**
```json
{
  "id": "50283"
}
```

**Response:**
```json
{
  "id": "50283",
  "number": "PD-09-5761",
  "title": "Grant Title",
  "agency": "Agency Name",
  "description": "Full description...",
  "eligibility": "Unrestricted",
  "fundingInstrument": "Grant",
  "category": "Science and Technology",
  "estimatedFunding": "$1,000,000",
  "awardCeiling": "$100,000",
  "awardFloor": "$50,000",
  "expectedAwards": "10",
  "costSharing": "No",
  "postDate": "Nov 18, 2009",
  "closeDate": "Supplement Accepted Anytime",
  "grantsGovUrl": "https://www.grants.gov/search-results-detail/50283"
}
```

### Saved Grants

#### `GET /api/saved?org_id={uuid}`

Get all saved grants for an organization. Returns grants with status, priority, and assignment fields.

#### `POST /api/saved`

Save a grant to the pipeline. Automatically sets status to 'researching'.

**Request body:**
```json
{
  "org_id": "uuid",
  "user_id": "uuid",
  "external_id": "grant-id",
  "title": "Grant Title",
  "agency": "Agency Name",
  "aln": "12.345",
  "open_date": "2025-01-01",
  "close_date": "2025-03-01"
}
```

#### `DELETE /api/saved?id={uuid}`

Remove a saved grant from the pipeline.

#### `PATCH /api/saved/[id]/status`

Update grant status, priority, or assignment.

**Request body:**
```json
{
  "status": "drafting",
  "priority": "high",
  "assigned_to": "user-uuid",
  "notes": "Working on budget section"
}
```

### Saved Views

#### `GET /api/views?org_id={uuid}&user_id={uuid}`

Get all saved filter views (personal + team shared) for an organization.

**Response:**
```json
{
  "views": [
    {
      "id": "uuid",
      "name": "Education grants due soon",
      "description": "Education category, due in 30 days",
      "keyword": "education",
      "category": "ED",
      "is_shared": true,
      "use_count": 15
    }
  ]
}
```

#### `POST /api/views`

Create a new saved view.

**Request body:**
```json
{
  "org_id": "uuid",
  "created_by": "uuid",
  "name": "View Name",
  "description": "Optional description",
  "keyword": "climate",
  "category": "EN",
  "agency": "EPA",
  "status_posted": true,
  "status_forecasted": false,
  "due_in_days": 30,
  "sort_by": "due_soon",
  "is_shared": false
}
```

#### `PUT /api/views?id={uuid}`

Update a saved view (e.g., toggle sharing).

#### `DELETE /api/views?id={uuid}`

Delete a saved view.

#### `PATCH /api/views?id={uuid}`

Increment use_count when a view is loaded.

### Recent Searches

#### `GET /api/recent-searches?org_id={uuid}&user_id={uuid}`

Get recent search history for a user.

**Response:**
```json
{
  "searches": [
    {
      "id": "uuid",
      "keyword": "climate",
      "category": "EN",
      "search_count": 5,
      "last_searched_at": "2025-01-14T12:00:00Z"
    }
  ]
}
```

#### `POST /api/recent-searches`

Record a new search (deduplicates and increments count for existing searches).

### Grant Tasks

#### `GET /api/tasks?grant_id={uuid}&org_id={uuid}`

Get all tasks for a specific grant, ordered by position.

**Response:**
```json
{
  "tasks": [
    {
      "id": "uuid",
      "grant_id": "uuid",
      "org_id": "uuid",
      "title": "Research grant requirements",
      "description": "Review eligibility, requirements, and evaluation criteria",
      "task_type": "research",
      "status": "completed",
      "assigned_to": "user-uuid",
      "due_date": "2025-01-20T00:00:00Z",
      "completed_at": "2025-01-15T10:30:00Z",
      "position": 1,
      "is_required": true,
      "notes": "Reviewed all eligibility criteria"
    }
  ]
}
```

#### `POST /api/tasks`

Create a new task for a grant.

**Request body:**
```json
{
  "grant_id": "uuid",
  "org_id": "uuid",
  "created_by": "uuid",
  "title": "Custom task title",
  "description": "Optional description",
  "task_type": "custom",
  "status": "pending",
  "due_date": "2025-02-01T00:00:00Z",
  "is_required": false
}
```

**Task types:** `research`, `budget`, `narrative`, `letters`, `documents`, `submission`, `custom`

**Task statuses:** `pending`, `in_progress`, `completed`, `blocked`

#### `PATCH /api/tasks?id={uuid}`

Update an existing task (e.g., mark as completed, change due date).

**Request body:**
```json
{
  "status": "completed",
  "notes": "Task completed successfully"
}
```

#### `DELETE /api/tasks?id={uuid}`

Delete a task.

**Note:** When a grant is saved, 6 default tasks are automatically created via the `create_default_grant_tasks()` database function.

### Webhooks

#### `GET /api/webhooks?org_id={uuid}`

List all webhooks for an organization.

**Response:**
```json
{
  "webhooks": [
    {
      "id": "uuid",
      "org_id": "uuid",
      "name": "My Webhook",
      "url": "https://example.com/webhook",
      "events": ["grant.saved", "grant.deadline_approaching"],
      "is_active": true,
      "created_at": "2025-01-09T00:00:00Z"
    }
  ]
}
```

#### `POST /api/webhooks`

Create a new webhook. **Admin only**.

**Request body:**
```json
{
  "org_id": "uuid",
  "name": "My Webhook",
  "url": "https://example.com/webhook",
  "secret": "optional-signing-secret",
  "events": ["grant.saved", "grant.deadline_approaching"]
}
```

#### `PATCH /api/webhooks?id={uuid}`

Update an existing webhook. **Admin only**.

#### `DELETE /api/webhooks?id={uuid}`

Delete a webhook. **Admin only**.

### Integrations

#### `GET /api/integrations?org_id={uuid}`

List all integrations for an organization.

**Response:**
```json
{
  "integrations": [
    {
      "id": "uuid",
      "org_id": "uuid",
      "integration_type": "microsoft_teams",
      "webhook_url": "https://...webhook.office.com/...",
      "is_active": true,
      "connected_at": "2025-01-09T00:00:00Z"
    }
  ]
}
```

#### `POST /api/integrations`

Connect a new integration. **Admin only**.

**Request body (Microsoft Teams):**
```json
{
  "org_id": "uuid",
  "integration_type": "microsoft_teams",
  "webhook_url": "https://yourorg.webhook.office.com/webhookb2/..."
}
```

#### `DELETE /api/integrations?org_id={uuid}&integration_type={type}`

Disconnect an integration. **Admin only**.

## Database Schema

### Core Tables

#### `organizations`
Organization details, metadata, and eligibility profile.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Organization name |
| slug | text | URL-safe slug (unique) |
| primary_state | text | Primary state/region |
| focus_areas | text[] | Array of focus areas |
| logo_url | text | Logo image URL |
| org_size | text | Organization size/type (small, medium, large, nonprofit, government, educational) |
| annual_budget_range | text | Annual budget range (0-100k, 100k-500k, 500k-1m, 1m-5m, 5m-10m, 10m+) |
| primary_locations | text[] | Array of state codes or regions |
| service_areas | text[] | Geographic areas where services are provided |
| focus_categories | text[] | Array of funding category codes (AG, AR, ED, etc.) |
| min_grant_amount | numeric | Minimum grant amount of interest |
| max_grant_amount | numeric | Maximum grant amount of interest |
| eligibility_notes | text | Additional eligibility context |
| auto_filter_enabled | boolean | Enable automatic filtering based on profile |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

**RLS**: Users can view organizations they're members of. Only admins can update.

#### `user_profiles`
User profile information.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key (matches auth.users.id) |
| full_name | text | User's full name |
| avatar_url | text | Avatar image URL |
| timezone | text | User's timezone (default: America/New_York) |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

**RLS**: Users can view and update their own profile only.

#### `org_members`
Organization membership and roles.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| org_id | uuid | Organization ID |
| user_id | uuid | User ID |
| role | text | 'admin' or 'contributor' |
| joined_at | timestamptz | When user joined |
| invited_by | uuid | User who sent invitation |

**RLS**: Users can view members of their organizations. Only admins can insert/update/delete.

#### `team_invitations`
Pending team invitations.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| org_id | uuid | Organization ID |
| email | text | Invitee email |
| role | text | 'admin' or 'contributor' |
| invited_by | uuid | User who sent invitation |
| invited_at | timestamptz | Invitation timestamp |
| expires_at | timestamptz | Expiration timestamp |
| accepted_at | timestamptz | Acceptance timestamp |
| revoked_at | timestamptz | Revocation timestamp |

**RLS**: Users can view invitations for their organizations. Only admins can insert/update/delete.

#### `user_preferences`
User-specific preferences.

| Column | Type | Description |
|--------|------|-------------|
| user_id | uuid | Primary key (user ID) |
| weekly_summary_emails | boolean | Receive weekly summary emails |
| product_updates | boolean | Receive product update emails |
| updated_at | timestamptz | Last update timestamp |

**RLS**: Users can view and update their own preferences only.

#### `organization_settings`
Organization-wide settings.

| Column | Type | Description |
|--------|------|-------------|
| org_id | uuid | Primary key (organization ID) |
| deadline_reminders_30d | boolean | Send 30-day deadline reminders |
| deadline_reminders_14d | boolean | Send 14-day deadline reminders |
| deadline_reminders_7d | boolean | Send 7-day deadline reminders |
| deadline_reminders_3d | boolean | Send 3-day deadline reminders |
| deadline_reminders_1d | boolean | Send 1-day deadline reminders |
| deadline_reminders_0d | boolean | Send day-of deadline reminders |
| daily_task_emails | boolean | Send daily task summary emails |
| ics_token | uuid | Secret token for ICS feed URL |
| google_calendar_connected | boolean | Google Calendar connection status |
| google_calendar_token | text | Google Calendar OAuth token |
| plan_name | text | Current plan name |
| plan_status | text | Current plan status |
| trial_ends_at | timestamptz | Trial end timestamp |
| next_renewal_at | timestamptz | Next billing renewal |
| updated_at | timestamptz | Last update timestamp |

**RLS**: Users can view settings for their organizations. Only admins can update.

#### `org_grants_saved`
Saved grant opportunities with pipeline workflow tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| org_id | uuid | Organization ID |
| user_id | uuid | User who saved it |
| external_source | text | 'grants.gov' |
| external_id | text | Grants.gov opportunity ID |
| title | text | Grant title |
| agency | text | Agency name |
| aln | text | Assistance Listing Number |
| open_date | timestamptz | Open date |
| close_date | timestamptz | Close date |
| status | text | Pipeline status (researching, drafting, submitted, awarded, rejected, withdrawn) |
| priority | text | Priority level (low, medium, high, urgent) |
| assigned_to | uuid | User assigned to this grant |
| stage_updated_at | timestamptz | When status last changed (auto-updated by trigger) |
| notes | text | Internal notes |
| saved_at | timestamptz | When saved |
| created_at | timestamptz | Row creation time |

**Unique constraint**: (org_id, external_source, external_id)

**RLS**: Users can view/insert/delete grants for their organization only.

#### `recent_searches`
Recent search query tracking for quick access.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| org_id | uuid | Organization ID |
| user_id | uuid | User who searched |
| keyword | text | Search keyword |
| category | text | Funding category code |
| agency | text | Agency name |
| status_posted | boolean | Include posted grants |
| status_forecasted | boolean | Include forecasted grants |
| due_in_days | integer | Due in X days filter |
| search_count | integer | Number of times used |
| last_searched_at | timestamptz | Last search timestamp |
| created_at | timestamptz | First search timestamp |

**Unique constraint**: (org_id, user_id, keyword, category, agency)

**RLS**: Users can view/insert/update/delete their own searches only.

#### `saved_views`
Saved filter configurations (shareable within organization).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| org_id | uuid | Organization ID |
| created_by | uuid | User who created it |
| name | text | View name |
| description | text | Optional description |
| keyword | text | Search keyword |
| category | text | Funding category code |
| agency | text | Agency name |
| status_posted | boolean | Include posted grants |
| status_forecasted | boolean | Include forecasted grants |
| due_in_days | integer | Due in X days filter |
| sort_by | text | Sort order (relevance, due_soon, newest) |
| is_shared | boolean | Shared with team |
| use_count | integer | Number of times loaded |
| last_used_at | timestamptz | Last use timestamp |
| created_at | timestamptz | Creation timestamp |

**Unique constraint**: (org_id, created_by, name)

**RLS**: Users can view shared views + their own views; only creators can update/delete.

#### `grant_interactions`
User interactions with grants for recommendation engine training.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| org_id | uuid | Organization ID |
| user_id | uuid | User who interacted |
| external_id | text | Grant external ID |
| interaction_type | text | saved, viewed, declined, submitted |
| created_at | timestamptz | Interaction timestamp |

**Unique constraint**: (org_id, user_id, external_id, interaction_type)

**RLS**: Users can view/insert interactions for their organization only.

#### `grant_tasks`
Task breakdown for grant application workflow management.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| grant_id | uuid | Reference to org_grants_saved |
| org_id | uuid | Organization ID |
| title | text | Task title |
| description | text | Task description |
| task_type | text | Task category (research, budget, narrative, letters, documents, submission, custom) |
| status | text | Task status (pending, in_progress, completed, blocked) |
| assigned_to | uuid | User assigned to task |
| due_date | timestamptz | Task due date |
| completed_at | timestamptz | When task was completed (auto-set by trigger) |
| completed_by | uuid | User who completed task (auto-set by trigger) |
| position | integer | Display order position |
| is_required | boolean | Whether task is required for submission |
| notes | text | Internal notes |
| created_by | uuid | User who created task |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp (auto-updated by trigger) |

**RLS**: Users can view/insert/update/delete tasks for grants in their organization.

**Default Tasks**: When a grant is saved, 6 default tasks are automatically created via `create_default_grant_tasks(grant_id, org_id, user_id)` function:
1. Research grant requirements (research)
2. Draft project narrative (narrative)
3. Prepare budget (budget)
4. Gather supporting documents (documents)
5. Obtain letters of support (letters)
6. Submit application (submission)

### Integration Tables

#### `integrations`
OAuth-based integrations (Slack, Teams, Google Calendar).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| org_id | uuid | Organization ID |
| integration_type | text | 'slack', 'microsoft_teams', 'google_calendar' |
| access_token | text | OAuth access token |
| refresh_token | text | OAuth refresh token |
| token_expires_at | timestamptz | Token expiration |
| webhook_url | text | For Teams incoming webhooks |
| channel_id | text | For Slack channel ID |
| channel_name | text | For Slack channel name |
| connected_by | uuid | User who connected |
| connected_at | timestamptz | Connection timestamp |
| settings | jsonb | Additional settings |
| is_active | boolean | Active status |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

**Unique constraint**: (org_id, integration_type)

**RLS**: Users can view integrations for their organizations. Only admins can manage.

#### `webhooks`
Custom webhook configurations.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| org_id | uuid | Organization ID |
| name | text | Webhook name |
| url | text | Webhook endpoint URL |
| secret | text | Optional signing secret |
| events | text[] | Subscribed events |
| is_active | boolean | Active status |
| created_by | uuid | User who created |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |
| last_triggered_at | timestamptz | Last delivery timestamp |
| total_deliveries | integer | Total delivery count |
| failed_deliveries | integer | Failed delivery count |

**RLS**: Users can view webhooks for their organizations. Only admins can manage.

#### `webhook_deliveries`
Webhook delivery log.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| webhook_id | uuid | Webhook ID |
| event_type | text | Event type |
| payload | jsonb | Event payload |
| response_status | integer | HTTP response status |
| response_body | text | HTTP response body |
| delivered_at | timestamptz | Delivery timestamp |
| error_message | text | Error message if failed |

**RLS**: Users can view deliveries for their organization's webhooks.

## Webhook Events

Webhooks can subscribe to the following events:

### `grant.saved`
Triggered when a grant is added to the organization's saved pipeline.

**Payload:**
```json
{
  "event": "grant.saved",
  "timestamp": "2025-01-09T12:00:00Z",
  "data": {
    "grant_id": "uuid",
    "external_id": "50283",
    "title": "Grant Title",
    "agency": "Agency Name",
    "close_date": "2025-03-01",
    "saved_by": "user@example.com"
  }
}
```

### `grant.deadline_approaching`
Triggered when a grant deadline is approaching (configured days before).

**Payload:**
```json
{
  "event": "grant.deadline_approaching",
  "timestamp": "2025-01-09T12:00:00Z",
  "data": {
    "grant_id": "uuid",
    "title": "Grant Title",
    "agency": "Agency Name",
    "close_date": "2025-01-16",
    "days_until_deadline": 7
  }
}
```

### `grant.deadline_passed`
Triggered when a grant deadline has passed.

### `grant.updated`
Triggered when grant information is updated.

## Deployment

### Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Set environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

The `/api` directory will be automatically deployed as serverless functions.

## Features Implemented

### v1 Complete Features

**Authentication & Authorization**
- ✅ Email/password sign-in
- ✅ Supabase Auth integration
- ✅ Protected routes with permission checks
- ✅ Role-based access control (Admin/Contributor)

**Grant Discovery & Search**
- ✅ Advanced search with Grants.gov API integration
- ✅ Multi-dimensional filters (category, agency, status, due ≤ X days)
- ✅ Multi-sort options (relevance, due soon, newest)
- ✅ Enhanced grant cards with hover effects
- ✅ Grant details modal with HTML parsing for clean display
- ✅ Quick search modal (cmd/ctrl+K keyboard shortcut)
- ✅ Recent search tracking with usage counts
- ✅ Saved views (personal and team-shared filter configurations)
- ✅ Eligibility profile for grant recommendations
- ✅ Grant interaction tracking for ML training
- ✅ Save/unsave grants to organization pipeline
- ✅ Proper error handling with fallback links

**Organizations & Teams**
- ✅ Multi-organization support with org switching
- ✅ Team member management and invitations
- ✅ Organization detail management with eligibility profile
- ✅ User profile management

**Pipeline & Workflow Management**
- ✅ Kanban board with 4 pipeline stages (Researching → Drafting → Submitted → Awarded)
- ✅ Native HTML5 drag-and-drop between stages
- ✅ Automatic status change timestamp tracking
- ✅ Priority levels (low, medium, high, urgent)
- ✅ Grant assignment to team members
- ✅ Visual deadline indicators (color-coded)
- ✅ Stage counts and visual grouping
- ✅ Notes field for internal tracking
- ✅ Grant detail drawer with tabs (Tasks, Notes)
- ✅ Task management system with CRUD operations
- ✅ Auto-created default task templates (6 tasks per grant)
- ✅ Task progress tracking with completion percentage
- ✅ Task types and status tracking
- ✅ Task due dates and completion timestamps
- ✅ Required vs optional task flags

**Calendar & Integrations**
- ✅ ICS calendar feed with unique tokens
- ✅ Microsoft Teams webhook integration
- ✅ Custom webhooks with CRUD operations
- ✅ Webhook event subscription management
- ✅ Integration status tracking

**Settings & Preferences**
- ✅ 7 settings pages (Profile, Organization, Team, Notifications, Calendar, Billing, Danger Zone)
- ✅ Customizable email reminder cadence
- ✅ User preference management
- ✅ Admin-only controls

**UI/UX**
- ✅ Responsive design with Mantine UI
- ✅ Mobile navigation with burger menu
- ✅ Desktop navigation with active states
- ✅ Loading states and error handling
- ✅ Toast notifications for user feedback

**Security**
- ✅ Row Level Security (RLS) on all database tables
- ✅ Admin-only API endpoints
- ✅ Bearer token authentication
- ✅ URL validation for webhooks

### Future Enhancements

**Integrations & Notifications**
- Google Calendar OAuth integration
- Slack OAuth integration
- Actual email notification delivery (backend workers)
- Webhook delivery retry logic
- Webhook signature verification

**Workflow Automation**
- Workflow automation rules (auto-move grants based on criteria)
- Task assignment to specific users with notifications
- Task comments and collaboration
- Task dependencies and blockers
- Grant application templates
- Document management and file uploads
- Bulk task operations (complete multiple, reorder, duplicate)

**Analytics & Insights**
- Analytics and reporting dashboards
- Success rate tracking by category/agency
- Team performance metrics
- ML-based recommendation engine (using grant_interactions data)

**Business Features**
- Real billing integration (Stripe)
- Export data functionality (CSV, JSON, PDF reports)
- Advanced search with Boolean operators
- State and foundation grant portals integration
- Grant writing AI assistance

## API Reference

- [Grants.gov Search2 API](https://grants.gov/api/common/search2)
- [Grants.gov fetchOpportunity API](https://grants.gov/api/common/fetchOpportunity)
- [Grants.gov API Guide](https://grants.gov/api/api-guide)
- [Supabase Documentation](https://supabase.com/docs)
- [Mantine UI](https://mantine.dev)

## License

MIT
