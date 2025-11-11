/**
 * Grants.gov Source Adapter
 *
 * Implements fetching and normalization for Grants.gov API
 */

import { BaseGrantAdapter } from './BaseGrantAdapter';
import type {
  CatalogGrant,
  RawGrantData,
  SourceSearchParams,
  SourceFetchResponse,
  OpportunityStatus,
} from '../types';

interface GrantsGovOpportunity {
  id?: string;
  number: string;
  title: string;
  agencyName: string;
  openDate: string | null;
  closeDate: string | null;
  oppStatus: string;
  alnist?: string[];
  cfdaList?: string[];
  description?: string;
  estimatedFunding?: string | number;
  awardFloor?: string | number;
  awardCeiling?: string | number;
  expectedAwards?: string | number;
  costSharing?: string;
  eligibleApplicants?: string;
  fundingInstrument?: string;
  category?: string;
}

interface GrantsGovSearchResponse {
  hitCount: number;
  startRecord: number;
  oppHits: GrantsGovOpportunity[];
}

export class GrantsGovAdapter extends BaseGrantAdapter {
  async fetchGrants(params: SourceSearchParams): Promise<SourceFetchResponse> {
    const baseUrl = this.source.api_base_url || 'https://api.grants.gov/v1/api';
    const endpoint = `${baseUrl}/search2`;

    // Build request body for Grants.gov
    const requestBody: Record<string, any> = {
      rows: params.limit || 100,
      startRecordNum: ((params.page || 1) - 1) * (params.limit || 100),
    };

    if (params.keyword) {
      requestBody.keyword = params.keyword;
    }

    if (params.categories && params.categories.length > 0) {
      requestBody.fundingCategories = params.categories.join('|');
    }

    if (params.agencies && params.agencies.length > 0) {
      requestBody.agencies = params.agencies.join('|');
    }

    if (params.statuses && params.statuses.length > 0) {
      requestBody.oppStatuses = params.statuses.join('|');
    } else {
      requestBody.oppStatuses = 'posted|forecasted';
    }

    // Make request
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Grants.gov API error: ${response.status} ${response.statusText}`);
    }

    const data: { data: GrantsGovSearchResponse } = await response.json();

    const grants = data.data.oppHits || [];
    const totalCount = data.data.hitCount || 0;
    const currentPage = params.page || 1;
    const limit = params.limit || 100;

    return {
      grants: grants as RawGrantData[],
      pagination: {
        page: currentPage,
        limit,
        total: totalCount,
        has_more: data.data.startRecord + grants.length < totalCount,
      },
    };
  }

  async fetchSingleGrant(externalId: string): Promise<RawGrantData | null> {
    const baseUrl = this.source.api_base_url || 'https://api.grants.gov/v1/api';
    const endpoint = `${baseUrl}/fetchOpportunity`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ opportunityId: Number(externalId) }),
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Grants.gov API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data as RawGrantData;
    } catch (error) {
      console.error(`Error fetching grant ${externalId}:`, error);
      return null;
    }
  }

  normalizeGrant(raw: RawGrantData): CatalogGrant {
    const opp = raw as GrantsGovOpportunity;

    // Map Grants.gov status to our normalized status
    const statusMap: Record<string, OpportunityStatus> = {
      forecasted: 'forecasted',
      posted: 'posted',
      closed: 'closed',
      archived: 'archived',
    };

    const status = statusMap[opp.oppStatus?.toLowerCase()] || 'posted';

    // Generate content hash
    const contentHash = this.generateContentHash({
      title: opp.title,
      agency: opp.agencyName,
      close_date: opp.closeDate || undefined,
    });

    const catalogGrant: CatalogGrant = {
      id: '', // Will be set by database
      source_id: this.source.id,
      source_key: this.source.source_key,
      external_id: opp.id || opp.number,

      // Core data
      title: this.cleanText(opp.title) || 'Untitled Grant',
      description: this.cleanText(opp.description),
      agency: this.cleanText(opp.agencyName),
      opportunity_number: opp.number,

      // Financial
      estimated_funding: this.parseNumber(opp.estimatedFunding),
      award_floor: this.parseNumber(opp.awardFloor),
      award_ceiling: this.parseNumber(opp.awardCeiling),
      expected_awards: this.parseNumber(opp.expectedAwards),

      // Categories
      funding_category: this.cleanText(opp.category),
      eligibility_applicants: opp.eligibleApplicants
        ? [opp.eligibleApplicants]
        : undefined,
      cost_sharing_required: opp.costSharing?.toLowerCase().includes('yes') || undefined,

      // Dates
      posted_date: this.parseDate(opp.openDate),
      open_date: this.parseDate(opp.openDate),
      close_date: this.parseDate(opp.closeDate),

      // Status
      opportunity_status: status,

      // Additional
      cfda_numbers: opp.cfdaList,
      aln_codes: opp.alnist,

      // Links
      source_url: `https://www.grants.gov/search-results-detail/${opp.id || opp.number}`,
      application_url: `https://www.grants.gov/search-results-detail/${opp.id || opp.number}`,

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
