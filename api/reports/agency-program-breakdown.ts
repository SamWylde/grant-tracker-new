import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { setCorsHeaders } from '../utils/cors.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface AgencyBreakdown {
  agency: string;
  totalFunding: number;
  grantCount: number;
  averageFunding: number;
  programs: ProgramBreakdown[];
  statusBreakdown: Record<string, number>;
}

interface ProgramBreakdown {
  program: string;
  totalFunding: number;
  grantCount: number;
  averageFunding: number;
  statusBreakdown: Record<string, number>;
}

interface TimelineDataPoint {
  period: string;
  agency: string;
  program: string | null;
  funding: number;
  grantCount: number;
}

interface ReportFilters {
  startDate?: string;
  endDate?: string;
  status?: string[];
  groupBy?: 'agency' | 'program' | 'both';
  timelineGranularity?: 'month' | 'quarter' | 'year';
}

/**
 * Calculate total funding for a grant based on status
 */
function getGrantFunding(grant: any): number {
  // Use award_amount if awarded, otherwise use requested_amount or estimated funding
  if (grant.status === 'awarded' && grant.award_amount) {
    return parseFloat(grant.award_amount) || 0;
  }
  if (grant.requested_amount) {
    return parseFloat(grant.requested_amount) || 0;
  }
  // Try to parse estimated funding from description or other fields
  return 0;
}

/**
 * Generate Agency Breakdown Report
 */
async function generateAgencyBreakdown(
  supabase: any,
  orgId: string,
  filters: ReportFilters
): Promise<AgencyBreakdown[]> {
  let query = supabase
    .from('org_grants_saved')
    .select('*')
    .eq('org_id', orgId)
    .not('agency', 'is', null);

  // Apply filters
  if (filters.startDate) {
    query = query.gte('saved_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('saved_at', filters.endDate);
  }
  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  const { data: grants, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch grants: ${error.message}`);
  }

  // Group by agency
  const agencyMap = new Map<string, any[]>();

  (grants || []).forEach((grant: any) => {
    const agency = grant.agency || 'Unknown Agency';
    if (!agencyMap.has(agency)) {
      agencyMap.set(agency, []);
    }
    agencyMap.get(agency)!.push(grant);
  });

  // Calculate breakdowns for each agency
  const breakdowns: AgencyBreakdown[] = [];

  agencyMap.forEach((agencyGrants, agency) => {
    // Calculate total funding
    const totalFunding = agencyGrants.reduce((sum, grant) => sum + getGrantFunding(grant), 0);
    const grantCount = agencyGrants.length;
    const averageFunding = grantCount > 0 ? totalFunding / grantCount : 0;

    // Status breakdown
    const statusBreakdown: Record<string, number> = {};
    agencyGrants.forEach((grant: any) => {
      const status = grant.status || 'unknown';
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    });

    // Program breakdown
    const programMap = new Map<string, any[]>();
    agencyGrants.forEach((grant: any) => {
      const program = grant.program || 'No Program Specified';
      if (!programMap.has(program)) {
        programMap.set(program, []);
      }
      programMap.get(program)!.push(grant);
    });

    const programs: ProgramBreakdown[] = [];
    programMap.forEach((programGrants, program) => {
      const programTotalFunding = programGrants.reduce((sum, grant) => sum + getGrantFunding(grant), 0);
      const programGrantCount = programGrants.length;
      const programAverageFunding = programGrantCount > 0 ? programTotalFunding / programGrantCount : 0;

      // Program status breakdown
      const programStatusBreakdown: Record<string, number> = {};
      programGrants.forEach((grant: any) => {
        const status = grant.status || 'unknown';
        programStatusBreakdown[status] = (programStatusBreakdown[status] || 0) + 1;
      });

      programs.push({
        program,
        totalFunding: programTotalFunding,
        grantCount: programGrantCount,
        averageFunding: programAverageFunding,
        statusBreakdown: programStatusBreakdown,
      });
    });

    // Sort programs by total funding (descending)
    programs.sort((a, b) => b.totalFunding - a.totalFunding);

    breakdowns.push({
      agency,
      totalFunding,
      grantCount,
      averageFunding,
      programs,
      statusBreakdown,
    });
  });

  // Sort agencies by total funding (descending)
  breakdowns.sort((a, b) => b.totalFunding - a.totalFunding);

  return breakdowns;
}

/**
 * Generate Program-Only Breakdown (flat list of all programs across agencies)
 */
async function generateProgramBreakdown(
  supabase: any,
  orgId: string,
  filters: ReportFilters
): Promise<ProgramBreakdown[]> {
  let query = supabase
    .from('org_grants_saved')
    .select('*')
    .eq('org_id', orgId)
    .not('program', 'is', null);

  // Apply filters
  if (filters.startDate) {
    query = query.gte('saved_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('saved_at', filters.endDate);
  }
  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  const { data: grants, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch grants: ${error.message}`);
  }

  // Group by program
  const programMap = new Map<string, any[]>();

  (grants || []).forEach((grant: any) => {
    const program = grant.program || 'No Program Specified';
    if (!programMap.has(program)) {
      programMap.set(program, []);
    }
    programMap.get(program)!.push(grant);
  });

  // Calculate breakdowns for each program
  const breakdowns: ProgramBreakdown[] = [];

  programMap.forEach((programGrants, program) => {
    const totalFunding = programGrants.reduce((sum, grant) => sum + getGrantFunding(grant), 0);
    const grantCount = programGrants.length;
    const averageFunding = grantCount > 0 ? totalFunding / grantCount : 0;

    // Status breakdown
    const statusBreakdown: Record<string, number> = {};
    programGrants.forEach((grant: any) => {
      const status = grant.status || 'unknown';
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    });

    breakdowns.push({
      program,
      totalFunding,
      grantCount,
      averageFunding,
      statusBreakdown,
    });
  });

  // Sort programs by total funding (descending)
  breakdowns.sort((a, b) => b.totalFunding - a.totalFunding);

  return breakdowns;
}

