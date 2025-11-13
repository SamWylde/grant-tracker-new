/**
 * API endpoint to verify 2FA code during login
 * Accepts both TOTP codes and backup codes
 *
 * POST /api/2fa/verify
 * Body: { code: string, userId?: string }
 * Returns: Success confirmation and marks backup code as used if applicable
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyTOTPCode, decryptTOTPSecret, checkRateLimit } from '../../src/lib/twoFactor.js';
import { hash } from '../../src/lib/crypto.js';

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

  const { code, userId } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Verification code is required' });
  }

  try {
    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get user ID (either from token or from request body for login flow)
    let currentUserId = userId;

    if (!currentUserId) {
      // Try to get from auth header
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (!authError && user) {
          currentUserId = user.id;
        }
      }
    }

    if (!currentUserId) {
      return res.status(401).json({ error: 'User identification required' });
    }

    // Get user's profile with 2FA data
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('totp_secret, totp_enabled, failed_2fa_attempts, last_failed_2fa_attempt')
      .eq('id', currentUserId)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }

    if (!profile?.totp_enabled || !profile?.totp_secret) {
      return res.status(400).json({
        error: 'Two-factor authentication is not enabled for this account.',
      });
    }

    // Check rate limiting
    const rateLimitCheck = checkRateLimit(
      profile.failed_2fa_attempts || 0,
      profile.last_failed_2fa_attempt ? new Date(profile.last_failed_2fa_attempt) : null
    );

    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        error: 'Too many failed attempts. Please try again later.',
        waitTime: rateLimitCheck.waitTime,
      });
    }

    // Try TOTP verification first
    let isValid = false;
    let isBackupCode = false;

    try {
      const secret = await decryptTOTPSecret(profile.totp_secret);
      isValid = verifyTOTPCode(secret, code);
    } catch (error) {
      console.error('Error verifying TOTP:', error);
    }

    // If TOTP fails, try as backup code
    if (!isValid) {
      // Get unused backup codes for this user
      const { data: backupCodes, error: backupError } = await supabase
        .from('user_backup_codes')
        .select('id, code_hash')
        .eq('user_id', currentUserId)
        .eq('used', false);

      if (backupError) {
        console.error('Error fetching backup codes:', backupError);
      } else if (backupCodes && backupCodes.length > 0) {
        // Hash the provided code and check if it matches
        const codeHash = hash(code.replace(/[^A-Z0-9]/gi, '').toUpperCase());
        const matchingCode = backupCodes.find(bc => bc.code_hash === codeHash);

        if (matchingCode) {
          isValid = true;
          isBackupCode = true;

          // Mark backup code as used
          await supabase
            .from('user_backup_codes')
            .update({
              used: true,
              used_at: new Date().toISOString(),
              used_from_ip: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || null,
            })
            .eq('id', matchingCode.id);

          // Log backup code usage
          await supabase.from('two_factor_audit_log').insert({
            user_id: currentUserId,
            event_type: 'backup_code_used',
            event_details: {
              remaining_codes: backupCodes.length - 1,
              ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
              user_agent: req.headers['user-agent'],
            },
            ip_address: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || null,
            user_agent: req.headers['user-agent'] || null,
          });
        }
      }
    }

    if (!isValid) {
      // Increment failed attempts
      await supabase.rpc('increment_failed_2fa_attempts', {
        p_user_id: currentUserId,
      });

      // Log failed verification
      await supabase.from('two_factor_audit_log').insert({
        user_id: currentUserId,
        event_type: 'verify_fail',
        event_details: {
          reason: 'Invalid code',
          remaining_attempts: rateLimitCheck.remainingAttempts ? rateLimitCheck.remainingAttempts - 1 : 0,
          ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
          user_agent: req.headers['user-agent'],
        },
        ip_address: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || null,
        user_agent: req.headers['user-agent'] || null,
      });

      return res.status(400).json({
        error: 'Invalid verification code. Please try again.',
        remainingAttempts: rateLimitCheck.remainingAttempts ? rateLimitCheck.remainingAttempts - 1 : 0,
      });
    }

    // Code is valid! Reset failed attempts
    await supabase.rpc('reset_failed_2fa_attempts', {
      p_user_id: currentUserId,
    });

    // Log successful verification
    await supabase.from('two_factor_audit_log').insert({
      user_id: currentUserId,
      event_type: 'verify_success',
      event_details: {
        method: isBackupCode ? 'backup_code' : 'totp',
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        user_agent: req.headers['user-agent'],
      },
      ip_address: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || null,
      user_agent: req.headers['user-agent'] || null,
    });

    // Get remaining backup codes count
    let remainingBackupCodes = 0;
    if (isBackupCode) {
      const { count } = await supabase
        .from('user_backup_codes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUserId)
        .eq('used', false);

      remainingBackupCodes = count || 0;
    }

    return res.status(200).json({
      success: true,
      verified: true,
      isBackupCode,
      remainingBackupCodes: isBackupCode ? remainingBackupCodes : undefined,
      warning: isBackupCode && remainingBackupCodes === 0
        ? 'This was your last backup code. Please generate new ones.'
        : undefined,
    });
  } catch (error) {
    console.error('Error in 2FA verify:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
