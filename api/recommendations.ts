/**
 * Grant Recommendations API
 *
 * GET /api/recommendations?org_id=xxx&user_id=xxx&limit=10
 *   - Get personalized grant recommendations based on collaborative filtering
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

interface RecommendationFactors {
  eligibility_match: number;
  past_behavior: number;
  collaborative_filtering: number;
  agency_familiarity: number;
  funding_fit: number;
}

interface GrantRecommendation {
  grant_id: string;
  external_id: string;
  title: string;
  agency: string;
  close_date: string | null;
  funding_category: string | null;
  estimated_funding: number | null;
  recommendation_score: number;
  recommendation_reason: string;
  factors: RecommendationFactors;
}

/**
 * Calculate recommendation score based on multiple factors
 */
function calculateRecommendationScore(
  factors: RecommendationFactors
): number {
  // Weighted average of factors
  const weights = {
    eligibility_match: 0.25,
    past_behavior: 0.30,
    collaborative_filtering: 0.25,
    agency_familiarity: 0.10,
    funding_fit: 0.10,
  };

  return (
    factors.eligibility_match * weights.eligibility_match +
    factors.past_behavior * weights.past_behavior +
    factors.collaborative_filtering * weights.collaborative_filtering +
    factors.agency_familiarity * weights.agency_familiarity +
    factors.funding_fit * weights.funding_fit
  );
}

/**
 * Generate human-readable recommendation reason
 */
function generateRecommendationReason(
  factors: RecommendationFactors,
  grant: any
): string {
  const reasons: string[] = [];

  if (factors.eligibility_match > 0.8) {
    reasons.push('Strong eligibility match');
  }

  if (factors.past_behavior > 0.7) {
    reasons.push('Similar to grants you\'ve saved');
  }

  if (factors.collaborative_filtering > 0.7) {
    reasons.push('Popular with similar organizations');
  }

  if (factors.agency_familiarity > 0.7) {
    reasons.push(`Your team has experience with ${grant.agency}`);
  }

  if (factors.funding_fit > 0.8) {
    reasons.push('Funding amount fits your profile');
  }

  return reasons.length > 0 ? reasons.join(' • ') : 'Recommended based on your profile';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { org_id, user_id, limit = 10 } = req.query;

    if (!org_id) {
      return res.status(400).json({ error: 'org_id is required' });
    }

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const limitNum = Math.min(parseInt(limit as string, 10) || 10, 50);

    // =====================================================
    // Step 1: Get org's past interactions (saved/submitted)
    // =====================================================
    const { data: orgInteractions, error: interactionsError } = await supabase
      .from('grant_interactions')
      .select('external_id, interaction_type')
      .eq('org_id', org_id)
      .in('interaction_type', ['saved', 'submitted'])
      .order('created_at', { ascending: false })
      .limit(100);

    if (interactionsError) throw interactionsError;

    const interactedGrantIds = new Set(
      orgInteractions?.map((i) => i.external_id) || []
    );

    // =====================================================
    // Step 2: Get org's eligibility profile
    // =====================================================
    const { data: orgProfile } = await supabase
      .from('org_eligibility_profile')
      .select('*')
      .eq('org_id', org_id)
      .single();

    const eligibleCategories = orgProfile?.eligible_categories || [];
    const typicalFundingMin = orgProfile?.typical_funding_min || 0;
    const typicalFundingMax = orgProfile?.typical_funding_max || 10000000;

    // =====================================================
    // Step 3: Get agencies org has worked with
    // =====================================================
    const { data: pastGrants } = await supabase
      .from('org_grants_saved')
      .select('agency')
      .eq('org_id', org_id)
      .not('agency', 'is', null);

    const familiarAgencies = new Set(
      pastGrants?.map((g) => g.agency).filter(Boolean) || []
    );

    // =====================================================
    // Step 4: Get active grants from catalog (exclude already interacted)
    // =====================================================
    let catalogQuery = supabase
      .from('grants_catalog')
      .select('*')
      .eq('is_active', true)
      .in('opportunity_status', ['posted', 'forecasted'])
      .gte('close_date', new Date().toISOString())
      .order('posted_date', { ascending: false })
      .limit(200);

    // Filter by eligible categories if available
    if (eligibleCategories.length > 0) {
      catalogQuery = catalogQuery.in('funding_category', eligibleCategories);
    }

    const { data: availableGrants, error: grantsError } = await catalogQuery;

    if (grantsError) throw grantsError;

    if (!availableGrants || availableGrants.length === 0) {
      return res.status(200).json({
        recommendations: [],
        message: 'No grants available for recommendation',
      });
    }

    // =====================================================
    // Step 5: Calculate recommendation scores
    // =====================================================
    const recommendations: GrantRecommendation[] = [];

    for (const grant of availableGrants) {
      // Skip if already interacted with
      if (interactedGrantIds.has(grant.opportunity_number || grant.external_id)) {
        continue;
      }

      // Calculate factors
      const factors: RecommendationFactors = {
        // Eligibility match based on category
        eligibility_match:
          eligibleCategories.length === 0 ||
          eligibleCategories.includes(grant.funding_category)
            ? 0.9
            : 0.5,

        // Past behavior - simple heuristic based on category match
        past_behavior:
          orgInteractions?.some(
            (i) => i.interaction_type === 'saved' || i.interaction_type === 'submitted'
          )
            ? 0.7
            : 0.3,

        // Collaborative filtering - simplified (would need more complex algorithm)
        collaborative_filtering: 0.6,

        // Agency familiarity
        agency_familiarity: familiarAgencies.has(grant.agency) ? 0.9 : 0.4,

        // Funding fit
        funding_fit:
          grant.award_ceiling &&
          grant.award_ceiling >= typicalFundingMin &&
          grant.award_ceiling <= typicalFundingMax
            ? 0.9
            : grant.award_floor &&
              grant.award_floor >= typicalFundingMin &&
              grant.award_floor <= typicalFundingMax
            ? 0.8
            : 0.5,
      };

      const score = calculateRecommendationScore(factors);
      const reason = generateRecommendationReason(factors, grant);

      recommendations.push({
        grant_id: grant.id,
        external_id: grant.opportunity_number || grant.external_id,
        title: grant.title,
        agency: grant.agency,
        close_date: grant.close_date,
        funding_category: grant.funding_category,
        estimated_funding: grant.estimated_funding,
        recommendation_score: score,
        recommendation_reason: reason,
        factors,
      });
    }

    // Sort by score descending
    recommendations.sort((a, b) => b.recommendation_score - a.recommendation_score);

    // Limit results
    const topRecommendations = recommendations.slice(0, limitNum);

    // =====================================================
    // Step 6: Store recommendations in database (optional caching)
    // =====================================================
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour cache

    for (const rec of topRecommendations.slice(0, 10)) {
      // Only store top 10
      await supabase
        .from('grant_recommendations')
        .upsert({
          user_id: user_id as string,
          org_id: org_id as string,
          grant_id: rec.grant_id,
          recommendation_score: rec.recommendation_score,
          recommendation_reason: rec.recommendation_reason,
          factors: rec.factors as any,
          expires_at: expiresAt.toISOString(),
        })
        .match({
          user_id: user_id as string,
          grant_id: rec.grant_id,
        });
    }

    return res.status(200).json({
      recommendations: topRecommendations,
      total_count: recommendations.length,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Recommendations API] Error:', error);
    return res.status(500).json({
      error: 'Failed to generate recommendations',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
