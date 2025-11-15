import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { setCorsHeaders } from './utils/cors.js';
import { ErrorHandlers, generateRequestId, wrapHandler } from './utils/error-handler';

// Use server-side environment variables (not VITE_ prefixed)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default wrapHandler(async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = generateRequestId();

  // Set secure CORS headers based on whitelisted origins
  setCorsHeaders(res, req.headers.origin, {
    methods: 'GET,OPTIONS,POST',
    headers: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  });

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return ErrorHandlers.methodNotAllowed(res, ['GET', 'POST'], requestId);
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return ErrorHandlers.unauthorized(res, 'Unauthorized', undefined, requestId);
  }

  const token = authHeader.replace('Bearer ', '');

  if (!supabaseUrl || !supabaseServiceKey) {
    return ErrorHandlers.serverError(res, new Error('Server configuration error'), requestId);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify user token
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return ErrorHandlers.unauthorized(res, 'Invalid token', undefined, requestId);
  }

    const { orgId, timeframe, startDate, endDate } = req.method === 'GET' ? req.query : req.body;

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
    let calculatedStartDate = startDate;
    let calculatedEndDate = endDate || new Date().toISOString();

    if (timeframe) {
      const now = new Date();
      switch (timeframe) {
        case '30days':
          calculatedStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case '60days':
          calculatedStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case '90days':
          calculatedStartDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case 'all':
        default:
          calculatedStartDate = null;
          break;
      }
    }

    // Fetch overall metrics using the database view
    const { data: _summaryMetrics, error: summaryError } = await supabase
      .from('grant_metrics_summary')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (summaryError && summaryError.code !== 'PGRST116') {
      console.error('Summary metrics error:', summaryError);
    }

    // Fetch detailed grants data with submissions and awards
    let grantsQuery = supabase
      .from('org_grants_saved')
      .select(
        `
        id,
        title,
        agency,
        close_date,
        saved_at,
        status,
        grant_submissions (
          id,
          submitted_date,
          deadline_date,
          met_deadline,
          days_to_submit,
          requested_amount,
          notes
        ),
        grant_awards (
          id,
          award_status,
          award_date,
          awarded_amount,
          notes
        )
      `
      )
      .eq('org_id', orgId);

    if (calculatedStartDate) {
      grantsQuery = grantsQuery.gte('created_at', calculatedStartDate);
    }

    if (calculatedEndDate) {
      grantsQuery = grantsQuery.lte('created_at', calculatedEndDate);
    }

    const { data: grants, error: grantsError } = await grantsQuery;

    if (grantsError) {
      console.error('Grants query error:', grantsError);
      return res.status(500).json({ error: 'Failed to fetch grants data' });
    }

    // Calculate metrics from the detailed data
    const totalGrantsSaved = grants?.length || 0;
    const grantsWithSubmissions = grants?.filter((g: any) => g.grant_submissions?.length > 0) || [];
    const totalGrantsSubmitted = grantsWithSubmissions.length;

    const deadlinesMet = grantsWithSubmissions.filter((g: any) => g.grant_submissions[0]?.met_deadline === true).length;
    const deadlinesMissed = grantsWithSubmissions.filter(
      (g: any) => g.grant_submissions[0]?.met_deadline === false
    ).length;

    const deadlineSuccessRate =
      totalGrantsSubmitted > 0 ? Math.round((deadlinesMet / totalGrantsSubmitted) * 100 * 100) / 100 : 0;

    const daysToSubmitValues = grantsWithSubmissions
      .map((g: any) => g.grant_submissions[0]?.days_to_submit)
      .filter((d: any) => d !== null && d !== undefined);

    const avgDaysToSubmit =
      daysToSubmitValues.length > 0
        ? Math.round((daysToSubmitValues.reduce((a: number, b: number) => a + b, 0) / daysToSubmitValues.length) * 10) /
          10
        : 0;

    const grantsAwarded = grants?.filter(
      (g: any) => g.grant_awards?.length > 0 && g.grant_awards[0]?.award_status === 'awarded'
    ) || [];
    const totalGrantsAwarded = grantsAwarded.length;

    const totalAwardedAmount = grantsAwarded.reduce((sum: number, g: any) => {
      return sum + (parseFloat(g.grant_awards[0]?.awarded_amount) || 0);
    }, 0);

    const avgAwardAmount = totalGrantsAwarded > 0 ? Math.round((totalAwardedAmount / totalGrantsAwarded) * 100) / 100 : 0;

    // Calculate baseline (missed deadlines before using the system)
    // For demo purposes, we'll simulate a baseline
    const baselineMissedDeadlines = Math.max(0, totalGrantsSaved - totalGrantsSubmitted);

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentGrants = grants?.filter((g: any) => g.saved_at >= thirtyDaysAgo) || [];
    const recentSubmissions = recentGrants.filter((g: any) => g.grant_submissions?.length > 0).length;

    // Construct response
    const metricsData = {
      summary: {
        totalGrantsSaved,
        totalGrantsSubmitted,
        totalGrantsAwarded,
        deadlinesMet,
        deadlinesMissed,
        deadlineSuccessRate,
        avgDaysToSubmit,
        totalAwardedAmount,
        avgAwardAmount,
        baselineMissedDeadlines,
      },
      timeframe: {
        start: calculatedStartDate,
        end: calculatedEndDate,
        label: timeframe || 'all',
      },
      recentActivity: {
        last30Days: {
          grantsSaved: recentGrants.length,
          grantsSubmitted: recentSubmissions,
        },
      },
      grants: grants?.map((g: any) => ({
        id: g.id,
        title: g.title,
        agency: g.agency,
        closeDate: g.close_date,
        savedAt: g.saved_at,
        status: g.status,
        submission: g.grant_submissions?.[0] || null,
        award: g.grant_awards?.[0] || null,
      })),
    };

  return res.status(200).json(metricsData);
});
