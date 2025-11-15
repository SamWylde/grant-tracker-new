import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { rateLimitPublic, handleRateLimit } from '../utils/ratelimit';
import { validateBody, grantSearchQuerySchema } from '../utils/validation';
import { createRequestLogger } from '../utils/logger';
import { ErrorHandlers, generateRequestId, wrapHandler, sanitizeError } from '../utils/error-handler';

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

export default wrapHandler(async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const requestId = generateRequestId();
  const logger = createRequestLogger(req, { module: 'grants/search', requestId });

  // Apply rate limiting (100 req/min per IP)
  const rateLimitResult = await rateLimitPublic(req);
  if (handleRateLimit(res, rateLimitResult)) {
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return ErrorHandlers.methodNotAllowed(res, ['POST'], requestId);
  }
  // Validate request body
  const validationResult = validateBody(req, res, grantSearchQuerySchema);
  if (!validationResult.success) return;

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
  } = validationResult.data;

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
      logger.error('Grants.gov API error', undefined, {
        status: response.status,
        statusText: response.statusText
      });
      return ErrorHandlers.externalApi(
        res,
        'Grants.gov',
        new Error(`${response.statusText}`),
        requestId
      );
    }

    const apiResponse: GrantsGovSearchResponse = await response.json();

    // Validate response structure
    if (!apiResponse.data || !apiResponse.data.oppHits || !Array.isArray(apiResponse.data.oppHits)) {
      logger.error('Invalid Grants.gov response structure', undefined, {
        hasData: !!apiResponse.data,
        hasOppHits: !!apiResponse.data?.oppHits,
        isArray: Array.isArray(apiResponse.data?.oppHits)
      });
      return ErrorHandlers.externalApi(
        res,
        'Grants.gov',
        new Error('Response missing data.oppHits array'),
        requestId
      );
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
      logger.debug('Description enrichment check', {
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
        grantsCount: normalizedGrants.length
      });

      if (supabaseUrl && supabaseServiceKey && normalizedGrants.length > 0) {
        try {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          const grantIds = normalizedGrants.map(g => g.id);
          logger.info('Starting grant enrichment', {
            totalGrants: grantIds.length,
            sampleIds: grantIds.slice(0, 5)
          });

          // Fetch the actual grants_gov source_id (used for caching)
          const { data: grantsGovSource } = await supabase
            .from('grant_sources')
            .select('id')
            .eq('source_key', 'grants_gov')
            .single();

          if (!grantsGovSource) {
            logger.warn('grants_gov source not found in grant_sources table');
          }

          // Step 1: Check catalog first
          const { data: catalogGrants } = await supabase
            .from('grants_catalog')
            .select('external_id, description')
            .in('external_id', grantIds);

          logger.info('Catalog lookup completed', {
            catalogGrantsFound: catalogGrants?.length || 0
          });

          const descriptionMap = new Map(
            catalogGrants?.map(g => [g.external_id, g.description]) || []
          );

          // Apply cached descriptions
          normalizedGrants = normalizedGrants.map(grant => ({
            ...grant,
            description: descriptionMap.get(grant.id) || null,
          }));

          const grantsWithDescriptions = normalizedGrants.filter(g => g.description).length;
          logger.info('Applied cached descriptions', {
            grantsWithDescriptions,
            totalGrants: normalizedGrants.length
          });

          // Step 2: Fetch missing descriptions live from Grants.gov
          const grantsWithoutDescriptions = normalizedGrants.filter(g => !g.description);

          if (grantsWithoutDescriptions.length > 0) {
            logger.info('Fetching missing descriptions from Grants.gov', {
              missingCount: grantsWithoutDescriptions.length,
              firstGrant: grantsWithoutDescriptions[0]
            });

            // Fetch details in parallel (limit to 10 concurrent to avoid overwhelming API)
            const batchSize = 10;
            for (let i = 0; i < grantsWithoutDescriptions.length; i += batchSize) {
              const batch = grantsWithoutDescriptions.slice(i, i + batchSize);

              await Promise.all(
                batch.map(async (grant) => {
                  try {
                    logger.debug('Fetching grant details', { grantId: grant.id });
                    const detailsResponse = await fetch('https://api.grants.gov/v1/api/fetchOpportunity', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ opportunityId: Number(grant.id) }),
                    });

                    logger.debug('Grant details response received', {
                      grantId: grant.id,
                      status: detailsResponse.status
                    });

                    if (detailsResponse.ok) {
                      const detailsData = await detailsResponse.json();
                      const description = detailsData?.data?.synopsis?.synopsisDesc || null;

                      logger.debug('Description extraction result', {
                        grantId: grant.id,
                        hasDescription: !!description
                      });

                      if (description) {
                        // Update in-memory grant
                        grant.description = description;
                        logger.debug('Grant updated with description', {
                          grantId: grant.id,
                          descriptionLength: description.length
                        });

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
                              logger.debug('Description cached successfully', { grantId: grant.id });
                            } catch (err) {
                              logger.warn('Failed to cache description', { grantId: grant.id, error: err });
                            }
                          })();
                        } else {
                          logger.warn('Skipping cache - no valid source_id', { grantId: grant.id });
                        }
                      }
                    } else {
                      logger.warn('Non-OK response from Grants.gov', {
                        grantId: grant.id,
                        status: detailsResponse.status
                      });
                    }
                  } catch (err) {
                    logger.error('Failed to fetch grant description', err, { grantId: grant.id });
                  }
                })
              );
            }
          } else {
            logger.info('All grants have descriptions from catalog');
          }
        } catch (dbError) {
          // Silently fail - descriptions are optional enhancement
          logger.error('Could not fetch descriptions from database', dbError);
        }
      } else {
        logger.warn('Skipping description enrichment', {
          reason: 'Missing config or no grants'
        });
      }

      // Log final description enrichment results
      const finalDescriptionCount = normalizedGrants.filter(g => g.description).length;
      logger.info('Grant enrichment completed', {
        grantsWithDescriptions: finalDescriptionCount,
        totalGrants: normalizedGrants.length,
        enrichmentRate: `${((finalDescriptionCount / normalizedGrants.length) * 100).toFixed(1)}%`
      });

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

    if (fetchError instanceof Error) {
      if (fetchError.name === 'AbortError' || fetchError.message.includes('timeout')) {
        logger.error('Request timeout', fetchError);
        return ErrorHandlers.timeout(res, 'Request timeout - please try again', requestId);
      }
    }

    throw fetchError;
  }
});
