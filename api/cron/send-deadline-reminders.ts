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
import { verifyCronAuth } from '../utils/auth.js';

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
  loi_deadline_reminders_enabled: boolean;
  loi_deadline_reminders_30d: boolean;
  loi_deadline_reminders_14d: boolean;
  loi_deadline_reminders_7d: boolean;
  loi_deadline_reminders_3d: boolean;
  loi_deadline_reminders_1d: boolean;
  loi_deadline_reminders_0d: boolean;
  internal_deadline_reminders_enabled: boolean;
  internal_deadline_reminders_30d: boolean;
  internal_deadline_reminders_14d: boolean;
  internal_deadline_reminders_7d: boolean;
  internal_deadline_reminders_3d: boolean;
  internal_deadline_reminders_1d: boolean;
  internal_deadline_reminders_0d: boolean;
}

interface Grant {
  id: string;
  title: string;
  agency: string | null;
  close_date: string;
  status: string | null;
  org_id: string;
  deadline_type?: 'external' | 'loi' | 'internal';
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
      loi_deadline_reminders_enabled,
      loi_deadline_reminders_30d,
      loi_deadline_reminders_14d,
      loi_deadline_reminders_7d,
      loi_deadline_reminders_3d,
      loi_deadline_reminders_1d,
      loi_deadline_reminders_0d,
      internal_deadline_reminders_enabled,
      internal_deadline_reminders_30d,
      internal_deadline_reminders_14d,
      internal_deadline_reminders_7d,
      internal_deadline_reminders_3d,
      internal_deadline_reminders_1d,
      internal_deadline_reminders_0d,
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
    loi_deadline_reminders_enabled: row.loi_deadline_reminders_enabled ?? true,
    loi_deadline_reminders_30d: row.loi_deadline_reminders_30d ?? true,
    loi_deadline_reminders_14d: row.loi_deadline_reminders_14d ?? true,
    loi_deadline_reminders_7d: row.loi_deadline_reminders_7d ?? true,
    loi_deadline_reminders_3d: row.loi_deadline_reminders_3d ?? true,
    loi_deadline_reminders_1d: row.loi_deadline_reminders_1d ?? true,
    loi_deadline_reminders_0d: row.loi_deadline_reminders_0d ?? true,
    internal_deadline_reminders_enabled: row.internal_deadline_reminders_enabled ?? true,
    internal_deadline_reminders_30d: row.internal_deadline_reminders_30d ?? true,
    internal_deadline_reminders_14d: row.internal_deadline_reminders_14d ?? true,
    internal_deadline_reminders_7d: row.internal_deadline_reminders_7d ?? true,
    internal_deadline_reminders_3d: row.internal_deadline_reminders_3d ?? true,
    internal_deadline_reminders_1d: row.internal_deadline_reminders_1d ?? true,
    internal_deadline_reminders_0d: row.internal_deadline_reminders_0d ?? true,
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
    deadline_type: 'external' as const,
  }));
}

/**
 * Get grants with LOI deadlines in the specified number of days
 */
async function getGrantsWithLOIDeadline(
  supabase: any,
  orgId: string,
  daysUntil: number
): Promise<Grant[]> {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysUntil);
  targetDate.setHours(0, 0, 0, 0);

  const endOfTargetDate = new Date(targetDate);
  endOfTargetDate.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('org_grants_saved')
    .select('id, title, agency, loi_deadline, status')
    .eq('org_id', orgId)
    .gte('loi_deadline', targetDate.toISOString())
    .lte('loi_deadline', endOfTargetDate.toISOString())
    .not('status', 'in', '("awarded", "rejected", "withdrawn")');

  if (error) {
    console.error(`[Deadline Reminders] Error fetching LOI grants for org ${orgId}, days ${daysUntil}:`, error);
    return [];
  }

  return (data || []).map((grant: any) => ({
    id: grant.id,
    title: grant.title,
    agency: grant.agency,
    close_date: grant.loi_deadline, // Use LOI deadline as close_date for email template
    status: grant.status,
    org_id: orgId,
    deadline_type: 'loi' as const,
  }));
}

/**
 * Get grants with internal deadlines in the specified number of days
 */
