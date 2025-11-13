/**
 * Cron Job: Send Deadline Reminders
 *
 * Runs daily to send email reminders for upcoming grant deadlines
 * based on organization notification settings (30d, 14d, 7d, 3d, 1d, same day)
 *
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/send-deadline-reminders",
 *     "schedule": "0 9 * * *"
 *   }]
 * }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { generateDeadlineReminderEmail } from '../../lib/emails/report-templates.js';

const resend = new Resend(process.env.RESEND_API_KEY);

interface OrganizationSettings {
  org_id: string;
  org_name: string;
  deadline_reminders_30d: boolean;
  deadline_reminders_14d: boolean;
  deadline_reminders_7d: boolean;
  deadline_reminders_3d: boolean;
  deadline_reminders_1d: boolean;
  deadline_reminders_0d: boolean;
}

interface Grant {
  id: string;
  title: string;
  agency: string | null;
  close_date: string;
  status: string | null;
  org_id: string;
}

interface OrgMember {
  user_id: string;
  email: string;
  full_name: string | null;
}

/**
 * Get all organizations with their deadline reminder settings
 */
async function getOrganizationsWithSettings(supabase: any): Promise<OrganizationSettings[]> {
  const { data, error } = await supabase
    .from('organization_settings')
    .select(`
      org_id,
      deadline_reminders_30d,
      deadline_reminders_14d,
      deadline_reminders_7d,
      deadline_reminders_3d,
      deadline_reminders_1d,
      deadline_reminders_0d,
      organizations!inner(name)
    `);

  if (error) {
    console.error('[Deadline Reminders] Error fetching organization settings:', error);
    throw error;
  }

  return (data || []).map((row: any) => ({
    org_id: row.org_id,
    org_name: row.organizations.name,
    deadline_reminders_30d: row.deadline_reminders_30d ?? true,
    deadline_reminders_14d: row.deadline_reminders_14d ?? true,
    deadline_reminders_7d: row.deadline_reminders_7d ?? true,
    deadline_reminders_3d: row.deadline_reminders_3d ?? true,
    deadline_reminders_1d: row.deadline_reminders_1d ?? true,
    deadline_reminders_0d: row.deadline_reminders_0d ?? true,
  }));
}

/**
 * Get grants with deadlines in the specified number of days
 */
async function getGrantsWithDeadline(
  supabase: any,
  orgId: string,
  daysUntil: number
): Promise<Grant[]> {
  // Calculate the target date (start and end of day)
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysUntil);
  targetDate.setHours(0, 0, 0, 0);

  const endOfTargetDate = new Date(targetDate);
  endOfTargetDate.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('org_grants_saved')
    .select('id, title, agency, close_date, status')
    .eq('org_id', orgId)
    .gte('close_date', targetDate.toISOString())
    .lte('close_date', endOfTargetDate.toISOString())
    .not('status', 'in', '("awarded", "rejected", "withdrawn")'); // Exclude completed grants

  if (error) {
    console.error(`[Deadline Reminders] Error fetching grants for org ${orgId}, days ${daysUntil}:`, error);
    return [];
  }

  return (data || []).map((grant: any) => ({
    id: grant.id,
    title: grant.title,
    agency: grant.agency,
    close_date: grant.close_date,
    status: grant.status,
    org_id: orgId,
  }));
}

/**
 * Get organization members (recipients for notifications)
 */
async function getOrgMembers(supabase: any, orgId: string): Promise<OrgMember[]> {
  // First, get all user IDs in the org
  const { data: memberIds, error: memberError } = await supabase
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgId);

  if (memberError || !memberIds || memberIds.length === 0) {
    console.error(`[Deadline Reminders] Error fetching members for org ${orgId}:`, memberError);
    return [];
  }

  const userIds = memberIds.map((m: any) => m.user_id);

  // Then get user profiles and emails
  const { data: profiles, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .in('id', userIds);

  if (profileError) {
    console.error(`[Deadline Reminders] Error fetching user profiles:`, profileError);
    return [];
  }

  // Get emails from auth schema using RPC or direct query
  // Since we can't directly query auth.users from Supabase client,
  // we'll use the admin API
  const result: OrgMember[] = [];

  for (const userId of userIds) {
    try {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);

      if (!userError && userData?.user?.email) {
        const profile = profiles?.find((p: any) => p.id === userId);
        result.push({
          user_id: userId,
          email: userData.user.email,
          full_name: profile?.full_name || userData.user.email,
        });
      }
    } catch (error) {
      console.error(`[Deadline Reminders] Error fetching user ${userId}:`, error);
    }
  }

  return result;
}

/**
 * Send deadline reminder email to a recipient
 */
