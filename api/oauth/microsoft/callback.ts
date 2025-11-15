import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { rateLimitStandard, handleRateLimit } from '../../utils/ratelimit';
import { fetchWithTimeout, TimeoutPresets, isTimeoutError } from '../../utils/timeout';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const microsoftClientId = process.env.MICROSOFT_CLIENT_ID;
const microsoftClientSecret = process.env.MICROSOFT_CLIENT_SECRET;
const microsoftRedirectUri = process.env.MICROSOFT_REDIRECT_URI || 'https://grantcue.com/api/oauth/microsoft/callback';
const microsoftTenantId = process.env.MICROSOFT_TENANT_ID || 'common';

interface MicrosoftTokenResponse {
  token_type: string;
  scope: string;
  expires_in: number;
  ext_expires_in: number;
  access_token: string;
  refresh_token?: string;
  id_token?: string;
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
    const { code, state, error: oauthError, error_description } = req.query;

    // Check for OAuth errors
    if (oauthError) {
      console.error('Microsoft OAuth error:', oauthError, error_description);
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

    if (!microsoftClientId || !microsoftClientSecret) {
      return res.status(500).json({ error: 'Microsoft OAuth not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate state token - CSRF protection
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_state_tokens')
      .select('user_id, org_id, expires_at, used, provider')
      .eq('state_token', state as string)
      .eq('provider', 'microsoft')
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

    // Exchange code for tokens with timeout protection
    const tokenUrl = `https://login.microsoftonline.com/${microsoftTenantId}/oauth2/v2.0/token`;
    let tokenResponse;
    try {
      tokenResponse = await fetchWithTimeout(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: microsoftClientId,
          client_secret: microsoftClientSecret,
          code: code as string,
          redirect_uri: microsoftRedirectUri,
          grant_type: 'authorization_code',
          scope: 'https://graph.microsoft.com/.default offline_access',
        }).toString(),
        timeoutMs: TimeoutPresets.OAUTH_CALLBACK, // 10 seconds
        retry: true,
        maxRetries: 2,
      });
    } catch (error) {
      if (isTimeoutError(error)) {
        console.error('[Microsoft OAuth] Token exchange timed out');
        return res.redirect('/settings/integrations?error=token_exchange_timeout');
      }
      console.error('[Microsoft OAuth] Token exchange failed:', error);
      return res.redirect('/settings/integrations?error=token_exchange_failed');
    }

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Microsoft token exchange failed:', errorText);
      return res.redirect('/settings/integrations?error=token_exchange_failed');
    }

    const tokens: MicrosoftTokenResponse = await tokenResponse.json();

    // Calculate token expiration
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

    // Store tokens in database
    const { error: dbError } = await supabase
      .from('integrations')
      .upsert({
        org_id: orgId,
        integration_type: 'microsoft_teams',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_expires_at: expiresAt.toISOString(),
        connected_by: userId,
        connected_at: new Date().toISOString(),
        is_active: true,
        settings: {
          scope: tokens.scope,
          tenant_id: microsoftTenantId,
        },
      }, {
        onConflict: 'org_id,integration_type',
      });

    if (dbError) {
      console.error('Error storing Microsoft tokens:', dbError);
      return res.redirect('/settings/integrations?error=database_error');
    }

    // Success! Redirect to settings page
    return res.redirect('/settings/integrations?success=microsoft_connected');
  } catch (error) {
    console.error('Error in Microsoft OAuth callback:', error);
    return res.redirect('/settings/integrations?error=internal_error');
  }
}
