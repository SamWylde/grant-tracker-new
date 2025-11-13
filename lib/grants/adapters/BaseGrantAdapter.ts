/**
 * Base Grant Source Adapter
 *
 * Abstract class that defines the interface for all grant source adapters.
 * Each source (Grants.gov, OpenGrants, state portals, etc.) implements this interface.
 */

import type {
  CatalogGrant,
  RawGrantData,
  SourceSearchParams,
  SourceFetchResponse,
  SyncResult,
  GrantSource,
} from '../types';

export abstract class BaseGrantAdapter {
  protected source: GrantSource;
  protected apiKey?: string;

  constructor(source: GrantSource, apiKey?: string) {
    this.source = source;
    this.apiKey = apiKey;
  }

  /**
   * Get the source configuration
   */
  getSource(): GrantSource {
    return this.source;
  }

  /**
   * Fetch grants from the external source
   * @param params Search/filter parameters
   * @returns Raw grant data from source
   */
  abstract fetchGrants(params: SourceSearchParams): Promise<SourceFetchResponse>;

  /**
   * Fetch a single grant by its external ID
   * @param externalId The grant's ID in the source system
   * @returns Raw grant data
   */
  abstract fetchSingleGrant(externalId: string): Promise<RawGrantData | null>;

  /**
   * Normalize raw grant data to our catalog format
   * @param raw Raw data from the source
   * @returns Normalized catalog grant
   */
  abstract normalizeGrant(raw: RawGrantData): CatalogGrant;

  /**
   * Generate a content hash for de-duplication
   * @param grant Normalized grant
   * @returns Hash string
   */
  generateContentHash(grant: Partial<CatalogGrant>): string {
    const hashInput = [
      grant.title?.toLowerCase().trim() || '',
      grant.agency?.toLowerCase().trim() || '',
      grant.close_date || '',
    ].join('|');

    // Simple hash (in production, use crypto.createHash)
    return Buffer.from(hashInput).toString('base64');
  }

  /**
   * Validate that required API credentials are present
   */
  validateCredentials(): boolean {
    if (this.source.api_key_required && !this.apiKey) {
      return false;
    }
    return true;
  }

  /**
   * Check if the source supports API access
   */
  isApiEnabled(): boolean {
    return this.source.api_enabled;
  }

  /**
   * Get rate limit for this source
   */
  getRateLimit(): number {
    return this.source.rate_limit_per_minute || 60;
  }

  /**
   * Perform full sync of all grants
   * @param fetchFullDetails - If true, fetches complete grant details including descriptions
   */
  async performFullSync(fetchFullDetails: boolean = true): Promise<SyncResult> {
    const result: SyncResult = {
      grants_fetched: 0,
      grants_created: 0,
      grants_updated: 0,
      grants_skipped: 0,
      duplicates_found: 0,
      errors: [],
      grants: [],
    };

    try {
      // Fetch all grants with pagination
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await this.fetchGrants({
          page,
          limit: 100,
        });

        result.grants_fetched += response.grants.length;

        // Process each grant - fetch full details if requested, then normalize
        for (const raw of response.grants) {
          try {
            let grantToNormalize = raw;

            // Fetch full details if requested and external_id is available
            if (fetchFullDetails) {
              const externalId = (raw as any).id || (raw as any).number;
              if (externalId) {
                const fullGrant = await this.fetchSingleGrant(String(externalId));
                if (fullGrant) {
                  grantToNormalize = fullGrant;
                }
                // Rate limit individual detail fetches
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }

            const normalized = this.normalizeGrant(grantToNormalize);
            result.grants!.push(normalized);
          } catch (error) {
            result.errors.push({
              error_code: 'NORMALIZATION_ERROR',
              error_message: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString(),
            });
          }
        }

        hasMore = response.pagination.has_more;
        page++;

        // Respect rate limits between pages
        if (hasMore) {
          await this.rateLimitDelay();
        }
      }
    } catch (error) {
      result.errors.push({
        error_code: 'FETCH_ERROR',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }

    return result;
  }

  /**
   * Perform incremental sync (only updated grants)
   */
  async performIncrementalSync(since: Date): Promise<SyncResult> {
    const result: SyncResult = {
      grants_fetched: 0,
      grants_created: 0,
      grants_updated: 0,
      grants_skipped: 0,
      duplicates_found: 0,
      errors: [],
      grants: [],
    };

    try {
      const response = await this.fetchGrants({
        modified_since: since.toISOString(),
        limit: 100,
      });

      result.grants_fetched = response.grants.length;

      for (const raw of response.grants) {
        try {
          const normalized = this.normalizeGrant(raw);
          result.grants!.push(normalized);
        } catch (error) {
          result.errors.push({
            error_code: 'NORMALIZATION_ERROR',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      result.errors.push({
        error_code: 'FETCH_ERROR',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }

    return result;
  }

  /**
   * Rate limit delay based on source configuration
   */
  protected async rateLimitDelay(): Promise<void> {
    const delayMs = (60 * 1000) / this.getRateLimit();
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  /**
   * Parse date string to ISO format
   */
  protected parseDate(dateStr: string | null | undefined): string | undefined {
    if (!dateStr) return undefined;
    try {
      return new Date(dateStr).toISOString();
    } catch {
      return undefined;
    }
  }

  /**
   * Clean and normalize text
   */
  protected cleanText(text: string | null | undefined): string | undefined {
    if (!text) return undefined;
    return text.trim().replace(/\s+/g, ' ');
  }

  /**
   * Parse numeric value
   */
  protected parseNumber(value: any): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
      return isNaN(num) ? undefined : num;
    }
    return undefined;
  }
}
