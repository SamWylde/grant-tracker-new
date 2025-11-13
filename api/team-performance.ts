import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Use server-side environment variables (not VITE_ prefixed)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '');

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user token
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { orgId, timeframe } = req.query;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    // Verify user has access to this organization
    const { data: membership, error: membershipError } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return res.status(403).json({ error: 'Access denied to this organization' });
    }

    // Calculate date range based on timeframe
    let startDate: string | null = null;
    const endDate = new Date().toISOString();

    if (timeframe) {
      const now = new Date();
      switch (timeframe) {
        case '30days':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case '90days':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case 'all':
        default:
          startDate = null;
          break;
      }
    }

    // Fetch all team members
    const { data: teamMembers, error: membersError } = await (supabase.rpc as any)('get_org_team_members', {
      org_uuid: orgId,
    });

    if (membersError) {
      console.error('Failed to fetch team members:', membersError);
      return res.status(500).json({ error: 'Failed to fetch team members' });
    }

    // Fetch grants data for each member
    const performanceData = await Promise.all(
      teamMembers.map(async (member: any) => {
        // Get grants owned by this member (assigned_to)
        let grantsQuery = supabase
          .from('org_grants_saved')
          .select(
            `
            id,
            title,
            status,
            saved_at,
            created_at,
            stage_updated_at,
            grant_submissions (
              id,
              submitted_date,
              deadline_date,
              met_deadline,
              days_to_submit,
              requested_amount
            ),
            grant_awards (
              id,
              award_status,
              award_date,
              awarded_amount
            )
          `
          )
          .eq('org_id', orgId)
          .eq('assigned_to', member.user_id);

        if (startDate) {
          grantsQuery = grantsQuery.gte('created_at', startDate);
        }

        const { data: grants, error: grantsError } = await grantsQuery;

        if (grantsError) {
          console.error(`Failed to fetch grants for member ${member.user_id}:`, grantsError);
          return null;
        }

        // Calculate metrics
        const totalGrantsOwned = grants?.length || 0;

        const grantsWithSubmissions = grants?.filter((g: any) => g.grant_submissions?.length > 0) || [];
        const totalSubmitted = grantsWithSubmissions.length;

        const submissionRate = totalGrantsOwned > 0 ? (totalSubmitted / totalGrantsOwned) * 100 : 0;

        const grantsAwarded = grants?.filter(
          (g: any) => g.grant_awards?.length > 0 && g.grant_awards[0]?.award_status === 'awarded'
        ) || [];
        const totalAwarded = grantsAwarded.length;

        const successRate = totalSubmitted > 0 ? (totalAwarded / totalSubmitted) * 100 : 0;

        // Calculate average time-to-submit
        const daysToSubmitValues = grantsWithSubmissions
          .map((g: any) => g.grant_submissions[0]?.days_to_submit)
          .filter((d: any) => d !== null && d !== undefined && d >= 0);

        const avgTimeToSubmit =
          daysToSubmitValues.length > 0
            ? daysToSubmitValues.reduce((a: number, b: number) => a + b, 0) / daysToSubmitValues.length
            : 0;

        // Calculate total awarded amount
        const totalAwardedAmount = grantsAwarded.reduce((sum: number, g: any) => {
          return sum + (parseFloat(g.grant_awards[0]?.awarded_amount) || 0);
        }, 0);

        return {
          userId: member.user_id,
          fullName: member.full_name || member.email || 'Unknown',
          email: member.email,
          role: member.role,
          metrics: {
            grantsOwned: totalGrantsOwned,
            grantsSubmitted: totalSubmitted,
            grantsAwarded: totalAwarded,
            submissionRate: Math.round(submissionRate * 100) / 100,
            successRate: Math.round(successRate * 100) / 100,
            avgTimeToSubmit: Math.round(avgTimeToSubmit * 10) / 10,
            totalAwardedAmount,
          },
        };
      })
    );

    // Filter out any null results (errors)
    const validPerformanceData = performanceData.filter((p) => p !== null);

    // Sort by success rate (for leaderboard)
    const leaderboard = [...validPerformanceData].sort((a, b) => {
      // Primary sort: success rate (higher is better)
      if (b.metrics.successRate !== a.metrics.successRate) {
        return b.metrics.successRate - a.metrics.successRate;
      }
      // Secondary sort: submission rate (higher is better)
      if (b.metrics.submissionRate !== a.metrics.submissionRate) {
        return b.metrics.submissionRate - a.metrics.submissionRate;
      }
      // Tertiary sort: total awarded amount (higher is better)
      return b.metrics.totalAwardedAmount - a.metrics.totalAwardedAmount;
    });

    // Add ranking
    const leaderboardWithRanking = leaderboard.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

    return res.status(200).json({
      timeframe: {
        start: startDate,
        end: endDate,
        label: timeframe || 'all',
      },
      teamMembers: validPerformanceData,
      leaderboard: leaderboardWithRanking,
    });
  } catch (error) {
    console.error('Team performance API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
