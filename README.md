# Grantcue - Discover & Manage Federal Grants

**[grantcue.com](https://grantcue.com)**

A comprehensive grant discovery and workflow management platform that helps organizations find, track, and manage federal grant opportunities from Grants.gov.

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
- **Self-Service Sign-Up**: New user registration with email confirmation
- **Secure Sign-In**: Email/password authentication via Supabase Auth
- **Magic Link Authentication**: Passwordless sign-in via email OTP links
- **User Profiles**: Manage personal profile information and preferences
- **Protected Routes**: Role-based access control for sensitive features
- **API Authentication**: Bearer token authentication on all API endpoints

### Multi-Source Grant Ingestion
- **Source Adapter Architecture**: Extensible adapter pattern for multiple grant sources
- **Grants.gov Integration**: Automated sync with federal grant database
- **Custom Grant Entry**: Manual grant entry with full validation
- **Automated Nightly Sync**: Vercel cron job for incremental updates (2 AM daily)
- **De-duplication Engine**: Content hash-based matching with fuzzy title comparison
- **Sync Job Tracking**: Comprehensive logging of sync operations, errors, and metrics
- **Admin Sync Controls**: Manual full/incremental sync triggers with source management
- **Full-Text Search**: PostgreSQL tsvector for fast grant catalog searches

### Import & Migration
- **CSV Import Wizard**: Multi-step wizard for bulk importing grants from CSV files
- **Flexible Field Mapping**: Visual column mapping UI with auto-detection of common field names
- **Platform-Specific Presets**: Auto-detection and field mapping for GrantHub, Instrumentl, Foundation Search, Candid, and Grants.gov exports
- **Smart Field Mapping**: Automatic detection of CSV columns with user-adjustable mapping
- **Enhanced Validation**: Comprehensive data validation with error and warning reporting
  - Required field validation (Grant Title)
  - Date format validation with helpful error messages
  - Missing field warnings (agency, close date)
  - Row-level issue tracking with severity levels
- **Data Preview & Quality Indicators**: Preview and validate data before importing with visual quality badges
- **Duplicate Detection**: Automatic detection and skipping of duplicate grants based on title + agency matching
- **Bulk Import API**: Efficient batch processing for importing multiple grants at once
- **Progress Tracking**: Real-time import progress with success/skipped/failure reporting
- **GrantHub Migration Tool**: Dedicated `/import/granthub` page for GrantHub users
- **Migration Landing Page**: Comprehensive `/granthub-migration` guide with deadline messaging, FAQs, and step-by-step instructions
- **PDF/Print Export**: Generate professional grant briefs and board packets for presentations
- **CSV Export**: Export saved grants and pipeline data with proper escaping and full field support
  - Exports all fields: title, agency, ALN, status, priority, dates, assigned to, notes, external ID
  - Proper CSV escaping for commas, quotes, and newlines
  - Filename includes current date: `grants-export-2025-01-21.csv`
  - Perfect for board reports, Excel analysis, and data archival
  - Usage: `GET /api/saved?org_id={uuid}&format=csv`

### Pipeline & Workflow Management
- **Kanban Board**: Visual pipeline with 4 stages (Researching → Drafting → Submitted → Awarded)
- **Drag-and-Drop**: Native HTML5 drag-and-drop to move grants between stages
- **Status Tracking**: Automatic timestamp tracking when grants move between stages
- **Priority Levels**: Assign priority (low, medium, high, urgent) to saved grants
- **Deadline Indicators**: Color-coded visual indicators for approaching and overdue deadlines
- **Assignment**: Assign grants to team members for accountability
- **Stage Counts**: Real-time count of grants in each pipeline stage
- **Grant Detail Drawer**: Click any grant card to open detailed view with tasks, budget, payments, compliance, and notes
  - **Notes Management**: Add and edit grant notes with rich text editing interface
  - **Editable Notes Tab**: In-line text editing with save/cancel controls
- **Task Management**: Break down each grant into actionable subtasks with progress tracking
- **Default Task Templates**: Auto-created task list (Research, Narrative, Budget, Documents, Letters, Submission)
- **Task Checklist**: Mark tasks complete with visual progress indicator
- **Task Types**: Categorize tasks (research, budget, narrative, letters, documents, submission, custom)
- **Task Due Dates**: Set deadlines for individual tasks
- **Task Status**: Track task state (pending, in_progress, completed, blocked)
- **Task Assignments**: Assign specific tasks to team members (coming soon)
- **Description Previews**: Grant cards display truncated description preview (200 chars on SavedGrantsPage, 150 chars on PipelinePage)
  - Automatically fetches and stores description when saving grants
  - HTML content automatically stripped for clean display
  - Line-clamped to 2 lines for consistent card layout

### Organization & Team Management
- **Multi-Organization Support**: Switch between multiple organizations with persistent context
- **Team Collaboration**: Invite team members with role-based permissions (Admin/Contributor)
- **Organization Settings**: Configure organization name, primary state, and focus areas
- **Admin Controls**: Admin-only features for sensitive operations

### Calendar & Integrations
- **ICS Calendar Feed**: Subscribe to grant deadlines in any calendar app (Google Calendar, Outlook, Apple Calendar)
  - Token-based authentication for secure calendar feeds
  - Automatic event generation for all grant close dates
  - VEVENT format with grant details, agency, and Grants.gov URLs
  - Real-time updates as grants are saved or modified
- **Microsoft Teams**: Connect Teams channels for deadline notifications via incoming webhooks
- **Custom Webhooks**: Configure custom webhook endpoints to receive grant events
- **Webhook Events**: grant.saved, grant.deadline_approaching, grant.deadline_passed, grant.updated
- **Google Calendar**: OAuth integration (coming soon)
- **Slack**: OAuth integration (coming soon)

### Notifications & Reminders
- **Grant Alerts**: Create custom alerts for new grants matching specific criteria (keyword, category, agency, amount range, due date)
- **Email Alert Notifications**: Automatic email notifications when new grants match your saved alerts
- **Alert Frequency**: Choose how often alerts are checked (realtime, daily, weekly)
- **Alert Channels**: Notify via email, in-app notifications, or custom webhooks
- **Automated Alert Checking**: Cron job runs every 6 hours to check for new matching grants
- **Alert Match Tracking**: Track which grants triggered which alerts with match history
- **In-App Notifications**: Real-time notification center for grant alerts, deadlines, and team updates
- **Email Reminders**: Customizable deadline reminder cadence (30d, 14d, 7d, 3d, 1d, day-of) via Resend
- **Daily Task Emails**: Optional daily summary emails
- **User Preferences**: Control email notification preferences
- **Transactional Emails**: Team invitations, password resets, and notifications

### Activity Feed & Audit Log
- **Comprehensive Activity Tracking**: Automatic logging of all changes to grants
- **Timeline View**: Beautiful timeline interface with user avatars and color-coded actions
- **Tracked Actions**: Grant saved, status changed, priority changed, assigned, notes added/updated/deleted
- **Change History**: See old value → new value for all field updates
- **User Attribution**: Every action is tied to the user who performed it
- **Filter Controls**: Filter by action type (status changed, priority changed, assigned, etc.)
- **Grant History**: View full activity log for individual grants
- **Organization-Wide View**: See all activity across your organization
- **Real-Time Updates**: Refresh to see latest changes from your team
- **Database Triggers**: Automatic capture of all changes with no manual logging required
- **Access Control**: Activity logs respect organization membership via RLS policies
- **Page**: `/activity` - Centralized activity feed for your organization

### Post-Award Financials & Compliance
- **Budget Tab**: Comprehensive budget management integrated into Grant Detail Drawer
  - Mini P&L showing proposed vs. awarded vs. spent by cost category
  - Burn-down chart with visual progress bars and remaining budget
  - 11 cost categories: Personnel, fringe benefits, travel, equipment, supplies, contractual, construction, other direct costs, indirect costs, in-kind match, cash match
  - Variance indicators with color-coded alerts (green/yellow/red)
  - Match & cost share tracking with ring progress visualization
  - Average daily spending rate with depletion estimates
  - Budget line items with detailed breakdowns and descriptions
- **Payment Schedule Tab**: Drawdown planning and payment tracking
  - Upcoming payments with deadline-style indicators (overdue/due soon/future)
  - Color-coded status badges for payment status
  - Report submission requirement tracking with warnings
  - Deliverable requirements display
  - Received payments timeline with actual vs. expected amounts
  - Alerts for payments requiring reports within 30 days
  - Relative time displays ("due in 5 days", "overdue by 3 days")
  - Payment types: Advance, reimbursement, cost reimbursement, milestone-based, quarterly, annual
- **Compliance Tab**: Regulatory and policy compliance tracking
  - Visual compliance completeness progress bar showing percentage complete
  - Critical requirements section with prominent red alerts
  - Requirements grouped by type in accordion interface
  - Compliance types: Federal/state regulations, indirect cost agreements, match requirements, audit requirements, reporting, certifications, policies
  - Due dates with relative time indicators
  - Documentation requirement badges
  - Policy reference links with external link icons
  - Overdue and upcoming compliance warnings
  - Interactive completion checkboxes with timestamp tracking
  - **Full CRUD Interface**: Add, edit, and delete compliance requirements
  - **Add Requirement Modal**: Comprehensive form with 9 fields (type, title, description, regulation reference, policy URL, due date, documentation required, critical flag, notes)
  - **Inline Editing**: Edit and delete icons on each requirement card
  - **Real-time Updates**: Instant cache invalidation and UI refresh using React Query
- **Backend Infrastructure**:
  - Disbursement tracking: Log expenses and payments with approval workflow
  - Payment methods: ACH, wire, check, credit card, in-kind contributions
  - Receipt management: Attach receipt URLs and documentation
  - Automatic calculations: Database triggers update totals when disbursements are added/approved
  - Summary views: Pre-built views for budget summaries and compliance status
  - Row Level Security: All data isolated by organization membership

### Settings & Management
- **7 Settings Pages**: Profile, Organization, Team, Notifications, Alerts, Calendar & Integrations, Billing, Danger Zone
- **Responsive Design**: Built with Mantine UI for a modern, mobile-friendly experience
- **Mobile Navigation**: Burger menu with drawer navigation on mobile devices
- **Role-Based Access**: Admin-only controls for sensitive settings

## Tech Stack

**Frontend**
- **Framework**: React 19, TypeScript, Vite
- **UI Library**: Mantine v8
- **Routing**: React Router v7
- **Data Fetching**: TanStack Query v5
- **Drag & Drop**: @dnd-kit (core, sortable, utilities)
- **Date Handling**: dayjs

**Backend & Infrastructure**
- **Hosting**: Vercel (Serverless Functions + Edge Network)
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Authentication**: Supabase Auth
- **Email Delivery**: Resend (integrated with Supabase & Vercel)
- **Domain**: grantcue.com

## Getting Started

### Environment Variables

Set up the following environment variables in your `.env` file:

**Client-side variables (Vite):**
```
VITE_SUPABASE_URL=your-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Server-side variables (API routes):**
```
SUPABASE_URL=your-project-url.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
RESEND_API_KEY=your-resend-api-key
CRON_SECRET=your-cron-secret
```

**Note**: Use `VITE_` prefix for client-side environment variables (Vite framework). The API routes use non-prefixed variables for server-side operations.

### Database Setup

Set up the database by running the migrations in your Supabase SQL editor:

Run the migrations in your Supabase SQL editor (in order):

- `supabase/migrations/20250108_create_org_grants_saved.sql` - Creates the saved grants table
- `supabase/migrations/20250108_create_settings_and_org_schema.sql` - Creates organizations, user profiles, team members, invitations, preferences, and settings tables with RLS policies
- `supabase/migrations/20250109_add_value_metrics_tracking.sql` - Creates value metrics tracking for ROI calculations
- `supabase/migrations/20250110_auto_create_organization.sql` - Adds trigger to auto-create organization on user signup
- `supabase/migrations/20250111_fix_org_members_rls.sql` - Fixes RLS policies for organization members
- `supabase/migrations/20250112_add_search_features.sql` - Creates recent_searches, saved_views, and grant_interactions tables
- `supabase/migrations/20250113_add_eligibility_profile.sql` - Adds eligibility profile fields to organizations table and grant recommendations view
- `supabase/migrations/20250114_add_pipeline_fields.sql` - Adds pipeline status, priority, and assignment fields to saved grants
- `supabase/migrations/20250115_add_grant_tasks.sql` - Creates grant_tasks table for actionable task breakdown with auto-created templates
- `supabase/migrations/20250116_add_grant_alerts.sql` - Creates grant alerts and notification system
- `supabase/migrations/20250117_multi_source_ingestion.sql` - Creates multi-source grant ingestion system (grant_sources, grants_catalog, sync_jobs, de-duplication)
- `supabase/migrations/20250118_fix_status_constraint.sql` - Fixes status check constraint
- `supabase/migrations/20250119_add_user_profiles_foreign_key.sql` - Adds foreign key from org_members to user_profiles for PostgREST joins and RPC function for large teams
- `supabase/migrations/20250120_fix_grant_org_id.sql` - Ensures all grants have valid org_id (data integrity fix)
- `supabase/migrations/20250121_add_activity_log.sql` - Creates grant_activity_log table with automatic triggers for all grant changes
- `supabase/migrations/20250122_add_post_award_financials.sql` - Creates post-award budget tracking, disbursements, payment schedules, and compliance requirements with automatic calculations and null-safe triggers
- `supabase/migrations/20250123_add_grant_description.sql` - Adds description column to org_grants_saved for card previews
- `supabase/migrations/add_integrations.sql` - Creates integrations, webhooks, and webhook_deliveries tables

**Note**: All migrations are idempotent and can be run multiple times safely.

## Project Structure

```
grant-tracker-new/
├── api/                      # Vercel serverless functions
│   ├── admin/
│   │   └── sync.ts          # Admin sync management (manual full/incremental sync)
│   ├── alerts/
│   │   └── check.ts         # Alert checking worker (cron job every 6 hours)
│   ├── calendar/
│   │   └── [orgId]/
│   │       └── [token].ts   # ICS calendar feed endpoint (public with token auth)
│   ├── cron/
│   │   └── sync-grants.ts   # Automated nightly sync job (2 AM)
│   ├── grants/
│   │   ├── search.ts        # Proxy to Grants.gov Search2 API
│   │   ├── details.ts       # Proxy to Grants.gov fetchOpportunity API
│   │   └── custom.ts        # Custom grant entry endpoint
│   ├── saved-status.ts      # Update grant status/priority/assignment (auth required)
│   ├── saved.ts             # CRUD for saved grants with CSV export (auth required)
│   ├── activity.ts          # Activity log / audit trail API (auth required)
│   ├── import.ts            # Bulk grant import endpoint (auth required)
│   ├── tasks.ts             # CRUD for grant tasks (auth required)
│   ├── views.ts             # CRUD for saved filter views (auth required)
│   ├── recent-searches.ts   # Recent search history tracking
│   ├── alerts.ts            # CRUD for grant alerts (auth required)
│   ├── budgets.ts           # Budget tracking with line items and summaries
│   ├── disbursements.ts     # Expense and payment tracking with approval
│   ├── payment-schedules.ts # Payment schedules and drawdown planning
│   ├── compliance.ts        # Compliance requirements and tracking
│   ├── webhooks.ts          # CRUD for custom webhooks
│   └── integrations.ts      # CRUD for integrations (Teams, Slack, etc.)
├── lib/
│   └── grants/
│       ├── types.ts         # Grant ingestion type definitions
│       ├── SyncService.ts   # Sync orchestration service
│       └── adapters/
│           ├── BaseGrantAdapter.ts    # Abstract base adapter
│           ├── GrantsGovAdapter.ts    # Grants.gov implementation
│           ├── OpenGrantsAdapter.ts   # OpenGrants implementation
│           └── CustomGrantAdapter.ts  # Custom grant entry validation
├── src/
│   ├── components/
│   │   ├── AppHeader.tsx         # Global header with navigation & user menu
│   │   ├── MarketingHeader.tsx   # Shared marketing header for public pages
│   │   ├── OrgSwitcher.tsx       # Organization selector dropdown
│   │   ├── UserMenu.tsx          # User profile dropdown menu
│   │   ├── SettingsLayout.tsx    # Settings page layout with tabs
│   │   ├── ProtectedRoute.tsx    # Route guard with permission checks
│   │   ├── QuickSearchModal.tsx  # cmd/ctrl+K quick search modal
│   │   ├── SavedViewsPanel.tsx   # Saved filter views panel
│   │   ├── GrantDetailDrawer.tsx # Grant details with tasks, budget, payments, compliance, and notes
│   │   ├── TaskList.tsx          # Task management component with progress tracking
│   │   ├── BudgetTab.tsx         # Budget tracking with mini P&L, burn-down chart, and variance indicators
│   │   ├── PaymentScheduleTab.tsx # Payment schedules with deadline indicators and report tracking
│   │   ├── ComplianceTab.tsx     # Compliance requirements with completeness bar and critical alerts
│   │   ├── CustomGrantForm.tsx   # Manual grant entry form with validation
│   │   ├── GrantFilters.tsx      # Reusable filter component for status/priority/assignee
│   │   ├── SaveToPipelineModal.tsx # Modal for configuring grant on save
│   │   └── ImportWizard.tsx      # Multi-step CSV import wizard
│   ├── contexts/
│   │   ├── AuthContext.tsx  # Supabase authentication context
│   │   └── OrganizationContext.tsx # Multi-org state management
│   ├── hooks/
│   │   └── usePermission.ts # Role-based permission checks
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client config
│   │   └── database.types.ts # Database TypeScript types
│   ├── utils/
│   │   ├── csvParser.ts     # CSV parsing utility with delimiter detection
│   │   ├── csvUtils.ts      # CSV generation, escaping, and security utilities
│   │   ├── fieldMapper.ts   # Platform-specific field mapping presets
│   │   ├── printGrant.ts    # Individual grant brief PDF generator
│   │   └── printBoardPacket.ts # Multi-grant board packet PDF generator with CSV export
│   ├── pages/
│   │   ├── HomePage.tsx            # Marketing/landing page with mobile nav
│   │   ├── SignInPage.tsx          # Sign-in page with email/password
│   │   ├── SignUpPage.tsx          # User registration with email confirmation
│   │   ├── DiscoverPage.tsx        # Grant search & discovery with filters/sort
│   │   ├── SavedGrantsPage.tsx     # Saved grants list view
│   │   ├── PipelinePage.tsx        # Kanban board for grant workflow
│   │   ├── MetricsPage.tsx         # Value metrics and analytics
│   │   ├── ActivityPage.tsx        # Activity feed / audit log timeline view
│   │   ├── FeaturesPage.tsx        # Product features and roadmap
│   │   ├── PricingPage.tsx         # Pricing tiers and plans
│   │   ├── PrivacyPage.tsx         # Privacy policy with public header
│   │   ├── GrantHubImportPage.tsx  # GrantHub CSV import wizard with field mapping and validation
│   │   ├── GrantHubMigrationPage.tsx # GrantHub migration landing page with deadline messaging and FAQs
│   │   ├── admin/
│   │   │   └── SyncManagementPage.tsx # Admin sync controls and source management
│   │   └── settings/
│   │       ├── ProfilePage.tsx        # User profile settings
│   │       ├── OrganizationPage.tsx   # Organization details & eligibility profile
│   │       ├── TeamPage.tsx           # Team member management
│   │       ├── NotificationsPage.tsx  # Email reminder settings
│   │       ├── AlertsPage.tsx         # Grant alert configuration
│   │       ├── CalendarPage.tsx       # ICS feed & integrations
│   │       ├── BillingPage.tsx        # Plan & billing
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
│       ├── 20250109_add_value_metrics_tracking.sql
│       ├── 20250110_auto_create_organization.sql
│       ├── 20250111_fix_org_members_rls.sql
│       ├── 20250112_add_search_features.sql
│       ├── 20250113_add_eligibility_profile.sql
│       ├── 20250114_add_pipeline_fields.sql
│       ├── 20250115_add_grant_tasks.sql
│       ├── 20250116_add_grant_alerts.sql
│       ├── 20250117_multi_source_ingestion.sql
│       ├── 20250118_fix_status_constraint.sql
│       ├── 20250119_add_user_profiles_foreign_key.sql
│       ├── 20250120_fix_grant_org_id.sql
│       ├── 20250121_add_activity_log.sql
│       ├── 20250122_add_post_award_financials.sql
│       └── add_integrations.sql
├── vercel.json              # Vercel deployment config (includes cron jobs)
└── package.json
```

## Application Routes

### Public Routes
- `/` - Marketing homepage
- `/signin` - User sign-in page
- `/signup` - Self-service user registration with email confirmation
- `/pricing` - Pricing tiers and plans
- `/features` - Product features and capabilities
- `/privacy` - Privacy policy
- `/granthub-migration` - Comprehensive migration guide for GrantHub users with deadline messaging and FAQs

### Protected Routes (Require Authentication)
- `/discover` - Grant search and discovery
- `/saved` - Saved grants list view
- `/pipeline` - Kanban pipeline board
- `/metrics` - Value metrics and ROI tracking
- `/import/granthub` - GrantHub CSV import wizard with field mapping and validation

### Settings Routes (Require Authentication)
- `/settings/profile` - User profile management
- `/settings/organization` - Organization details and eligibility profile
- `/settings/team` - Team member management
- `/settings/notifications` - Email notification preferences
- `/settings/alerts` - Grant alert configuration
- `/settings/calendar` - ICS feed and integrations
- `/settings/billing` - Plan and billing management
- `/settings/danger-zone` - Data export and organization deletion

### Admin Routes (Require Admin Role)
- `/admin/sync` - Grant sync management and source configuration

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

### Multi-Source Grant Ingestion

#### `POST /api/grants/custom`

Submit a custom grant entry. **Requires authentication**.

**Request body:**
```json
{
  "org_id": "uuid",
  "user_id": "uuid",
  "title": "Custom Grant Opportunity",
  "description": "Full grant description",
  "agency": "State Department of Education",
  "opportunity_number": "STATE-EDU-2025-01",
  "funding_category": "ED",
  "estimated_funding": 500000,
  "award_floor": 25000,
  "award_ceiling": 100000,
  "expected_awards": 10,
  "cost_sharing_required": false,
  "open_date": "2025-01-15",
  "close_date": "2025-03-15",
  "opportunity_status": "posted",
  "source_url": "https://example.com/grant",
  "application_url": "https://example.com/apply"
}
```

**Response:**
```json
{
  "success": true,
  "grant": {
    "id": "uuid",
    "title": "Custom Grant Opportunity",
    "status": "researching"
  }
}
```

#### `POST /api/admin/sync`

Trigger manual grant sync. **Admin only**.

**Request body:**
```json
{
  "source_id": "uuid",
  "sync_type": "full",
  "user_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "uuid",
    "source_id": "uuid",
    "status": "running",
    "started_at": "2025-01-17T10:00:00Z"
  }
}
```

#### `GET /api/cron/sync-grants`

Automated nightly sync job (scheduled via Vercel cron at 2 AM). Syncs all enabled grant sources with incremental updates.

### Saved Grants

#### `GET /api/saved?org_id={uuid}&format={json|csv}`

Get all saved grants for an organization. Returns grants with status, priority, and assignment fields.

**Query parameters:**
- `org_id` (required): Organization UUID
- `format` (optional): Response format - `json` (default) or `csv`

**CSV Export:**
When `format=csv`, returns a CSV file with all grant fields:
- Headers: Title, Agency, ALN, Status, Priority, Open Date, Close Date, Assigned To, Notes, Saved At, External ID, External Source
- Proper CSV escaping for commas, quotes, and newlines
- Filename: `grants-export-YYYY-MM-DD.csv`
- Content-Type: `text/csv`

**Example:**
```bash
# Get JSON
GET /api/saved?org_id={uuid}

