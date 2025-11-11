/**
 * Grant Success Probability Scoring API
 *
 * GET /api/grants/success-score?grant_id=xxx&org_id=xxx
 *   - Calculate probability of success for org-grant pair
 *   - Returns score (0-1), match level, and breakdown of factors
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

interface ScoreFactors {
  agency_history: number;
  competition_level: number;
  org_fit: number;
  funding_amount_fit: number;
  timeline_feasibility: number;
}

interface SuccessScore {
  grant_id: string;
  org_id: string;
  success_probability: number;
  confidence_interval: number;
  match_level: 'excellent' | 'good' | 'fair' | 'poor';
  recommendation_text: string;
  score_factors: ScoreFactors;
  historical_win_rate: number | null;
  estimated_applicants: number | null;
  eligibility_match_score: number;
}

/**
 * Calculate agency history factor
 * Based on org's past success with this agency
 */
async function calculateAgencyHistoryFactor(
  supabase: any,
  orgId: string,
  agency: string
): Promise<{ score: number; winRate: number | null }> {
  // Get grants from this agency that org has worked with
  const { data: pastGrants } = await supabase
    .from('org_grants_saved')
    .select('status')
    .eq('org_id', orgId)
    .eq('agency', agency);

  if (!pastGrants || pastGrants.length === 0) {
    return { score: 0.5, winRate: null }; // Neutral if no history
  }

  const awardedCount = pastGrants.filter((g: any) => g.status === 'awarded').length;
  const totalCount = pastGrants.length;
  const winRate = awardedCount / totalCount;

  // Higher score if org has won from this agency before
  const score = 0.3 + winRate * 0.7; // Range: 0.3-1.0

  return { score, winRate };
}

/**
 * Calculate competition level factor
 * Estimated based on funding amount and category popularity
 */
function calculateCompetitionFactor(
  fundingAmount: number | null,
  category: string | null
): { score: number; estimatedApplicants: number } {
  // Estimate competition based on funding amount
  // Higher funding = more competition = lower score
  let estimatedApplicants = 50; // Default estimate
  let score = 0.6; // Default neutral

  if (fundingAmount) {
    if (fundingAmount > 10000000) {
      // $10M+: Very competitive
      estimatedApplicants = 200;
      score = 0.3;
    } else if (fundingAmount > 5000000) {
      // $5M-$10M: Highly competitive
      estimatedApplicants = 150;
      score = 0.4;
    } else if (fundingAmount > 1000000) {
      // $1M-$5M: Competitive
      estimatedApplicants = 100;
      score = 0.5;
    } else if (fundingAmount > 500000) {
      // $500K-$1M: Moderately competitive
      estimatedApplicants = 75;
      score = 0.6;
    } else if (fundingAmount > 100000) {
      // $100K-$500K: Less competitive
      estimatedApplicants = 50;
      score = 0.7;
    } else {
      // <$100K: Least competitive
      estimatedApplicants = 30;
      score = 0.8;
    }
  }

  // Popular categories are more competitive
  const popularCategories = ['ED', 'HL', 'ST', 'ENV']; // Education, Health, Science, Environment
  if (category && popularCategories.includes(category)) {
    score *= 0.9; // 10% reduction for popular categories
    estimatedApplicants = Math.floor(estimatedApplicants * 1.2);
  }

  return { score, estimatedApplicants };
}

/**
 * Calculate org fit factor
 * Based on eligibility profile match
 */
async function calculateOrgFitFactor(
  supabase: any,
  orgId: string,
  grantCategory: string | null,
  grantEligibility: string[] | null
): Promise<number> {
  // Get org eligibility profile
  const { data: profile } = await supabase
    .from('org_eligibility_profile')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (!profile) {
    return 0.5; // Neutral if no profile
  }

  let score = 0.5;

  // Check category match
  if (grantCategory && profile.eligible_categories) {
    const categories = profile.eligible_categories || [];
    if (categories.includes(grantCategory)) {
      score += 0.25;
    }
  }

  // Check organization type match
  if (grantEligibility && profile.organization_types) {
    const orgTypes = profile.organization_types || [];
    const hasMatch = grantEligibility.some((e: string) =>
      orgTypes.some((t: string) => e.toLowerCase().includes(t.toLowerCase()))
    );
    if (hasMatch) {
      score += 0.25;
    }
  }

  return Math.min(score, 1.0);
}

