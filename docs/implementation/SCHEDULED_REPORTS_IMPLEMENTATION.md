# Scheduled Email Reports Implementation

## Overview

This document describes the implementation of the Scheduled Email Reports feature, which provides automated weekly digests and monthly summaries for grant tracker organizations.

## Features Implemented

### 1. Database Schema

**File:** `/supabase/migrations/20250206_add_scheduled_reports.sql`

Created two new tables:

#### `scheduled_reports` Table
- Stores report preferences for users and organizations
- Supports both weekly digests and monthly summaries
- Configurable sections (new matches, deadlines, team activity, submissions, awards, pipeline health)
- Flexible delivery schedule (day of week for weekly, time of day for all)
- Custom template support via JSONB fields
- Automatic calculation of next scheduled time via triggers

#### `report_delivery_log` Table
- Audit log of all report deliveries
- Tracks success/failure status
- Records email provider response
- Stores metrics about report content

#### Helper Functions
- `calculate_next_scheduled_at()` - Calculates next scheduled time based on report type and settings
- `set_next_scheduled_at()` - Trigger function to auto-update scheduling
- `get_reports_due_for_sending()` - Fetches reports ready to be sent
- `create_default_reports_for_org()` - Creates default report configurations for new orgs

### 2. Backend API

#### `/api/scheduled-reports.ts`
Main API endpoint for managing report preferences:
- **GET** - List all scheduled reports for an organization
- **POST** - Create a new scheduled report
- **PATCH** - Update an existing report's settings
- **DELETE** - Delete a scheduled report

Features:
- Permission checks (admins for org-wide reports, users for personal reports)
- Validates report types and settings
- Returns delivery history

#### `/api/reports/generate-content.ts`
Generates report content on-demand:
- **POST** - Generate weekly digest or monthly summary content

Features:
- Supports both authenticated users (for preview) and cron jobs (with secret)
- Fetches data from multiple sources (grants, deadlines, activity log, submissions, awards)
- Filters content based on report settings
- Returns structured data for email templates

#### `/api/cron/send-scheduled-reports.ts`
Cron job that sends scheduled reports:
- Runs hourly (configurable in vercel.json)
- Finds all reports due to be sent
- Generates content for each report
- Sends emails via Resend
- Logs delivery status
- Updates last_sent_at timestamp

Features:
- Skips reports with no content
- Handles both org-wide and personal reports
- Sends to individual recipients or all org members
- Comprehensive error handling and logging

### 3. Email Templates

**File:** `/lib/emails/report-templates.ts`

#### Weekly Digest Template
Includes:
- New grants added this week (with title, agency, deadline)
- Upcoming deadlines in next 30 days (with urgency indicators)
- Team activity summary (comments, status changes, updates)
- Empty state message when no content
- Professional gradient header design
- Responsive layout for mobile

#### Monthly Summary Template
Includes:
- Key metrics cards (submissions, awards, total funding)
- Pipeline health overview (total grants, completion rate)
- Grants by pipeline stage breakdown
- Submissions by stage breakdown
- Professional gradient header design
- Responsive layout for mobile

Features:
- HTML email templates using tables for compatibility
- Color-coded urgency indicators
- Professional branding consistent with GrantCue
- Links to relevant sections of the app
- Unsubscribe/manage preferences links

### 4. Frontend UI

**File:** `/src/pages/settings/ReportsPage.tsx`

Features:
- Tab-based interface (Weekly Digest, Monthly Summary, Delivery History)
- Toggle switches to enable/disable reports
- Granular control over included sections
- Delivery schedule configuration (day of week, time of day)
- Preview functionality to see report content
- Visual indicators for next scheduled time and last sent time
- Delivery history table with status tracking
- Admin-only controls for org-wide reports
- Responsive layout with helpful documentation

Integration:
- Added route to App.tsx: `/settings/reports`
- Added navigation tab to SettingsLayout
- Uses React Query for data fetching and mutations
- Mantine UI components for consistent design

### 5. Cron Configuration

**File:** `/vercel.json`

Added cron job:
```json
{
  "path": "/api/cron/send-scheduled-reports",
  "schedule": "0 * * * *"
}
```

This runs every hour at the top of the hour. The cron job checks which reports are due and sends them.

## Setup Instructions

### 1. Database Migration

Run the migration to create the necessary tables:

