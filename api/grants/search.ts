import type { VercelRequest, VercelResponse } from '@vercel/node';

interface GrantsGovOpportunity {
  id?: string;
  number: string;
  title: string;
  agencyName: string;
  openDate: string | null;
  closeDate: string | null;
  oppStatus: string;
  alnist?: string[];
}

interface GrantsGovSearchResponse {
  hitCount: number;
  startRecord: number;
  oppHits: GrantsGovOpportunity[];
}

interface NormalizedGrant {
  id: string;
  number: string;
  title: string;
  agency: string;
  openDate: string | null;
  closeDate: string | null;
  status: string;
  aln: string | null;
}

// Normalize a single opportunity
function normalizeOpportunity(opp: GrantsGovOpportunity): NormalizedGrant {
  return {
    id: opp.id || opp.number,
    number: opp.number,
    title: opp.title,
    agency: opp.agencyName,
    openDate: opp.openDate,
    closeDate: opp.closeDate,
    status: opp.oppStatus,
    aln: opp.alnist && opp.alnist.length > 0 ? opp.alnist[0] : null,
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      keyword,
      fundingCategories,
      agencies,
      oppStatuses,
      aln,
      rows = 25,
      startRecordNum = 0,
    } = req.body;

    // Input validation
    if (rows && (rows < 1 || rows > 50)) {
      return res.status(400).json({ error: 'rows must be between 1 and 50' });
    }

    // Build request body for Grants.gov
    const grantsGovRequest: Record<string, unknown> = {
      oppStatuses: oppStatuses || 'posted|forecasted',
      rows: Math.min(rows, 50),
      startRecordNum: startRecordNum || 0,
    };

    // Add optional filters
    if (keyword) grantsGovRequest.keyword = keyword;
    if (fundingCategories) grantsGovRequest.fundingCategories = fundingCategories;
    if (agencies) grantsGovRequest.agencies = agencies;
    if (aln) grantsGovRequest.aln = aln;

    // Call Grants.gov API
    const response = await fetch('https://api.grants.gov/v1/api/search2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(grantsGovRequest),
      signal: AbortSignal.timeout(25000), // 25s timeout
    });

    if (!response.ok) {
      console.error('Grants.gov API error:', response.status, response.statusText);
      return res.status(response.status).json({
        error: 'Failed to fetch from Grants.gov',
        details: response.statusText,
      });
    }

    const data: GrantsGovSearchResponse = await response.json();

    // Normalize the response
    const normalizedGrants = data.oppHits.map(normalizeOpportunity);

    // Return normalized response
    const responseData = {
      grants: normalizedGrants,
      totalCount: data.hitCount,
      startRecord: data.startRecord,
      pageSize: rows,
    };

    // Set cache headers (60 seconds)
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');

    return res.status(200).json(responseData);
  } catch (error) {
    console.error('Error in grants search:', error);

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
