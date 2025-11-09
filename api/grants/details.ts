import type { VercelRequest, VercelResponse } from '@vercel/node';

// Interface for applicant types array
interface ApplicantType {
  id?: string;
  description?: string;
}

// Interface for funding instruments array
interface FundingInstrument {
  id?: string;
  description?: string;
}

// Interface for funding activity categories array
interface FundingActivityCategory {
  id?: string;
  description?: string;
}

// Nested synopsis object structure
interface SynopsisDetail {
  opportunityId?: number | string;
  version?: number;
  agencyCode?: string;
  agencyName?: string;
  synopsisDesc?: string;
  responseDateDesc?: string;
  postingDate?: string;
  costSharing?: boolean | string;
  awardCeiling?: string;
  awardCeilingFormatted?: string;
  awardFloor?: string;
  awardFloorFormatted?: string;
  estimatedFunding?: string;
  estimatedFundingFormatted?: string;
  numberOfAwards?: string;
  lastUpdatedDate?: string;
  applicantTypes?: ApplicantType[];
  fundingInstruments?: FundingInstrument[];
  fundingActivityCategories?: FundingActivityCategory[];
  [key: string]: any;
}

// Top-level data object from Grants.gov API
interface GrantsGovOpportunityDetail {
  id?: number | string;
  opportunityNumber?: string;
  opportunityTitle?: string;
  owningAgencyCode?: string;
  synopsis?: SynopsisDetail;
  cfdas?: Array<{ cfdaNumber?: string; programTitle?: string }>;
  [key: string]: any;
}

interface GrantsGovDetailResponse {
  errorcode: number;
  msg: string;
  data: GrantsGovOpportunityDetail;
}

interface NormalizedGrantDetail {
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

// Normalize a grant detail response
function normalizeGrantDetail(detail: GrantsGovOpportunityDetail): NormalizedGrantDetail {
  const synopsis = detail.synopsis || {};

  // Extract applicant types as comma-separated string
  const eligibility = synopsis.applicantTypes
    ?.map((type) => type.description)
    .filter(Boolean)
    .join(', ') || null;

  // Extract funding instruments as comma-separated string
  const fundingInstrument = synopsis.fundingInstruments
    ?.map((instr) => instr.description)
    .filter(Boolean)
    .join(', ') || null;

  // Extract funding categories as comma-separated string
  const category = synopsis.fundingActivityCategories
    ?.map((cat) => cat.description)
    .filter(Boolean)
    .join(', ') || null;

  // Handle cost sharing - convert boolean to string
  const costSharing = synopsis.costSharing !== undefined
    ? typeof synopsis.costSharing === 'boolean'
      ? synopsis.costSharing ? 'Yes' : 'No'
      : String(synopsis.costSharing)
    : null;

  const opportunityId = String(detail.id || synopsis.opportunityId || '');
  const opportunityNumber = detail.opportunityNumber || opportunityId;

  return {
    id: opportunityId,
    number: opportunityNumber,
    title: detail.opportunityTitle || 'Untitled Opportunity',
    agency: synopsis.agencyName || 'Unknown Agency',
    description: synopsis.synopsisDesc || 'No description available.',
    postDate: synopsis.postingDate || null,
    closeDate: synopsis.responseDateDesc || null,
    eligibility,
    fundingInstrument,
    category,
    estimatedFunding: synopsis.estimatedFundingFormatted || synopsis.estimatedFunding || null,
    awardCeiling: synopsis.awardCeilingFormatted || synopsis.awardCeiling || null,
    awardFloor: synopsis.awardFloorFormatted || synopsis.awardFloor || null,
    expectedAwards: synopsis.numberOfAwards || null,
    costSharing,
    grantsGovUrl: `https://www.grants.gov/search-results-detail/${opportunityId}`,
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { id } = req.body || {};

    // Validate ID
    if (!id) {
      return res.status(400).json({ error: 'Opportunity ID is required' });
    }

    // Convert to number - Grants.gov expects numeric opportunityId
    const opportunityId = Number(id);
    if (Number.isNaN(opportunityId)) {
      return res.status(400).json({
        error: 'Opportunity ID must be numeric',
        details: `Received ID: "${id}". The Grants.gov details API requires a numeric opportunity ID, not the opportunity number.`
      });
    }

    // Set up timeout with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

    try {
      // Call Grants.gov fetchOpportunity API (POST with JSON body)
      const response = await fetch(
        'https://api.grants.gov/v1/api/fetchOpportunity',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ opportunityId }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Grants.gov API error:', response.status, response.statusText, errorText);
        return res.status(response.status).json({
          error: 'Failed to fetch grant details from Grants.gov',
          details: response.statusText,
        });
      }

      const apiResponse: GrantsGovDetailResponse = await response.json();

      // Validate response structure
      if (!apiResponse.data) {
        console.error('Invalid Grants.gov response structure:', apiResponse);
        return res.status(500).json({
          error: 'Invalid response from Grants.gov',
          details: 'Response missing data object',
        });
      }

      // Normalize the response
      const normalizedDetail = normalizeGrantDetail(apiResponse.data);

      // Set cache headers (5 minutes)
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

      return res.status(200).json(normalizedDetail);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error('Error in grant details:', error);

    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        return res.status(504).json({ error: 'Request timeout - please try again' });
      }
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
