/**
 * Authentication Middleware
 *
 * Provides reusable authentication and authorization helpers for API endpoints.
 * This middleware supports multiple authentication patterns:
 * - User authentication via JWT tokens
 * - Organization membership verification
 * - Role-based access control (RBAC)
 * - Platform admin verification
 * - CRON job authentication
 *
 * SECURITY BEST PRACTICES:
 * - Always verify authentication before processing requests
 * - Return 401 Unauthorized for missing/invalid authentication
 * - Return 403 Forbidden for insufficient permissions
 * - Use timing-safe comparisons for secrets
 * - Log authentication failures for security monitoring
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { verifyCronAuth } from './auth.js';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  [key: string]: any;
}

export interface AuthResult {
  success: boolean;
  user?: AuthenticatedUser;
  error?: string;
  statusCode?: number;
}

export interface OrgMembershipResult extends AuthResult {
  membership?: {
    org_id: string;
    user_id: string;
    role: 'admin' | 'member' | 'viewer';
    [key: string]: any;
  };
}

export interface PlatformAdminResult extends AuthResult {
  isPlatformAdmin?: boolean;
}

/**
 * Extract and verify user JWT token from authorization header
 *
 * @param req - The Vercel request object
 * @param supabase - Supabase client instance
 * @returns AuthResult with user data if successful
 *
 * @example
 * const authResult = await verifyUserAuth(req, supabase);
 * if (!authResult.success) {
 *   return res.status(authResult.statusCode || 401).json({ error: authResult.error });
 * }
 * const user = authResult.user!;
 */
export async function verifyUserAuth(
  req: VercelRequest,
  supabase: SupabaseClient
): Promise<AuthResult> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return {
      success: false,
      error: 'Missing authorization header',
      statusCode: 401,
    };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      error: 'Invalid authorization header format. Expected: Bearer <token>',
      statusCode: 401,
    };
  }

  const token = authHeader.substring(7);

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.warn('[Auth] User authentication failed:', authError?.message || 'No user found');
      return {
        success: false,
        error: 'Unauthorized - Invalid or expired token',
        statusCode: 401,
      };
    }

    return {
      success: true,
      user: user as AuthenticatedUser,
    };
  } catch (error) {
    console.error('[Auth] Error verifying user authentication:', error);
    return {
      success: false,
      error: 'Authentication verification failed',
      statusCode: 500,
    };
  }
}

/**
 * Verify user is a member of the specified organization
 *
 * @param supabase - Supabase client instance
 * @param userId - The authenticated user's ID
 * @param orgId - The organization ID to check membership for
 * @returns OrgMembershipResult with membership data if successful
 *
 * @example
 * const membershipResult = await verifyOrgMembership(supabase, user.id, orgId);
 * if (!membershipResult.success) {
 *   return res.status(membershipResult.statusCode || 403).json({ error: membershipResult.error });
 * }
 * const role = membershipResult.membership!.role;
 */
export async function verifyOrgMembership(
  supabase: SupabaseClient,
  userId: string,
  orgId: string
): Promise<OrgMembershipResult> {
  try {
    const { data: membership, error: membershipError } = await supabase
      .from('org_members')
      .select('*')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership) {
      console.warn(`[Auth] User ${userId} attempted access to org ${orgId} - not a member`);
      return {
        success: false,
        error: 'Access denied - not a member of this organization',
        statusCode: 403,
      };
    }

    return {
      success: true,
      user: { id: userId } as AuthenticatedUser,
      membership,
    };
  } catch (error) {
    console.error('[Auth] Error verifying org membership:', error);
    return {
      success: false,
      error: 'Failed to verify organization membership',
      statusCode: 500,
    };
  }
}

/**
 * Verify user has admin role in the specified organization
 *
 * @param supabase - Supabase client instance
 * @param userId - The authenticated user's ID
 * @param orgId - The organization ID to check admin status for
 * @returns OrgMembershipResult with membership data if user is admin
 *
 * @example
 * const adminResult = await verifyOrgAdmin(supabase, user.id, orgId);
 * if (!adminResult.success) {
 *   return res.status(adminResult.statusCode || 403).json({ error: adminResult.error });
 * }
 */
export async function verifyOrgAdmin(
  supabase: SupabaseClient,
  userId: string,
  orgId: string
): Promise<OrgMembershipResult> {
  const membershipResult = await verifyOrgMembership(supabase, userId, orgId);

  if (!membershipResult.success) {
    return membershipResult;
  }

  if (membershipResult.membership!.role !== 'admin') {
    console.warn(`[Auth] User ${userId} attempted admin action on org ${orgId} - insufficient permissions`);
    return {
      success: false,
      error: 'Access denied - admin access required',
      statusCode: 403,
    };
  }

  return membershipResult;
}

