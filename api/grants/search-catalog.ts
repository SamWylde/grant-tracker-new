import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface CatalogGrant {
  id: string;
  external_id: string;
  title: string;
  description: string | null;
  agency: string | null;
  opportunity_number: string | null;
  open_date: string | null;
  close_date: string | null;
  opportunity_status: string;
  aln_codes: string[] | null;
  funding_category: string | null;
  estimated_funding: number | null;
  award_ceiling: number | null;
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

/**
 * Catalog-First Search API
 *
 * Searches grants_catalog first using full-text search, then falls back
 * to live Grants.gov API if needed. This is much faster when grants are cached.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const requestedRows = Math.min(rows, 50);

    // Build catalog query
    let query = supabase
      .from('grants_catalog')
      .select('*')
      .eq('source_key', 'grants_gov')
      .eq('is_active', true);

    // Full-text search if keyword provided
    if (keyword) {
      query = query.textSearch('search_vector', keyword.split(' ').join(' & '));
    }

    // Filter by status
    if (oppStatuses) {
      const statuses = oppStatuses.split('|');
      query = query.in('opportunity_status', statuses);
    } else {
      query = query.in('opportunity_status', ['posted', 'forecasted']);
    }

    // Filter by funding category
    if (fundingCategories) {
      query = query.eq('funding_category', fundingCategories);
    }

    // Filter by agency
    if (agencies) {
      query = query.ilike('agency', `%${agencies}%`);
    }

    // Filter by ALN
    if (aln) {
      query = query.contains('aln_codes', [aln]);
    }

    // Filter by due date
    if (dueInDays && typeof dueInDays === 'number' && dueInDays > 0) {
      const now = new Date();
      const futureDate = new Date(now.getTime() + dueInDays * 24 * 60 * 60 * 1000);
      query = query
        .gte('close_date', now.toISOString())
        .lte('close_date', futureDate.toISOString());
    }

    // Apply sorting
    if (sortBy === 'due_soon') {
      query = query.order('close_date', { ascending: true, nullsFirst: false });
    } else if (sortBy === 'newest') {
      query = query.order('open_date', { ascending: false, nullsFirst: false });
    } else {
      // Default: sort by relevance (full-text search ranking) or close date
      query = query.order('close_date', { ascending: true, nullsFirst: false });
    }

    // Apply pagination
    query = query.range(startRecordNum, startRecordNum + requestedRows - 1);

    // Execute catalog search
    console.log('[Catalog Search] Querying local catalog...');
    const { data: catalogGrants, error: catalogError } = await query;

    if (catalogError) {
      console.error('[Catalog Search] Catalog query error:', catalogError);
      throw catalogError;
    }

    console.log(`[Catalog Search] Found ${catalogGrants?.length || 0} grants in catalog`);

    // Normalize catalog grants to match expected format
    let normalizedGrants: NormalizedGrant[] = (catalogGrants || []).map((grant: CatalogGrant) => ({
      id: grant.external_id,
      number: grant.opportunity_number || grant.external_id,
      title: grant.title,
      agency: grant.agency || '',
      openDate: grant.open_date,
      closeDate: grant.close_date,
      status: grant.opportunity_status,
      aln: grant.aln_codes && grant.aln_codes.length > 0 ? grant.aln_codes[0] : null,
      description: grant.description,
    }));

    // Check if we have enough results
    const catalogHasEnoughResults = normalizedGrants.length >= requestedRows;

    // Fall back to live API if catalog doesn't have enough results
    if (!catalogHasEnoughResults) {
      console.log(`[Catalog Search] Insufficient results (${normalizedGrants.length}/${requestedRows}), falling back to live API...`);

      try {
        // Build request body for Grants.gov
        const grantsGovRequest: Record<string, unknown> = {
          oppStatuses: oppStatuses || 'posted|forecasted',
          rows: requestedRows,
          startRecordNum: startRecordNum || 0,
        };

        if (keyword) grantsGovRequest.keyword = keyword;
        if (fundingCategories) grantsGovRequest.fundingCategories = fundingCategories;
        if (agencies) grantsGovRequest.agencies = agencies;
        if (aln) grantsGovRequest.aln = aln;

        // Call Grants.gov API with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const response = await fetch('https://api.grants.gov/v1/api/search2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(grantsGovRequest),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const apiResponse = await response.json();
          const oppHits = apiResponse?.data?.oppHits || [];

          console.log(`[Catalog Search] Live API returned ${oppHits.length} grants`);

          // Normalize live API grants
          const liveGrants: NormalizedGrant[] = oppHits.map((opp: any) => ({
            id: opp.id || opp.number,
            number: opp.number,
            title: opp.title,
            agency: opp.agencyName,
            openDate: opp.openDate,
            closeDate: opp.closeDate,
            status: opp.oppStatus,
            aln: opp.alnist && opp.alnist.length > 0 ? opp.alnist[0] : null,
            description: null, // Descriptions will be enriched separately if needed
          }));

          // Merge results, preferring catalog grants (they have descriptions)
          const catalogIds = new Set(normalizedGrants.map(g => g.id));
          const newGrants = liveGrants.filter(g => !catalogIds.has(g.id));

          normalizedGrants = [...normalizedGrants, ...newGrants].slice(0, requestedRows);

          // Enrich live grants with descriptions from API
          if (newGrants.length > 0) {
            console.log(`[Catalog Search] Enriching ${newGrants.length} new grants with descriptions`);

            const batchSize = 10;
            for (let i = 0; i < newGrants.length; i += batchSize) {
              const batch = newGrants.slice(i, i + batchSize);

              await Promise.all(
                batch.map(async (grant) => {
                  try {
                    const detailsResponse = await fetch('https://api.grants.gov/v1/api/fetchOpportunity', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ opportunityId: Number(grant.id) }),
                    });

                    if (detailsResponse.ok) {
                      const detailsData = await detailsResponse.json();
                      const description = detailsData?.data?.synopsis?.synopsisDesc || null;

                      if (description) {
                        grant.description = description;

                        // Cache asynchronously
                        void (async () => {
                          try {
                            const { data: sourceData } = await supabase
                              .from('grant_sources')
                              .select('id')
                              .eq('source_key', 'grants_gov')
                              .single();

                            if (sourceData) {
                              await supabase.from('grants_catalog').upsert({
                                source_id: sourceData.id,
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
                            }
                          } catch (err) {
                            console.warn(`Failed to cache grant ${grant.id}:`, err);
                          }
                        })();
                      }
                    }
                  } catch (error) {
                    console.warn(`Failed to fetch details for grant ${grant.id}:`, error);
                  }
                })
              );
            }
          }

          return res.status(200).json({
            grants: normalizedGrants,
            totalResults: apiResponse?.data?.hitCount || normalizedGrants.length,
            source: 'hybrid', // Indicates results came from both catalog and live API
          });
        } else {
          console.error('[Catalog Search] Live API failed:', response.status, response.statusText);

          // Return catalog results even if API fails
          return res.status(200).json({
            grants: normalizedGrants,
            totalResults: normalizedGrants.length,
            source: 'catalog',
            warning: 'Live API unavailable, showing cached results only',
          });
        }
      } catch (apiError) {
        console.error('[Catalog Search] Live API error:', apiError);

        // Always return catalog results even if API fails
        return res.status(200).json({
          grants: normalizedGrants,
          totalCount: normalizedGrants.length,
          totalResults: normalizedGrants.length, // Legacy field for backward compatibility
          source: 'catalog',
          warning: 'Live API unavailable, showing cached results only',
        });
      }
    }

    // Catalog had enough results, return them
    return res.status(200).json({
      grants: normalizedGrants,
      totalCount: normalizedGrants.length,
      totalResults: normalizedGrants.length, // Legacy field for backward compatibility
      source: 'catalog',
    });

  } catch (error) {
    console.error('[Catalog Search] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
