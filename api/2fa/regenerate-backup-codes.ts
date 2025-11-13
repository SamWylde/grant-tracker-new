/**
 * API endpoint to regenerate backup codes
 * Requires verification code
 *
 * POST /api/2fa/regenerate-backup-codes
 * Body: { code: string }
 * Requires: Authenticated user with 2FA enabled
 * Returns: New backup codes (shown once!)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyTOTPCode, decryptTOTPSecret, generateBackupCodes, hashBackupCodes } from '../../src/lib/twoFactor.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check environment variables
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { code } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Verification code is required' });
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

    // Get user's TOTP secret
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('totp_secret, totp_enabled')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }

    if (!profile?.totp_enabled || !profile?.totp_secret) {
      return res.status(400).json({
        error: 'Two-factor authentication is not enabled.',
      });
    }

    // Decrypt and verify the code
    const secret = await decryptTOTPSecret(profile.totp_secret);
    const isValid = verifyTOTPCode(secret, code);

    if (!isValid) {
      return res.status(400).json({
        error: 'Invalid verification code. Please try again.',
      });
    }

    // Code is valid! Generate new backup codes
    const backupCodes = generateBackupCodes(10);
    const backupCodesHashed = hashBackupCodes(backupCodes);

    // Delete all existing backup codes
    await supabase
      .from('user_backup_codes')
      .delete()
      .eq('user_id', user.id);

    // Insert new backup codes
    const backupCodeRecords = backupCodesHashed.map(codeHash => ({
      user_id: user.id,
      code_hash: codeHash,
      used: false,
    }));

    const { error: insertError } = await supabase
      .from('user_backup_codes')
      .insert(backupCodeRecords);

    if (insertError) {
      console.error('Error storing backup codes:', insertError);
      return res.status(500).json({ error: 'Failed to save backup codes' });
    }

    // Log the regeneration event
    await supabase.from('two_factor_audit_log').insert({
      user_id: user.id,
      event_type: 'backup_codes_regenerated',
      event_details: {
        codes_count: backupCodes.length,
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        user_agent: req.headers['user-agent'],
      },
      ip_address: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || null,
      user_agent: req.headers['user-agent'] || null,
    });

    // Return new backup codes
    // IMPORTANT: These are only shown ONCE
    return res.status(200).json({
      success: true,
      backupCodes: backupCodes,
      message: 'New backup codes generated. Save them in a secure place!',
    });
  } catch (error) {
    console.error('Error in regenerate backup codes:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