/**
 * Verify user is a platform administrator
 *
 * Platform admins have elevated privileges across all organizations.
 * This should only be used for system-level administrative endpoints.
 *
 * @param supabase - Supabase client instance
 * @param userId - The authenticated user's ID
 * @returns PlatformAdminResult indicating if user is a platform admin
 *
 * @example
 * const adminResult = await verifyPlatformAdmin(supabase, user.id);
 * if (!adminResult.success || !adminResult.isPlatformAdmin) {
 *   return res.status(403).json({ error: 'Platform admin access required' });
 * }
 */
export async function verifyPlatformAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<PlatformAdminResult> {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('is_platform_admin')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('[Auth] Error checking platform admin status:', profileError);
      return {
        success: false,
        error: 'Failed to verify platform admin status',
        statusCode: 500,
      };
    }

    if (!profile?.is_platform_admin) {
      console.warn(`[Auth] User ${userId} attempted platform admin action - not a platform admin`);
      return {
        success: false,
        error: 'Access denied - platform admin access required',
        statusCode: 403,
        isPlatformAdmin: false,
      };
    }

    return {
      success: true,
      user: { id: userId } as AuthenticatedUser,
      isPlatformAdmin: true,
    };
  } catch (error) {
    console.error('[Auth] Error verifying platform admin:', error);
    return {
      success: false,
      error: 'Failed to verify platform admin status',
      statusCode: 500,
    };
  }
}

/**
 * Verify CRON job authentication
 *
 * CRON jobs authenticate using a secret token in the Authorization header.
 * This uses timing-safe comparison to prevent timing attacks.
 *
 * @param req - The Vercel request object
 * @returns boolean indicating if CRON authentication is valid
 *
 * @example
 * if (!verifyCronRequest(req)) {
 *   return res.status(401).json({ error: 'Unauthorized - invalid CRON secret' });
 * }
 */
export function verifyCronRequest(req: VercelRequest): boolean {
  const authHeader = req.headers.authorization;
  return verifyCronAuth(authHeader);
}

/**
 * Combined authentication middleware for endpoints that support both user and CRON auth
 *
 * This is useful for endpoints like report generation that can be called by
 * both authenticated users (for preview) and CRON jobs (for scheduled delivery).
 *
 * @param req - The Vercel request object
 * @param supabase - Supabase client instance
 * @returns AuthResult with user data if user-authenticated, or success for CRON
 *
 * @example
 * const authResult = await verifyUserOrCron(req, supabase);
 * if (!authResult.success) {
 *   return res.status(authResult.statusCode || 401).json({ error: authResult.error });
 * }
 * const isCronRequest = !authResult.user;
 */
export async function verifyUserOrCron(
  req: VercelRequest,
  supabase: SupabaseClient
): Promise<AuthResult & { isCron?: boolean }> {
  // Check if it's a CRON request first
  if (verifyCronRequest(req)) {
    return {
      success: true,
      isCron: true,
    };
  }

  // Otherwise, verify user authentication
  const userAuthResult = await verifyUserAuth(req, supabase);
  return {
    ...userAuthResult,
    isCron: false,
  };
}

/**
 * Helper to create a Supabase client with proper authentication
 *
 * @param authHeader - Authorization header from the request
 * @returns Supabase client configured with user's auth token
 *
 * @example
 * const supabase = createAuthenticatedClient(req.headers.authorization);
 */
export function createAuthenticatedClient(authHeader?: string): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  if (authHeader) {
    return createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Standard error responses for common authentication failures
 */
export const AUTH_ERRORS = {
  MISSING_AUTH: {
    statusCode: 401,
    error: 'Missing authorization header',
  },
  INVALID_TOKEN: {
    statusCode: 401,
    error: 'Unauthorized - Invalid or expired token',
  },
  NOT_ORG_MEMBER: {
    statusCode: 403,
    error: 'Access denied - not a member of this organization',
  },
  NOT_ORG_ADMIN: {
    statusCode: 403,
    error: 'Access denied - admin access required',
  },
  NOT_PLATFORM_ADMIN: {
    statusCode: 403,
    error: 'Access denied - platform admin access required',
  },
  INVALID_CRON: {
    statusCode: 401,
    error: 'Unauthorized - invalid CRON secret',
  },
} as const;

/**
 * Quick helper to send authentication error responses
 *
 * @param res - The Vercel response object
 * @param authResult - The failed authentication result
 *
 * @example
 * const authResult = await verifyUserAuth(req, supabase);
 * if (!authResult.success) {
 *   return sendAuthError(res, authResult);
 * }
 */
export function sendAuthError(res: VercelResponse, authResult: AuthResult): void {
  res.status(authResult.statusCode || 401).json({
    error: authResult.error || 'Unauthorized',
  });
}