async function sendDeadlineEmail(
  recipient: OrgMember,
  orgName: string,
  daysUntil: number,
  grants: Grant[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const emailHtml = generateDeadlineReminderEmail({
      orgName,
      userName: recipient.full_name || 'User',
      daysUntil,
      grants,
    });

    const daysText = daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} Days`;
    const subject = `${grants.length} Grant${grants.length === 1 ? '' : 's'} Due ${daysText} - ${orgName}`;

    const result = await resend.emails.send({
      from: 'GrantCue Deadlines <deadlines@grantcue.com>',
      to: recipient.email,
      subject,
      html: emailHtml,
    });

    if (result.error) {
      throw result.error;
    }

    console.log(`[Deadline Reminders] Sent email to ${recipient.email} for ${grants.length} grants (${daysUntil} days)`);
    return { success: true };
  } catch (error) {
    console.error(`[Deadline Reminders] Failed to send email to ${recipient.email}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create in-app notifications for deadline reminders
 */
async function createInAppNotifications(
  supabase: any,
  orgId: string,
  members: OrgMember[],
  grants: Grant[],
  daysUntil: number
): Promise<void> {
  const daysText = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;

  for (const member of members) {
    for (const grant of grants) {
      try {
        await supabase.from('in_app_notifications').insert({
          user_id: member.user_id,
          org_id: orgId,
          type: 'deadline_reminder',
          title: `Deadline ${daysText}: ${grant.title}`,
          message: `Grant deadline is ${daysText}. ${grant.agency ? `Agency: ${grant.agency}.` : ''} Don't miss this opportunity!`,
          action_url: `/grants/${grant.id}`,
          metadata: {
            grant_id: grant.id,
            days_until: daysUntil,
            close_date: grant.close_date,
          },
        });
      } catch (error) {
        console.error(`[Deadline Reminders] Failed to create in-app notification for user ${member.user_id}:`, error);
      }
    }
  }
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
    console.log('[Deadline Reminders] Starting deadline reminder check...');

    // Get all organizations with their settings
    const orgs = await getOrganizationsWithSettings(supabase);

    if (orgs.length === 0) {
      return res.status(200).json({
        message: 'No organizations found',
        timestamp: new Date().toISOString(),
        results: [],
      });
    }

    console.log(`[Deadline Reminders] Processing ${orgs.length} organizations`);

    const results = [];
    let totalEmailsSent = 0;
    let totalEmailsFailed = 0;
    let totalNotifications = 0;

    // Define reminder intervals (in days)
    const reminderIntervals = [
      { days: 30, setting: 'deadline_reminders_30d' },
      { days: 14, setting: 'deadline_reminders_14d' },
      { days: 7, setting: 'deadline_reminders_7d' },
      { days: 3, setting: 'deadline_reminders_3d' },
      { days: 1, setting: 'deadline_reminders_1d' },
      { days: 0, setting: 'deadline_reminders_0d' },
    ] as const;

    // Process each organization
    for (const org of orgs) {
      const orgResult: any = {
        org_id: org.org_id,
        org_name: org.org_name,
        reminders: [],
      };

      // Check each reminder interval
      for (const interval of reminderIntervals) {
        // Skip if this reminder is disabled for this org
        if (!org[interval.setting as keyof OrganizationSettings]) {
          continue;
        }

        // Get grants with deadlines at this interval
        const grants = await getGrantsWithDeadline(supabase, org.org_id, interval.days);

        if (grants.length === 0) {
          continue;
        }

        console.log(`[Deadline Reminders] Found ${grants.length} grants for ${org.org_name} at ${interval.days} days`);

        // Get organization members
        const members = await getOrgMembers(supabase, org.org_id);

        if (members.length === 0) {
          console.warn(`[Deadline Reminders] No members found for org ${org.org_id}`);
          continue;
        }

        let sentCount = 0;
        let failedCount = 0;

        // Send email to each member
        for (const member of members) {
          const result = await sendDeadlineEmail(member, org.org_name, interval.days, grants);
          if (result.success) {
            sentCount++;
          } else {
            failedCount++;
          }
        }

        // Create in-app notifications
        await createInAppNotifications(supabase, org.org_id, members, grants, interval.days);

        totalEmailsSent += sentCount;
        totalEmailsFailed += failedCount;
        totalNotifications += grants.length * members.length;

        orgResult.reminders.push({
          days_until: interval.days,
          grants_count: grants.length,
          members_notified: members.length,
          emails_sent: sentCount,
          emails_failed: failedCount,
        });
      }

      if (orgResult.reminders.length > 0) {
        results.push(orgResult);
      }
    }

    console.log(`[Deadline Reminders] Completed: ${totalEmailsSent} emails sent, ${totalEmailsFailed} failed, ${totalNotifications} in-app notifications created`);

    return res.status(200).json({
      message: 'Deadline reminders processed',
      timestamp: new Date().toISOString(),
      summary: {
        organizations_processed: orgs.length,
        emails_sent: totalEmailsSent,
        emails_failed: totalEmailsFailed,
        in_app_notifications_created: totalNotifications,
      },
      results,
    });
  } catch (error) {
    console.error('[Deadline Reminders] Cron job error:', error);
    return res.status(500).json({
      error: 'Failed to process deadline reminders',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
