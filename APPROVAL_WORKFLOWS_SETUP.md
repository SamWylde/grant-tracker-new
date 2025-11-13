# Approval Workflows - Quick Setup Guide

## Prerequisites

- Supabase project configured
- Resend API key for email notifications
- Node.js environment with dependencies installed

## Setup Steps

### 1. Apply Database Migration

**Option A: Using Supabase CLI**
```bash
cd /home/user/grant-tracker-new
supabase db push
```

**Option B: Manual via Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Create new query
4. Copy contents of `supabase/migrations/20250205_add_approval_workflows.sql`
5. Paste and execute

### 2. Verify Environment Variables

Ensure these variables are set in your environment (`.env` or Vercel environment):

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Resend Email API
RESEND_API_KEY=re_your_resend_key_here
```

### 3. Install Dependencies (if needed)

All required dependencies should already be installed:
- `@supabase/supabase-js` ✓
- `resend` ✓
- `@mantine/core`, `@mantine/notifications` ✓
- `@tanstack/react-query` ✓

No additional packages needed!

### 4. Build and Deploy

```bash
# Build the application
npm run build

# Deploy to Vercel (if using Vercel)
vercel --prod
```

### 5. Verify Database Tables

After migration, verify these tables exist in Supabase:
- `approval_workflows`
- `approval_requests`
- `approval_request_approvers`

Check in: Supabase Dashboard → Database → Tables

### 6. Test the Feature

#### As Admin:
1. Log in to your application
2. Navigate to `/settings/workflows`
3. Create a test workflow:
   - Name: "Test Approval"
   - From Stage: "Researching"
   - To Stage: "Drafting"
   - Add approval level with your user as approver
   - Save

#### As User:
1. Go to a grant in "Researching" stage
2. Click "Change Stage" → "Start Drafting"
3. Should see "Approval Required" indicator
4. Submit approval request
5. Check email for notification (if configured)
6. Go to `/approvals` to see pending request

#### As Approver:
1. Navigate to `/approvals`
2. See request in "My Approvals" tab
3. Click "Review Request"
4. Approve or reject
5. Verify grant stage updates (if approved)

## Navigation Menu Integration

To add approval workflows to your navigation menu, update your navigation component:

```tsx
// In your navigation/header component
import { IconShieldCheck } from '@tabler/icons-react';

// Add to menu items:
{
  label: 'Approvals',
  icon: IconShieldCheck,
  href: '/approvals',
  badge: pendingApprovalsCount, // Optional: show count
},

// In admin settings menu:
{
  label: 'Approval Workflows',
  icon: IconSettings,
  href: '/settings/workflows',
  adminOnly: true,
}
```

To get pending approvals count:

```tsx
import { getPendingApprovalsCount } from '../utils/approvalsApi';

const { data: pendingCount } = useQuery({
  queryKey: ['pendingApprovalsCount', currentOrg?.id],
  queryFn: () => getPendingApprovalsCount(currentOrg!.id),
  enabled: !!currentOrg?.id,
  refetchInterval: 60000, // Refresh every minute
});
```

## Grant Detail Page Integration

To add the stage transition button to your grant detail pages:

```tsx
// In GrantDetailDrawer.tsx or similar component
import { StageTransitionButton } from './StageTransitionButton';

// Add to your grant actions area:
<StageTransitionButton
  grantId={grant.id}
  orgId={grant.org_id}
  currentStage={grant.status as GrantStage}
  onStageChanged={() => {
    // Refresh grant data
    queryClient.invalidateQueries({ queryKey: ['savedGrants'] });
  }}
/>
```

## Email Template Customization

To customize email templates, edit the functions in:
- `/api/approval-requests.ts` → `generateApprovalRequestEmailHTML()`

Default sender: `approvals@grantcue.com`
Make sure this email is verified in Resend dashboard.

## Troubleshooting

### Issue: Migration fails with "relation already exists"
**Solution**: Tables already created. Check if previous migration ran. If needed, drop tables and re-run:
```sql
DROP TABLE IF EXISTS approval_request_approvers CASCADE;
DROP TABLE IF EXISTS approval_requests CASCADE;
DROP TABLE IF EXISTS approval_workflows CASCADE;
```

### Issue: Emails not sending
**Solution**:
1. Verify `RESEND_API_KEY` is set correctly
2. Check Resend dashboard for delivery logs
3. Verify sender email is verified in Resend
4. Check user profiles have email addresses

### Issue: RLS policy errors
**Solution**: Ensure you're using service role key for API routes, not anon key.
Check `process.env.SUPABASE_SERVICE_ROLE_KEY` in API routes.

### Issue: Routes not found (404)
**Solution**:
1. Clear browser cache
2. Rebuild application: `npm run build`
3. Verify routes added to `App.tsx`
4. Check for TypeScript compilation errors

### Issue: Permission denied errors
**Solution**:
1. Verify user is member of organization
2. Check user role (workflows require admin for creation)
3. Review RLS policies in Supabase

## Database Indexes

The migration includes optimized indexes. If performance issues arise, verify these indexes exist:

```sql
-- Check indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('approval_workflows', 'approval_requests', 'approval_request_approvers');
```

Expected indexes:
- `idx_approval_workflows_org_id`
- `idx_approval_workflows_active`
- `idx_approval_workflows_transition`
- `idx_approval_requests_org_id`
- `idx_approval_requests_grant_id`
- `idx_approval_requests_pending`
- `idx_approval_request_approvers_user`
- `idx_approval_request_approvers_pending`

## Production Checklist

Before going live:

- [ ] Database migration applied successfully
- [ ] Environment variables configured
- [ ] Email service tested (Resend)
- [ ] RLS policies verified
- [ ] Test workflow created and tested
- [ ] Test approval request submitted and processed
- [ ] Email notifications received
- [ ] In-app notifications working
- [ ] Admin and user permissions tested
- [ ] Multi-level approval tested (if using)
- [ ] Navigation menu updated
- [ ] Grant detail pages integrated
- [ ] Error logging configured
- [ ] Monitoring set up (optional)

## Monitoring

To monitor approval workflows in production:

1. **Database Queries**: Monitor slow queries in Supabase
2. **Email Delivery**: Check Resend dashboard for failures
3. **Error Logs**: Check Vercel/server logs for API errors
4. **User Feedback**: Monitor for UX issues or confusion

Useful SQL queries for monitoring:

```sql
-- Pending requests older than 24 hours
SELECT ar.*, g.title as grant_title
FROM approval_requests ar
JOIN org_grants_saved g ON g.id = ar.grant_id
WHERE ar.status = 'pending'
  AND ar.requested_at < NOW() - INTERVAL '24 hours';

-- Active workflows by organization
SELECT org_id, COUNT(*) as workflow_count
FROM approval_workflows
WHERE is_active = true
GROUP BY org_id;

-- Approval metrics
SELECT
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (completed_at - requested_at))/3600) as avg_hours_to_complete
FROM approval_requests
WHERE completed_at IS NOT NULL
GROUP BY status;
```

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the main implementation documentation
3. Check Supabase logs for database errors
4. Review Vercel logs for API errors
5. Test with simple workflow first before complex multi-level chains

## Success!

Once setup is complete, you'll have a fully functional approval workflow system that:
- Enforces approval requirements on grant stage transitions
- Supports multi-level approval chains
- Sends email notifications to approvers
- Tracks approval progress and history
- Provides admin configuration UI
- Integrates seamlessly with existing grant pipeline

Enjoy your new approval workflows feature!
