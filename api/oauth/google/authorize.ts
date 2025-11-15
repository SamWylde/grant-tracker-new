import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { org_id, user_id } = req.query;

  if (!org_id || typeof org_id !== 'string') {
    return res.status(400).json({ error: 'org_id is required' });
  }

  if (!user_id || typeof user_id !== 'string') {
    return res.status(400).json({ error: 'user_id is required' });
  }

  // Validate environment variables
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Get OAuth credentials from environment
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://grantcue.com/api/oauth/google/callback';

  if (!clientId) {
    return res.status(500).json({
      error: 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID environment variable.'
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate cryptographically secure random state token
    const stateToken = crypto.randomBytes(32).toString('base64url');

    // Store state token in database with 10-minute expiration
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    const { error: dbError } = await supabase
      .from('oauth_state_tokens')
      .insert({
        state_token: stateToken,
        user_id,
        org_id,
        provider: 'google',
        expires_at: expiresAt.toISOString(),
      });

    if (dbError) {
      console.error('Error storing OAuth state token:', dbError);
      return res.status(500).json({ error: 'Failed to initialize OAuth flow' });
    }

    // Construct OAuth URL with cryptographic state token
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar.events',
      access_type: 'offline',
      prompt: 'consent',
      state: stateToken,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    // Redirect to Google OAuth
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error in Google OAuth authorize:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
