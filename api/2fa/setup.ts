/**
 * API endpoint to initialize 2FA setup
 * Generates TOTP secret, QR code, and backup codes
 *
 * POST /api/2fa/setup
 * Requires: Authenticated user
 * Returns: QR code, secret (for manual entry), backup codes
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { generate2FASetup } from '../../src/lib/twoFactor.js';
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

    // Check if user already has 2FA enabled
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('totp_enabled, totp_secret')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }

    // If 2FA is already enabled, require it to be disabled first
    if (profile?.totp_enabled) {
      return res.status(400).json({
        error: 'Two-factor authentication is already enabled. Please disable it first to set up a new authenticator.',
      });
    }

    // Generate 2FA setup data
    const userEmail = user.email || 'user@grantcue.com';
    const setupData = await generate2FASetup(userEmail);

    // Store the encrypted secret in the database (not enabled yet)
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        totp_secret: setupData.encryptedSecret,
        totp_enabled: false, // Not enabled until verified
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating user profile:', updateError);
      return res.status(500).json({ error: 'Failed to save 2FA setup' });
    }

    // Store backup codes (hashed)
    // First, delete any existing backup codes
    await supabase
      .from('user_backup_codes')
      .delete()
      .eq('user_id', user.id);

    // Insert new backup codes
    const backupCodeRecords = setupData.backupCodesHashed.map(codeHash => ({
      user_id: user.id,
      code_hash: codeHash,
      used: false,
    }));

    const { error: backupCodesError } = await supabase
      .from('user_backup_codes')
      .insert(backupCodeRecords);

    if (backupCodesError) {
      console.error('Error storing backup codes:', backupCodesError);
      return res.status(500).json({ error: 'Failed to save backup codes' });
    }

    // Log the setup event
    await supabase.from('two_factor_audit_log').insert({
      user_id: user.id,
      event_type: 'setup',
      event_details: {
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        user_agent: req.headers['user-agent'],
      },
      ip_address: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || null,
      user_agent: req.headers['user-agent'] || null,
    });

    // Return setup data to user
    // IMPORTANT: The plaintext secret and backup codes are only shown ONCE
    return res.status(200).json({
      success: true,
      qrCode: setupData.qrCodeDataUrl,
      secret: setupData.secret, // For manual entry
      backupCodes: setupData.backupCodes, // Plain backup codes (show once!)
      message: 'Scan the QR code with your authenticator app, then verify with a 6-digit code to enable 2FA.',
    });
  } catch (error) {
    console.error('Error in 2FA setup:', error);
    // Import sanitizeError from error-handler
    const { sanitizeError } = await import('../utils/error-handler.js');
    return res.status(500).json({
      error: sanitizeError(error, '2FA setup'),
    });
  }
}
