import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  // Verify user is authenticated
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // SECURITY: Verify user is a platform admin (NOT organization admin)
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('is_platform_admin')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Error checking platform admin status:', profileError);
    return res.status(500).json({ error: 'Failed to verify platform admin status' });
  }

  if (!profile?.is_platform_admin) {
    return res.status(403).json({
      error: 'Platform admin access required',
      message: 'This endpoint is restricted to platform administrators only'
    });
  }

  try {
    // Fetch all organizations with their settings
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (orgsError) throw orgsError;

    // Fetch organization settings for each org
    const { data: settings, error: settingsError } = await supabase
      .from('organization_settings')
      .select('org_id, plan_name, plan_status, trial_ends_at, next_renewal_at');

    if (settingsError) throw settingsError;

    // Count members for each org
    const { data: memberCounts, error: memberCountsError } = await supabase
      .from('org_members')
      .select('org_id');

    if (memberCountsError) throw memberCountsError;

    // Build member count map
    const memberCountMap = memberCounts?.reduce((acc: Record<string, number>, member) => {
      acc[member.org_id] = (acc[member.org_id] || 0) + 1;
      return acc;
    }, {}) || {};

    // Build settings map
    const settingsMap = settings?.reduce((acc: Record<string, any>, setting) => {
      acc[setting.org_id] = setting;
      return acc;
    }, {}) || {};

    // Combine data
    const organizations = orgs?.map(org => ({
      id: org.id,
      name: org.name,
      created_at: org.created_at,
      plan_name: settingsMap[org.id]?.plan_name || 'free',
      plan_status: settingsMap[org.id]?.plan_status || 'active',
      trial_ends_at: settingsMap[org.id]?.trial_ends_at || null,
      next_renewal_at: settingsMap[org.id]?.next_renewal_at || null,
      member_count: memberCountMap[org.id] || 0,
    })) || [];

    return res.status(200).json(organizations);
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
