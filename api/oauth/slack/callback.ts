import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
    const clientId = process.env.SLACK_OAUTH_CLIENT_ID;
    const clientSecret = process.env.SLACK_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.SLACK_OAUTH_REDIRECT_URI || `${process.env.VITE_APP_URL || 'http://localhost:3000'}/api/oauth/slack/callback`;

    if (!clientId || !clientSecret) {
      return res.redirect('/settings/calendar?error=oauth_not_configured');
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange failed:', error);
      return res.redirect('/settings/calendar?error=token_exchange_failed');
    }

    const data = await tokenResponse.json();

    if (!data.ok) {
      console.error('Slack OAuth error:', data.error);
      return res.redirect(`/settings/calendar?error=${data.error}`);
    }

    const { access_token, incoming_webhook, team } = data;
    const channelName = incoming_webhook?.channel || '';
    const webhookUrl = incoming_webhook?.url || '';

    // Store tokens in database
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: dbError } = await supabase
      .from('integrations')
      .upsert({
        org_id,
        integration_type: 'slack',
        access_token,
        webhook_url: webhookUrl,
        channel_name: channelName,
        settings: { team_name: team?.name },
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

    // Redirect back to settings with success
    res.redirect('/settings/calendar?success=slack_connected');
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect('/settings/calendar?error=unexpected_error');
  }
}
