// Grants.gov API types
export interface GrantsGovOpportunity {
  id?: string;
  number: string;
  title: string;
  agencyName: string;
  openDate: string | null;
  closeDate: string | null;
  oppStatus: string;
  alnist?: string[];
}

export interface GrantsGovSearchResponse {
  hitCount: number;
  startRecord: number;
  oppHits: GrantsGovOpportunity[];
}

export interface GrantsGovSearchRequest {
  keyword?: string;
  fundingCategories?: string;
  agencies?: string;
  oppStatuses?: string;
  aln?: string;
  rows?: number;
  startRecordNum?: number;
}

// Normalized grant data for our UI
export interface NormalizedGrant {
  id: string;
  number: string;
  title: string;
  agency: string;
  openDate: string | null;
  closeDate: string | null;
  status: string;
  aln: string | null;
  description?: string | null;
}

// Search response for our API
export interface SearchResponse {
  grants: NormalizedGrant[];
  totalCount: number;
  startRecord: number;
  pageSize: number;
}

// Saved grant (from database)
export interface SavedGrant {
  id: string;
  org_id: string;
  user_id: string;
  external_source: string;
  external_id: string;
  title: string;
  agency: string | null;
  program: string | null;
  aln: string | null;
  open_date: string | null;
  close_date: string | null;
  loi_deadline: string | null;
  internal_deadline: string | null;
  description: string | null;
  status: string;
  priority: string | null;
  assigned_to: string | null;
  notes: string | null;
  saved_at: string;
  stage_updated_at: string | null;
  created_at: string;
}

// Grant detail (from Grants.gov API)
export interface GrantDetail {
  id: string;
  number: string;
  title: string;
  agency: string;
  description: string;
  postDate: string | null;
  closeDate: string | null;
  eligibility: string | null;
  fundingInstrument: string | null;
  category: string | null;
  estimatedFunding: string | null;
  awardCeiling: string | null;
  awardFloor: string | null;
  expectedAwards: string | null;
  costSharing: string | null;
  grantsGovUrl: string | null;
}

// Filter options
export interface SearchFilters {
  keyword?: string;
  category?: string;
  agency?: string;
  statusPosted?: boolean;
  statusForecasted?: boolean;
  dueInDays?: number;
}

// Funding categories (2-letter codes from Grants.gov)
export const FUNDING_CATEGORIES = [
  { value: 'AG', label: 'Agriculture' },
  { value: 'AR', label: 'Arts' },
  { value: 'BC', label: 'Business and Commerce' },
  { value: 'CD', label: 'Community Development' },
  { value: 'CP', label: 'Consumer Protection' },
  { value: 'DPR', label: 'Disaster Prevention and Relief' },
  { value: 'ED', label: 'Education' },
  { value: 'ELT', label: 'Employment, Labor, and Training' },
  { value: 'EN', label: 'Energy' },
  { value: 'ENV', label: 'Environment' },
  { value: 'FN', label: 'Food and Nutrition' },
  { value: 'HL', label: 'Health' },
  { value: 'HO', label: 'Housing' },
  { value: 'HU', label: 'Humanities' },
  { value: 'IS', label: 'Information and Statistics' },
  { value: 'IJ', label: 'Income Security and Social Services' },
  { value: 'LJL', label: 'Law, Justice, and Legal Services' },
  { value: 'NR', label: 'Natural Resources' },
  { value: 'RA', label: 'Regional Development' },
  { value: 'RD', label: 'Rural Development' },
  { value: 'ST', label: 'Science and Technology' },
  { value: 'T', label: 'Transportation' },
  { value: 'O', label: 'Other' },
] as const;

// Major federal agencies (common ones)
export const FEDERAL_AGENCIES = [
  { value: 'HHS', label: 'Health and Human Services' },
  { value: 'ED', label: 'Education' },
  { value: 'DOL', label: 'Labor' },
  { value: 'DOJ', label: 'Justice' },
  { value: 'HUD', label: 'Housing and Urban Development' },
  { value: 'DOT', label: 'Transportation' },
  { value: 'USDA', label: 'Agriculture' },
  { value: 'DOC', label: 'Commerce' },
  { value: 'DOI', label: 'Interior' },
  { value: 'EPA', label: 'Environmental Protection Agency' },
  { value: 'NSF', label: 'National Science Foundation' },
  { value: 'NEA', label: 'National Endowment for the Arts' },
  { value: 'NEH', label: 'National Endowment for the Humanities' },
  { value: 'DHS', label: 'Homeland Security' },
] as const;
