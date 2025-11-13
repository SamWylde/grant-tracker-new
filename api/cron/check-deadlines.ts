/**
 * Grant Deadline Checker (Cron Job)
 *
 * Checks for approaching and passed deadlines and sends notifications
 * Run this via cron daily
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { sendNotifications } from '../utils/notifications';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST or GET for cron
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Define deadline thresholds
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const fourteenDaysFromNow = new Date(today);
    fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);

    let approachingCount = 0;
    let passedCount = 0;

    // Get all active grants with close dates
    const { data: grants, error: grantsError } = await supabase
      .from('org_grants_saved')
      .select('id, org_id, title, agency, close_date, status')
      .not('close_date', 'is', null)
      .neq('status', 'archived')
      .neq('status', 'declined')
      .neq('status', 'awarded')
      .neq('status', 'submitted');

    if (grantsError) {
      throw grantsError;
    }

    if (!grants || grants.length === 0) {
      return res.status(200).json({
        message: 'No grants with deadlines found',
        approaching: 0,
        passed: 0,
      });
    }

    const origin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://grantcue.com';

    for (const grant of grants) {
      const closeDate = new Date(grant.close_date);
      closeDate.setHours(0, 0, 0, 0); // Normalize to start of day

      // Check if deadline has passed (yesterday or earlier)
      if (closeDate < today) {
        try {
          await sendNotifications({
            event: 'grant.deadline_passed',
            org_id: grant.org_id,
            grant_id: grant.id,
            grant_title: grant.title,
            grant_agency: grant.agency,
            grant_deadline: grant.close_date,
            action_url: `${origin}/grants/${grant.id}`,
            metadata: {
              status: grant.status,
              days_overdue: Math.floor((today.getTime() - closeDate.getTime()) / (1000 * 60 * 60 * 24)),
            },
          });
          passedCount++;
          console.log(`[Deadline Check] Sent deadline_passed notification for grant: ${grant.title}`);
        } catch (error) {
          console.error(`[Deadline Check] Error sending deadline_passed notification for grant ${grant.id}:`, error);
        }
      }
      // Check if deadline is approaching (within 3, 7, or 14 days)
      else if (closeDate <= fourteenDaysFromNow) {
        try {
          const daysUntilDeadline = Math.ceil((closeDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          await sendNotifications({
            event: 'grant.deadline_approaching',
            org_id: grant.org_id,
            grant_id: grant.id,
            grant_title: grant.title,
            grant_agency: grant.agency,
            grant_deadline: grant.close_date,
            action_url: `${origin}/grants/${grant.id}`,
            metadata: {
              status: grant.status,
              days_until_deadline: daysUntilDeadline,
            },
          });
          approachingCount++;
          console.log(`[Deadline Check] Sent deadline_approaching notification for grant: ${grant.title} (${daysUntilDeadline} days)`);
        } catch (error) {
          console.error(`[Deadline Check] Error sending deadline_approaching notification for grant ${grant.id}:`, error);
        }
      }
    }

    return res.status(200).json({
      message: 'Deadline check completed',
      grants_checked: grants.length,
      approaching_notifications: approachingCount,
      passed_notifications: passedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Deadline Check] Error:', error);
    return res.status(500).json({
      error: 'Deadline check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
