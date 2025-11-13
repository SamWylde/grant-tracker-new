import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface WeeklyDigestContent {
  newGrants: any[];
  upcomingDeadlines: any[];
  teamActivity: any[];
}

interface MonthlySummaryContent {
  submissions: {
    total: number;
    byStage: Record<string, number>;
  };
  awards: {
    total: number;
    totalAmount: number;
  };
  pipelineHealth: {
    totalGrants: number;
    byStage: Record<string, number>;
    completionRate: number;
  };
}

/**
 * Generate Weekly Digest Content
 */
async function generateWeeklyDigest(
  supabase: any,
  orgId: string,
  settings: any
): Promise<WeeklyDigestContent> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const content: WeeklyDigestContent = {
    newGrants: [],
    upcomingDeadlines: [],
    teamActivity: [],
  };

  // Get new grants matching profile (saved in the last week)
  if (settings.include_new_matches) {
    const { data: newGrants } = await supabase
      .from('org_grants_saved')
      .select('id, title, agency, close_date, external_source, saved_at')
      .eq('org_id', orgId)
      .gte('saved_at', oneWeekAgo.toISOString())
      .order('saved_at', { ascending: false })
      .limit(20);

    content.newGrants = newGrants || [];
  }

  // Get upcoming deadlines (next 30 days)
  if (settings.include_upcoming_deadlines) {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const { data: deadlines } = await supabase
      .from('org_grants_saved')
      .select('id, title, agency, close_date, status, pipeline_stage')
      .eq('org_id', orgId)
      .gte('close_date', now.toISOString())
      .lte('close_date', thirtyDaysFromNow.toISOString())
      .order('close_date', { ascending: true })
      .limit(15);

    content.upcomingDeadlines = deadlines || [];
  }

  // Get team activity (comments, status changes, tasks completed)
  if (settings.include_team_activity) {
    const { data: activityLog } = await supabase
      .from('activity_log')
      .select(`
        id,
        action,
        entity_type,
        entity_id,
        metadata,
        created_at,
        user_profiles!inner(full_name)
      `)
      .eq('org_id', orgId)
      .gte('created_at', oneWeekAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(25);

    content.teamActivity = activityLog || [];
  }

  return content;
}

/**
 * Generate Monthly Summary Content
 */
async function generateMonthlySummary(
  supabase: any,
  orgId: string,
  settings: any
): Promise<MonthlySummaryContent> {
  const firstDayOfMonth = new Date();
  firstDayOfMonth.setDate(1);
  firstDayOfMonth.setHours(0, 0, 0, 0);

  const firstDayOfLastMonth = new Date(firstDayOfMonth);
  firstDayOfLastMonth.setMonth(firstDayOfLastMonth.getMonth() - 1);

  const content: MonthlySummaryContent = {
    submissions: { total: 0, byStage: {} },
    awards: { total: 0, totalAmount: 0 },
    pipelineHealth: { totalGrants: 0, byStage: {}, completionRate: 0 },
  };

  // Get submission statistics for last month
  if (settings.include_submissions) {
    const { data: submissions } = await supabase
      .from('org_grants_saved')
      .select('id, pipeline_stage, status')
      .eq('org_id', orgId)
      .eq('status', 'submitted')
      .gte('updated_at', firstDayOfLastMonth.toISOString())
      .lt('updated_at', firstDayOfMonth.toISOString());

    content.submissions.total = submissions?.length || 0;

    // Group by stage
    submissions?.forEach((grant: any) => {
      const stage = grant.pipeline_stage || 'Unknown';
      content.submissions.byStage[stage] =
        (content.submissions.byStage[stage] || 0) + 1;
    });
  }

  // Get award statistics
  if (settings.include_awards) {
    const { data: awards } = await supabase
      .from('org_grants_saved')
      .select('id, award_amount')
      .eq('org_id', orgId)
      .eq('status', 'awarded')
      .gte('updated_at', firstDayOfLastMonth.toISOString())
      .lt('updated_at', firstDayOfMonth.toISOString());

    content.awards.total = awards?.length || 0;
    content.awards.totalAmount = awards?.reduce(
      (sum: number, grant: any) => sum + (grant.award_amount || 0),
      0
    );
  }

  // Get pipeline health metrics (current state)
  if (settings.include_pipeline_health) {
    const { data: allGrants } = await supabase
      .from('org_grants_saved')
      .select('id, pipeline_stage, status')
      .eq('org_id', orgId)
      .not('status', 'eq', 'archived');

    content.pipelineHealth.totalGrants = allGrants?.length || 0;

    // Group by stage
    allGrants?.forEach((grant: any) => {
      const stage = grant.pipeline_stage || 'Unknown';
      content.pipelineHealth.byStage[stage] =
        (content.pipelineHealth.byStage[stage] || 0) + 1;
    });

    // Calculate completion rate (awarded + rejected vs total)
    const completed = allGrants?.filter(
      (g: any) => g.status === 'awarded' || g.status === 'rejected'
    ).length || 0;
    content.pipelineHealth.completionRate =
      allGrants?.length > 0 ? (completed / allGrants.length) * 100 : 0;
  }

  return content;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // This endpoint can be called either by authenticated user (preview) or by cron (with secret)
  const authHeader = req.headers.authorization;
  const isCronRequest = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  let supabase;
  let user = null;

  if (isCronRequest) {
    // Cron request - use service role
    supabase = createClient(supabaseUrl, supabaseServiceKey);
  } else {
    // User request - verify authentication
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !authUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    user = authUser;
  }

  try {
    const { org_id, report_type, report_id } = req.body;

    if (!org_id || !report_type) {
      return res.status(400).json({ error: 'org_id and report_type are required' });
    }

    // If not cron request, verify user is member of the org
    if (!isCronRequest && user) {
      const { data: membership } = await supabase
        .from('org_members')
        .select('role')
        .eq('org_id', org_id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return res.status(403).json({ error: 'Not a member of this organization' });
      }
    }

    // Get report settings
    let settings;
    if (report_id) {
      const { data: report } = await supabase
        .from('scheduled_reports')
        .select('*')
        .eq('id', report_id)
        .single();

      settings = report;
    } else {
      // Use default settings for preview
      settings = {
        include_new_matches: true,
        include_upcoming_deadlines: true,
        include_team_activity: true,
        include_submissions: true,
        include_awards: true,
        include_pipeline_health: true,
      };
    }

    if (!settings) {
      return res.status(404).json({ error: 'Report configuration not found' });
    }

    // Generate content based on report type
    let content;

    if (report_type === 'weekly_digest') {
      content = await generateWeeklyDigest(supabase, org_id, settings);
    } else if (report_type === 'monthly_summary') {
      content = await generateMonthlySummary(supabase, org_id, settings);
    } else {
      return res.status(400).json({ error: 'Invalid report_type' });
    }

    // Get organization details
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', org_id)
      .single();

    return res.status(200).json({
      reportType: report_type,
      orgName: org?.name || 'Your Organization',
      generatedAt: new Date().toISOString(),
      content,
    });
  } catch (error) {
    console.error('Error generating report content:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
