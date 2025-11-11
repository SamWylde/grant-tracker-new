# Grantcue - Discover & Manage Federal Grants

**[grantcue.com](https://grantcue.com)**

A comprehensive grant discovery and workflow management platform that helps organizations find, track, and manage federal grant opportunities from Grants.gov.

## Quick Links

- **Live Site**: [grantcue.com](https://grantcue.com)
- **Features**: See the `/features` page on the site for a comprehensive list of all features
- **Documentation**: See `/docs` for detailed guides (coming soon)

## Tech Stack

**Frontend**
- **Framework**: React 19, TypeScript, Vite
- **UI Library**: Mantine v8
- **Routing**: React Router v7
- **Data Fetching**: TanStack Query v5
- **Drag & Drop**: @dnd-kit (core, sortable, utilities)
- **Date Handling**: dayjs
- **AI Integration**: OpenAI GPT-4o-mini

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
```bash
VITE_SUPABASE_URL=your-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_OPEN_AI_API_KEY=your-openai-api-key  # Optional: For client-side AI features
```

**Server-side variables (API routes):**
```bash
SUPABASE_URL=your-project-url.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
RESEND_API_KEY=your-resend-api-key
CRON_SECRET=your-cron-secret
OPEN_AI_API_KEY=your-openai-api-key  # Required for AI features
```

**OAuth Integration Variables (Optional):**
```bash
# Google Calendar OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://grantcue.com/api/oauth/google/callback

# Slack OAuth
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_REDIRECT_URI=https://grantcue.com/api/oauth/slack/callback

# Microsoft Teams OAuth
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_TENANT_ID=common  # or your specific tenant ID
MICROSOFT_REDIRECT_URI=https://grantcue.com/api/oauth/microsoft/callback
```

**Note**: Use `VITE_` prefix for client-side environment variables (Vite framework). The API routes use non-prefixed variables for server-side operations.

### Installation

```bash
# Install dependencies
yarn install

# Run development server
yarn dev

# Build for production
yarn build

# Type check
yarn typecheck
```

### Database Setup

Run the migrations in your Supabase SQL editor in the following order:

#### Core Schema
1. `20250108_create_org_grants_saved.sql` - Saved grants table
2. `20250108_create_settings_and_org_schema.sql` - Organizations, users, team management
3. `20250109_add_value_metrics_tracking.sql` - ROI and value tracking
4. `20250110_auto_create_organization.sql` - Auto-create org on signup trigger
5. `20250111_fix_org_members_rls.sql` - RLS policy fixes

#### Search & Discovery
6. `20250112_add_search_features.sql` - Recent searches, saved views, interactions
7. `20250113_add_eligibility_profile.sql` - Organization eligibility profiles
8. `20250117_multi_source_ingestion.sql` - Multi-source grant catalog system
9. `20250123_add_grant_description.sql` - Description previews on grant cards

#### Workflow & Pipeline
10. `20250114_add_pipeline_fields.sql` - Pipeline status, priority, assignments
11. `20250115_add_grant_tasks.sql` - Task management with templates
12. `20250121_add_activity_log.sql` - Activity feed and audit trail

#### Alerts & Notifications
14. `20250116_add_grant_alerts.sql` - Alert system with email notifications

#### Post-Award Management
15. `20250122_add_post_award_financials.sql` - Budget, disbursements, compliance tracking

#### AI Features
16. `20250124_add_ai_features.sql` - AI summaries, tagging, recommendations, success scoring

#### Collaboration Features
17. `20250125_add_collaboration_features.sql` - Threaded comments, @mentions, activity stream

#### Integrations
18. `add_integrations.sql` - Calendar feeds, webhooks, Teams/Slack

#### Data Fixes
19. `20250118_fix_status_constraint.sql` - Status field constraint fix
20. `20250119_add_user_profiles_foreign_key.sql` - Foreign key for PostgREST joins
21. `20250120_fix_grant_org_id.sql` - Data integrity fix for org_id
22. `20250126_fix_activity_log_user_id.sql` - Allow system-generated activities
23. `20250127_fix_collaboration_full_name.sql` - Fix schema references (user_profiles vs org_members)

**Note**: All migrations are idempotent and can be run multiple times safely.

## Database Structure

### Core Tables
- `organizations` - Multi-tenant organization management
- `org_members` - Team membership with role-based access (admin, contributor)
- `user_profiles` - Extended user information and preferences
- `org_invitations` - Team invitations with expiration
- `org_grants_saved` - Saved grants in pipeline with status tracking
- `grant_tasks` - Task breakdown for each grant with due dates
- `grant_activity_log` - Audit trail for all grant changes (NEW)

### Grant Discovery
- `grant_sources` - Configurable grant data sources (Grants.gov, custom)
- `grants_catalog` - Unified grant catalog from all sources
- `grant_duplicates` - De-duplication tracking across sources
- `sync_jobs` - Sync operation history and metrics
- `recent_searches` - User search history tracking
- `saved_views` - Saved filter configurations
- `grant_interactions` - User interactions (viewed, saved, clicked)

### AI Features (NEW)
- `grant_ai_summaries` - AI-generated NOFO summaries with extracted data
- `grant_tags` - Tag taxonomy with 4 categories (focus, eligibility, funding, geographic)
- `grant_tag_assignments` - Many-to-many grant-tag relationships
- `grant_recommendations` - Cached personalized recommendations
- `grant_success_scores` - Success probability predictions

### Alerts & Notifications
- `grant_alerts` - User-defined grant alerts with criteria
- `alert_matches` - Tracking which grants matched which alerts
- `in_app_notifications` - Notification center messages

### Post-Award Management
- `grant_budgets` - Budget tracking with proposed/awarded/spent amounts
- `budget_line_items` - Detailed budget breakdowns by cost category
- `grant_disbursements` - Expense and payment tracking
- `grant_payment_schedules` - Drawdown planning and payment tracking
- `grant_compliance_requirements` - Regulatory and policy compliance tracking

### Integrations
- `integrations` - OAuth connections (Teams, Slack, Google Calendar)
- `webhooks` - Custom webhook endpoints
- `webhook_deliveries` - Delivery tracking and retry logic
- `calendar_feed_tokens` - Secure ICS calendar feed tokens

### Views & Computed Tables
- `budget_summaries` - Rollup of budget data by grant
- `grant_recommendations` (view) - Collaborative filtering recommendations

## Project Structure

```
grant-tracker-new/
├── api/                          # Vercel serverless functions
│   ├── admin/                    # Admin endpoints
│   │   └── sync.ts               # Manual sync management
│   ├── alerts/
│   │   └── check.ts              # Alert checking worker (cron every 6h)
│   ├── calendar/
│   │   └── [orgId]/[token].ts   # ICS calendar feed endpoint
│   ├── cron/
│   │   └── sync-grants.ts        # Nightly grant sync (2 AM daily)
│   ├── grants/
│   │   ├── search.ts             # Grants.gov Search2 API proxy
│   │   ├── details.ts            # Grant details API
│   │   ├── custom.ts             # Custom grant entry
│   │   ├── nofo-summary.ts       # AI-powered NOFO summarization
│   │   ├── tags.ts               # AI auto-tagging
│   │   └── success-score.ts      # Success probability calculation
│   ├── activity.ts               # Activity log API
│   ├── alerts.ts                 # Alert CRUD
│   ├── budgets.ts                # Budget management
│   ├── compliance.ts             # Compliance tracking
│   ├── disbursements.ts          # Expense tracking
│   ├── import.ts                 # Bulk import
│   ├── integrations.ts           # Integration management
│   ├── metrics.ts                # Value metrics
│   ├── notifications.ts          # Notification center
│   ├── payment-schedules.ts      # Payment tracking
│   ├── recent-searches.ts        # Search history
│   ├── recommendations.ts        # AI recommendations
│   ├── saved.ts                  # Saved grants CRUD
│   ├── saved-status.ts           # Grant status updates
│   ├── tasks.ts                  # Task management
│   ├── views.ts                  # Saved views
│   └── webhooks.ts               # Webhook management
├── src/
│   ├── components/               # React components
│   │   ├── AISummaryTab.tsx      # NOFO AI summary display
│   │   ├── GrantTagBadges.tsx    # Tag display component
│   │   ├── RecommendationsSection.tsx  # Recommendations UI
│   │   ├── SuccessScoreBadge.tsx # Success probability indicator
│   │   └── ...                   # Other components
│   ├── contexts/
│   │   ├── AuthContext.tsx       # Authentication state
│   │   └── OrganizationContext.tsx  # Multi-org context
│   ├── pages/
│   │   ├── ActivityPage.tsx      # Activity feed page
│   │   ├── DiscoverPage.tsx      # Grant search and discovery
│   │   ├── FeaturesPage.tsx      # Feature showcase
│   │   ├── PipelinePage.tsx      # Kanban board
│   │   ├── SavedGrantsPage.tsx   # Saved grants list
│   │   └── ...                   # Other pages
│   ├── types/
│   │   └── grants.ts             # TypeScript interfaces
│   └── utils/
│       ├── htmlUtils.ts          # HTML parsing utilities
│       └── printGrant.ts         # PDF export utilities
├── supabase/
│   └── migrations/               # Database migration files
└── lib/
    └── grants/
        ├── adapters/
        │   └── GrantsGovAdapter.ts  # Grants.gov data adapter
        ├── SyncService.ts        # Sync orchestration
        └── types.ts              # Grant ingestion types
```

## Key Pages

- `/` - Landing page with feature showcase
- `/discover` - Grant search and discovery with recommendations
- `/saved` - List view of saved grants
- `/pipeline` - Kanban board for workflow management
- `/activity` - Activity feed and audit trail
- `/import` - CSV import wizard
- `/import/granthub` - GrantHub migration tool
- `/features` - Comprehensive feature list
- `/settings/*` - Settings pages (profile, org, team, notifications, integrations)

## API Endpoints

### Grant Discovery
- `POST /api/grants/search` - Search grants with filters
- `GET /api/grants/details?id={id}` - Get grant details
- `POST /api/grants/custom` - Add custom grant

### AI Features
- `POST /api/grants/nofo-summary` - Generate AI summary
- `GET /api/grants/nofo-summary?saved_grant_id={id}` - Get cached summary
- `POST /api/grants/tags` - Generate AI tags
- `GET /api/grants/tags?grant_id={id}` - Get grant tags
- `GET /api/grants/success-score?grant_id={id}&org_id={id}` - Get success probability
- `GET /api/recommendations?org_id={id}&user_id={id}` - Get personalized recommendations

### Grant Management
- `GET /api/saved?org_id={id}` - List saved grants
- `GET /api/saved?org_id={id}&format=csv` - Export to CSV
- `POST /api/saved` - Save a grant
- `DELETE /api/saved?id={id}` - Remove grant
- `PATCH /api/saved-status?id={id}` - Update status/priority/assignment
- `GET /api/activity?grant_id={id}` - Get activity log

### Tasks & Workflow
- `GET /api/tasks?grant_id={id}` - List tasks
- `POST /api/tasks` - Create task
- `PATCH /api/tasks?id={id}` - Update task
- `DELETE /api/tasks?id={id}` - Delete task

### Post-Award
- `GET /api/budgets?grant_id={id}` - Get budget
- `POST /api/budgets` - Create/update budget
- `GET /api/disbursements?grant_id={id}` - List disbursements
- `POST /api/disbursements` - Log disbursement
- `GET /api/payment-schedules?grant_id={id}` - Get payment schedule
- `POST /api/payment-schedules` - Add payment
- `GET /api/compliance?grant_id={id}` - List requirements
- `POST /api/compliance` - Add requirement

### Integrations
- `GET /calendar/{orgId}/{token}.ics` - ICS calendar feed
- `GET /api/integrations?org_id={id}` - List integrations
- `POST /api/integrations` - Create integration
- `GET /api/webhooks?org_id={id}` - List webhooks
- `POST /api/webhooks` - Create webhook

### OAuth Callbacks
- `GET /api/oauth/google/callback` - Google Calendar OAuth callback
- `GET /api/oauth/slack/callback` - Slack OAuth callback
- `GET /api/oauth/microsoft/callback` - Microsoft Teams OAuth callback

## Cron Jobs

Configured in `vercel.json`:

- **Nightly Grant Sync**: `0 2 * * *` (2 AM daily) - `/api/cron/sync-grants`
- **Alert Checking**: `0 */6 * * *` (Every 6 hours) - `/api/alerts/check`

## Development

```bash
# Install dependencies
yarn install

# Run dev server
yarn dev

# Type check
yarn typecheck

# Build
yarn build
```

## Deployment

The project is deployed on Vercel with automatic deployments from the main branch:

- **Production**: [grantcue.com](https://grantcue.com)
- **Branch Previews**: Automatic preview deployments for all branches

## Contributing

This is a private project. For questions or support, contact the maintainer.

## License

Proprietary - All rights reserved
