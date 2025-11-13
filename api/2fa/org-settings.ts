/**
 * API endpoint to manage organization 2FA enforcement settings
 *
 * GET /api/2fa/org-settings?orgId={orgId}
 * POST /api/2fa/org-settings
 * Body: { orgId: string, require2FAForAdmins: boolean, require2FAForAll: boolean }
 * Requires: Authenticated admin user
 * Returns: Organization 2FA settings
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    if (req.method === 'GET') {
      // Get organization 2FA settings
      const { orgId } = req.query;

      if (!orgId || typeof orgId !== 'string') {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      // Verify user is an admin of this organization
      const { data: membership, error: memberError } = await supabase
        .from('org_members')
        .select('role')
        .eq('org_id', orgId)
        .eq('user_id', user.id)
        .single();

      if (memberError || !membership || membership.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Get organization settings
      const { data: settings, error: settingsError } = await supabase
        .from('organization_settings')
        .select('require_2fa_for_admins, require_2fa_for_all')
        .eq('org_id', orgId)
        .single();

      if (settingsError) {
        console.error('Error fetching org settings:', settingsError);
        return res.status(500).json({ error: 'Failed to fetch organization settings' });
      }

      // Count org members and their 2FA status
      const { data: members, error: membersError } = await supabase
        .from('org_members')
        .select(`
          user_id,
          role,
          user_profiles!inner (
            full_name,
            totp_enabled
          )
        `)
        .eq('org_id', orgId);

      if (membersError) {
        console.error('Error fetching org members:', membersError);
      }

      const memberStats = {
        total: members?.length || 0,
        admins: members?.filter(m => m.role === 'admin').length || 0,
        with2FA: members?.filter(m => {
          const profile = m.user_profiles as any;
          return profile?.totp_enabled;
        }).length || 0,
        adminsWith2FA: members?.filter(m => {
          const profile = m.user_profiles as any;
          return m.role === 'admin' && profile?.totp_enabled;
        }).length || 0,
      };

      return res.status(200).json({
        orgId,
        require2FAForAdmins: settings?.require_2fa_for_admins || false,
        require2FAForAll: settings?.require_2fa_for_all || false,
        memberStats,
      });
    } else if (req.method === 'POST') {
      // Update organization 2FA settings
      const { orgId, require2FAForAdmins, require2FAForAll } = req.body;

      if (!orgId || typeof orgId !== 'string') {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      if (typeof require2FAForAdmins !== 'boolean' && typeof require2FAForAll !== 'boolean') {
        return res.status(400).json({ error: 'At least one setting must be provided' });
      }

      // Verify user is an admin of this organization
      const { data: membership, error: memberError } = await supabase
        .from('org_members')
        .select('role')
        .eq('org_id', orgId)
        .eq('user_id', user.id)
        .single();

      if (memberError || !membership || membership.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Update settings
      const updateData: any = {};
      if (typeof require2FAForAdmins === 'boolean') {
        updateData.require_2fa_for_admins = require2FAForAdmins;
      }
      if (typeof require2FAForAll === 'boolean') {
        updateData.require_2fa_for_all = require2FAForAll;
      }

      const { error: updateError } = await supabase
        .from('organization_settings')
        .update(updateData)
        .eq('org_id', orgId);

      if (updateError) {
        console.error('Error updating org settings:', updateError);
        return res.status(500).json({ error: 'Failed to update organization settings' });
      }

      return res.status(200).json({
        success: true,
        message: 'Organization 2FA settings updated successfully',
        settings: updateData,
      });
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in org 2FA settings:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
