import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { rateLimitStandard, handleRateLimit } from '../../utils/ratelimit';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://grantcue.com/api/oauth/google/callback';

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Apply rate limiting (60 req/min per IP)
  const rateLimitResult = await rateLimitStandard(req);
  if (handleRateLimit(res, rateLimitResult)) {
    return;
  }

  // Only allow GET (OAuth callback)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, state, error: oauthError } = req.query;

    // Check for OAuth errors
    if (oauthError) {
      console.error('Google OAuth error:', oauthError);
      return res.redirect(`/settings/integrations?error=${encodeURIComponent(oauthError as string)}`);
    }

    // Validate code and state
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }

    // Validate environment variables
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (!googleClientId || !googleClientSecret) {
      return res.status(500).json({ error: 'Google OAuth not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate state token - CSRF protection
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_state_tokens')
      .select('user_id, org_id, expires_at, used, provider')
      .eq('state_token', state as string)
      .eq('provider', 'google')
      .single();

    if (stateError || !stateData) {
      console.error('Invalid state token:', stateError);
      return res.redirect('/settings/integrations?error=invalid_state_token');
    }

    // Check if token has expired
    if (new Date(stateData.expires_at) < new Date()) {
      console.error('State token has expired');
      return res.redirect('/settings/integrations?error=state_token_expired');
    }

    // Check if token has already been used
    if (stateData.used) {
      console.error('State token has already been used');
      return res.redirect('/settings/integrations?error=state_token_reused');
    }

    // Mark state token as used
    await supabase
      .from('oauth_state_tokens')
      .update({ used: true })
      .eq('state_token', state as string);

    const userId = stateData.user_id;
    const orgId = stateData.org_id;

    // Verify user has access to this organization
    const { data: membership } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .single();

    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can connect integrations' });
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: code as string,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: googleRedirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Google token exchange failed:', errorText);
      return res.redirect('/settings/integrations?error=token_exchange_failed');
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();

    // Calculate token expiration
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

    // Store tokens in database
    const { error: dbError } = await supabase
      .from('integrations')
      .upsert({
        org_id: orgId,
        integration_type: 'google_calendar',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_expires_at: expiresAt.toISOString(),
        connected_by: userId,
        connected_at: new Date().toISOString(),
        is_active: true,
        settings: {
          scope: tokens.scope,
        },
      }, {
        onConflict: 'org_id,integration_type',
      });

    if (dbError) {
      console.error('Error storing Google tokens:', dbError);
      return res.redirect('/settings/integrations?error=database_error');
    }

    // Success! Redirect to settings page
    return res.redirect('/settings/integrations?success=google_connected');
  } catch (error) {
    console.error('Error in Google OAuth callback:', error);
    return res.redirect('/settings/integrations?error=internal_error');
  }
}
