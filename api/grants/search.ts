import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  errorcode: number;
  msg: string;
  token: string;
  data: {
    hitCount: number;
    startRecord: number;
    oppHits: GrantsGovOpportunity[];
  };
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
  description?: string | null;
}

// Normalize a single opportunity
function normalizeOpportunity(opp: GrantsGovOpportunity): NormalizedGrant {
  // Ensure we use the numeric ID from Grants.gov, not the opportunity number
  // The 'id' field is a numeric string like "50283"
  // The 'number' field is a string like "PD-09-5761" (not usable for details API)
  const grantId = opp.id || opp.number;

  return {
    id: grantId,
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
      dueInDays,
      sortBy,
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

    // Set up timeout with AbortController (compatible with all Node versions)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

    try {
      // Call Grants.gov API
      const response = await fetch('https://api.grants.gov/v1/api/search2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(grantsGovRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('Grants.gov API error:', response.status, response.statusText);
        return res.status(response.status).json({
          error: 'Failed to fetch from Grants.gov',
          details: response.statusText,
        });
      }

      const apiResponse: GrantsGovSearchResponse = await response.json();

      // Validate response structure
      if (!apiResponse.data || !apiResponse.data.oppHits || !Array.isArray(apiResponse.data.oppHits)) {
        console.error('Invalid Grants.gov response structure:', apiResponse);
        return res.status(500).json({
          error: 'Invalid response from Grants.gov',
          details: 'Response missing data.oppHits array',
        });
      }

      // Normalize the response
      let normalizedGrants = apiResponse.data.oppHits.map(normalizeOpportunity);

      // Apply server-side filtering for dueInDays
      if (dueInDays && typeof dueInDays === 'number' && dueInDays > 0) {
        const now = new Date();
        normalizedGrants = normalizedGrants.filter((grant) => {
          if (!grant.closeDate) return false;
          const closeDate = new Date(grant.closeDate);
          const daysDiff = Math.ceil((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return daysDiff >= 0 && daysDiff <= dueInDays;
        });
      }

      // Apply server-side sorting
      if (sortBy) {
        switch (sortBy) {
          case 'due_soon':
            normalizedGrants.sort((a, b) => {
              if (!a.closeDate && !b.closeDate) return 0;
              if (!a.closeDate) return 1;
              if (!b.closeDate) return -1;
              return new Date(a.closeDate).getTime() - new Date(b.closeDate).getTime();
            });
            break;
          case 'newest':
            normalizedGrants.sort((a, b) => {
              if (!a.openDate && !b.openDate) return 0;
              if (!a.openDate) return 1;
              if (!b.openDate) return -1;
              return new Date(b.openDate).getTime() - new Date(a.openDate).getTime();
            });
            break;
          case 'relevance':
            // Calculate relevance scores based on keyword matching
            if (keyword) {
              const searchTerms = keyword.toLowerCase().split(' ').filter(Boolean);
              const calculateRelevanceScore = (grant: NormalizedGrant): number => {
                let score = 0;
                const title = grant.title.toLowerCase();
                const agency = grant.agency.toLowerCase();

                searchTerms.forEach((term: string) => {
                  // Title matches are worth 3x more than agency matches
                  if (title.includes(term)) score += 3;
                  if (agency.includes(term)) score += 1;
                });

                return score;
              };

              normalizedGrants.sort((a, b) => {
                const scoreA = calculateRelevanceScore(a);
                const scoreB = calculateRelevanceScore(b);
                if (scoreA !== scoreB) return scoreB - scoreA;

                // Fallback to due date if scores are equal
                if (!a.closeDate && !b.closeDate) return 0;
                if (!a.closeDate) return 1;
                if (!b.closeDate) return -1;
                return new Date(a.closeDate).getTime() - new Date(b.closeDate).getTime();
              });
            }
            break;
        }
      }

      // Enrich with descriptions from grants_catalog (if available)
      if (supabaseUrl && supabaseServiceKey && normalizedGrants.length > 0) {
        try {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          const grantIds = normalizedGrants.map(g => g.id);

          const { data: catalogGrants } = await supabase
            .from('grants_catalog')
            .select('external_id, description')
            .in('external_id', grantIds);

          if (catalogGrants && catalogGrants.length > 0) {
            const descriptionMap = new Map(
              catalogGrants.map(g => [g.external_id, g.description])
            );

            normalizedGrants = normalizedGrants.map(grant => ({
              ...grant,
              description: descriptionMap.get(grant.id) || null,
            }));
          }
        } catch (dbError) {
          // Silently fail - descriptions are optional enhancement
          console.warn('Could not fetch descriptions from database:', dbError);
        }
      }

      // Return normalized response
      const responseData = {
        grants: normalizedGrants,
        totalCount: apiResponse.data.hitCount || 0,
        startRecord: apiResponse.data.startRecord || 0,
        pageSize: rows,
      };

      // Set cache headers (60 seconds)
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');

      return res.status(200).json(responseData);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
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
