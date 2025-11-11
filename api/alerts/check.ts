/**
 * Grant Alerts Checker
 *
 * Checks for new grants matching saved searches and creates notifications
 * Can be called manually or via cron
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

/**
 * Generates HTML email for grant alert notifications
 */
function generateAlertEmailHTML(alert: {
  alert_name: string;
  user_name: string;
  org_name: string;
  matches_count: number;
  matches: Array<{
    title: string;
    agency: string;
    close_date: string | null;
  }>;
}): string {
  const matchesHTML = alert.matches
    .map(
      (match) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">${match.title}</div>
        <div style="font-size: 14px; color: #6b7280;">
          ${match.agency}
          ${match.close_date ? ` • Closes ${new Date(match.close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
        </div>
      </td>
    </tr>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Grant Matches</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; border-bottom: 1px solid #e5e7eb;">
              <h1 style="margin: 0; font-size: 24px; color: #111827;">🔔 New Grant Matches</h1>
              <p style="margin: 8px 0 0; font-size: 16px; color: #6b7280;">
                ${alert.matches_count} new ${alert.matches_count === 1 ? 'grant matches' : 'grants match'} your alert: <strong>${alert.alert_name}</strong>
              </p>
            </td>
          </tr>

          <!-- Matches List -->
          <tr>
            <td style="padding: 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${matchesHTML}
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 32px; text-align: center;">
              <a href="https://grantcue.com/alerts" style="display: inline-block; padding: 12px 32px; background-color: #7c3aed; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
                View All Matches
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e5e7eb; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 14px; color: #6b7280; text-align: center;">
                You're receiving this email because you have an active alert for ${alert.org_name}.
                <br>
                <a href="https://grantcue.com/settings/alerts" style="color: #7c3aed; text-decoration: none;">Manage your alerts</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get all active alerts (not saved searches - using grant_alerts table)
    const { data: alerts, error: alertsError } = await supabase
      .from('grant_alerts')
      .select(`
        *,
        user_profiles!grant_alerts_user_id_fkey(full_name, email),
        organizations!grant_alerts_org_id_fkey(name)
      `)
      .eq('is_active', true)
      .order('last_checked_at', { ascending: true, nullsFirst: true });

    if (alertsError) {
      throw alertsError;
    }

    if (!alerts || alerts.length === 0) {
      return res.status(200).json({
        message: 'No active alerts found',
        alerts_checked: 0,
        matches_created: 0,
        emails_queued: 0,
      });
    }

    let matchesCreated = 0;
    let emailsQueued = 0;
    const alertsWithMatches: any[] = [];

    // For each alert, find new matching grants
    for (const alert of alerts) {
      try {
        // Build query for matching grants
        let query = supabase
          .from('grants_catalog')
          .select('*')
          .eq('is_active', true);

        // Apply filters from alert
        if (alert.keyword) {
          // Use full-text search if available
          query = query.textSearch('search_vector', alert.keyword);
        }

        if (alert.category) {
          query = query.eq('funding_category', alert.category);
        }

        if (alert.agency) {
          query = query.ilike('agency', `%${alert.agency}%`);
        }

        // Status filter
        const statuses = [];
        if (alert.status_posted) statuses.push('posted');
        if (alert.status_forecasted) statuses.push('forecasted');
        if (statuses.length > 0) {
          query = query.in('opportunity_status', statuses);
        }

        // Due date filter
        if (alert.due_in_days) {
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + alert.due_in_days);
          query = query
            .gte('close_date', new Date().toISOString())
            .lte('close_date', futureDate.toISOString());
        }

        // Amount filters
        if (alert.min_amount) {
          query = query.gte('award_ceiling', alert.min_amount);
        }
        if (alert.max_amount) {
          query = query.lte('award_floor', alert.max_amount);
        }

        // Only get grants created since last check (or last 24 hours for new alerts)
        const checkSince = alert.last_checked_at
          ? new Date(alert.last_checked_at)
          : new Date(Date.now() - 24 * 60 * 60 * 1000);

        query = query.gte('first_seen_at', checkSince.toISOString());

        const { data: matchingGrants, error: grantsError } = await query.limit(50);

        if (grantsError) {
          console.error(`Error fetching grants for alert ${alert.id}:`, grantsError);
          continue;
        }

        // Update last_checked_at for this alert
        await supabase
          .from('grant_alerts')
          .update({ last_checked_at: new Date().toISOString() })
          .eq('id', alert.id);

        if (!matchingGrants || matchingGrants.length === 0) {
          continue;
        }

        const newMatches: any[] = [];

        // Create alert matches for new grants
        for (const grant of matchingGrants) {
          // Insert alert match (will trigger notification via database trigger)
          const { data: match, error: matchError } = await supabase
            .from('grant_alert_matches')
            .insert({
              alert_id: alert.id,
              org_id: alert.org_id,
              external_source: grant.source || 'grants.gov',
              external_id: grant.opportunity_number,
              grant_title: grant.opportunity_title,
              grant_agency: grant.agency_name,
              grant_close_date: grant.close_date,
              matched_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (!matchError && match) {
            matchesCreated++;
            newMatches.push({
              title: grant.opportunity_title,
              agency: grant.agency_name,
              close_date: grant.close_date,
            });
          } else if (matchError && matchError.code !== '23505') {
            // Ignore duplicate key errors (23505), log others
            console.error(`Error creating match for grant ${grant.opportunity_number}:`, matchError);
          }
        }

        // If email notifications are enabled and there are new matches, queue email
        if (alert.notify_email && newMatches.length > 0) {
          const userEmail = alert.user_profiles?.email;

          // Skip if email is missing
          if (!userEmail) {
            console.warn(`[Alert Check] Skipping email for alert ${alert.id} - user email not found`);
            continue;
          }

          emailsQueued++;
          alertsWithMatches.push({
            alert_name: alert.name,
            user_email: userEmail,
            user_name: alert.user_profiles?.full_name || 'User',
            org_name: alert.organizations?.name || 'Your Organization',
            matches_count: newMatches.length,
            matches: newMatches,
          });

          // Update last_alert_sent_at and increment alert_count
          await supabase
            .from('grant_alerts')
            .update({
              last_alert_sent_at: new Date().toISOString(),
              alert_count: (alert.alert_count || 0) + 1,
            })
            .eq('id', alert.id);
        }
      } catch (error) {
        console.error(`Error processing alert ${alert.id}:`, error);
      }
    }

    // Send email notifications using Resend
    if (emailsQueued > 0) {
      const resendApiKey = process.env.RESEND_API_KEY;

      if (!resendApiKey) {
        console.error('[Alert Check] RESEND_API_KEY not configured - emails cannot be sent');
        console.log('[Alert Check] Alerts with matches (not sent):', alertsWithMatches);
      } else {
        const resend = new Resend(resendApiKey);
        let emailsSent = 0;
        let emailsFailed = 0;

        for (const alert of alertsWithMatches) {
          try {
            await resend.emails.send({
              from: 'GrantCue Alerts <alerts@grantcue.com>',
              to: alert.user_email,
              subject: `${alert.matches_count} New Grant${alert.matches_count === 1 ? '' : 's'} Match Your Alert: ${alert.alert_name}`,
              html: generateAlertEmailHTML(alert),
            });
            emailsSent++;
            console.log(`[Alert Check] Email sent to ${alert.user_email} for alert "${alert.alert_name}"`);
          } catch (error) {
            emailsFailed++;
            console.error(`[Alert Check] Failed to send email to ${alert.user_email}:`, error);
          }
        }

        console.log(`[Alert Check] Email summary: ${emailsSent} sent, ${emailsFailed} failed out of ${emailsQueued} queued`);
      }
    }

    return res.status(200).json({
      message: 'Alert check completed',
      alerts_checked: alerts.length,
      matches_created: matchesCreated,
      emails_queued: emailsQueued,
      alerts_with_matches: alertsWithMatches.map(a => ({
        alert_name: a.alert_name,
        matches_count: a.matches_count,
      })),
    });
  } catch (error) {
    console.error('Alert check error:', error);
    return res.status(500).json({
      error: 'Alert check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