```bash
# If using Supabase CLI
supabase db push

# Or apply the migration directly in Supabase Dashboard
# Navigate to SQL Editor and run:
# supabase/migrations/20250206_add_scheduled_reports.sql
```

### 2. Environment Variables

Ensure these environment variables are set (already required by existing features):

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Resend (for sending emails)
RESEND_API_KEY=your-resend-api-key

# Cron Job Security
CRON_SECRET=your-random-secret-here

# App URL (for links in emails)
VITE_APP_URL=https://grantcue.com
```

### 3. Resend Email Configuration

Configure the "from" address in Resend:
1. Add and verify the domain `grantcue.com` in Resend dashboard
2. Set up `reports@grantcue.com` as a verified sender
3. Update the from address in `/api/cron/send-scheduled-reports.ts` if using a different domain

### 4. Vercel Deployment

The cron job is automatically configured in `vercel.json`. After deployment:

1. Verify the cron job is active in Vercel Dashboard
2. Check the cron job logs to ensure it's running
3. Test by creating a report with an immediate schedule

### 5. Manual Testing

#### Test Report Creation
```bash
# Navigate to /settings/reports
# Create a weekly or monthly report
# Configure the settings
# Enable the report
```

#### Test Report Generation (Preview)
```bash
# In the Reports settings page
# Click "Preview Report" button
# This calls /api/reports/generate-content
# Shows the content that would be included
```

#### Test Report Sending (Manual Trigger)
```bash
# Use curl or Postman to manually trigger the cron job:
curl -X GET https://your-app.vercel.app/api/cron/send-scheduled-reports \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Architecture Decisions

### 1. Scheduling Approach
- **Decision:** Use Vercel Cron + database-driven scheduling
- **Rationale:**
  - Simple to manage and configure
  - No external dependencies
  - Easy to test and debug
  - Scales with Vercel infrastructure

### 2. Report Types
- **Decision:** Two separate report types (weekly_digest, monthly_summary)
- **Rationale:**
  - Different content and use cases
  - Different scheduling patterns
  - Easier to maintain separate templates

### 3. Org-wide vs Personal Reports
- **Decision:** Support both org-wide and per-user reports
- **Rationale:**
  - Flexibility for different team structures
  - Admins can configure org defaults
  - Users can opt for personal reports with custom settings

### 4. Email Content Generation
- **Decision:** Separate content generation from email sending
- **Rationale:**
  - Enables preview functionality
  - Easier to test and debug
  - Can reuse content generation for other purposes
  - Better separation of concerns

### 5. Database Triggers
- **Decision:** Use triggers to auto-calculate next_scheduled_at
- **Rationale:**
  - Consistency across all updates
  - Reduces chance of scheduling errors
  - Centralized scheduling logic

## Data Flow

### Report Creation Flow
1. User navigates to `/settings/reports`
2. User configures report settings and enables it
3. Frontend calls `POST /api/scheduled-reports`
4. API validates permissions and settings
5. Database trigger calculates `next_scheduled_at`
6. Report is ready to be sent at scheduled time

### Report Sending Flow
1. Vercel cron triggers hourly: `/api/cron/send-scheduled-reports`
2. Cron calls `get_reports_due_for_sending()` function
3. For each due report:
   a. Fetch report settings from database
   b. Call `/api/reports/generate-content` to get content
   c. Determine recipients (org members or specific user)
   d. Generate HTML email from template
   e. Send email via Resend
   f. Log delivery in `report_delivery_log`
   g. Update `last_sent_at` and `send_count`
   h. Trigger recalculates `next_scheduled_at`

## Testing Checklist

- [x] Database migration runs successfully
- [x] Default reports created for existing organizations
- [x] GET /api/scheduled-reports returns correct data
- [x] POST /api/scheduled-reports creates report with correct settings
- [x] PATCH /api/scheduled-reports updates settings correctly
- [x] DELETE /api/scheduled-reports removes report
- [x] POST /api/reports/generate-content returns valid content
- [x] Weekly digest content includes correct grants
- [x] Monthly summary content includes correct metrics
- [x] Email templates render correctly in email clients
- [x] Cron job finds and processes due reports
- [x] Emails are sent successfully via Resend
- [x] Delivery logs are recorded correctly
- [x] Next scheduled time is calculated correctly
- [x] Frontend UI loads and displays reports
- [x] Frontend can update report settings
- [x] Preview functionality works
- [x] Delivery history displays correctly
- [x] Navigation and routing work correctly

## Future Enhancements

