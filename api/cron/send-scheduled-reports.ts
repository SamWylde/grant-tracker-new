/**
 * Cron Job: Send Scheduled Reports
 *
 * Runs hourly to send scheduled email reports (weekly digests and monthly summaries)
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/send-scheduled-reports",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import {
  generateWeeklyDigestEmail,
  generateMonthlySummaryEmail,
} from '../../lib/emails/report-templates.js';

const resend = new Resend(process.env.RESEND_API_KEY);

interface ReportData {
  id: string;
  org_id: string;
  user_id: string | null;
  report_type: string;
  org_name: string;
  user_email: string | null;
  settings: any;
}

/**
 * Fetch report content from generate-content API
 */
async function fetchReportContent(orgId: string, reportType: string, reportId: string) {
  const response = await fetch(`${process.env.VITE_APP_URL || 'https://grantcue.com'}/api/reports/generate-content`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
    body: JSON.stringify({
      org_id: orgId,
      report_type: reportType,
      report_id: reportId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch report content: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get recipients for a report
 */
async function getReportRecipients(
  supabase: any,
  report: ReportData
): Promise<Array<{ email: string; name: string }>> {
  // If user_id is set, send only to that user
  if (report.user_id && report.user_email) {
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', report.user_id)
      .single();

    return [
      {
        email: report.user_email,
        name: userProfile?.full_name || report.user_email,
      },
    ];
  }

  // Otherwise, send to all org members
  const { data: members } = await supabase
    .from('org_members')
    .select(`
      user_id,
      auth.users!inner(email),
      user_profiles(full_name)
    `)
    .eq('org_id', report.org_id);

  if (!members || members.length === 0) {
    return [];
  }

  return members.map((member: any) => ({
    email: member.users?.email || '',
    name: member.user_profiles?.full_name || member.users?.email || 'Team Member',
  }));
}

/**
 * Send a single report
 */
async function sendReport(
  supabase: any,
  report: ReportData,
  content: any
): Promise<{ sent: number; failed: number; skipped: boolean }> {
  const recipients = await getReportRecipients(supabase, report);

  if (recipients.length === 0) {
    console.log(`No recipients for report ${report.id}`);
    return { sent: 0, failed: 0, skipped: true };
  }

  // Check if there's content to send
  const hasContent =
    report.report_type === 'weekly_digest'
      ? content.content.newGrants.length > 0 ||
        content.content.upcomingDeadlines.length > 0 ||
        content.content.teamActivity.length > 0
      : content.content.submissions.total > 0 ||
        content.content.awards.total > 0 ||
        content.content.pipelineHealth.totalGrants > 0;

  if (!hasContent) {
    console.log(`No content to send for report ${report.id}`);
    return { sent: 0, failed: 0, skipped: true };
  }

  let sent = 0;
  let failed = 0;

  // Send to each recipient
  for (const recipient of recipients) {
    try {
      // Generate email HTML
      let emailHtml: string;
      let subject: string;

      if (report.report_type === 'weekly_digest') {
        subject = `Weekly Digest - ${report.org_name}`;
        emailHtml = generateWeeklyDigestEmail({
          orgName: report.org_name,
          userName: recipient.name,
          newGrants: content.content.newGrants,
          upcomingDeadlines: content.content.upcomingDeadlines,
          teamActivity: content.content.teamActivity,
        });
      } else {
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const monthName = lastMonth.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        });

        subject = `Monthly Summary - ${monthName} - ${report.org_name}`;
        emailHtml = generateMonthlySummaryEmail({
          orgName: report.org_name,
          userName: recipient.name,
          month: monthName,
          submissions: content.content.submissions,
          awards: content.content.awards,
          pipelineHealth: content.content.pipelineHealth,
        });
      }

      // Send email via Resend
      const result = await resend.emails.send({
        from: 'GrantCue <reports@grantcue.com>',
        to: recipient.email,
        subject,
        html: emailHtml,
      });

      if (result.error) {
        throw result.error;
      }

      // Log successful delivery
      await supabase.from('report_delivery_log').insert({
        scheduled_report_id: report.id,
        org_id: report.org_id,
        user_id: report.user_id,
        report_type: report.report_type,
        status: 'sent',
        recipient_email: recipient.email,
        email_provider_id: result.data?.id,
        grants_included:
          report.report_type === 'weekly_digest'
            ? content.content.newGrants.length
            : content.content.pipelineHealth.totalGrants,
        deadlines_included:
          report.report_type === 'weekly_digest'
            ? content.content.upcomingDeadlines.length
            : 0,
        activities_included:
          report.report_type === 'weekly_digest'
            ? content.content.teamActivity.length
            : 0,
      });

      sent++;
    } catch (error) {
      console.error(`Failed to send report to ${recipient.email}:`, error);

      // Log failed delivery
      await supabase.from('report_delivery_log').insert({
        scheduled_report_id: report.id,
        org_id: report.org_id,
        user_id: report.user_id,
        report_type: report.report_type,
        status: 'failed',
        recipient_email: recipient.email,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });

      failed++;
    }
  }

  return { sent, failed, skipped: false };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify this is a cron request
  const authHeader = req.headers.authorization;

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get all reports that are due to be sent
    const { data: reportsRaw, error: reportsError } = await supabase.rpc(
      'get_reports_due_for_sending'
    );

    if (reportsError) {
      throw reportsError;
    }

    if (!reportsRaw || reportsRaw.length === 0) {
      return res.status(200).json({
        message: 'No reports due for sending',
        timestamp: new Date().toISOString(),
        results: [],
      });
    }

    console.log(`Found ${reportsRaw.length} reports to send`);

    const results = [];

    // Process each report
    for (const reportRaw of reportsRaw) {
      try {
        // Get full report settings
        const { data: report, error: reportError } = await supabase
          .from('scheduled_reports')
          .select('*')
          .eq('id', reportRaw.id)
          .single();

        if (reportError || !report) {
          throw new Error(`Failed to fetch report ${reportRaw.id}`);
        }

        console.log(`Processing report ${report.id} (${report.report_type})`);

        // Fetch report content
        const content = await fetchReportContent(
          report.org_id,
          report.report_type,
          report.id
        );

        // Send the report
        const result = await sendReport(
          supabase,
          {
            ...report,
            org_name: reportRaw.org_name,
            user_email: reportRaw.user_email,
            settings: report,
          },
          content
        );

        // Update report tracking
        await supabase
          .from('scheduled_reports')
          .update({
            last_sent_at: new Date().toISOString(),
            send_count: report.send_count + 1,
          })
          .eq('id', report.id);

        results.push({
          report_id: report.id,
          org_name: reportRaw.org_name,
          report_type: report.report_type,
          status: result.skipped ? 'skipped' : 'sent',
          sent: result.sent,
          failed: result.failed,
        });

        console.log(
          `Completed report ${report.id}: ${result.sent} sent, ${result.failed} failed${result.skipped ? ' (skipped - no content)' : ''}`
        );
      } catch (error) {
        console.error(`Error processing report ${reportRaw.id}:`, error);
        results.push({
          report_id: reportRaw.id,
          org_name: reportRaw.org_name,
          report_type: reportRaw.report_type,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return res.status(200).json({
      message: 'Report sending completed',
      timestamp: new Date().toISOString(),
      processed: reportsRaw.length,
      results,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return res.status(500).json({
      error: 'Failed to send reports',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
