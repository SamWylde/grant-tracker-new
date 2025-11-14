/**
 * Admin API: Fix Grant Titles and Descriptions
 *
 * Call this endpoint to fetch real titles and descriptions from Grants.gov
 * and update all grants in the catalog.
 *
 * Usage: POST /api/admin/fix-grant-titles
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface CatalogGrant {
  id: string;
  external_id: string;
  title: string;
  description: string | null;
  agency: string | null;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchGrantDetails(externalId: string) {
  try {
    const response = await fetch('https://api.grants.gov/v1/api/fetchOpportunity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunityId: Number(externalId) }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      title: data?.data?.title || null,
      description: data?.data?.synopsis?.synopsisDesc || null,
      agency: data?.data?.agencyName || null,
    };
  } catch (error) {
    return null;
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all grants that need fixing
    const { data: grants, error } = await supabase
      .from('grants_catalog')
      .select('id, external_id, title, description, agency')
      .eq('source_key', 'grants_gov')
      .eq('is_active', true);

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch grants',
        details: error.message
      });
    }

    if (!grants || grants.length === 0) {
      return res.status(200).json({
        message: 'No grants found in catalog',
        stats: { total: 0, fixed: 0, failed: 0, skipped: 0 }
      });
    }

    // Filter grants that need fixing
    const grantsNeedingFix = grants.filter((g: CatalogGrant) => {
      const hasBadTitle = !g.title ||
                         /^Grant [0-9]+$/.test(g.title) ||
                         g.title === 'Untitled Grant';
      const hasNoDescription = !g.description;
      return hasBadTitle || hasNoDescription;
    });

    console.log(`[Fix Grant Titles] Found ${grantsNeedingFix.length} grants needing fixes out of ${grants.length} total`);

    if (grantsNeedingFix.length === 0) {
      return res.status(200).json({
        message: 'All grants already have valid titles and descriptions',
        stats: { total: grants.length, fixed: 0, failed: 0, skipped: 0 }
      });
    }

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    // Process in batches to avoid rate limiting
    const batchSize = 10;
    const delayBetweenBatches = 1000; // 1 second

    for (let i = 0; i < grantsNeedingFix.length; i += batchSize) {
      const batch = grantsNeedingFix.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (grant: CatalogGrant) => {
          const hasBadTitle = !grant.title ||
                             /^Grant [0-9]+$/.test(grant.title) ||
                             grant.title === 'Untitled Grant';
          const hasNoDescription = !grant.description;

          const details = await fetchGrantDetails(grant.external_id);

          if (!details) {
            skippedCount++;
            return;
          }

          const updates: any = {
            last_synced_at: new Date().toISOString(),
          };
          let needsUpdate = false;

          if (hasBadTitle && details.title) {
            updates.title = details.title;
            needsUpdate = true;
          }

          if (hasNoDescription && details.description) {
            updates.description = details.description;
            needsUpdate = true;
          }

          if (!grant.agency && details.agency) {
            updates.agency = details.agency;
            needsUpdate = true;
          }

          if (needsUpdate) {
            const { error: updateError } = await supabase
              .from('grants_catalog')
              .update(updates)
              .eq('id', grant.id);

            if (updateError) {
              console.error(`Failed to update grant ${grant.external_id}:`, updateError);
              failCount++;
            } else {
              successCount++;
            }
          } else {
            skippedCount++;
          }
        })
      );

      // Delay between batches
      if (i + batchSize < grantsNeedingFix.length) {
        await sleep(delayBetweenBatches);
      }
    }

    return res.status(200).json({
      message: 'Grant titles and descriptions updated',
      stats: {
        total: grants.length,
        needing_fix: grantsNeedingFix.length,
        fixed: successCount,
        failed: failCount,
        skipped: skippedCount,
      }
    });

  } catch (error) {
    console.error('[Fix Grant Titles] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
