/**
 * API endpoint to get 2FA status for current user
 *
 * GET /api/2fa/status
 * Requires: Authenticated user
 * Returns: 2FA status, backup codes count, org requirements
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check environment variables
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // Create Supabase client with user's auth token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's 2FA status
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('totp_enabled, totp_verified_at, failed_2fa_attempts')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }

    // Count unused backup codes
    const { count: backupCodesCount, error: backupError } = await supabase
      .from('user_backup_codes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('used', false);

    if (backupError) {
      console.error('Error counting backup codes:', backupError);
    }

    // Check if user is required to have 2FA based on org settings
    const { data: requiresData, error: requiresError } = await supabase
      .rpc('user_requires_2fa', { p_user_id: user.id });

    if (requiresError) {
      console.error('Error checking 2FA requirement:', requiresError);
    }

    // Get user's organizations and their 2FA settings
    const { data: orgMemberships, error: orgError } = await supabase
      .from('org_members')
      .select(`
        org_id,
        role,
        organizations!inner (
          name,
          organization_settings (
            require_2fa_for_admins,
            require_2fa_for_all
          )
        )
      `)
      .eq('user_id', user.id);

    if (orgError) {
      console.error('Error fetching org memberships:', orgError);
    }

    // Build response
    return res.status(200).json({
      enabled: profile?.totp_enabled || false,
      verifiedAt: profile?.totp_verified_at || null,
      backupCodesRemaining: backupCodesCount || 0,
      requiredByOrg: requiresData || false,
      organizations: orgMemberships?.map(om => {
        const org = om.organizations as any;
        const settings = org?.organization_settings?.[0];
        return {
          name: org?.name,
          role: om.role,
          requires2FA: om.role === 'admin'
            ? (settings?.require_2fa_for_admins || settings?.require_2fa_for_all)
            : settings?.require_2fa_for_all,
        };
      }) || [],
    });
  } catch (error) {
    console.error('Error in 2FA status:', error);
    // Import sanitizeError from error-handler
    const { sanitizeError } = await import('../utils/error-handler.js');
    return res.status(500).json({
      error: sanitizeError(error, '2FA status'),
    });
  }
}
