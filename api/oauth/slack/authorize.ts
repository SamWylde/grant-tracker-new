import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { org_id, state } = req.query;

  if (!org_id || typeof org_id !== 'string') {
    return res.status(400).json({ error: 'org_id is required' });
  }

  // Get OAuth credentials from environment
  const clientId = process.env.SLACK_OAUTH_CLIENT_ID;
  const redirectUri = process.env.SLACK_OAUTH_REDIRECT_URI || `${process.env.VITE_APP_URL || 'http://localhost:3000'}/api/oauth/slack/callback`;

  if (!clientId) {
    return res.status(500).json({
      error: 'Slack OAuth not configured. Please set SLACK_OAUTH_CLIENT_ID environment variable.'
    });
  }

  // Construct OAuth URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'incoming-webhook,chat:write',
    state: JSON.stringify({ org_id, custom_state: state }),
  });

  const authUrl = `https://slack.com/oauth/v2/authorize?${params.toString()}`;

  // Redirect to Slack OAuth
  res.redirect(authUrl);
}
