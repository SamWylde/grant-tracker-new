import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { rateLimitAdmin, handleRateLimit } from '../utils/ratelimit';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apply rate limiting (30 req/min per IP)
  const rateLimitResult = await rateLimitAdmin(req);
  if (handleRateLimit(res, rateLimitResult)) {
    return;
  }

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

  // Create client with user's token for authentication and authorization checks
  const userClient = createClient(supabaseUrl, supabaseServiceKey, {
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
  } = await userClient.auth.getUser(authHeader.replace('Bearer ', ''));

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // SECURITY: Verify user is a platform admin (NOT organization admin)
  const { data: profile, error: profileError } = await userClient
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

  // Create a separate client with service role key for admin operations
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch ALL users from auth.users (requires service role key)
    const { data: authUsers, error: authUsersError } = await adminClient.auth.admin.listUsers();

    if (authUsersError) throw authUsersError;

    // Fetch user profiles (using admin client for full access)
    const { data: profiles, error: profilesError } = await adminClient
      .from('user_profiles')
      .select('id, full_name, is_platform_admin, created_at');

    if (profilesError) throw profilesError;

    // Fetch org memberships for each user (using admin client for full access)
    const { data: memberships, error: membershipsError } = await adminClient
      .from('org_members')
      .select(`
        user_id,
        role,
        organizations (
          id,
          name
        )
      `);

    if (membershipsError) throw membershipsError;

    // Build profile map
    const profileMap = profiles?.reduce((acc: Record<string, any>, profile) => {
      acc[profile.id] = profile;
      return acc;
    }, {}) || {};

    // Build memberships map (group by user_id)
    const membershipsMap = memberships?.reduce((acc: Record<string, any[]>, membership) => {
      const userId = membership.user_id;
      if (!acc[userId]) acc[userId] = [];
      acc[userId].push({
        role: membership.role,
        org_id: (membership.organizations as any)?.id,
        org_name: (membership.organizations as any)?.name,
      });
      return acc;
    }, {}) || {};

    // Combine data
    const users = authUsers.users.map(authUser => {
      const userProfile = profileMap[authUser.id];
      const userMemberships = membershipsMap[authUser.id] || [];

      return {
        id: authUser.id,
        email: authUser.email,
        full_name: userProfile?.full_name || null,
        is_platform_admin: userProfile?.is_platform_admin || false,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at,
        organizations: userMemberships,
        org_count: userMemberships.length,
      };
    });

    // Sort by created_at descending (newest first)
    users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