/**
 * Generate Timeline Data (funding over time by agency/program)
 */
async function generateTimelineData(
  supabase: any,
  orgId: string,
  filters: ReportFilters
): Promise<TimelineDataPoint[]> {
  let query = supabase
    .from('org_grants_saved')
    .select('*')
    .eq('org_id', orgId);

  // Apply filters
  if (filters.startDate) {
    query = query.gte('saved_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('saved_at', filters.endDate);
  }
  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  const { data: grants, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch grants: ${error.message}`);
  }

  const granularity = filters.timelineGranularity || 'month';
  const timelineMap = new Map<string, TimelineDataPoint[]>();

  (grants || []).forEach((grant: any) => {
    const date = new Date(grant.saved_at);
    let period: string;

    // Format period based on granularity
    if (granularity === 'month') {
      period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } else if (granularity === 'quarter') {
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      period = `${date.getFullYear()}-Q${quarter}`;
    } else {
      period = String(date.getFullYear());
    }

    const agency = grant.agency || 'Unknown Agency';
    const program = grant.program || null;
    const key = `${period}|${agency}|${program}`;

    if (!timelineMap.has(key)) {
      timelineMap.set(key, []);
    }
    timelineMap.get(key)!.push(grant);
  });

  // Aggregate timeline data
  const timeline: TimelineDataPoint[] = [];

  timelineMap.forEach((grants, key) => {
    const [period, agency, program] = key.split('|');
    const totalFunding = grants.reduce((sum, grant) => sum + getGrantFunding(grant), 0);
    const grantCount = grants.length;

    timeline.push({
      period,
      agency,
      program: program === 'null' ? null : program,
      funding: totalFunding,
      grantCount,
    });
  });

  // Sort by period
  timeline.sort((a, b) => a.period.localeCompare(b.period));

  return timeline;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set secure CORS headers based on whitelisted origins
  setCorsHeaders(res, req.headers.origin, { methods: 'GET, POST, OPTIONS' });

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const token = authHeader.substring(7);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get parameters from body (POST) or query (GET)
    const params = req.method === 'POST' ? req.body : req.query;
    const { org_id, format } = params;
    const filters: ReportFilters = {
      startDate: params.start_date,
      endDate: params.end_date,
      status: params.status ? (Array.isArray(params.status) ? params.status : [params.status]) : undefined,
      groupBy: params.group_by || 'both',
      timelineGranularity: params.timeline_granularity || 'month',
    };

    if (!org_id || typeof org_id !== 'string') {
      return res.status(400).json({ error: 'org_id is required' });
    }

    // Verify user is member of organization
    const { data: membership } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', org_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this organization' });
    }

    // Generate reports based on groupBy parameter
    let agencyBreakdown: AgencyBreakdown[] = [];
    let programBreakdown: ProgramBreakdown[] = [];
    let timeline: TimelineDataPoint[] = [];

    if (filters.groupBy === 'agency' || filters.groupBy === 'both') {
      agencyBreakdown = await generateAgencyBreakdown(supabase, org_id, filters);
    }

    if (filters.groupBy === 'program' || filters.groupBy === 'both') {
      programBreakdown = await generateProgramBreakdown(supabase, org_id, filters);
    }

    // Always generate timeline data
    timeline = await generateTimelineData(supabase, org_id, filters);

    // CSV export
    if (format === 'csv') {
      let csvContent = '';

      if (filters.groupBy === 'agency' || filters.groupBy === 'both') {
        csvContent += 'AGENCY BREAKDOWN\n';
        csvContent += 'Agency,Total Funding,Grant Count,Average Funding,Awarded,Submitted,In Progress,Saved\n';

        agencyBreakdown.forEach((agency) => {
          csvContent += `"${agency.agency}",${agency.totalFunding},${agency.grantCount},${agency.averageFunding},`;
          csvContent += `${agency.statusBreakdown.awarded || 0},${agency.statusBreakdown.submitted || 0},`;
          csvContent += `${agency.statusBreakdown.in_progress || 0},${agency.statusBreakdown.saved || 0}\n`;

          // Add program breakdowns under each agency
          if (agency.programs && agency.programs.length > 0) {
            agency.programs.forEach((program) => {
              csvContent += `  "${program.program}",${program.totalFunding},${program.grantCount},${program.averageFunding},`;
              csvContent += `${program.statusBreakdown.awarded || 0},${program.statusBreakdown.submitted || 0},`;
              csvContent += `${program.statusBreakdown.in_progress || 0},${program.statusBreakdown.saved || 0}\n`;
            });
          }
        });

        csvContent += '\n\n';
      }

      if (filters.groupBy === 'program') {
        csvContent += 'PROGRAM BREAKDOWN\n';
        csvContent += 'Program,Total Funding,Grant Count,Average Funding,Awarded,Submitted,In Progress,Saved\n';

        programBreakdown.forEach((program) => {
          csvContent += `"${program.program}",${program.totalFunding},${program.grantCount},${program.averageFunding},`;
          csvContent += `${program.statusBreakdown.awarded || 0},${program.statusBreakdown.submitted || 0},`;
          csvContent += `${program.statusBreakdown.in_progress || 0},${program.statusBreakdown.saved || 0}\n`;
        });

        csvContent += '\n\n';
      }

      // Add timeline data
      csvContent += 'TIMELINE DATA\n';
      csvContent += 'Period,Agency,Program,Funding,Grant Count\n';
      timeline.forEach((point) => {
        csvContent += `${point.period},"${point.agency}","${point.program || 'N/A'}",${point.funding},${point.grantCount}\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="agency-program-breakdown-${new Date().toISOString().split('T')[0]}.csv"`);
      return res.status(200).send(csvContent);
    }

    // JSON response
    return res.status(200).json({
      agencyBreakdown,
      programBreakdown,
      timeline,
      filters,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error generating agency/program breakdown:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
