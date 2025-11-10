/**
 * Cron Job: Nightly Grant Sync
 *
 * Runs daily to sync grants from enabled sources
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/sync-grants",
 *     "schedule": "0 2 * * *"
 *   }]
 * }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { SyncService } from '../../lib/grants/SyncService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify this is a cron request (Vercel sets this header)
  const authHeader = req.headers.authorization;

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get all sources that are enabled for sync
    const { data: sources, error: sourcesError } = await supabase
      .from('grant_sources')
      .select('*')
      .eq('sync_enabled', true);

    if (sourcesError) {
      throw sourcesError;
    }

    if (!sources || sources.length === 0) {
      return res.status(200).json({
        message: 'No sources configured for sync',
        results: [],
      });
    }

    const syncService = new SyncService(supabaseUrl, supabaseServiceKey);
    const results = [];

    // Sync each enabled source
    for (const source of sources) {
      try {
        console.log(`Starting sync for ${source.source_key}...`);

        // Determine job type based on last sync
        const jobType = source.last_sync_at ? 'incremental' : 'full';

        const job = await syncService.runSync(source.source_key, jobType as any);

        results.push({
          source_key: source.source_key,
          status: job.status,
          grants_fetched: job.grants_fetched,
          grants_created: job.grants_created,
          grants_updated: job.grants_updated,
        });

        console.log(`Completed sync for ${source.source_key}`);
      } catch (error) {
        console.error(`Error syncing ${source.source_key}:`, error);
        results.push({
          source_key: source.source_key,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return res.status(200).json({
      message: 'Sync completed',
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    console.error('Cron sync error:', error);
    return res.status(500).json({
      error: 'Sync failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
