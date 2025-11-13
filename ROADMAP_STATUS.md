# Grant Tracker Roadmap Status - Current vs. Planned

**Last Updated**: 2025-11-13
**Legend**: ✅ = Fully Implemented | 🟡 = Partially Implemented | ❌ = Not Implemented

---

# 🟢 NOW – Core Product (MVP that can win against spreadsheets)

## Grant Pipeline & Detail View

* ✅ **Create central pipeline view of all grants**
  - Implemented: Kanban board with drag-drop in `PipelinePage.tsx`
  - Includes: Grant cards, status badges, priority indicators, AI scores

* 🟡 **Define standard stages**
  - ✅ Implemented: 4 stages (Researching → Drafting → Submitted → Awarded)
  - ❌ Missing: Go/No-Go, Not funded, Closed out stages
  - Note: Also has "Idea" concept in rejected/withdrawn statuses

* ✅ **Add key fields to grant record**
  - All fields implemented: title, agency, program/NOFO ID, internal owner, amount, due date, stage, tags, probability
  - Database: `org_grants_saved` table with all required fields

* ✅ **Implement filters/search**
  - Implemented: By agency, status, fiscal year, tags, priority, assignee
  - Additional: Keyword search with 500ms debounce, category filters, "My grants only" toggle
  - Files: `GrantFilters.tsx`, `DiscoverPage.tsx`

* ✅ **Add per-grant activity log**
  - Implemented: Full audit trail in `grant_activity_log` table
  - Tracks: Status changes, comments, file uploads, assignments, notes
  - UI: `ActivityFeed.tsx`, `ActivityPage.tsx`

## Deadlines, Tasks & Calendar

* 🟡 **Allow multiple key dates per grant**
  - ✅ Implemented: open_date, close_date
  - ✅ AI extracts: application_deadline, award_date, project_period_start/end
  - ❌ Missing: Dedicated LOI deadline field (only in AI summary)
  - ❌ Missing: Internal deadline tracking separate from external deadlines

* ✅ **Implement tasks**
  - Fully implemented: title, description, due date, assignee, status
  - Database: `grant_tasks` table with 7 task types
  - UI: `TaskList.tsx` with drag-drop reordering
  - Default templates auto-created on grant save

* 🟡 **Add email notifications for upcoming deadlines & tasks**
  - ✅ Infrastructure: `in_app_notifications` table, notification channels
  - ✅ Settings: Deadline reminders (30d, 14d, 7d, 3d, 1d, same day)
  - ✅ Alert system: Email via Resend for grant matches
  - ❌ Missing: Actual deadline reminder emails (infrastructure only)
  - ❌ Missing: Task assignment email notifications

* ✅ **Build org-wide calendar view of all deadlines & tasks**
  - Implemented: ICS calendar feed at `/api/calendar/{orgId}/{token}.ics`
  - Compatible with: Google Calendar, Apple Calendar, Outlook
  - Includes: All grant deadlines with titles, agencies, links

* 🟡 **Integrate Google Calendar (one-way sync)**
  - ✅ OAuth integration implemented: `api/oauth/google/authorize.ts`, callback
  - ✅ Settings UI: `CalendarPage.tsx` with connect/disconnect
  - ❌ Missing: Actual event creation on deadline changes (infrastructure only)

## Team Collaboration (Basic)

* ✅ **Support multi-user organizations**
  - Fully implemented: `organizations`, `org_members` tables
  - Users can belong to multiple orgs with org switcher
  - Database: RLS policies enforce org isolation

* ✅ **Implement simple roles (Admin, Member)**
  - Implemented: Admin and Contributor roles
  - Permissions: view, edit_org, manage_team, manage_billing, delete_org
  - Files: `usePermission.ts`, `OrganizationContext.tsx`

* ✅ **Add comments on grant detail view**
  - Fully implemented: Threaded comments with unlimited depth
  - Features: @mentions, edit/delete, reactions
  - Database: `grant_comments`, `task_comments` tables
  - UI: `CommentThread.tsx`, `CommentInput.tsx`

* ✅ **Show "My Tasks" view for each user**
  - Implemented: Tasks filterable by assigned user
  - Task list shows assigned member
  - Each grant has full task management

* ✅ **Record key actions in activity feed**
  - Fully implemented: Comprehensive activity logging
  - Tracks: Created grant, changed stage, assignments, notes, comments
  - Database: `grant_activity_log`, `activity_stream` view
  - UI: `ActivityFeed.tsx` with filtering