/**
 * Calculate funding amount fit factor
 */
async function calculateFundingFitFactor(
  supabase: any,
  orgId: string,
  grantMinAward: number | null,
  grantMaxAward: number | null
): Promise<number> {
  // Get org eligibility profile
  const { data: profile } = await supabase
    .from('org_eligibility_profile')
    .select('typical_funding_min, typical_funding_max')
    .eq('org_id', orgId)
    .single();

  if (!profile || (!grantMinAward && !grantMaxAward)) {
    return 0.6; // Neutral if no data
  }

  const orgMin = profile.typical_funding_min || 0;
  const orgMax = profile.typical_funding_max || 100000000;

  const grantAmount = grantMaxAward || grantMinAward || 0;

  // Check if grant amount fits org's typical range
  if (grantAmount >= orgMin && grantAmount <= orgMax) {
    return 0.9; // Strong fit
  } else if (grantAmount < orgMin) {
    // Grant is smaller than org typically handles
    const ratio = grantAmount / orgMin;
    return Math.max(0.3, ratio * 0.9);
  } else {
    // Grant is larger than org typically handles
    const ratio = orgMax / grantAmount;
    return Math.max(0.3, ratio * 0.9);
  }
}

/**
 * Calculate timeline feasibility factor
 */
function calculateTimelineFeasibility(
  closeDate: string | null
): number {
  if (!closeDate) {
    return 0.7; // Neutral if no deadline
  }

  const now = new Date();
  const deadline = new Date(closeDate);
  const daysUntilDeadline = Math.floor(
    (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilDeadline < 0) {
    return 0.0; // Already closed
  } else if (daysUntilDeadline < 7) {
    return 0.2; // Very tight deadline
  } else if (daysUntilDeadline < 14) {
    return 0.4; // Tight deadline
  } else if (daysUntilDeadline < 30) {
    return 0.6; // Reasonable deadline
  } else if (daysUntilDeadline < 60) {
    return 0.9; // Good amount of time
  } else {
    return 1.0; // Plenty of time
  }
}

/**
 * Determine match level based on score
 */
function getMatchLevel(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 0.8) return 'excellent';
  if (score >= 0.65) return 'good';
  if (score >= 0.5) return 'fair';
  return 'poor';
}

/**
 * Generate recommendation text
 */
