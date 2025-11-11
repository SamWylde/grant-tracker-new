/**
 * Grant Sync Service
 *
 * Handles synchronization of grants from external sources to the catalog
 */

import { createClient } from '@supabase/supabase-js';
import { createAdapter } from './adapters';
import type {
  GrantSource,
  SyncJob,
  SyncResult,
  JobType,
} from './types';

export class SyncService {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Run a sync job for a specific source
   */
  async runSync(
    sourceKey: string,
    jobType: JobType = 'full',
    singleGrantId?: string
  ): Promise<SyncJob> {
    // Get source configuration
    const { data: source, error: sourceError } = await this.supabase
      .from('grant_sources')
      .select('*')
      .eq('source_key', sourceKey)
      .single();

    if (sourceError || !source) {
      throw new Error(`Source not found: ${sourceKey}`);
    }

    // Create sync job record
    const { data: job, error: jobError } = await this.supabase
      .from('sync_jobs')
      .insert({
        source_id: source.id,
        job_type: jobType,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new Error('Failed to create sync job');
    }

    try {
      // Get API key if required (from environment or config)
      const apiKey = this.getApiKeyForSource(sourceKey);

      // Create adapter
      const adapter = createAdapter(source as GrantSource, apiKey);

      let result: SyncResult;

      // Run appropriate sync type
      if (jobType === 'single' && singleGrantId) {
        result = await this.syncSingleGrant(adapter, singleGrantId);
      } else if (jobType === 'incremental' && source.last_sync_at) {
        result = await adapter.performIncrementalSync(new Date(source.last_sync_at));
      } else {
        result = await adapter.performFullSync();
      }

      // Process grants and save to catalog
      const catalogResult = await this.processSyncResult(result, source as GrantSource, adapter);

      // Update job with results
      await this.supabase
        .from('sync_jobs')
        .update({
          status: 'completed',
          grants_fetched: catalogResult.grants_fetched,
          grants_created: catalogResult.grants_created,
          grants_updated: catalogResult.grants_updated,
          grants_skipped: catalogResult.grants_skipped,
          duplicates_found: catalogResult.duplicates_found,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      // Update source last_sync_at
      await this.supabase
        .from('grant_sources')
        .update({
          last_sync_at: new Date().toISOString(),
        })
        .eq('id', source.id);

      // Return updated job
      const { data: updatedJob } = await this.supabase
        .from('sync_jobs')
        .select('*')
        .eq('id', job.id)
        .single();

      return updatedJob as SyncJob;
    } catch (error) {
      // Update job with error
      await this.supabase
        .from('sync_jobs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      throw error;
    }
  }

  /**
   * Sync a single grant by external ID
   */
  private async syncSingleGrant(adapter: any, externalId: string): Promise<SyncResult> {
    const result: SyncResult = {
      grants_fetched: 0,
      grants_created: 0,
      grants_updated: 0,
      grants_skipped: 0,
      duplicates_found: 0,
      errors: [],
    };

    try {
      const raw = await adapter.fetchSingleGrant(externalId);

      if (!raw) {
        result.errors.push({
          error_code: 'NOT_FOUND',
          error_message: `Grant ${externalId} not found`,
          timestamp: new Date().toISOString(),
        });
        return result;
      }

      result.grants_fetched = 1;
      // Will be processed in processSyncResult
    } catch (error) {
      result.errors.push({
        grant_id: externalId,
        error_code: 'FETCH_ERROR',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }

    return result;
  }

  /**
   * Process sync result and save grants to catalog
   */
  private async processSyncResult(
    result: SyncResult,
    source: GrantSource,
    adapter: any
  ): Promise<SyncResult> {
    // Since the adapter's performFullSync/Incremental don't return raw grants,
    // we need to fetch them again and process them
    // This is inefficient but works with the current architecture

    try {
      let page = 1;
      let hasMore = true;
      const processedIds = new Set<string>();

      while (hasMore && page <= 10) { // Limit to 10 pages for safety
        const response = await adapter.fetchGrants({
          page,
          limit: 50,
        });

        if (!response.grants || response.grants.length === 0) {
          break;
        }

        // Process each grant
        for (const rawGrant of response.grants) {
          try {
            // Normalize the grant using the adapter
            const normalized = adapter.normalizeGrant(rawGrant);

            // Generate content hash
            const contentHash = adapter.generateContentHash(normalized);

            // Check if grant already exists
            const { data: existing } = await this.supabase
              .from('grants_catalog')
              .select('id, content_hash, last_updated_at')
              .eq('source_key', source.source_key)
              .eq('external_id', normalized.external_id)
              .maybeSingle();

            const now = new Date().toISOString();

            if (existing) {
              // Check if content has changed
              if (existing.content_hash !== contentHash) {
                // Update existing grant
                await this.supabase
                  .from('grants_catalog')
                  .update({
                    title: normalized.title,
                    description: normalized.description,
                    agency: normalized.agency,
                    opportunity_number: normalized.opportunity_number,
                    estimated_funding: normalized.estimated_funding,
                    award_floor: normalized.award_floor,
                    award_ceiling: normalized.award_ceiling,
                    expected_awards: normalized.expected_awards,
                    funding_category: normalized.funding_category,
                    eligibility_applicants: normalized.eligibility_applicants,
                    cost_sharing_required: normalized.cost_sharing_required,
                    posted_date: normalized.posted_date,
                    open_date: normalized.open_date,
                    close_date: normalized.close_date,
                    opportunity_status: normalized.opportunity_status,
                    cfda_numbers: normalized.cfda_numbers,
                    aln_codes: normalized.aln_codes,
                    source_url: normalized.source_url,
                    application_url: normalized.application_url,
                    content_hash: contentHash,
                    last_updated_at: now,
                    last_synced_at: now,
                  })
                  .eq('id', existing.id);

                result.grants_updated++;
              } else {
                // No changes, just update sync timestamp
                await this.supabase
                  .from('grants_catalog')
                  .update({ last_synced_at: now })
                  .eq('id', existing.id);

                result.grants_skipped++;
              }
            } else {
              // Insert new grant
              await this.supabase
                .from('grants_catalog')
                .insert({
                  source_id: source.id,
                  source_key: source.source_key,
                  external_id: normalized.external_id,
                  title: normalized.title,
                  description: normalized.description,
                  agency: normalized.agency,
                  opportunity_number: normalized.opportunity_number,
                  estimated_funding: normalized.estimated_funding,
                  award_floor: normalized.award_floor,
                  award_ceiling: normalized.award_ceiling,
                  expected_awards: normalized.expected_awards,
                  funding_category: normalized.funding_category,
                  eligibility_applicants: normalized.eligibility_applicants,
                  cost_sharing_required: normalized.cost_sharing_required,
                  posted_date: normalized.posted_date,
                  open_date: normalized.open_date,
                  close_date: normalized.close_date,
                  opportunity_status: normalized.opportunity_status,
                  cfda_numbers: normalized.cfda_numbers,
                  aln_codes: normalized.aln_codes,
                  source_url: normalized.source_url,
                  application_url: normalized.application_url,
                  content_hash: contentHash,
                  first_seen_at: now,
                  last_updated_at: now,
                  last_synced_at: now,
                  is_active: true,
                });

              result.grants_created++;
            }

            processedIds.add(normalized.external_id);
          } catch (error) {
            result.errors.push({
              error_code: 'PROCESSING_ERROR',
              error_message: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString(),
            });
          }
        }

        hasMore = response.pagination.has_more;
        page++;

        // Respect rate limits
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Update the result counts to reflect actual operations
      result.grants_fetched = processedIds.size;
    } catch (error) {
      result.errors.push({
        error_code: 'SYNC_ERROR',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }

    return result;
  }

  /**
   * Get API key for a source from environment
   */
  private getApiKeyForSource(sourceKey: string): string | undefined {
    const envVar = `${sourceKey.toUpperCase()}_API_KEY`;
    return process.env[envVar];
  }

  /**
   * Find and mark duplicates for a grant
   */
  async findDuplicates(grantId: string): Promise<void> {
    const { data: duplicates, error } = await this.supabase
      .rpc('find_potential_duplicates', { p_grant_id: grantId });

    if (error || !duplicates) return;

    // Insert duplicate records (upsert to handle conflicts)
    for (const dup of duplicates) {
      await this.supabase
        .from('grant_duplicates')
        .upsert({
          primary_grant_id: grantId,
          duplicate_grant_id: dup.duplicate_id,
          match_score: dup.match_score,
          match_method: dup.match_reason,
        }, {
          onConflict: 'primary_grant_id,duplicate_grant_id',
          ignoreDuplicates: true
        });
    }
  }

  /**
   * Get recent sync jobs for a source
   */
  async getSyncHistory(sourceKey: string, limit: number = 10): Promise<SyncJob[]> {
    const { data: source } = await this.supabase
      .from('grant_sources')
      .select('id')
      .eq('source_key', sourceKey)
      .single();

    if (!source) return [];

    const { data: jobs } = await this.supabase
      .from('sync_jobs')
      .select('*')
      .eq('source_id', source.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    return jobs as SyncJob[];
  }
}
