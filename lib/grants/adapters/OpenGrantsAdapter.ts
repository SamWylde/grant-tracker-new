/**
 * OpenGrants API Source Adapter
 *
 * Implements fetching and normalization for OpenGrants API
 * https://www.opengrants.io/
 */

import { BaseGrantAdapter } from './BaseGrantAdapter.js';
import type {
  CatalogGrant,
  RawGrantData,
  SourceSearchParams,
  SourceFetchResponse,
  OpportunityStatus,
} from '../types.js';

interface OpenGrantsOpportunity {
  id: string;
  title: string;
  agency: string;
  description?: string;
  category?: string;
  open_date?: string;
  close_date?: string;
  status?: string;
  estimated_funding?: number;
  award_floor?: number;
  award_ceiling?: number;
  eligibility?: string[];
  source_url?: string;
  cfda_number?: string;
  [key: string]: any;
}

export class OpenGrantsAdapter extends BaseGrantAdapter {
  async fetchGrants(params: SourceSearchParams): Promise<SourceFetchResponse> {
    if (!this.validateCredentials()) {
      throw new Error('OpenGrants API key is required');
    }

    const baseUrl = this.source.api_base_url || 'https://api.opengrants.io/v1';
    const endpoint = `${baseUrl}/opportunities`;

    // Build query parameters
    const queryParams = new URLSearchParams();

    if (params.keyword) {
      queryParams.append('q', params.keyword);
    }

    if (params.page) {
      queryParams.append('page', params.page.toString());
    }

    if (params.limit) {
      queryParams.append('limit', params.limit.toString());
    }

    if (params.modified_since) {
      queryParams.append('modified_since', params.modified_since);
    }

    if (params.statuses && params.statuses.length > 0) {
      queryParams.append('status', params.statuses.join(','));
    }

    // Make request
    const response = await fetch(`${endpoint}?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`OpenGrants API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      grants: data.opportunities || [],
      pagination: {
        page: data.page || params.page || 1,
        limit: data.limit || params.limit || 100,
        total: data.total || 0,
        has_more: data.has_more || false,
      },
    };
  }

  async fetchSingleGrant(externalId: string): Promise<RawGrantData | null> {
    if (!this.validateCredentials()) {
      throw new Error('OpenGrants API key is required');
    }

    const baseUrl = this.source.api_base_url || 'https://api.opengrants.io/v1';
    const endpoint = `${baseUrl}/opportunities/${externalId}`;

    try {
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`OpenGrants API error: ${response.status}`);
      }

      const data = await response.json();
      return data.opportunity as RawGrantData;
    } catch (error) {
      console.error(`Error fetching grant ${externalId}:`, error);
      return null;
    }
  }

  normalizeGrant(raw: RawGrantData): CatalogGrant {
    const opp = raw as OpenGrantsOpportunity;

    // Map OpenGrants status to our normalized status
    const statusMap: Record<string, OpportunityStatus> = {
      forecasted: 'forecasted',
      open: 'posted',
      posted: 'posted',
      closed: 'closed',
      archived: 'archived',
    };

    const status = statusMap[opp.status?.toLowerCase() || 'posted'] || 'posted';

    // Generate content hash
    const contentHash = this.generateContentHash({
      title: opp.title,
      agency: opp.agency,
      close_date: opp.close_date,
    });

    const catalogGrant: CatalogGrant = {
      id: '', // Will be set by database
      source_id: this.source.id,
      source_key: this.source.source_key,
      external_id: opp.id,

      // Core data
      title: (() => {
        const cleanedTitle = this.cleanText(opp.title);
        if (!cleanedTitle) {
          throw new Error(`Grant ${opp.id} is missing required title field - skipping`);
        }
        return cleanedTitle;
      })(),
      description: this.cleanText(opp.description),
      agency: this.cleanText(opp.agency),
      opportunity_number: opp.opportunity_number,

      // Financial
      estimated_funding: opp.estimated_funding,
      award_floor: opp.award_floor,
      award_ceiling: opp.award_ceiling,
      expected_awards: this.parseNumber(opp.expected_awards),

      // Categories
      funding_category: this.cleanText(opp.category),
      eligibility_applicants: opp.eligibility,
      cost_sharing_required: undefined,

      // Dates
      posted_date: this.parseDate(opp.open_date),
      open_date: this.parseDate(opp.open_date),
      close_date: this.parseDate(opp.close_date),

      // Status
      opportunity_status: status,

      // Additional
      cfda_numbers: opp.cfda_number ? [opp.cfda_number] : undefined,
      aln_codes: undefined,

      // Links
      source_url: opp.source_url,
      application_url: opp.source_url,

      // Deduplication
      content_hash: contentHash,

      // Metadata
      first_seen_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
      is_active: status === 'posted' || status === 'forecasted',
    };

    return catalogGrant;
  }
}
