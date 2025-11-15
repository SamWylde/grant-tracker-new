/**
 * API endpoint to verify and enable 2FA
 * Verifies the TOTP code and enables 2FA for the user
 *
 * POST /api/2fa/verify-setup
 * Body: { code: string }
 * Requires: Authenticated user with pending 2FA setup
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
    return res.status(400).json({ error: '6-digit verification code is required' });
  }

  // Validate code format (6 digits)
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Code must be 6 digits' });
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

    if (!profile?.totp_secret) {
      return res.status(400).json({
        error: 'No 2FA setup found. Please initiate setup first.',
      });
    }

    if (profile.totp_enabled) {
      return res.status(400).json({
        error: 'Two-factor authentication is already enabled.',
      });
    }

    // Decrypt the secret
    const secret = await decryptTOTPSecret(profile.totp_secret);

    // Verify the code
    const isValid = verifyTOTPCode(secret, code);

    if (!isValid) {
      // Log failed verification
      await supabase.from('two_factor_audit_log').insert({
        user_id: user.id,
        event_type: 'verify_fail',
        event_details: {
          reason: 'Invalid code during setup',
          ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
          user_agent: req.headers['user-agent'],
        },
        ip_address: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || null,
        user_agent: req.headers['user-agent'] || null,
      });

      return res.status(400).json({
        error: 'Invalid verification code. Please try again.',
      });
    }

    // Code is valid! Enable 2FA
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        totp_enabled: true,
        totp_verified_at: new Date().toISOString(),
        failed_2fa_attempts: 0,
        last_failed_2fa_attempt: null,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error enabling 2FA:', updateError);
      return res.status(500).json({ error: 'Failed to enable 2FA' });
    }

    // Log successful verification and enablement
    await supabase.from('two_factor_audit_log').insert({
      user_id: user.id,
      event_type: 'verify_success',
      event_details: {
        action: 'enabled',
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        user_agent: req.headers['user-agent'],
      },
      ip_address: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || null,
      user_agent: req.headers['user-agent'] || null,
    });

    return res.status(200).json({
      success: true,
      message: 'Two-factor authentication has been successfully enabled!',
    });
  } catch (error) {
    console.error('Error in 2FA verify-setup:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
