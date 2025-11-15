/**
 * API endpoint to disable 2FA for current user
 * Requires verification code to disable
 *
 * POST /api/2fa/disable
 * Body: { code: string, password?: string }
 * Requires: Authenticated user with 2FA enabled
 * Returns: Success confirmation
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyTOTPCode, decryptTOTPSecret } from '../../src/lib/twoFactor.js';
import { rateLimitAuth, handleRateLimit } from '../utils/ratelimit';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apply rate limiting (10 req/min per IP)
  const rateLimitResult = await rateLimitAuth(req);
  if (handleRateLimit(res, rateLimitResult)) {
    return;
  }

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
    return res.status(400).json({ error: 'Verification code is required to disable 2FA' });
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

    // Check if user is required to have 2FA by their organization
    const { data: requiresData, error: requiresError } = await supabase
      .rpc('user_requires_2fa', { p_user_id: user.id });

    if (!requiresError && requiresData) {
      return res.status(403).json({
        error: 'Cannot disable 2FA. Your organization requires two-factor authentication.',
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

    // Code is valid! Disable 2FA
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        totp_enabled: false,
        totp_secret: null,
        totp_verified_at: null,
        failed_2fa_attempts: 0,
        last_failed_2fa_attempt: null,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error disabling 2FA:', updateError);
      return res.status(500).json({ error: 'Failed to disable 2FA' });
    }

    // Delete all backup codes
    await supabase
      .from('user_backup_codes')
      .delete()
      .eq('user_id', user.id);

    // Log the disable event
    await supabase.from('two_factor_audit_log').insert({
      user_id: user.id,
      event_type: 'disable',
      event_details: {
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        user_agent: req.headers['user-agent'],
      },
      ip_address: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || null,
      user_agent: req.headers['user-agent'] || null,
    });

    return res.status(200).json({
      success: true,
      message: 'Two-factor authentication has been disabled.',
    });
  } catch (error) {
    console.error('Error in 2FA disable:', error);
    // Import sanitizeError from error-handler
    const { sanitizeError } = await import('../utils/error-handler.js');
    return res.status(500).json({
      error: sanitizeError(error, '2FA disable'),
    });
  }
}
