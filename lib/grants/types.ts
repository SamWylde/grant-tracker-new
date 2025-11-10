/**
 * Multi-Source Grant Ingestion Types
 *
 * Defines interfaces and types for the grant source adapter system
 */

// Source types
export type SourceType = 'federal' | 'state' | 'private' | 'custom';
export type SyncFrequency = 'hourly' | 'daily' | 'weekly' | 'manual';
export type JobType = 'full' | 'incremental' | 'single';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type OpportunityStatus = 'forecasted' | 'posted' | 'closed' | 'archived';

// Grant Source Configuration
export interface GrantSource {
  id: string;
  source_key: string;
  source_name: string;
  source_type: SourceType;
  api_enabled: boolean;
  api_base_url?: string;
  api_key_required: boolean;
  rate_limit_per_minute?: number;
  sync_enabled: boolean;
  sync_frequency: SyncFrequency;
  last_sync_at?: string;
  next_sync_at?: string;
  created_at: string;
  updated_at: string;
}

// Normalized grant from catalog
export interface CatalogGrant {
  id: string;
  source_id: string;
  source_key: string;
  external_id: string;

  // Core data
  title: string;
  description?: string;
  agency?: string;
  opportunity_number?: string;

  // Financial
  estimated_funding?: number;
  award_floor?: number;
  award_ceiling?: number;
  expected_awards?: number;

  // Categories
  funding_category?: string;
  eligibility_applicants?: string[];
  cost_sharing_required?: boolean;

  // Dates
  posted_date?: string;
  open_date?: string;
  close_date?: string;

  // Status
  opportunity_status: OpportunityStatus;

  // Additional
  cfda_numbers?: string[];
  aln_codes?: string[];

  // Links
  source_url?: string;
  application_url?: string;

  // Deduplication
  content_hash?: string;

  // Metadata
  first_seen_at: string;
  last_updated_at: string;
  last_synced_at: string;
  is_active: boolean;
}

// Raw grant data from external source (before normalization)
export interface RawGrantData {
  [key: string]: any; // Flexible to accommodate different source formats
}

// Result of a sync operation
export interface SyncResult {
  grants_fetched: number;
  grants_created: number;
  grants_updated: number;
  grants_skipped: number;
  duplicates_found: number;
  errors: SyncError[];
}

export interface SyncError {
  grant_id?: string;
  error_code: string;
  error_message: string;
  timestamp: string;
}

// Sync job record
export interface SyncJob {
  id: string;
  source_id: string;
  job_type: JobType;
  status: JobStatus;
  grants_fetched: number;
  grants_created: number;
  grants_updated: number;
  grants_skipped: number;
  duplicates_found: number;
  error_message?: string;
  retry_count: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

// Search/filter parameters for fetching grants
export interface SourceSearchParams {
  keyword?: string;
  categories?: string[];
  agencies?: string[];
  statuses?: string[];
  page?: number;
  limit?: number;
  modified_since?: string; // For incremental sync
}

// Pagination info
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  has_more: boolean;
}

// Source fetch response
export interface SourceFetchResponse {
  grants: RawGrantData[];
  pagination: PaginationInfo;
  metadata?: {
    [key: string]: any;
  };
}

// De-duplication match
export interface DuplicateMatch {
  primary_grant_id: string;
  duplicate_grant_id: string;
  match_score: number;
  match_method: 'title_hash' | 'fuzzy_match' | 'manual';
  is_confirmed: boolean;
}

// Saved search (alert) configuration
export interface SavedSearch {
  id: string;
  org_id: string;
  user_id: string;
  name: string;
  keyword?: string;
  category?: string;
  agency?: string;
  status_posted: boolean;
  status_forecasted: boolean;
  due_in_days?: number;
  sort_by: string;
  search_count: number;
  last_used_at?: string;
  created_at: string;
}

// Grant match notification
export interface GrantMatchNotification {
  id: string;
  org_id: string;
  user_id: string;
  saved_search_id?: string;
  grant_id: string;
  match_score?: number;
  notification_sent: boolean;
  sent_at?: string;
  viewed: boolean;
  viewed_at?: string;
  dismissed: boolean;
  dismissed_at?: string;
  created_at: string;
}