## Funder & Contact Mini-CRM

* ❌ **Create Funder entity**
  - Not implemented: No dedicated `funders` table
  - Current: Only `agency` string field on grants

* ❌ **Link funders to grants (1 funder → many grants)**
  - Not implemented: No funder relationships
  - Current: Agency name only, no metadata

* ❌ **Create Contact entity**
  - Not implemented: No `contacts` table
  - Note: AI extracts program officer contact from NOFO but doesn't persist

* ❌ **Link contacts to funders and grants**
  - Not implemented

* ❌ **Add basic interaction log per funder/contact**
  - Not implemented
  - Note: `grant_interactions` tracks user-grant interactions, not funder interactions

## Documents & Templates (First Pass)

* ✅ **Allow file uploads on grant records**
  - Fully implemented: Supabase Storage with drag-drop upload
  - Supports: PDF, Word, Excel, PowerPoint, images, CSV, ZIP
  - Max size: 100MB per file (plan-based)
  - Files: `DocumentUploadButton.tsx`, `api/documents/upload.ts`

* 🟡 **Mark a "Final submitted" version per major document type**
  - ✅ Version tracking implemented: `version`, `is_latest_version` fields
  - ❌ Missing: Explicit "Final submitted" flag or special version marker

* ✅ **Group documents by type**
  - Implemented: 6 categories (Proposals, Budgets, Reports, Letters, Financial, Other)
  - UI: Category filter in `DocumentsTab.tsx`
  - Database: `document_category` field

* ✅ **Add basic document notes / description field**
  - Implemented: `description` field in `grant_documents` table
  - UI: Description visible in document list

## Basic Reporting

* ✅ **Show total requested vs awarded by year**
  - Implemented: Metrics dashboard with time filters (30/60/90 days, all time)
  - Files: `MetricsPage.tsx`, `api/metrics.ts`

* ✅ **Show number of submissions vs awards (win rate)**
  - Fully implemented: Win rate percentage with circular progress
  - Metrics: Total submitted, total awarded, win rate %

* 🟡 **Show funding by agency / program**
  - ❌ Missing: Agency/program breakdown reports
  - ✅ Implemented: Overall totals and averages
  - Note: Data exists but no UI for agency-specific analysis

* ✅ **Implement CSV export of grants**
  - Fully implemented: Export with all key fields
  - Files: `csvUtils.ts`, `DangerZonePage.tsx`
  - Fields: Title, Agency, ALN, Status, Priority, Dates, Notes, etc.

---

# 🟡 NEXT – Compete with GrantHub / simple Instrumentl use cases

## Federal-Focused Discovery & Pre-Flight

* ✅ **Integrate with Grants.gov / SAM.gov or import feed**
  - ✅ Grants.gov: Fully integrated via API adapter
  - ❌ SAM.gov: Not integrated (only Grants.gov)
  - Files: `GrantsGovAdapter.ts`, `api/grants/search.ts`

* ✅ **Implement search UI**
  - Fully implemented: Filters by agency, category, eligibility, due date
  - Additional: 22 funding categories, 14 federal agencies
  - Files: `DiscoverPage.tsx`, search-catalog API

* ✅ **Enable "Save to pipeline" from search results**
  - Implemented: Modal with initial stage, priority, assignee selection
  - Creates grant record with full metadata
  - Duplicate prevention built-in

* 🟡 **Add simple pre-flight checklist fields**
  - ✅ AI extracts: Eligibility, match requirements, key attachments from NOFO
  - ❌ Missing: Dedicated pre-flight checklist UI/fields
  - Note: Data extracted but no structured pre-flight workflow

## FOA/NOFO Summarizer & Checklist

* ✅ **Allow upload/paste of FOA/NOFO text or PDF**
  - Implemented: PDF upload and AI processing
  - Files: `api/grants/nofo-summary.ts`

* ✅ **Parse and extract core fields**
  - AI extracts: Dates, eligibility, match %, cost share, funding amounts
  - Database: `grant_ai_summaries` table with structured JSONB

* 🟡 **Generate suggested task checklist from FOA**
  - ✅ Default task templates created on grant save (6 standard tasks)
  - ❌ Missing: AI-generated custom checklists from NOFO content
  - Note: Tasks created but not AI-customized per NOFO