async function getGrantsWithInternalDeadline(
  supabase: any,
  orgId: string,
  daysUntil: number
): Promise<Grant[]> {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysUntil);
  targetDate.setHours(0, 0, 0, 0);

  const endOfTargetDate = new Date(targetDate);
  endOfTargetDate.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('org_grants_saved')
    .select('id, title, agency, internal_deadline, status')
    .eq('org_id', orgId)
    .gte('internal_deadline', targetDate.toISOString())
    .lte('internal_deadline', endOfTargetDate.toISOString())
    .not('status', 'in', '("awarded", "rejected", "withdrawn")');

  if (error) {
    console.error(`[Deadline Reminders] Error fetching internal deadline grants for org ${orgId}, days ${daysUntil}:`, error);
    return [];
  }

  return (data || []).map((grant: any) => ({
    id: grant.id,
    title: grant.title,
    agency: grant.agency,
    close_date: grant.internal_deadline, // Use internal deadline as close_date for email template
    status: grant.status,
    org_id: orgId,
    deadline_type: 'internal' as const,
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
  grants: Grant[],
  deadlineType: 'external' | 'loi' | 'internal' = 'external'
): Promise<{ success: boolean; error?: string }> {
  try {
    const emailHtml = generateDeadlineReminderEmail({
      orgName,
      userName: recipient.full_name || 'User',
      daysUntil,
      grants,
    });

    const daysText = daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} Days`;
    const deadlineTypeLabel = deadlineType === 'loi' ? 'LOI' : deadlineType === 'internal' ? 'Internal' : '';
    const deadlineTypeText = deadlineTypeLabel ? ` (${deadlineTypeLabel})` : '';
    const subject = `${grants.length} Grant${grants.length === 1 ? '' : 's'}${deadlineTypeText} Due ${daysText} - ${orgName}`;

    const result = await resend.emails.send({
      from: 'GrantCue Deadlines <deadlines@grantcue.com>',
      to: recipient.email,
      subject,
      html: emailHtml,
    });

    if (result.error) {
      throw result.error;
    }

    console.log(`[Deadline Reminders] Sent ${deadlineType} email to ${recipient.email} for ${grants.length} grants (${daysUntil} days)`);
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
  daysUntil: number,
  deadlineType: 'external' | 'loi' | 'internal' = 'external'
): Promise<void> {
  const daysText = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;
  const deadlineTypeLabel = deadlineType === 'loi' ? 'LOI Deadline' : deadlineType === 'internal' ? 'Internal Deadline' : 'Deadline';

  for (const member of members) {
    for (const grant of grants) {
      try {
        await supabase.from('in_app_notifications').insert({
          user_id: member.user_id,
          org_id: orgId,
          type: 'deadline_reminder',
          title: `${deadlineTypeLabel} ${daysText}: ${grant.title}`,
          message: `Grant ${deadlineTypeLabel.toLowerCase()} is ${daysText}. ${grant.agency ? `Agency: ${grant.agency}.` : ''} Don't miss this opportunity!`,
          action_url: `/grants/${grant.id}`,
          metadata: {
            grant_id: grant.id,
            days_until: daysUntil,
            close_date: grant.close_date,
            deadline_type: deadlineType,
          },
        });
      } catch (error) {
        console.error(`[Deadline Reminders] Failed to create in-app notification for user ${member.user_id}:`, error);
      }
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify this is a cron request using timing-safe comparison
  // SECURITY: Timing-safe comparison prevents timing attacks that could be used to guess the secret
  // NOTE: CRON_SECRET should be rotated regularly (recommended: every 90 days)
  const authHeader = req.headers.authorization;

  if (!verifyCronAuth(authHeader)) {
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

    // Define reminder intervals (in days) for each deadline type
    const reminderIntervals = [
      { days: 30, setting: 'deadline_reminders_30d' },
      { days: 14, setting: 'deadline_reminders_14d' },
      { days: 7, setting: 'deadline_reminders_7d' },
      { days: 3, setting: 'deadline_reminders_3d' },
      { days: 1, setting: 'deadline_reminders_1d' },
      { days: 0, setting: 'deadline_reminders_0d' },
    ] as const;

    const loiReminderIntervals = [
      { days: 30, setting: 'loi_deadline_reminders_30d' },
      { days: 14, setting: 'loi_deadline_reminders_14d' },
      { days: 7, setting: 'loi_deadline_reminders_7d' },
      { days: 3, setting: 'loi_deadline_reminders_3d' },
      { days: 1, setting: 'loi_deadline_reminders_1d' },
      { days: 0, setting: 'loi_deadline_reminders_0d' },
    ] as const;

    const internalReminderIntervals = [
      { days: 30, setting: 'internal_deadline_reminders_30d' },
      { days: 14, setting: 'internal_deadline_reminders_14d' },
      { days: 7, setting: 'internal_deadline_reminders_7d' },
      { days: 3, setting: 'internal_deadline_reminders_3d' },
      { days: 1, setting: 'internal_deadline_reminders_1d' },
      { days: 0, setting: 'internal_deadline_reminders_0d' },
    ] as const;

    // Process each organization
    for (const org of orgs) {
      const orgResult: any = {
        org_id: org.org_id,
        org_name: org.org_name,
        reminders: [],
      };

      // Get organization members once for this org
      const members = await getOrgMembers(supabase, org.org_id);

      if (members.length === 0) {
        console.warn(`[Deadline Reminders] No members found for org ${org.org_id}`);
        continue;
      }

      // Process external deadlines
      for (const interval of reminderIntervals) {
        if (!org[interval.setting as keyof OrganizationSettings]) {
          continue;
        }

        const grants = await getGrantsWithDeadline(supabase, org.org_id, interval.days);

        if (grants.length > 0) {
          console.log(`[Deadline Reminders] Found ${grants.length} external deadline grants for ${org.org_name} at ${interval.days} days`);

          let sentCount = 0;
          let failedCount = 0;

          for (const member of members) {
            const result = await sendDeadlineEmail(member, org.org_name, interval.days, grants, 'external');
            if (result.success) {
              sentCount++;
            } else {
              failedCount++;
            }
          }

          await createInAppNotifications(supabase, org.org_id, members, grants, interval.days, 'external');

          totalEmailsSent += sentCount;
          totalEmailsFailed += failedCount;
          totalNotifications += grants.length * members.length;

          orgResult.reminders.push({
            type: 'external',
            days_until: interval.days,
            grants_count: grants.length,
            members_notified: members.length,
            emails_sent: sentCount,
            emails_failed: failedCount,
          });
        }
      }

      // Process LOI deadlines
      if (org.loi_deadline_reminders_enabled) {
        for (const interval of loiReminderIntervals) {
          if (!org[interval.setting as keyof OrganizationSettings]) {
            continue;
          }

          const grants = await getGrantsWithLOIDeadline(supabase, org.org_id, interval.days);

          if (grants.length > 0) {
            console.log(`[Deadline Reminders] Found ${grants.length} LOI deadline grants for ${org.org_name} at ${interval.days} days`);

            let sentCount = 0;
            let failedCount = 0;

            for (const member of members) {
              const result = await sendDeadlineEmail(member, org.org_name, interval.days, grants, 'loi');
              if (result.success) {
                sentCount++;
              } else {
                failedCount++;
              }
            }

            await createInAppNotifications(supabase, org.org_id, members, grants, interval.days, 'loi');

            totalEmailsSent += sentCount;
            totalEmailsFailed += failedCount;
            totalNotifications += grants.length * members.length;

            orgResult.reminders.push({
              type: 'loi',
              days_until: interval.days,
              grants_count: grants.length,
              members_notified: members.length,
              emails_sent: sentCount,
              emails_failed: failedCount,
            });
          }
        }
      }

      // Process internal deadlines
      if (org.internal_deadline_reminders_enabled) {
        for (const interval of internalReminderIntervals) {
          if (!org[interval.setting as keyof OrganizationSettings]) {
            continue;
          }

          const grants = await getGrantsWithInternalDeadline(supabase, org.org_id, interval.days);

          if (grants.length > 0) {
            console.log(`[Deadline Reminders] Found ${grants.length} internal deadline grants for ${org.org_name} at ${interval.days} days`);

            let sentCount = 0;
            let failedCount = 0;

            for (const member of members) {
              const result = await sendDeadlineEmail(member, org.org_name, interval.days, grants, 'internal');
              if (result.success) {
                sentCount++;
              } else {
                failedCount++;
              }
            }

            await createInAppNotifications(supabase, org.org_id, members, grants, interval.days, 'internal');

            totalEmailsSent += sentCount;
            totalEmailsFailed += failedCount;
            totalNotifications += grants.length * members.length;

            orgResult.reminders.push({
              type: 'internal',
              days_until: interval.days,
              grants_count: grants.length,
              members_notified: members.length,
              emails_sent: sentCount,
              emails_failed: failedCount,
            });
          }
        }
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
