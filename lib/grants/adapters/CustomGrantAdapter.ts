/**
 * Custom Grant Source Adapter
 *
 * Handles manually entered grants (no external API)
 */

import { BaseGrantAdapter } from './BaseGrantAdapter.js';
import type {
  CatalogGrant,
  RawGrantData,
  SourceSearchParams,
  SourceFetchResponse,
  OpportunityStatus,
} from '../types.js';

export interface CustomGrantInput {
  title: string;
  description?: string;
  agency?: string;
  opportunity_number?: string;

  estimated_funding?: number;
  award_floor?: number;
  award_ceiling?: number;
  expected_awards?: number;

  funding_category?: string;
  eligibility_applicants?: string[];
  cost_sharing_required?: boolean;

  open_date?: string;
  close_date?: string;
  opportunity_status?: OpportunityStatus;

  source_url?: string;
  application_url?: string;
}

export class CustomGrantAdapter extends BaseGrantAdapter {
  /**
   * Custom grants don't support API fetching - they're manually entered
   */
  async fetchGrants(_params: SourceSearchParams): Promise<SourceFetchResponse> {
    // Custom grants are not fetched from external source
    // They're created directly in the system
    return {
      grants: [],
      pagination: {
        page: 1,
        limit: 0,
        total: 0,
        has_more: false,
      },
    };
  }

  /**
   * Custom grants don't have external IDs to fetch
   */
  async fetchSingleGrant(_externalId: string): Promise<RawGrantData | null> {
    return null;
  }

  /**
   * Normalize custom grant input to catalog format
   */
  normalizeGrant(raw: RawGrantData): CatalogGrant {
    const input = raw as CustomGrantInput;

    // Generate unique ID for custom grant
    const externalId = `custom_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Generate content hash
    const contentHash = this.generateContentHash({
      title: input.title,
      agency: input.agency,
      close_date: input.close_date,
    });

    const catalogGrant: CatalogGrant = {
      id: '', // Will be set by database
      source_id: this.source.id,
      source_key: this.source.source_key,
      external_id: externalId,

      // Core data
      title: (() => {
        const cleanedTitle = this.cleanText(input.title);
        if (!cleanedTitle) {
          throw new Error(`Custom grant is missing required title field`);
        }
        return cleanedTitle;
      })(),
      description: this.cleanText(input.description),
      agency: this.cleanText(input.agency),
      opportunity_number: input.opportunity_number,

      // Financial
      estimated_funding: input.estimated_funding,
      award_floor: input.award_floor,
      award_ceiling: input.award_ceiling,
      expected_awards: input.expected_awards,

      // Categories
      funding_category: input.funding_category,
      eligibility_applicants: input.eligibility_applicants,
      cost_sharing_required: input.cost_sharing_required,

      // Dates
      posted_date: this.parseDate(input.open_date),
      open_date: this.parseDate(input.open_date),
      close_date: this.parseDate(input.close_date),

      // Status
      opportunity_status: input.opportunity_status || 'posted',

      // Additional
      cfda_numbers: undefined,
      aln_codes: undefined,

      // Links
      source_url: input.source_url,
      application_url: input.application_url,

      // Deduplication
      content_hash: contentHash,

      // Metadata
      first_seen_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
      is_active: true,
    };

    return catalogGrant;
  }

  /**
   * Validate custom grant input
   */
  validateGrantInput(input: CustomGrantInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!input.title || input.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (input.title && input.title.length > 500) {
      errors.push('Title must be less than 500 characters');
    }

    // Date validation
    if (input.open_date && input.close_date) {
      const openDate = new Date(input.open_date);
      const closeDate = new Date(input.close_date);

      if (closeDate < openDate) {
        errors.push('Close date must be after open date');
      }
    }

    // Financial validation
    if (input.award_floor !== undefined && input.award_ceiling !== undefined) {
      if (input.award_floor > input.award_ceiling) {
        errors.push('Award floor cannot exceed award ceiling');
      }
    }

    if (input.award_floor !== undefined && input.award_floor < 0) {
      errors.push('Award floor must be a positive number');
    }

    if (input.award_ceiling !== undefined && input.award_ceiling < 0) {
      errors.push('Award ceiling must be a positive number');
    }

    if (input.estimated_funding !== undefined && input.estimated_funding < 0) {
      errors.push('Estimated funding must be a positive number');
    }

    if (input.expected_awards !== undefined && input.expected_awards < 0) {
      errors.push('Expected awards must be a positive number');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