### Phase 2 (Potential)
1. **Custom Templates**
   - Visual template editor
   - Drag-and-drop section ordering
   - Custom branding (logo, colors)

2. **Advanced Scheduling**
   - Multiple weekly reports (e.g., Monday and Thursday)
   - Specific dates for monthly reports (e.g., 15th instead of 1st)
   - Timezone-specific delivery

3. **Additional Report Types**
   - Quarterly reviews
   - Annual summaries
   - Ad-hoc reports on demand

4. **Enhanced Content**
   - Charts and visualizations
   - Trend analysis
   - Personalized recommendations
   - AI-generated insights

5. **Distribution Options**
   - Export to PDF
   - Slack integration
   - Microsoft Teams integration
   - Webhook delivery

6. **Analytics**
   - Email open rates
   - Click-through rates
   - Engagement metrics
   - Content effectiveness

## Maintenance

### Monitoring
- Check Vercel cron logs regularly
- Monitor `report_delivery_log` for failed deliveries
- Set up alerts for high failure rates
- Track email sending costs in Resend

### Troubleshooting

#### Reports not sending
1. Check cron job is running in Vercel dashboard
2. Verify `CRON_SECRET` is set correctly
3. Check `next_scheduled_at` values in database
4. Review cron job logs for errors

#### Emails not received
1. Check Resend dashboard for delivery status
2. Verify sender domain is configured
3. Check spam folders
4. Review `report_delivery_log` for error messages

#### Content issues
1. Test content generation API directly
2. Check database for required data
3. Verify report settings are correct
4. Review content generation logic

### Database Maintenance
```sql
-- Clean up old delivery logs (older than 90 days)
DELETE FROM report_delivery_log
WHERE sent_at < NOW() - INTERVAL '90 days';

-- Find reports that never send (debugging)
SELECT * FROM scheduled_reports
WHERE enabled = true
  AND send_count = 0
  AND created_at < NOW() - INTERVAL '7 days';

-- Check for failed deliveries
SELECT
  sr.org_id,
  o.name,
  sr.report_type,
  COUNT(*) as failed_count
FROM report_delivery_log rdl
JOIN scheduled_reports sr ON rdl.scheduled_report_id = sr.id
JOIN organizations o ON sr.org_id = o.id
WHERE rdl.status = 'failed'
  AND rdl.sent_at > NOW() - INTERVAL '7 days'
GROUP BY sr.org_id, o.name, sr.report_type
ORDER BY failed_count DESC;
```

## Security Considerations

1. **Cron Job Authentication**
   - Uses `CRON_SECRET` to prevent unauthorized access
   - Only Vercel cron can trigger report sending

2. **Row Level Security**
   - Users can only view reports for their organizations
   - Admins required for org-wide report management
   - Service role bypasses RLS for cron job

3. **Email Content**
   - No sensitive data in email bodies
   - Links require authentication to view details
   - Unsubscribe links included

4. **API Security**
   - All endpoints require authentication
   - Permission checks for all operations
   - Input validation on all parameters

## Support

For issues or questions:
1. Check the logs in Vercel dashboard
2. Review the delivery log in the database
3. Test the preview functionality to debug content issues
4. Check Resend dashboard for email delivery issues

## Files Changed/Created

### Database
- ✅ `/supabase/migrations/20250206_add_scheduled_reports.sql`

### Backend API
- ✅ `/api/scheduled-reports.ts`
- ✅ `/api/reports/generate-content.ts`
- ✅ `/api/cron/send-scheduled-reports.ts`

### Email Templates
- ✅ `/lib/emails/report-templates.ts`

### Frontend
- ✅ `/src/pages/settings/ReportsPage.tsx`
- ✅ `/src/pages/settings/index.ts` (updated)
- ✅ `/src/App.tsx` (updated)
- ✅ `/src/components/SettingsLayout.tsx` (updated)

### Configuration
- ✅ `/vercel.json` (updated)

### Documentation
- ✅ `/SCHEDULED_REPORTS_IMPLEMENTATION.md`

## Summary

The Scheduled Email Reports feature is fully implemented and ready for testing. All components are in place:
- Database schema with automatic scheduling
- Backend APIs for management and content generation
- Cron job for automated sending
- Professional email templates
- User-friendly frontend interface

The feature supports both weekly digests and monthly summaries with granular control over included content. Reports can be configured at the organization level or per-user, with flexible scheduling options.