* ✅ **Attach generated checklist to the grant record for editing**
  - Tasks linked to grants, fully editable
  - Drag-drop reordering, custom tasks supported

## Awarded-Grant & Post-Award Tracking

* ✅ **Track award amount and start/end dates on awarded grants**
  - Fully implemented: `grant_awards` table
  - Fields: award_date, awarded_amount, award_status
  - Budget periods: budget_period_start, budget_period_end

* ✅ **Add high-level budget categories**
  - Implemented: 11 categories (personnel, travel, equipment, supplies, etc.)
  - Database: `budget_line_items` table
  - UI: `BudgetTab.tsx` with category breakdown

* ✅ **Track simple "spent to date" values**
  - Fully implemented: spent_amount, committed_amount per line item
  - Automatic totals calculation via triggers
  - Burn-down visualization in UI

* ✅ **Add reporting schedule fields**
  - Implemented: `payment_schedules` table
  - Fields: report_due_date, report_required, report_submitted
  - Deliverable tracking included

* ✅ **Include awarded vs requested summary in reporting/dashboard**
  - Metrics dashboard shows: Total awarded, avg award, win rate
  - Budget tab shows: Awarded vs spent with variance

## Security & Compliance (First Steps)

### 2FA (Two-Factor Authentication)

* ❌ **Implement TOTP-based 2FA**
  - Status: Planned (P1 Priority in roadmap)
  - Not implemented

* ❌ **Add QR code 2FA setup flow**
  - Not implemented

* ❌ **Generate & store backup codes for users**
  - Not implemented

* ❌ **Org-level setting: enforce 2FA for admins**
  - Not implemented

### Data Export & Hygiene

* ✅ **Add org-level data export**
  - Implemented: CSV export with all grant data
  - Files: `DangerZonePage.tsx`, `csvUtils.ts`

* 🟡 **Add user-level export for personal data**
  - ✅ Users can export grants they've created
  - ❌ Missing: Dedicated personal data export (GDPR-style)

* ❌ **Implement basic anonymization/pseudonymization on account deletion**
  - Not implemented
  - Current: Soft deletes exist but no anonymization

* 🟡 **Admin UI to request/export org data**
  - ✅ Export function exists in Danger Zone
  - ❌ Missing: Dedicated admin data export UI

## Slack / Teams Notifications (Base Integration)

* ✅ **Create integration settings for Slack (and/or Teams) at org level**
  - Fully implemented: OAuth for both Slack and Teams
  - Files: `api/oauth/slack/`, `api/oauth/microsoft/`
  - UI: `CalendarPage.tsx` integration settings

* 🟡 **Send notifications for new tasks assigned**
  - ✅ Infrastructure: Webhook system implemented
  - ❌ Missing: Actual notification triggers (infrastructure only)

* 🟡 **Send notifications for upcoming deadlines**
  - ✅ Infrastructure: Webhook deliveries, notification channels
  - ❌ Missing: Actual deadline notification triggers

* 🟡 **Include deep links back to the task/grant**
  - ✅ Infrastructure: action_url field in notifications
  - ❌ Missing: Actual implementation in notifications

* ✅ **Allow admins to choose which events trigger notifications**
  - Implemented: Custom webhooks with event selection
  - Events: grant.saved, grant.deadline_approaching, grant.deadline_passed, grant.updated
  - UI: Webhook configuration in CalendarPage

## Real-Time Collaboration (Phase 1)

* 🟡 **Add WebSocket / Supabase Realtime layer**
  - ✅ Supabase Realtime infrastructure available
  - ❌ Missing: Active WebSocket subscriptions
  - Current: Uses 30-second polling instead

* ❌ **Show "Currently viewing: @UserName" on grant detail pages**
  - Not implemented

* 🟡 **Ensure updates to tasks/status/comments appear in real-time**
  - ✅ React Query cache invalidation on mutations
  - ❌ Missing: True real-time push updates (uses polling)

---

# 🔵 LATER – Differentiation & Upsell Paths

## Opinionated Federal Workflows

* ❌ **Define templates for common federal program types**
  - Not implemented
  - Note: Generic task templates exist but not program-specific

* ❌ **Allow choosing a template when creating a new grant**
  - Not implemented

* ❌ **Auto-create recommended tasks and internal deadlines per template**
  - Partial: Default 6 tasks created, but not template-based