function generateRecommendationText(
  score: number,
  factors: ScoreFactors
): string {
  const matchLevel = getMatchLevel(score);

  if (matchLevel === 'excellent') {
    return 'Highly recommended - Strong fit across all factors. This grant aligns well with your organization\'s profile and capabilities.';
  } else if (matchLevel === 'good') {
    return 'Recommended - Good overall fit. Consider applying if you have the capacity and resources.';
  } else if (matchLevel === 'fair') {
    const weakFactors: string[] = [];
    if (factors.agency_history < 0.5) weakFactors.push('agency relationship');
    if (factors.competition_level < 0.5) weakFactors.push('high competition');
    if (factors.timeline_feasibility < 0.5) weakFactors.push('tight deadline');

    return `Possible opportunity - ${weakFactors.length > 0 ? 'Consider challenges: ' + weakFactors.join(', ') : 'Some factors may pose challenges'}.`;
  } else {
    return 'Limited fit - Several factors suggest this may not be the best match for your organization.';
  }
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
    const { grant_id, org_id } = req.query;

    if (!grant_id) {
      return res.status(400).json({ error: 'grant_id is required' });
    }

    if (!org_id) {
      return res.status(400).json({ error: 'org_id is required' });
    }

    // Check for cached score
    const { data: cachedScore } = await supabase
      .from('grant_success_scores')
      .select('*')
      .eq('grant_id', grant_id)
      .eq('org_id', org_id)
      .gte('expires_at', new Date().toISOString())
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();

    if (cachedScore) {
      console.log(`[Success Score] Returning cached score for grant ${grant_id}`);
      return res.status(200).json({
        ...cachedScore,
        cached: true,
      });
    }

    // Fetch grant details from catalog
    const { data: grant, error: grantError } = await supabase
      .from('grants_catalog')
      .select('*')
      .eq('id', grant_id)
      .single();

    if (grantError || !grant) {
      return res.status(404).json({ error: 'Grant not found' });
    }

    console.log(`[Success Score] Calculating score for grant: ${grant.title}`);

    // Calculate all factors
    const agencyResult = await calculateAgencyHistoryFactor(
      supabase,
      org_id as string,
      grant.agency
    );

    const competitionResult = calculateCompetitionFactor(
      grant.estimated_funding,
      grant.funding_category
    );

    const orgFit = await calculateOrgFitFactor(
      supabase,
      org_id as string,
      grant.funding_category,
      grant.eligibility_applicants
    );

    const fundingFit = await calculateFundingFitFactor(
      supabase,
      org_id as string,
      grant.award_floor,
      grant.award_ceiling
    );

    const timelineFeasibility = calculateTimelineFeasibility(
      grant.close_date
    );

    const scoreFactors: ScoreFactors = {
      agency_history: agencyResult.score,
      competition_level: competitionResult.score,
      org_fit: orgFit,
      funding_amount_fit: fundingFit,
      timeline_feasibility: timelineFeasibility,
    };

    // Calculate weighted overall score
    const weights = {
      agency_history: 0.25,
      competition_level: 0.20,
      org_fit: 0.30,
      funding_amount_fit: 0.15,
      timeline_feasibility: 0.10,
    };

    const successProbability =
      scoreFactors.agency_history * weights.agency_history +
      scoreFactors.competition_level * weights.competition_level +
      scoreFactors.org_fit * weights.org_fit +
      scoreFactors.funding_amount_fit * weights.funding_amount_fit +
      scoreFactors.timeline_feasibility * weights.timeline_feasibility;

    const matchLevel = getMatchLevel(successProbability);
    const recommendationText = generateRecommendationText(
      successProbability,
      scoreFactors
    );

    // Confidence interval (simplified - would be more sophisticated in production)
    const confidenceInterval = 0.15; // ±15%

    const result: SuccessScore = {
      grant_id: grant.id,
      org_id: org_id as string,
      success_probability: Math.round(successProbability * 10000) / 10000,
      confidence_interval: confidenceInterval,
      match_level: matchLevel,
      recommendation_text: recommendationText,
      score_factors: scoreFactors,
      historical_win_rate: agencyResult.winRate,
      estimated_applicants: competitionResult.estimatedApplicants,
      eligibility_match_score: orgFit,
    };

    // Cache the score for 24 hours
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await supabase
      .from('grant_success_scores')
      .insert({
        grant_id: grant.id,
        org_id: org_id as string,
        success_probability: result.success_probability,
        confidence_interval: result.confidence_interval,
        score_factors: result.score_factors as any,
        historical_win_rate: result.historical_win_rate,
        estimated_applicants: result.estimated_applicants,
        eligibility_match_score: result.eligibility_match_score,
        match_level: result.match_level,
        recommendation_text: result.recommendation_text,
        model_version: 'v1.0',
        expires_at: expiresAt.toISOString(),
      });

    console.log(`[Success Score] Score calculated: ${(successProbability * 100).toFixed(1)}% (${matchLevel})`);

    return res.status(200).json(result);
  } catch (error) {
    console.error('[Success Score] Error:', error);
    return res.status(500).json({
      error: 'Failed to calculate success score',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