# Export CSV
GET /api/saved?org_id={uuid}&format=csv
```

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

#### `PATCH /api/saved-status?id={grant_id}`

Update grant status, priority, or assignment.

**Query parameters:**
- `id` (required): Grant UUID

**Request body:**
```json
{
  "status": "drafting",
  "priority": "high",
  "assigned_to": "user-uuid",
  "notes": "Working on budget section"
}
```

#### `POST /api/import`

Bulk import multiple grants from CSV. **Requires authentication**.

**Request body:**
```json
{
  "org_id": "uuid",
  "user_id": "uuid",
  "grants": [
    {
      "external_id": "grant-123",
      "title": "Grant Title 1",
      "agency": "Agency Name",
      "aln": "12.345",
      "open_date": "2025-01-01",
      "close_date": "2025-03-01",
      "status": "researching",
      "priority": "high",
      "assigned_to": "user-uuid"
    },
    {
      "external_id": "grant-456",
      "title": "Grant Title 2",
      "agency": "Another Agency",
      "close_date": "2025-04-15"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "imported": 2,
  "failed": 0,
  "errors": []
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

### Grant Alerts

#### `GET /api/alerts?org_id={uuid}`

Get all grant alerts for an organization.

**Response:**
```json
{
  "alerts": [
    {
      "id": "uuid",
      "name": "Education grants over $100K",
      "description": "Alert for large education grants",
      "keyword": "education",
      "category": "ED",
      "min_amount": 100000,
      "frequency": "daily",
      "notify_email": true,
      "notify_in_app": true,
      "is_active": true,
      "alert_count": 5,
      "last_alert_sent_at": "2025-01-20T14:30:00Z"
    }
  ]
}
```

#### `POST /api/alerts`

Create a new grant alert.

**Request body:**
```json
{
  "org_id": "uuid",
  "name": "Alert Name",
  "description": "Optional description",
  "keyword": "climate",
  "category": "EN",
  "agency": "EPA",
  "status_posted": true,
  "status_forecasted": false,
  "due_in_days": 60,
  "min_amount": 50000,
  "max_amount": 500000,
  "frequency": "daily",
  "notify_email": true,
  "notify_in_app": true,
  "notify_webhook": false
}
```

#### `PUT /api/alerts?alert_id={uuid}`

Update an existing alert.

#### `DELETE /api/alerts?alert_id={uuid}`

Delete a grant alert.

#### `POST /api/alerts/check`

Check all active alerts for new matching grants. This endpoint is called automatically by a cron job every 6 hours, but can also be triggered manually.

**Response:**
```json
{
  "message": "Alert check completed",
  "alerts_checked": 12,
  "matches_created": 3,
  "emails_queued": 2,
  "alerts_with_matches": [
    {
      "alert_name": "Education grants over $100K",
      "matches_count": 2
    }
  ]
}
```

**Behavior:**
- Checks grants added since last check (or last 24 hours for new alerts)
- Creates `grant_alert_matches` records
- Triggers in-app notifications via database trigger
- Queues emails for alerts with `notify_email: true`
- Updates `last_checked_at`, `last_alert_sent_at`, and `alert_count`

### Activity Log

#### `GET /api/activity?grant_id={uuid}&org_id={uuid}&user_id={uuid}&action={action}&limit={50}&offset={0}`

Get activity log entries with optional filtering.

**Query parameters:**
- `grant_id` (optional): Filter by specific grant
- `org_id` (optional): Filter by organization
- `user_id` (optional): Filter by user
- `action` (optional): Filter by action type (`saved`, `status_changed`, `priority_changed`, `assigned`, `note_added`, etc.)
- `limit` (optional, default 50): Number of results
- `offset` (optional, default 0): Pagination offset

**Response:**
```json
{
  "activities": [
    {
      "id": "uuid",
      "action": "status_changed",
      "field_name": "status",
      "old_value": "researching",
      "new_value": "drafting",
      "description": "Grant status changed from researching to drafting",
      "created_at": "2025-01-21T10:30:00Z",
      "user_profiles": {
        "full_name": "John Doe",
        "avatar_url": "https://..."
      },
      "org_grants_saved": {
        "title": "Education Grant 2025",
        "external_id": "ED-2025-001"
      }
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

**Tracked Actions:**
- `saved` - Grant added to pipeline
- `status_changed` - Pipeline stage changed
- `priority_changed` - Priority updated
- `assigned` - Grant assigned to team member
- `note_added` - Note added
- `note_updated` - Note modified
- `note_deleted` - Note removed

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

### Post-Award Financials

#### `GET /api/budgets?grant_id={uuid}&org_id={uuid}&budget_id={uuid}`

Get budget(s) with line items and summary metrics.

**Query parameters:**
- `grant_id` (optional): Get budget for specific grant
- `org_id` (optional): List all budgets for organization
- `budget_id` (optional): Get specific budget by ID

**Response:**
```json
{
  "budget": {
    "id": "uuid",
    "grant_id": "uuid",
    "proposed_amount": 500000,
    "awarded_amount": 450000,
    "total_spent": 125000,
    "total_committed": 50000,
    "match_required": true,
    "match_amount": 90000,
    "match_received": 45000,
    "status": "active",
    "budget_line_items": [...],
    "grant_budget_summary": {
      "remaining_amount": 325000,
      "percent_spent": 27.78,
      "match_percent_complete": 50
    }
  }
}
```

#### `POST /api/budgets`

Create a new budget for a grant.

**Request body:**
```json
{
  "grant_id": "uuid",
  "org_id": "uuid",
  "proposed_amount": 500000,
  "awarded_amount": 450000,
  "match_required": true,
  "match_amount": 90000,
  "budget_period_start": "2025-01-01",
  "budget_period_end": "2025-12-31",
  "line_items": [
    {
      "category": "personnel",
      "description": "Project Director (1.0 FTE)",
      "proposed_amount": 120000,
      "awarded_amount": 110000,
      "line_number": 1
    },
    {
      "category": "travel",
      "description": "Conference travel",
      "proposed_amount": 15000,
      "awarded_amount": 12000,
      "line_number": 2
    }
  ]
}
```

#### `PATCH /api/budgets?budget_id={uuid}`

Update a budget.

#### `DELETE /api/budgets?budget_id={uuid}`

Delete a budget.

#### `GET /api/disbursements?budget_id={uuid}&org_id={uuid}`

List disbursements (expenses and payments).

#### `POST /api/disbursements`

Create a new disbursement.

**Request body:**
```json
{
  "budget_id": "uuid",
  "org_id": "uuid",
  "disbursement_type": "expense",
  "amount": 5000,
  "disbursement_date": "2025-01-15",
  "category": "travel",
  "line_item_id": "uuid",
  "payment_method": "credit_card",
  "vendor_payee": "Conference Registration",
  "description": "Annual conference registration and hotel",
  "receipt_url": "https://...",
  "approved": false
}
```

**Disbursement types:** `payment_received`, `expense`, `adjustment`
**Categories:** `personnel`, `fringe_benefits`, `travel`, `equipment`, `supplies`, `contractual`, `construction`, `other_direct`, `indirect_costs`, `match_in_kind`, `match_cash`

#### `GET /api/payment-schedules?budget_id={uuid}&upcoming=true`

List payment schedules and drawdowns.

**Query parameters:**
- `budget_id`: Filter by budget
- `upcoming=true`: Only show upcoming payments in next 90 days

#### `POST /api/payment-schedules`

Create a payment schedule.

**Request body:**
```json
{
  "budget_id": "uuid",
  "org_id": "uuid",
  "payment_name": "Q1 Reimbursement",
  "payment_type": "reimbursement",
  "expected_amount": 112500,
  "expected_date": "2025-04-30",
  "report_required": "Quarterly Progress Report",
  "report_due_date": "2025-04-15"
}
```

**Payment types:** `advance`, `reimbursement`, `cost_reimbursement`, `milestone`, `quarterly`, `annual`

#### `GET /api/compliance?grant_id={uuid}&org_id={uuid}`

List compliance requirements with summary.

**Response:**
```json
{
  "requirements": [
    {
      "id": "uuid",
      "requirement_type": "federal_regulation",
      "title": "2 CFR 200 Uniform Guidance",
      "description": "Federal procurement standards compliance",
      "status": "completed",
      "is_critical": true,
      "completed": true,
      "due_date": "2025-01-31"
    }
  ],
  "summary": {
    "total_requirements": 8,
    "completed_requirements": 5,
    "critical_requirements": 3,
    "critical_incomplete": 1,
    "overdue_requirements": 0,
    "compliance_percentage": 62.5
  }
}
```

#### `POST /api/compliance`

Create a compliance requirement.

**Request body:**
```json
{
  "grant_id": "uuid",
  "org_id": "uuid",
  "requirement_type": "match_requirement",
  "title": "20% Cost Share Requirement",
  "description": "Minimum 20% cost share required",
  "is_critical": true,
  "due_date": "2025-12-31",
  "documentation_required": true
}
```

**Requirement types:** `federal_regulation`, `state_regulation`, `indirect_cost_agreement`, `match_requirement`, `audit_requirement`, `reporting_requirement`, `certification`, `policy`, `other`

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

### Multi-Source Grant Ingestion Tables

#### `grant_sources`
Configuration for different grant data sources.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Source name (Grants.gov, OpenGrants, Custom) |
| source_type | text | grants_gov, opengrants, foundation, state_portal, custom |
| api_endpoint | text | API endpoint URL (if applicable) |
| api_key | text | API authentication key (encrypted) |
| is_enabled | boolean | Whether source is active |
| sync_frequency | text | full_daily, incremental_hourly, manual |
| last_sync_at | timestamptz | Last successful sync timestamp |
| next_sync_at | timestamptz | Scheduled next sync |
| sync_config | jsonb | Source-specific configuration |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

**RLS**: Public read access, admin-only write access.

#### `grants_catalog`
Centralized grant catalog from all sources.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| source_id | uuid | Reference to grant_sources |
| external_id | text | Source's unique grant ID |
| title | text | Grant title |
| description | text | Full grant description |
| agency | text | Issuing agency |
| category | text | Funding category code |
| opportunity_number | text | Official opportunity number |
| open_date | timestamptz | Opening date |
| close_date | timestamptz | Closing/deadline date |
| award_floor | numeric | Minimum award amount |
| award_ceiling | numeric | Maximum award amount |
| estimated_funding | numeric | Total program funding |
| expected_awards | integer | Number of expected awards |
| eligibility | text | Eligibility requirements |
| cost_sharing_required | boolean | Cost sharing requirement |
| opportunity_status | text | posted, forecasted, closed, archived |
| source_url | text | Original listing URL |
| application_url | text | Application submission URL |
| content_hash | text | SHA-256 hash for de-duplication |
| search_vector | tsvector | Full-text search index |
| raw_data | jsonb | Original source data |
| created_at | timestamptz | First ingestion timestamp |
| updated_at | timestamptz | Last update timestamp |

**Unique constraint**: (source_id, external_id)

**Indexes**:
- GIN index on search_vector for full-text search
- Index on content_hash for de-duplication
- Index on (source_id, external_id) for lookups

**RLS**: Public read access for active grants.

#### `sync_jobs`
Sync operation tracking and logging.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| source_id | uuid | Reference to grant_sources |
| sync_type | text | full, incremental, single |
| status | text | pending, running, completed, failed |
| started_at | timestamptz | Sync start time |
| completed_at | timestamptz | Sync completion time |
| started_by | uuid | User who triggered (null for cron) |
| grants_fetched | integer | Number of grants retrieved |
| grants_created | integer | Number of new grants added |
| grants_updated | integer | Number of grants updated |
| grants_unchanged | integer | Number of unchanged grants |
| duplicates_found | integer | Number of duplicates detected |
| error_message | text | Error details if failed |
| error_stack | text | Full error stack trace |
| sync_metadata | jsonb | Additional sync details |
| created_at | timestamptz | Record creation time |

**RLS**: Admin-only access.

#### `grant_duplicates`
Duplicate grant detection and linking.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| catalog_grant_id | uuid | Reference to grants_catalog (primary) |
| duplicate_grant_id | uuid | Reference to grants_catalog (duplicate) |
| match_type | text | exact_hash, fuzzy_title, manual |
| match_score | numeric | Similarity score (0-1) |
| detected_at | timestamptz | Detection timestamp |
| verified_by | uuid | User who verified (if manual) |
| verified_at | timestamptz | Verification timestamp |

**Unique constraint**: (catalog_grant_id, duplicate_grant_id)

**RLS**: Public read access, admin-only write access.

#### `grant_match_notifications`
Notifications for grants matching org eligibility profiles.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| org_id | uuid | Reference to organizations |
| catalog_grant_id | uuid | Reference to grants_catalog |
| match_score | numeric | Relevance score (0-1) |
| match_reasons | text[] | Array of matching criteria |
| notified_at | timestamptz | Notification sent timestamp |
| viewed_at | timestamptz | When user viewed |
| dismissed_at | timestamptz | When user dismissed |
| created_at | timestamptz | Record creation time |

**Unique constraint**: (org_id, catalog_grant_id)

**RLS**: Users can view matches for their organization only.

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

### Vercel Deployment

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Set environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL` - Supabase project URL (client-side)
   - `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key (client-side)
   - `SUPABASE_URL` - Supabase project URL (for API routes)
   - `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for API routes)
   - `RESEND_API_KEY` - Resend API key for email delivery
   - `CRON_SECRET` - Secret key for cron job authentication

   **Note**: Use `VITE_` prefix for environment variables that need to be accessible in the browser (Vite framework requirement). API routes use non-prefixed variables like `SUPABASE_URL`.

4. Configure custom domain (grantcue.com) in Vercel dashboard

The `/api` directory will be automatically deployed as serverless functions.

### Database Migrations

Run migrations in your Supabase SQL editor in the order listed in the Getting Started section. Each migration is idempotent and safe to run multiple times.

## Features Implemented

### v1 Complete Features

**Authentication & Authorization**
- ✅ Self-service user sign-up with email confirmation
- ✅ Email/password sign-in
- ✅ Magic link authentication (passwordless OTP via email)
- ✅ Supabase Auth integration
- ✅ Protected routes with permission checks
- ✅ Role-based access control (Admin/Contributor)
- ✅ Bearer token authentication on all API endpoints
- ✅ Organization membership verification

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

**Multi-Source Grant Ingestion**
- ✅ Source adapter architecture (extensible pattern for multiple sources)
- ✅ Grants.gov automated sync integration
- ✅ Custom grant entry with full validation
- ✅ Automated nightly sync via Vercel cron (2 AM daily)
- ✅ De-duplication engine (content hash + fuzzy matching)
- ✅ Sync job tracking and error logging
- ✅ Admin sync controls (manual full/incremental triggers)
- ✅ Full-text search with PostgreSQL tsvector
- ✅ Grant catalog with centralized multi-source storage

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
- ✅ Advanced filtering by status, priority, and assignee
- ✅ "My grants only" toggle for personalized view
- ✅ Save-to-pipeline modal with stage, priority, and assignee selection
- ✅ Visual deadline indicators (color-coded)
- ✅ Stage counts and visual grouping
- ✅ Notes field for internal tracking
- ✅ Grant detail drawer with tabs (Tasks, Notes)
- ✅ Print grant brief as professional PDF
- ✅ Task management system with CRUD operations
- ✅ Auto-created default task templates (6 tasks per grant)
- ✅ Task progress tracking with completion percentage
- ✅ Task types and status tracking
- ✅ Task due dates and completion timestamps
- ✅ Required vs optional task flags

**Import & Migration**
- ✅ Multi-step CSV import wizard with file upload (4 steps: Upload → Map Fields → Review → Import)
- ✅ Flexible field mapping UI with visual column-to-field mapping
- ✅ Auto-detection and intelligent mapping of CSV columns (title, agency, ALN, deadline, etc.)
- ✅ User-adjustable field mapping with skip column option
- ✅ Platform-specific presets (GrantHub, Instrumentl, Foundation Search, Candid, Grants.gov)
- ✅ Enhanced data validation with error and warning severity levels
  - ✅ Required field validation (Grant Title)
  - ✅ Date format validation with helpful error messages
  - ✅ Missing field warnings (agency, close date)
  - ✅ Row-level issue tracking with line numbers
- ✅ Data preview with visual quality indicators (OK/N issues badges)
- ✅ Duplicate detection based on title + agency matching
- ✅ Bulk import API for efficient batch processing
- ✅ Real-time import progress tracking with imported/skipped/failed counts
- ✅ GrantHub migration landing page (/granthub-migration) with:
  - ✅ January 31, 2026 deadline messaging
  - ✅ Step-by-step migration guide with visual Stepper
  - ✅ Comprehensive FAQ section (7 questions)
  - ✅ Multiple CTAs with user-aware navigation
  - ✅ Benefits showcase with 6 feature cards
- ✅ CSV export with proper escaping and CSV injection prevention
- ✅ PDF/print export for grant briefs
- ✅ Board packet export with summary statistics and timeline

**Calendar & Integrations**
- ✅ ICS calendar feed with unique tokens
- ✅ Microsoft Teams webhook integration
- ✅ Custom webhooks with CRUD operations
- ✅ Webhook event subscription management
- ✅ Integration status tracking

**Settings & Preferences**
- ✅ 7 settings pages (Profile, Organization, Team, Notifications, Calendar, Billing, Danger Zone)
- ✅ Customizable email reminder cadence (powered by Resend)
- ✅ User preference management
- ✅ Admin-only controls
- ✅ Email notification preferences with granular controls

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

### Recent Improvements (January 2025)

**Calendar Feed & Integrations** *(Latest - Jan 2025)*
- ✅ Created `/api/calendar/[orgId]/[token].ts` endpoint for ICS calendar feeds
  - Token-based authentication validates organization ICS tokens
  - Generates proper ICS/iCalendar format with VEVENT entries for all grant deadlines
  - Includes grant title, agency, description preview, and Grants.gov URLs
  - Sets appropriate HTTP headers for calendar subscription compatibility
- ✅ Fixed database trigger null guard issue in post-award financials migration
  - Restored `WHEN (NEW.line_item_id IS NOT NULL OR OLD.line_item_id IS NOT NULL)` clause
  - Prevents trigger from firing when disbursement has no associated line item
  - Eliminates potential errors when deleting unassigned disbursements
  - Improves performance by avoiding unnecessary function calls

**Grant Card Enhancements**
- ✅ Added description preview feature to grant cards
  - Shows 200-character preview on SavedGrantsPage cards
  - Shows 150-character preview on PipelinePage cards (smaller card size)
  - Automatically fetches grant description when saving from DiscoverPage
  - Uses `stripHtml()` utility to clean HTML formatting from descriptions
  - Line-clamped to 2 lines for consistent card layout
  - Stores descriptions in database for instant display
- ✅ Fixed grant card click behavior
  - Clicking card body opens Grant Detail Drawer
  - Clicking title or link icon opens Grants.gov URL in new tab
  - Proper event propagation handling with stopPropagation()

**Grant Detail Drawer & Compliance**
- ✅ Added notes editing functionality to Grant Detail Drawer
  - Editable notes tab with textarea and save/cancel controls
  - Real-time save with loading states and error handling
  - Updates grant object locally after successful save
- ✅ Implemented full CRUD interface for compliance requirements
  - "Add Requirement" button to create new compliance items
  - Edit and delete action icons on each requirement card
  - Interactive checkboxes to toggle completion status
  - Comprehensive modal form with 9 fields:
    - Requirement type (9 options: federal/state regulations, indirect costs, match, audit, reporting, certification, policy, other)
    - Title (required)
    - Description (rich text)
    - Regulation reference (e.g., "2 CFR 200.303")
    - Policy URL (external link)
    - Due date (DateInput with calendar picker)
    - Documentation required (Switch)
    - Critical requirement flag (Switch)
    - Notes (additional context)
  - Real-time cache invalidation using React Query
  - Instant UI updates without page refresh

### Recent Improvements (January 2025)

**Team Scalability & Performance**
- ✅ Fixed PostgREST schema cache error by adding foreign key from org_members → user_profiles
- ✅ Created `get_org_team_members()` RPC function to prevent URL length issues with large teams (50+ members)
- ✅ Updated GrantFilters, SaveToPipelineModal, and TaskList components to use RPC instead of PostgREST joins
- ✅ Eliminates 414 Request-URI Too Large errors when organizations have many team members

**GrantHub Import Enhancements**
- ✅ Flexible field mapping UI with visual column-to-field mapping
- ✅ Intelligent auto-detection of CSV column names with user-adjustable mapping
- ✅ Enhanced validation with error and warning severity levels:
  - Required field validation with clear error messages
  - Date format validation with helpful feedback
  - Missing field warnings for optional but recommended fields
  - Row-level issue tracking with line numbers
- ✅ Data preview table with visual quality indicators (OK/Warning badges)
- ✅ Validates data before import to prevent issues

**User Experience & Navigation**
- ✅ Created ScrollToTop component to fix scroll position on route changes
- ✅ Added footer to PrivacyPage for consistent branding across all pages
- ✅ Implemented friendly 404 NotFoundPage with:
  - Gradient background matching brand identity
  - User-aware navigation (different CTAs for logged-in vs logged-out users)
  - Quick links to key pages (Features, Pricing, Pipeline/Sign In)
  - Professional error messaging

**Debugging & Developer Experience**
- ✅ Added comprehensive console logging to PipelinePage PATCH requests
- ✅ Enhanced error handling and troubleshooting capabilities
- ✅ Improved visibility into status update operations

### Future Enhancements

**Integrations & Notifications**
- Google Calendar OAuth integration
- Slack OAuth integration
- Email notification workers (deadline reminders, daily summaries via Resend)
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
- Export data functionality (CSV, JSON)
- Advanced search with Boolean operators
- State and foundation grant portals integration
- Grant writing AI assistance
- Additional import sources (state portals, private foundations)

## API Reference & Documentation

**External APIs**
- [Grants.gov Search2 API](https://grants.gov/api/common/search2)
- [Grants.gov fetchOpportunity API](https://grants.gov/api/common/fetchOpportunity)
- [Grants.gov API Guide](https://grants.gov/api/api-guide)

**Platform Stack**
- [Vercel Documentation](https://vercel.com/docs) - Hosting & Serverless Functions
- [Supabase Documentation](https://supabase.com/docs) - Database & Authentication
- [Resend Documentation](https://resend.com/docs) - Email Delivery
- [Mantine UI](https://mantine.dev) - React Component Library
- [TanStack Query](https://tanstack.com/query) - Data Fetching & Caching

## About

**Grantcue** helps organizations streamline their grant management workflow - from discovery to submission. Built with modern web technologies and designed for teams.

**Website**: [grantcue.com](https://grantcue.com)

## License

MIT