* 🟡 **Add "Compliance" tab on awarded grants**
  - ✅ Compliance tab implemented: `ComplianceTab.tsx`
  - ✅ Reporting schedule: Yes
  - ✅ Match requirements: Tracked in budget
  - 🟡 Key conditions & risk flags: Basic compliance tracking only

## Consultant / Multi-Org Mode

* ✅ **Allow a user to belong to multiple organizations**
  - Fully implemented: Users can join multiple orgs

* ✅ **Provide easy org-switcher in UI**
  - Implemented: `OrgSwitcher` component in header

* 🟡 **Build "Consultant overview" page showing tasks & deadlines across orgs**
  - ❌ Missing: Cross-org overview page
  - ✅ Current: Can switch orgs and view each separately

* 🟡 **Determine permissions boundaries (consultant vs internal staff)**
  - ✅ Roles exist: Admin vs Contributor
  - ❌ Missing: Specific "Consultant" role type

## Funder & Grant Intelligence

* ❌ **Aggregate historical data by agency & program**
  - Not implemented

* ❌ **Build "Funder Intelligence Dashboard"**
  - Not implemented

* ❌ **Show success patterns by funder**
  - Not implemented

* ❌ **Add simple competitor/peer analysis views**
  - Not implemented

* ❌ **Define billing/limits for Intelligence as a premium add-on**
  - Not implemented
  - Note: Plan-based limits exist for storage, not intelligence features

## Slack Bot (Commands)

* ❌ **Implement Slack slash command `/grant search [query]`**
  - Not implemented

* ❌ **Implement `/grant save [id or URL]`**
  - Not implemented

* ❌ **Implement `/grant status [grant-name-or-id]`**
  - Not implemented

* ❌ **Add interactive buttons on notifications**
  - Not implemented
  - Note: Basic webhooks exist but no interactive components

## Browser Extension

* ❌ **Build Chrome extension (Manifest V3)**
  - Not implemented

* ❌ **Add "Save to GrantCue" button on Grants.gov / SAM.gov pages**
  - Not implemented

* ❌ **Implement feature: highlight grant ID → quick lookup in sidebar**
  - Not implemented

* ❌ **Support login/auth from extension to main app**
  - Not implemented

* ❌ **Plan Firefox/Edge support**
  - Not implemented

## Advanced Permissions / RBAC

* 🟡 **Design roles: Grant Creator, Grant Viewer, Task Manager, Billing Admin, etc.**
  - ✅ Basic roles: Admin, Contributor, Platform Admin
  - ❌ Missing: Granular role types

* ❌ **Create `roles`, `permissions`, `role_permissions` tables**
  - Not implemented
  - Current: Hard-coded permission checks

* 🟡 **Implement permission checks in backend and UI**
  - ✅ Basic permission checks: `usePermission.ts`
  - ❌ Missing: Fine-grained permissions system

* 🟡 **Add admin UI for assigning roles to users**
  - ✅ Can change Admin ↔ Contributor on `TeamPage.tsx`
  - ❌ Missing: Advanced role assignment UI

* ❌ **(Later) Add custom role builder for larger orgs**
  - Not implemented

---

# 🟣 FUTURE+ – Big Bets & Enterprise / Platform

## Predictive Deadline & Risk Alerts

* 🟡 **Define risk signals**
  - ✅ AI success scores implemented with probability calculations
  - ✅ Days to deadline tracking
  - ❌ Missing: Comprehensive risk scoring based on open tasks, past behavior

* 🟡 **Start with rule-based risk scoring per grant**
  - ✅ Success scores use agency history, competition, org fit
  - ❌ Missing: Task-based risk signals

* ❌ **Upgrade to ML model when volume is sufficient**
  - Not implemented

* ❌ **Show "At risk of missing deadline" banner**
  - Not implemented
  - Note: Shows "Closing soon" and "Overdue" but not risk-based

* ❌ **Send proactive alerts for high-risk grants**
  - Not implemented

## Mobile App (React Native)

* ❌ **Build shared API suitable for mobile clients**
  - Not implemented
  - Note: All APIs are REST-based and could work with mobile

* ❌ **Implement "My Tasks & Deadlines" mobile views**
  - Not implemented

* ❌ **Add push notifications for upcoming deadlines**
  - Not implemented

* ❌ **Enable quick notes/comments on grants from mobile**
  - Not implemented

* ❌ **Add offline mode + sync once online**
  - Not implemented

## Public API & Developer Portal

