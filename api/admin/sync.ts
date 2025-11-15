/**
 * Admin Sync API
 *
 * Endpoints for managing grant source synchronization
 * POST /api/admin/sync - Trigger a sync job
 * GET /api/admin/sync - Get sync history
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { SyncService } from '../../lib/grants/SyncService.js';
import { rateLimitAdmin, handleRateLimit } from '../utils/ratelimit';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apply rate limiting (30 req/min per IP)
  const rateLimitResult = await rateLimitAdmin(req);
  if (handleRateLimit(res, rateLimitResult)) {
    return;
  }

  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Verify admin role
  const { data: memberships } = await supabase
    .from('org_members')
    .select('role')
    .eq('user_id', user.id);

  const isAdmin = memberships?.some((m) => m.role === 'admin');

  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  if (req.method === 'POST') {
    return handleTriggerSync(req, res, supabaseUrl, supabaseServiceKey);
  } else if (req.method === 'GET') {
    return handleGetSyncHistory(req, res, supabaseUrl, supabaseServiceKey);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleTriggerSync(
  req: VercelRequest,
  res: VercelResponse,
  supabaseUrl: string,
  supabaseServiceKey: string
) {
  const { source_key, job_type = 'full', external_id } = req.body;

  if (!source_key) {
    return res.status(400).json({ error: 'source_key is required' });
  }

  if (job_type === 'single' && !external_id) {
    return res.status(400).json({ error: 'external_id required for single grant sync' });
  }

  try {
    const syncService = new SyncService(supabaseUrl, supabaseServiceKey);
    const job = await syncService.runSync(source_key, job_type as any, external_id);

    return res.status(200).json({
      message: 'Sync job completed',
      job,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return res.status(500).json({
      error: 'Sync failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleGetSyncHistory(
  req: VercelRequest,
  res: VercelResponse,
  supabaseUrl: string,
  supabaseServiceKey: string
) {
  const { source_key } = req.query;

  if (!source_key || typeof source_key !== 'string') {
    return res.status(400).json({ error: 'source_key is required' });
  }

  try {
    const syncService = new SyncService(supabaseUrl, supabaseServiceKey);
    const history = await syncService.getSyncHistory(source_key);

    return res.status(200).json({ history });
  } catch (error) {
    console.error('Error fetching sync history:', error);
    return res.status(500).json({
      error: 'Failed to fetch sync history',
    });
  }
}
