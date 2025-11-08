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

    // Log the request for debugging
    console.log('Grants.gov request:', JSON.stringify(grantsGovRequest, null, 2));

    // Call Grants.gov API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    let response;
    try {
      response = await fetch('https://api.grants.gov/v1/api/search2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(grantsGovRequest),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Grants.gov API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      return res.status(response.status).json({
        error: 'Failed to fetch from Grants.gov',
        details: response.statusText,
        debug: errorText.substring(0, 200)
      });
    }

    const responseText = await response.text();
    console.log('Grants.gov response (first 500 chars):', responseText.substring(0, 500));

    let data: GrantsGovSearchResponse;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse Grants.gov response:', parseError);
      return res.status(502).json({
        error: 'Invalid response from Grants.gov',
        message: 'Failed to parse API response'
      });
    }

    // Log the parsed data structure for debugging
    console.log('Parsed Grants.gov data keys:', Object.keys(data));
    console.log('Full response:', JSON.stringify(data, null, 2));

    // Validate response structure
    if (!data || typeof data !== 'object') {
      console.error('Invalid data structure from Grants.gov:', data);
      return res.status(502).json({
        error: 'Invalid response from Grants.gov',
        message: 'Response is not a valid object',
        debug: JSON.stringify(data).substring(0, 200)
      });
    }

    if (!data.oppHits || !Array.isArray(data.oppHits)) {
      console.error('Missing or invalid oppHits in Grants.gov response:', {
        hasOppHits: !!data.oppHits,
        isArray: Array.isArray(data.oppHits),
        dataKeys: Object.keys(data)
      });
      return res.status(502).json({
        error: 'Invalid response structure from Grants.gov',
        message: 'Response missing oppHits array',
        debug: `Response keys: ${Object.keys(data).join(', ')}`
      });
    }

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
