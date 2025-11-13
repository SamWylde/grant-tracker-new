import type { VercelRequest, VercelResponse } from '@vercel/node';

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

  // Get OAuth credentials from environment
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://grantcue.com/api/oauth/google/callback';

  if (!clientId) {
    return res.status(500).json({
      error: 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID environment variable.'
    });
  }

  // Construct OAuth URL - state in format userId:orgId for callback parsing
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent',
    state: `${user_id}:${org_id}`,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  // Redirect to Google OAuth
  res.redirect(authUrl);
}
