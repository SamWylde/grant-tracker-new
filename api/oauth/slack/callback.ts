import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

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

    // State should be in format: userId:orgId
    const [userId, orgId] = (state as string).split(':');
    if (!userId || !orgId) {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }

    // Validate environment variables
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (!slackClientId || !slackClientSecret) {
      return res.status(500).json({ error: 'Slack OAuth not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
