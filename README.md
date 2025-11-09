# Grant Tracker - Discover Federal Grants

A grant discovery and tracking platform that helps organizations find and manage federal grant opportunities from Grants.gov.

## Features

### Grant Discovery
- **Search & Discover**: Search federal grants by keyword, category, agency, and status
- **Smart Filters**: Filter by funding category, agency, opportunity status, and due date
- **Save to Pipeline**: Save interesting opportunities to your organization's pipeline
- **Real-time Data**: Live data from Grants.gov Search2 API (no authentication required)

### Organization & Team Management
- **Multi-Organization Support**: Switch between multiple organizations with persistent context
- **Team Collaboration**: Invite team members with role-based permissions (Admin/Contributor)
- **User Profiles**: Manage personal profile information and preferences
- **Organization Settings**: Configure organization name, primary state, and focus areas

### Notifications & Integrations
- **Email Reminders**: Customizable deadline reminder cadence (30d, 14d, 7d, 3d, 1d, day-of)
- **ICS Calendar Feed**: Subscribe to grant deadlines in any calendar app
- **Google Calendar Integration**: Real-time sync with Google Calendar (coming soon)

### Settings & Preferences
- **7 Settings Pages**: Profile, Organization, Team, Notifications, Calendar & Integrations, Billing, Danger Zone
- **Responsive Design**: Built with Mantine UI for a modern, mobile-friendly experience
- **Role-Based Access**: Admin-only controls for sensitive settings

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **UI Library**: Mantine v8
- **Routing**: React Router v7
- **Data Fetching**: TanStack Query v5
- **Backend**: Vercel Serverless Functions
- **Database**: Supabase (PostgreSQL with RLS)
- **Dates**: dayjs

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

Run the migrations in your Supabase SQL editor:

- `supabase/migrations/20250108_create_org_grants_saved.sql` - Creates the saved grants table
- `supabase/migrations/20250108_create_settings_and_org_schema.sql` - Creates organizations, user profiles, team members, invitations, preferences, and settings tables with RLS policies

**Note**: The settings schema migration is idempotent and can be run multiple times safely.

5. Start the development server:
```bash
yarn dev
```

Visit `http://localhost:5173` to see the app.

## Project Structure

```
grant-tracker-new/
├── api/                      # Vercel serverless functions
│   ├── grants/
│   │   └── search.ts        # Proxy to Grants.gov Search2 API
│   └── saved.ts             # CRUD for saved grants
├── src/
│   ├── components/
│   │   ├── AppHeader.tsx    # Global header with org switcher & user menu
│   │   ├── OrgSwitcher.tsx  # Organization selector dropdown
│   │   ├── UserMenu.tsx     # User profile dropdown menu
│   │   ├── SettingsLayout.tsx # Settings page layout with tabs
│   │   └── ProtectedRoute.tsx # Route guard with permission checks
│   ├── contexts/
│   │   ├── AuthContext.tsx  # Supabase authentication context
│   │   └── OrganizationContext.tsx # Multi-org state management
│   ├── hooks/
│   │   └── usePermission.ts # Role-based permission checks
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client config
│   │   └── database.types.ts # Database TypeScript types
│   ├── pages/
│   │   ├── HomePage.tsx     # Marketing/landing page
│   │   ├── DiscoverPage.tsx # Grant search & discovery
│   │   └── settings/
│   │       ├── ProfilePage.tsx        # User profile settings
│   │       ├── OrganizationPage.tsx   # Organization details
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
│       └── 20250108_create_settings_and_org_schema.sql
├── vercel.json              # Vercel deployment config
└── package.json
```

## API Routes

### `POST /api/grants/search`

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

### `GET /api/saved?org_id={uuid}`

Get all saved grants for an organization.

### `POST /api/saved`

Save a grant to the pipeline.

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

### `DELETE /api/saved?id={uuid}`

Remove a saved grant from the pipeline.

## Database Schema

### Core Tables

#### `organizations`
Organization details and metadata.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Organization name |
| slug | text | URL-safe slug (unique) |
| primary_state | text | Primary state/region |
| focus_areas | text[] | Array of focus areas |
| logo_url | text | Logo image URL |
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
Saved grant opportunities.

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
| saved_at | timestamptz | When saved |
| created_at | timestamptz | Row creation time |

**Unique constraint**: (org_id, external_source, external_id)

**RLS**: Users can view/insert/delete grants for their organization only.

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

## Development Notes

### v1 Features Implemented

**Grant Discovery**
- Search and filtering with Grants.gov API integration
- Save/unsave grants to organization pipeline
- Client-side sorting by close date

**Authentication & Organizations**
- Supabase authentication with AuthContext
- Multi-organization support with org switching
- Role-based permissions (Admin vs Contributor)
- Team member management and invitations

**Settings & Preferences**
- 7 settings pages (Profile, Organization, Team, Notifications, Calendar, Billing, Danger Zone)
- Customizable email reminder cadence
- ICS calendar feed with unique tokens
- User profile and organization detail management

**Security**
- Row Level Security (RLS) on all database tables
- Permission-based access control
- Protected routes with role checks

### Future Enhancements

- Grant detail drawer with full opportunity data
- Saved grants dashboard and management page
- Actual email notification delivery (backend workers)
- Google Calendar OAuth integration
- Real billing integration (Stripe)
- Pipeline stages and workflow automation
- Analytics and reporting dashboards
- Export data functionality (CSV, JSON)

## API Reference

- [Grants.gov Search2 API](https://grants.gov/api/common/search2)
- [Grants.gov API Guide](https://grants.gov/api/api-guide)

## License

MIT
