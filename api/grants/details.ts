import type { VercelRequest, VercelResponse } from '@vercel/node';

interface GrantsGovOpportunityDetail {
  opportunityID: string;
  opportunityNumber: string;
  opportunityTitle: string;
  agencyName: string;
  agencyCode: string;
  description: string;
  costSharingOrMatchingRequirement: string;
  eligibleApplicants: string;
  additionalInformationOnEligibility: string;
  fundingInstrumentType: string;
  categoryOfFundingActivity: string;
  expectedNumberOfAwards: string;
  estimatedTotalProgramFunding: string;
  awardCeiling: string;
  awardFloor: string;
  postDate: string;
  closeDate: string;
  archiveDate: string;
  grantsGovLink: string;
  lastUpdatedDate: string;
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
  return {
    id: detail.opportunityID,
    number: detail.opportunityNumber,
    title: detail.opportunityTitle,
    agency: detail.agencyName,
    description: detail.description || 'No description available.',
    postDate: detail.postDate || null,
    closeDate: detail.closeDate || null,
    eligibility: detail.eligibleApplicants || null,
    fundingInstrument: detail.fundingInstrumentType || null,
    category: detail.categoryOfFundingActivity || null,
    estimatedFunding: detail.estimatedTotalProgramFunding || null,
    awardCeiling: detail.awardCeiling || null,
    awardFloor: detail.awardFloor || null,
    expectedAwards: detail.expectedNumberOfAwards || null,
    costSharing: detail.costSharingOrMatchingRequirement || null,
    grantsGovUrl: detail.grantsGovLink || `https://www.grants.gov/search-results-detail/${detail.opportunityID}`,
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
