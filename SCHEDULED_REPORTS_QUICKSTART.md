# Scheduled Reports - Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Database Migration
```bash
# Option A: Using Supabase CLI
cd /home/user/grant-tracker-new
supabase db push

# Option B: Manual (Supabase Dashboard)
# 1. Go to Supabase Dashboard → SQL Editor
# 2. Copy contents of supabase/migrations/20250206_add_scheduled_reports.sql
# 3. Run the SQL
```

### Step 2: Verify Environment Variables
All required variables should already be set. Verify in `.env` or Vercel:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
RESEND_API_KEY=your-key
CRON_SECRET=your-secret
VITE_APP_URL=https://grantcue.com
```

### Step 3: Deploy
```bash
# Commit changes
git add .
git commit -m "Add scheduled email reports feature"
git push origin main

# Or deploy directly to Vercel
vercel deploy --prod
```

### Step 4: Configure Reports
1. Open your app: `https://grantcue.com`
2. Navigate to **Settings → Reports**
3. Configure **Weekly Digest**:
   - Toggle ON
   - Select sections to include
   - Choose delivery day (e.g., Monday)
   - Set time (e.g., 9:00 AM)
4. Configure **Monthly Summary**:
   - Toggle ON
   - Select sections to include
   - Set time (e.g., 9:00 AM)

### Step 5: Test
```bash
# Manual cron trigger (replace YOUR_CRON_SECRET)
curl https://grantcue.com/api/cron/send-scheduled-reports \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## 📧 Email Setup (Resend)

### Configure Sender Domain
1. Go to [Resend Dashboard](https://resend.com/domains)
2. Add and verify `grantcue.com`
3. Add DNS records as instructed
4. Set up `reports@grantcue.com` as sender

### Update Sender Address (if needed)
If using a different domain, edit `/api/cron/send-scheduled-reports.ts`:
```typescript
from: 'YourApp <reports@yourdomain.com>',
```

## 🧪 Testing

### Test Content Generation
```bash
# Get your auth token from browser dev tools (Application → Local Storage)
# Or use Supabase Dashboard to get a user token

curl -X POST https://grantcue.com/api/reports/generate-content \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "org_id": "YOUR_ORG_ID",
    "report_type": "weekly_digest"
  }'
```

### Test Report Sending
```bash
# Manually trigger the cron job
curl https://grantcue.com/api/cron/send-scheduled-reports \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Use Preview in UI
1. Go to Settings → Reports
2. Click "Preview Report" button
3. See what content will be included

## 📊 Monitor

### Vercel Dashboard
- Check cron job logs: `Deployments → Your Deployment → Functions → /api/cron/send-scheduled-reports`
- Verify cron schedule: `Settings → Cron Jobs`

### Supabase Dashboard
```sql
-- Check recent deliveries
SELECT * FROM report_delivery_log
ORDER BY sent_at DESC
LIMIT 10;

-- Check failed deliveries
SELECT * FROM report_delivery_log
WHERE status = 'failed'
ORDER BY sent_at DESC;

-- Check next scheduled times
SELECT
  o.name,
  sr.report_type,
  sr.enabled,
  sr.next_scheduled_at,
  sr.last_sent_at
FROM scheduled_reports sr
JOIN organizations o ON sr.org_id = o.id
WHERE sr.enabled = true
ORDER BY sr.next_scheduled_at;
```

### Resend Dashboard
- Check delivery stats: `Emails → Activity`
- Monitor bounce rates
- View email content

## 🎯 Usage

### Weekly Digest
**What it includes:**
- New grants added to workspace (last 7 days)
- Upcoming deadlines (next 30 days)
- Team activity (comments, status changes)

**When it sends:**
- Your chosen day of the week
- At your chosen time
- Every week

### Monthly Summary
**What it includes:**
- Submission statistics
- Award metrics and funding totals
- Pipeline health overview

**When it sends:**
- 1st of each month
- At your chosen time

## 🔧 Troubleshooting

### Reports Not Sending

**Check 1: Is cron running?**
- Vercel Dashboard → Cron Jobs
- Should show recent executions

**Check 2: Is report enabled?**
```sql
SELECT * FROM scheduled_reports
WHERE org_id = 'YOUR_ORG_ID';
```

