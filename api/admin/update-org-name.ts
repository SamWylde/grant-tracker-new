import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { rateLimitAdmin, handleRateLimit } from '../utils/ratelimit';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apply rate limiting (30 req/min per IP)
  const rateLimitResult = await rateLimitAdmin(req);
  if (handleRateLimit(res, rateLimitResult)) {
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
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

  // SECURITY: Verify user is a platform admin (NOT organization admin)
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('is_platform_admin')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Error checking platform admin status:', profileError);
    return res.status(500).json({ error: 'Failed to verify platform admin status' });
  }

  if (!profile?.is_platform_admin) {
    return res.status(403).json({
      error: 'Platform admin access required',
      message: 'This endpoint is restricted to platform administrators only'
    });
  }

  try {
    const { org_id, name } = req.body;

    // Validate input
    if (!org_id || !name) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'org_id and name are required'
      });
    }

    // Validate name
    if (typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid name',
        message: 'name must be a non-empty string'
      });
    }

    // Update organization
    const { data, error } = await supabase
      .from('organizations')
      .update({
        name: name.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', org_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating organization:', error);
      throw error;
    }

    console.log(`[Admin] User ${user.id} updated organization name for org ${org_id}: ${name}`);

    return res.status(200).json({
      success: true,
      message: 'Organization name updated successfully',
      data,
    });
  } catch (error) {
    console.error('Error updating organization name:', error);
    // Import sanitizeError from error-handler
    const { sanitizeError } = await import('../utils/error-handler.js');
    return res.status(500).json({
      error: sanitizeError(error, 'processing request'),
    });
  }
}
