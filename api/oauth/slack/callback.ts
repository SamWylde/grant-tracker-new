import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { rateLimitStandard, handleRateLimit } from '../../utils/ratelimit';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const slackClientId = process.env.SLACK_CLIENT_ID;
const slackClientSecret = process.env.SLACK_CLIENT_SECRET;
const slackRedirectUri = process.env.SLACK_REDIRECT_URI || 'https://grantcue.com/api/oauth/slack/callback';

interface SlackOAuthResponse {
  ok: boolean;
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id?: string;
  app_id: string;
  team: {
    name: string;
    id: string;
  };
  incoming_webhook?: {
    channel: string;
    channel_id: string;
    configuration_url: string;
    url: string;
  };
  error?: string;
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
      console.error('Slack OAuth error:', oauthError);
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

    if (!slackClientId || !slackClientSecret) {
      return res.status(500).json({ error: 'Slack OAuth not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate state token - CSRF protection
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_state_tokens')
      .select('user_id, org_id, expires_at, used, provider')
      .eq('state_token', state as string)
      .eq('provider', 'slack')
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
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: code as string,
        client_id: slackClientId,
        client_secret: slackClientSecret,
        redirect_uri: slackRedirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Slack token exchange failed:', errorText);
      return res.redirect('/settings/integrations?error=token_exchange_failed');
    }

    const slackData: SlackOAuthResponse = await tokenResponse.json();

    if (!slackData.ok) {
      console.error('Slack OAuth error:', slackData.error);
      return res.redirect(`/settings/integrations?error=${encodeURIComponent(slackData.error || 'unknown')}`);
    }

    // Store tokens in database
    const { error: dbError } = await supabase
      .from('integrations')
      .upsert({
        org_id: orgId,
        integration_type: 'slack',
        access_token: slackData.access_token,
        channel_id: slackData.incoming_webhook?.channel_id || null,
        channel_name: slackData.incoming_webhook?.channel || null,
        webhook_url: slackData.incoming_webhook?.url || null,
        connected_by: userId,
        connected_at: new Date().toISOString(),
        is_active: true,
        settings: {
          team_id: slackData.team.id,
          team_name: slackData.team.name,
          bot_user_id: slackData.bot_user_id,
          scope: slackData.scope,
        },
      }, {
        onConflict: 'org_id,integration_type',
      });

    if (dbError) {
      console.error('Error storing Slack tokens:', dbError);
      return res.redirect('/settings/integrations?error=database_error');
    }

    // Success! Redirect to settings page
    return res.redirect('/settings/integrations?success=slack_connected');
  } catch (error) {
    console.error('Error in Slack OAuth callback:', error);
    return res.redirect('/settings/integrations?error=internal_error');
  }
}