**Check 3: Check logs**
- Vercel Dashboard → Functions → Logs
- Look for errors

**Check 4: Manual trigger**
```bash
curl https://grantcue.com/api/cron/send-scheduled-reports \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -v
```

### Emails Not Received

**Check 1: Resend dashboard**
- Go to Resend → Emails
- Find your email
- Check delivery status

**Check 2: Spam folder**
- Check recipient's spam folder
- Add `reports@grantcue.com` to contacts

**Check 3: Delivery logs**
```sql
SELECT * FROM report_delivery_log
WHERE recipient_email = 'user@example.com'
ORDER BY sent_at DESC;
```

**Check 4: Domain verification**
- Resend Dashboard → Domains
- Verify DNS records are correct

### Empty Reports (Skipped)

**This is normal!** Reports are skipped if there's no content:
- Weekly digest: No new grants, deadlines, or activity
- Monthly summary: No submissions, awards, or grants

Check delivery logs:
```sql
SELECT * FROM report_delivery_log
WHERE status = 'skipped'
ORDER BY sent_at DESC;
```

## 📝 Common Tasks

### Change Delivery Schedule
1. Settings → Reports
2. Select report tab
3. Change day/time
4. Changes apply immediately
5. Next scheduled time updates automatically

### Disable Reports Temporarily
1. Settings → Reports
2. Toggle OFF
3. Reports stop sending
4. Toggle ON to resume

### View Report History
1. Settings → Reports
2. Click "Delivery History" tab
3. See all sent reports

### Customize Report Content
1. Settings → Reports
2. Toggle sections on/off:
   - Weekly: New matches, deadlines, team activity
   - Monthly: Submissions, awards, pipeline health
3. Changes apply to next report

### Test Before Sending
1. Settings → Reports
2. Click "Preview Report"
3. See current content
4. Adjust settings as needed

## 🎨 For Developers

### Add Custom Sections
Edit `/lib/emails/report-templates.ts`:
```typescript
// Add to WeeklyDigestData interface
interface WeeklyDigestData {
  // ... existing fields
  customSection: any[]; // Your new section
}

// Add to template
const customSectionHTML = `
  <tr>
    <td style="padding: 24px 32px;">
      <h2>Your Custom Section</h2>
      <!-- Your HTML here -->
    </td>
  </tr>
`;
```

### Add New Report Type
1. Update database:
```sql
-- Add to CHECK constraint in scheduled_reports table
ALTER TABLE scheduled_reports
DROP CONSTRAINT scheduled_reports_report_type_check;

ALTER TABLE scheduled_reports
ADD CONSTRAINT scheduled_reports_report_type_check
CHECK (report_type IN ('weekly_digest', 'monthly_summary', 'your_new_type'));
```

2. Update content generation API
3. Create email template
4. Add to frontend UI

### Modify Cron Schedule
Edit `/vercel.json`:
```json
{
  "path": "/api/cron/send-scheduled-reports",
  "schedule": "0 */2 * * *"  // Every 2 hours instead of hourly
}
```

## 📚 Documentation

- **Full Implementation:** `/SCHEDULED_REPORTS_IMPLEMENTATION.md`
- **Summary:** `/SCHEDULED_REPORTS_SUMMARY.md`
- **This Guide:** `/SCHEDULED_REPORTS_QUICKSTART.md`

## ✅ Checklist

Before going live:
- [ ] Database migration applied
- [ ] Environment variables set
- [ ] Deployed to Vercel
- [ ] Cron job active
- [ ] Resend domain verified
- [ ] Test report generated successfully
- [ ] Test email received
- [ ] Email renders correctly
- [ ] Settings page accessible
- [ ] Delivery logs working

## 🎉 You're Done!

Reports will now send automatically at scheduled times. Team members will receive:
- Weekly digests every chosen day
- Monthly summaries on the 1st of each month

Monitor in:
- Vercel Dashboard (cron execution)
- Supabase Dashboard (delivery logs)
- Resend Dashboard (email delivery)

---

**Questions?** Check `/SCHEDULED_REPORTS_IMPLEMENTATION.md` for detailed documentation.