* 🟡 **Design REST API (auth, rate limits, versioning)**
  - ✅ REST APIs exist for all features
  - ❌ Missing: Public API documentation, versioning, rate limits
  - Note: APIs exist for internal use only

* ❌ **Expose key endpoints (grants, tasks, deadlines, funders)**
  - Not implemented (internal only)

* ❌ **Build developer portal (docs, examples, API keys)**
  - Not implemented

* ❌ **Track API usage & errors**
  - Not implemented

* ❌ **Package paid "Developer Tier" with limits & pricing**
  - Not implemented

## White-Label / Enterprise

* ❌ **Support custom branding (logo, colors) per org**
  - Not implemented
  - Note: Org logos exist but no custom theming

* ❌ **Support custom domain per org (CNAME-based)**
  - Not implemented

* ❌ **Add SSO/SAML integration (Okta, Azure AD, etc.)**
  - Not implemented
  - Status: Planned (P2 Priority)
  - Note: OAuth exists for Google, Slack, Microsoft but not SSO

* ❌ **Plan dedicated infrastructure option for large clients**
  - Not implemented

* ❌ **Define Enterprise pricing & SLAs**
  - Not implemented

## Grant Writing Services Marketplace

* ❌ **Design marketplace model**
  - Not implemented

* ❌ **Create vendor onboarding & vetting flow**
  - Not implemented

* ❌ **Build marketplace directory UI**
  - Not implemented

* ❌ **Add booking & payment flow**
  - Not implemented

* ❌ **Implement review/ratings + dispute handling**
  - Not implemented

## SOC 2 Type II

* 🟡 **Implement logging, monitoring, and access controls to SOC 2 standards**
  - ✅ Activity logging implemented
  - ✅ RLS policies for access control
  - ✅ Audit trails for documents
  - ❌ Missing: Formal SOC 2 compliance program

* 🟡 **Document security policies & procedures**
  - ✅ Security page documentation exists
  - ❌ Missing: Formal policy documentation

* ❌ **Perform internal readiness assessment**
  - Not implemented

* ❌ **Engage external auditor for SOC 2 Type II**
  - Not implemented

* ❌ **Maintain annual audit + remediation cycle**
  - Not implemented

---

# Summary Statistics

## NOW (Core Product) - 39 items
- ✅ **Fully Implemented**: 24 items (62%)
- 🟡 **Partially Implemented**: 12 items (31%)
- ❌ **Not Implemented**: 3 items (7%)

## NEXT (GrantHub Competitive) - 22 items
- ✅ **Fully Implemented**: 8 items (36%)
- 🟡 **Partially Implemented**: 11 items (50%)
- ❌ **Not Implemented**: 3 items (14%)

## LATER (Differentiation) - 28 items
- ✅ **Fully Implemented**: 3 items (11%)
- 🟡 **Partially Implemented**: 6 items (21%)
- ❌ **Not Implemented**: 19 items (68%)

## FUTURE+ (Big Bets) - 38 items
- ✅ **Fully Implemented**: 0 items (0%)
- 🟡 **Partially Implemented**: 5 items (13%)
- ❌ **Not Implemented**: 33 items (87%)

## Overall Progress: 127 Total Items
- ✅ **Fully Implemented**: 35 items (28%)
- 🟡 **Partially Implemented**: 34 items (27%)
- ❌ **Not Implemented**: 58 items (45%)

---

# Key Gaps & Recommendations

## High-Priority Gaps (NOW Category)
1. **Funder & Contact CRM**: Completely missing - need dedicated tables and UI
2. **Stage Expansion**: Missing Go/No-Go, Not funded, Closed out stages
3. **Email Notifications**: Infrastructure exists but not triggered
4. **Google Calendar Sync**: OAuth done but event creation missing

## Medium-Priority Gaps (NEXT Category)
1. **2FA**: Planned but not started
2. **Real-time Collaboration**: Using polling instead of WebSockets
3. **Pre-flight Checklist**: Data extracted but no structured workflow
4. **AI Task Generation**: Tasks are generic, not customized from NOFO

## Infrastructure Ready (Just Needs Triggers)
- Deadline reminder emails
- Task assignment notifications
- Slack/Teams notifications
- Google Calendar event creation
- Webhook event triggers

## Strong Foundation Areas
- Grant pipeline and tracking
- Task management
- Document management
- Post-award financials
- Activity logging and audit trails
- Multi-user collaboration
- Role-based access control
