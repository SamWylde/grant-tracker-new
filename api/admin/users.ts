import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { rateLimitAdmin, handleRateLimit } from '../utils/ratelimit';
import { ErrorHandlers, generateRequestId, wrapHandler } from '../utils/error-handler';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default wrapHandler(async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = generateRequestId();
  // Apply rate limiting (30 req/min per IP)
  const rateLimitResult = await rateLimitAdmin(req);
  if (handleRateLimit(res, rateLimitResult)) {
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return ErrorHandlers.methodNotAllowed(res, ['GET'], requestId);
  }

  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return ErrorHandlers.unauthorized(res, 'Missing authorization header', undefined, requestId);
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return ErrorHandlers.serverError(res, new Error('Server configuration error'), requestId);
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
    return ErrorHandlers.unauthorized(res, 'Unauthorized', undefined, requestId);
  }

  // SECURITY: Verify user is a platform admin (NOT organization admin)
  const { data: profile, error: profileError } = await userClient
    .from('user_profiles')
    .select('is_platform_admin')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Error checking platform admin status:', profileError);
    return ErrorHandlers.database(res, profileError, requestId);
  }

  if (!profile?.is_platform_admin) {
    return ErrorHandlers.forbidden(
      res,
      'Platform admin access required',
      'This endpoint is restricted to platform administrators only',
      requestId
    );
  }

  // Create a separate client with service role key for admin operations
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  // Fetch ALL users from auth.users (requires service role key)
  const { data: authUsers, error: authUsersError } = await adminClient.auth.admin.listUsers();

  if (authUsersError) {
    return ErrorHandlers.database(res, authUsersError, requestId);
  }

  // Fetch user profiles (using admin client for full access)
  const { data: profiles, error: profilesError } = await adminClient
    .from('user_profiles')
    .select('id, full_name, is_platform_admin, created_at');

  if (profilesError) {
    return ErrorHandlers.database(res, profilesError, requestId);
  }

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

  if (membershipsError) {
    return ErrorHandlers.database(res, membershipsError, requestId);
  }

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
});
