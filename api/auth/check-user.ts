import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { rateLimitPublic, handleRateLimit } from '../utils/ratelimit';
import { createRequestLogger } from '../utils/logger';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Check User Endpoint
 *
 * SECURITY: This endpoint intentionally does NOT reveal whether a user exists.
 * It returns a generic message for all requests to prevent user enumeration attacks
 * where an attacker could discover valid email addresses.
 *
 * The actual user existence check happens server-side only for logging/analytics,
 * but is not exposed to the client.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const logger = createRequestLogger(req, { module: 'auth/check-user' });

  // Apply rate limiting (100 req/min per IP)
  const rateLimitResult = await rateLimitPublic(req);
  if (handleRateLimit(res, rateLimitResult)) {
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Use admin API to list users by email
    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
      logger.error('Error checking user', error);
      // Even on error, return generic message to prevent enumeration
      return res.status(200).json({
        message: 'If an account exists for this email, you will receive instructions shortly.'
      });
    }

    // Check if user with this email exists (for internal logging only)
    const userExists = users?.some(user => user.email?.toLowerCase() === email.toLowerCase());

    // Log for analytics/monitoring (internal use only)
    logger.info('Email check completed', {
      emailPrefix: email.substring(0, 3),
      userExists,
      status: userExists ? 'exists' : 'new'
    });

    // SECURITY: Always return the same generic message regardless of whether user exists
    // This prevents attackers from discovering valid email addresses in the system
    return res.status(200).json({
      message: 'If an account exists for this email, you will receive instructions shortly.'
    });
  } catch (error) {
    logger.error('Error in check-user API', error);
    // Even on error, return generic message to prevent enumeration
    return res.status(200).json({
      message: 'If an account exists for this email, you will receive instructions shortly.'
    });
  }
}
