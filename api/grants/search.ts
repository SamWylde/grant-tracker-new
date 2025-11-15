import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { rateLimitPublic, handleRateLimit } from '../utils/ratelimit';

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
    description: null, // Will be enriched later if available
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Apply rate limiting (100 req/min per IP)
  const rateLimitResult = await rateLimitPublic(req);
  if (handleRateLimit(res, rateLimitResult)) {
    return;
  }

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
      rows = 15,
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

      // Enrich with descriptions (hybrid: catalog + live fetch)
      console.log(`[Search API] Description enrichment check - Supabase URL: ${!!supabaseUrl}, Service Key: ${!!supabaseServiceKey}, Grants count: ${normalizedGrants.length}`);

      if (supabaseUrl && supabaseServiceKey && normalizedGrants.length > 0) {
        try {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          const grantIds = normalizedGrants.map(g => g.id);
          console.log(`[Search API] Enriching ${grantIds.length} grants with descriptions`);
          console.log(`[Search API] Grant IDs to enrich:`, grantIds.slice(0, 5)); // Log first 5 IDs

          // Fetch the actual grants_gov source_id (used for caching)
          const { data: grantsGovSource } = await supabase
            .from('grant_sources')
            .select('id')
            .eq('source_key', 'grants_gov')
            .single();

          if (!grantsGovSource) {
            console.warn('[Search API] grants_gov source not found in grant_sources table');
          }

          // Step 1: Check catalog first
          const { data: catalogGrants } = await supabase
            .from('grants_catalog')
            .select('external_id, description')
            .in('external_id', grantIds);

          console.log(`[Search API] Found ${catalogGrants?.length || 0} grants in catalog`);

          const descriptionMap = new Map(
            catalogGrants?.map(g => [g.external_id, g.description]) || []
          );

          // Apply cached descriptions
          normalizedGrants = normalizedGrants.map(grant => ({
            ...grant,
            description: descriptionMap.get(grant.id) || null,
          }));

          const grantsWithDescriptions = normalizedGrants.filter(g => g.description).length;
          console.log(`[Search API] ${grantsWithDescriptions} grants have descriptions from catalog`);

          // Step 2: Fetch missing descriptions live from Grants.gov
          const grantsWithoutDescriptions = normalizedGrants.filter(g => !g.description);

          if (grantsWithoutDescriptions.length > 0) {
            console.log(`[Search API] Fetching ${grantsWithoutDescriptions.length} descriptions live from Grants.gov`);
            console.log(`[Search API] First grant without description:`, grantsWithoutDescriptions[0]);

            // Fetch details in parallel (limit to 10 concurrent to avoid overwhelming API)
            const batchSize = 10;
            for (let i = 0; i < grantsWithoutDescriptions.length; i += batchSize) {
              const batch = grantsWithoutDescriptions.slice(i, i + batchSize);

              await Promise.all(
                batch.map(async (grant) => {
                  try {
                    console.log(`[Search API] Fetching details for grant ${grant.id}`);
                    const detailsResponse = await fetch('https://api.grants.gov/v1/api/fetchOpportunity', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ opportunityId: Number(grant.id) }),
                    });

                    console.log(`[Search API] Details response status for ${grant.id}: ${detailsResponse.status}`);

                    if (detailsResponse.ok) {
                      const detailsData = await detailsResponse.json();
                      const description = detailsData?.data?.synopsis?.synopsisDesc || null;

                      console.log(`[Search API] Description found for ${grant.id}: ${description ? 'YES' : 'NO'}`);

                      if (description) {
                        // Update in-memory grant
                        grant.description = description;
                        console.log(`[Search API] Updated grant ${grant.id} with description (length: ${description.length})`);

                        // Cache in database asynchronously (don't wait)
                        // Only cache if we have a valid source_id
                        if (grantsGovSource?.id) {
                          void (async () => {
                            try {
                              await supabase
                                .from('grants_catalog')
                                .upsert({
                                  source_id: grantsGovSource.id,
                                  source_key: 'grants_gov',
                                  external_id: grant.id,
                                  title: grant.title,
                                  description: description,
                                  agency: grant.agency,
                                  opportunity_number: grant.number,
                                  close_date: grant.closeDate,
                                  open_date: grant.openDate,
                                  opportunity_status: grant.status as any,
                                  first_seen_at: new Date().toISOString(),
                                  last_updated_at: new Date().toISOString(),
                                  last_synced_at: new Date().toISOString(),
                                  is_active: true,
                                }, {
                                  onConflict: 'source_key,external_id',
                                });
                              console.log(`[Search API] Cached description for grant ${grant.id}`);
                            } catch (err) {
                              console.warn(`[Search API] Failed to cache description:`, err);
                            }
                          })();
                        } else {
                          console.warn(`[Search API] Skipping cache for grant ${grant.id} - no valid source_id`);
                        }
                      }
                    } else {
                      console.warn(`[Search API] Non-OK response for ${grant.id}: ${detailsResponse.status}`);
                    }
                  } catch (err) {
                    console.error(`[Search API] Failed to fetch description for grant ${grant.id}:`, err);
                  }
                })
              );
            }
          } else {
            console.log(`[Search API] All grants already have descriptions from catalog`);
          }
        } catch (dbError) {
          // Silently fail - descriptions are optional enhancement
          console.error('[Search API] Could not fetch descriptions from database:', dbError);
        }
      } else {
        console.warn(`[Search API] Skipping description enrichment - Missing config or no grants`);
      }

      // Log final description enrichment results
      const finalDescriptionCount = normalizedGrants.filter(g => g.description).length;
      console.log(`[Search API] Final result: ${finalDescriptionCount}/${normalizedGrants.length} grants have descriptions`);

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
