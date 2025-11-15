import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { fetchWithTimeout, TimeoutPresets, isTimeoutError } from './utils/timeout';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPEN_AI_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!openaiApiKey) {
    return res.status(500).json({
      error: 'OpenAI API key not configured',
      details: 'OPEN_AI_API_KEY environment variable not set'
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  // Verify user is authenticated
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // SECURITY: Verify user is an admin in at least one organization
  const { data: adminMembership, error: membershipError } = await supabase
    .from('org_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error('Error checking admin status:', membershipError);
    return res.status(500).json({ error: 'Failed to verify admin status' });
  }

  if (!adminMembership) {
    return res.status(403).json({
      error: 'Admin access required',
      message: 'This endpoint is restricted to admin users only'
    });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { endpoint, body } = req.body;

    if (!endpoint || !body) {
      return res.status(400).json({ error: 'endpoint and body are required' });
    }

    // Validate endpoint is an OpenAI endpoint
    if (!endpoint.startsWith('https://api.openai.com/')) {
      return res.status(400).json({ error: 'Invalid OpenAI endpoint' });
    }

    // Forward request to OpenAI with timeout and retry logic
    try {
      const openaiResponse = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify(body),
        timeoutMs: TimeoutPresets.AI_OPERATION, // 45 seconds
        retry: true,
        maxRetries: 2,
        retryDelayMs: 2000,
      });

      const data = await openaiResponse.json();

      if (!openaiResponse.ok) {
        return res.status(openaiResponse.status).json(data);
      }

      return res.status(200).json(data);
    } catch (error) {
      // Handle timeout errors specifically
      if (isTimeoutError(error)) {
        console.error('[OpenAI Proxy] Request timed out');
    // Import sanitizeError from error-handler
    const { sanitizeError } = await import('../utils/error-handler.js');
        return res.status(408).json({
          error: 'Request timeout',
          message: 'OpenAI API request timed out. Please try again.',
        });
      }

      throw error;
    }
  } catch (error) {
    console.error('Error in OpenAI proxy:', error);
    return res.status(500).json({
      error: sanitizeError(error, 'processing request'),
    });
  }
}
