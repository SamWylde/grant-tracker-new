/**
 * Grant Alerts Checker
 *
 * Checks for new grants matching saved searches and creates notifications
 * Can be called manually or via cron
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get all active saved searches with alerts enabled
    const { data: savedSearches, error: searchesError } = await supabase
      .from('recent_searches')
      .select('*')
      .order('last_used_at', { ascending: false });

    if (searchesError) {
      throw searchesError;
    }

    if (!savedSearches || savedSearches.length === 0) {
      return res.status(200).json({
        message: 'No saved searches found',
        notifications_created: 0,
      });
    }

    let notificationsCreated = 0;

    // For each saved search, find new matching grants
    for (const search of savedSearches) {
      try {
        // Build query for matching grants
        let query = supabase
          .from('grants_catalog')
          .select('*')
          .eq('is_active', true);

        // Apply filters from saved search
        if (search.keyword) {
          // Use full-text search if available
          query = query.textSearch('search_vector', search.keyword);
        }

        if (search.category) {
          query = query.eq('funding_category', search.category);
        }

        if (search.agency) {
          query = query.ilike('agency', `%${search.agency}%`);
        }

        // Status filter
        const statuses = [];
        if (search.status_posted) statuses.push('posted');
        if (search.status_forecasted) statuses.push('forecasted');
        if (statuses.length > 0) {
          query = query.in('opportunity_status', statuses);
        }

        // Due date filter
        if (search.due_in_days) {
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + search.due_in_days);
          query = query
            .gte('close_date', new Date().toISOString())
            .lte('close_date', futureDate.toISOString());
        }

        // Only get grants created in last 24 hours (new grants)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        query = query.gte('first_seen_at', yesterday.toISOString());

        const { data: matchingGrants, error: grantsError } = await query.limit(50);

        if (grantsError) {
          console.error(`Error fetching grants for search ${search.id}:`, grantsError);
          continue;
        }

        if (!matchingGrants || matchingGrants.length === 0) {
          continue;
        }

        // Create notifications for matching grants
        for (const grant of matchingGrants) {
          // Check if notification already exists
          const { data: existing } = await supabase
            .from('grant_match_notifications')
            .select('id')
            .eq('user_id', search.user_id)
            .eq('grant_id', grant.id)
            .single();

          if (existing) {
            continue; // Already notified about this grant
          }

          // Calculate match score (simple version)
          let matchScore = 0.5;
          if (search.keyword && grant.title.toLowerCase().includes(search.keyword.toLowerCase())) {
            matchScore += 0.3;
          }
          if (search.agency && grant.agency?.toLowerCase().includes(search.agency.toLowerCase())) {
            matchScore += 0.2;
          }

          // Create notification
          const { error: notifError } = await supabase
            .from('grant_match_notifications')
            .insert({
              org_id: search.org_id,
              user_id: search.user_id,
              saved_search_id: search.id,
              grant_id: grant.id,
              match_score: matchScore,
              notification_sent: false,
            });

          if (!notifError) {
            notificationsCreated++;
          }
        }
      } catch (error) {
        console.error(`Error processing search ${search.id}:`, error);
      }
    }

    return res.status(200).json({
      message: 'Alert check completed',
      searches_checked: savedSearches.length,
      notifications_created: notificationsCreated,
    });
  } catch (error) {
    console.error('Alert check error:', error);
    return res.status(500).json({
      error: 'Alert check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
