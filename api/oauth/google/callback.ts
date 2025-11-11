import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state, error } = req.query;

  // Handle OAuth error
  if (error) {
    return res.redirect(`/settings/calendar?error=${encodeURIComponent(error as string)}`);
  }

  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    return res.redirect('/settings/calendar?error=invalid_callback');
  }

  try {
    const stateData = JSON.parse(state);
    const { org_id } = stateData;

    if (!org_id) {
      return res.redirect('/settings/calendar?error=invalid_state');
    }

    // Get OAuth credentials
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || `${process.env.VITE_APP_URL || 'http://localhost:3000'}/api/oauth/google/callback`;

    if (!clientId || !clientSecret) {
      return res.redirect('/settings/calendar?error=oauth_not_configured');
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange failed:', error);
      return res.redirect('/settings/calendar?error=token_exchange_failed');
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    // Store tokens in database
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const expiresAt = new Date(Date.now() + expires_in * 1000);

    const { error: dbError } = await supabase
      .from('integrations')
      .upsert({
        org_id,
        integration_type: 'google_calendar',
        access_token,
        refresh_token,
        token_expires_at: expiresAt.toISOString(),
        is_active: true,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'org_id,integration_type'
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return res.redirect('/settings/calendar?error=database_error');
    }

    // Also update organization_settings
    await supabase
      .from('organization_settings')
      .update({ google_calendar_connected: true })
      .eq('org_id', org_id);

    // Redirect back to settings with success
    res.redirect('/settings/calendar?success=google_connected');
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect('/settings/calendar?error=unexpected_error');
  }
}
