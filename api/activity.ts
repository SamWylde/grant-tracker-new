import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { setCorsHeaders } from './utils/cors.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set secure CORS headers based on whitelisted origins
  setCorsHeaders(res, req.headers.origin, { methods: 'GET, OPTIONS' });

  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Initialize Supabase client
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { grant_id, org_id, user_id, action, limit = '50', offset = '0', stream = 'false' } = req.query;

    // =====================================================
    // NEW: Collaboration Activity Stream
    // =====================================================
    if (stream === 'true') {
      if (!org_id) {
        return res.status(400).json({ error: 'org_id is required for activity stream' });
      }

      // Verify user is org member
      const { data: membership } = await supabase
        .from('org_members')
        .select('id')
        .eq('org_id', org_id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const limitNum = Math.min(parseInt(limit as string, 10) || 50, 100);

      // Get activity from the activity_stream view
      let streamQuery = supabase
        .from('activity_stream')
        .select('*')
        .eq('org_id', org_id)
        .order('created_at', { ascending: false })
        .limit(limitNum);

      // Filter by activity type if specified
      if (action) {
        streamQuery = streamQuery.eq('activity_type', action);
      }

      const { data: activities, error: activitiesError } = await streamQuery;

      if (activitiesError) throw activitiesError;

      // Group by date for UI display
      const groupedByDate: Record<string, any[]> = {};

      activities?.forEach(activity => {
        const date = new Date(activity.created_at).toISOString().split('T')[0];

        if (!groupedByDate[date]) {
          groupedByDate[date] = [];
        }

        groupedByDate[date].push(activity);
      });

      return res.status(200).json({
        activities: activities || [],
        grouped_by_date: groupedByDate,
        total: activities?.length || 0,
        source: 'activity_stream',
      });
    }

    // =====================================================
    // ORIGINAL: Grant Activity Log
    // =====================================================

    // Build query based on filters
    let query = supabase
      .from('grant_activity_log')
      .select(`
        *,
        user_profiles!grant_activity_log_user_id_fkey (
          full_name,
          avatar_url
        ),
        org_grants_saved!grant_activity_log_grant_id_fkey (
          title,
          external_id
        )
      `)
      .order('created_at', { ascending: false });

    // Filter by grant_id if provided
    if (grant_id && typeof grant_id === 'string') {
      query = query.eq('grant_id', grant_id);

      // Verify user has access to this grant
      const { data: grant } = await supabase
        .from('org_grants_saved')
        .select('org_id')
        .eq('id', grant_id)
        .single();

      if (!grant) {
        return res.status(404).json({ error: 'Grant not found' });
      }

      // Verify user is a member of the organization
      const { data: membership } = await supabase
        .from('org_members')
        .select('id')
        .eq('org_id', grant.org_id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return res.status(403).json({ error: 'Access denied to this grant' });
      }
    }

    // Filter by org_id if provided (and verify access)
    if (org_id && typeof org_id === 'string') {
      // Verify user is a member of the organization
      const { data: membership } = await supabase
        .from('org_members')
        .select('id')
        .eq('org_id', org_id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return res.status(403).json({ error: 'Access denied to this organization' });
      }

      query = query.eq('org_id', org_id);
    }

    // Filter by user_id if provided
    if (user_id && typeof user_id === 'string') {
      query = query.eq('user_id', user_id);
    }

    // Filter by action type if provided
    if (action && typeof action === 'string') {
      query = query.eq('action', action);
    }

    // If neither grant_id nor org_id is provided, get activity for all user's orgs
    if (!grant_id && !org_id) {
      const { data: memberships } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id);

      if (!memberships || memberships.length === 0) {
        return res.status(200).json({ activities: [], total: 0 });
      }

      const orgIds = memberships.map(m => m.org_id);
      query = query.in('org_id', orgIds);
    }

    // Apply pagination
    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);

    query = query.range(offsetNum, offsetNum + limitNum - 1);

    const { data: activities, error, count } = await query;

    if (error) {
      console.error('Error fetching activity log:', error);
      return res.status(500).json({ error: 'Failed to fetch activity log' });
    }

    return res.status(200).json({
      activities: activities || [],
      total: count || activities?.length || 0,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    console.error('Error in activity log API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
