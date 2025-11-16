/**
 * Analytics Service
 *
 * Abstracts analytics and reporting operations from components.
 * Handles metrics, reports, analytics queries, and data export.
 */

import { supabase } from '../lib/supabase';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    generatedAt?: string;
    reportPeriod?: string;
  };
}

export interface GrantMetrics {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byAgency: Record<string, number>;
  averagePerMonth: number;
  upcomingDeadlines: number;
  overdueDeadlines: number;
}

export interface TeamPerformanceMetrics {
  totalMembers: number;
  grantsPerMember: Record<string, number>;
  completionRates: Record<string, number>;
  averageGrantsPerMember: number;
}

export interface TimelineMetrics {
  grantsAddedByMonth: Array<{ month: string; count: number }>;
  grantsClosedByMonth: Array<{ month: string; count: number }>;
  statusChangesOverTime: Array<{
    date: string;
    status: string;
    count: number;
  }>;
}

export interface PipelineHealth {
  totalValue: number;
  byStage: Record<
    string,
    {
      count: number;
      percentage: number;
    }
  >;
  conversionRate: number;
  averageTimeInStage: Record<string, number>;
}

export interface ExportFormat {
  format: 'csv' | 'json' | 'excel';
  includeFields?: string[];
  filters?: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

export interface ExportData {
  data: any[];
  filename: string;
  mimeType: string;
}

// =====================================================
// GRANT METRICS
// =====================================================

/**
 * Get comprehensive grant metrics for an organization
 */
export async function getGrantMetrics(
  orgId: string
): Promise<ServiceResponse<GrantMetrics>> {
  try {
    const { data, error } = await supabase
      .from('org_grants_saved')
      .select('*')
      .eq('org_id', orgId);

    if (error) {
      console.error('[AnalyticsService] Error fetching grant metrics:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // Calculate metrics
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byAgency: Record<string, number> = {};
    let upcomingDeadlines = 0;
    let overdueDeadlines = 0;

    // Get earliest grant date for average calculation
    let earliestDate = new Date();

    data.forEach((grant: any) => {
      // Count by status
      if (grant.status) {
        byStatus[grant.status] = (byStatus[grant.status] || 0) + 1;
      }

      // Count by priority
      if (grant.priority) {
        byPriority[grant.priority] = (byPriority[grant.priority] || 0) + 1;
      }

      // Count by agency
      if (grant.agency) {
        byAgency[grant.agency] = (byAgency[grant.agency] || 0) + 1;
      }

      // Track deadlines
      if (grant.close_date) {
        const closeDate = new Date(grant.close_date);
        if (closeDate < now) {
          overdueDeadlines++;
        } else if (closeDate <= thirtyDaysAgo) {
          upcomingDeadlines++;
        }
      }

      // Track earliest grant
      const grantDate = new Date(grant.created_at);
      if (grantDate < earliestDate) {
        earliestDate = grantDate;
      }
    });

    // Calculate average grants per month
    const monthsSinceFirst = Math.max(
      1,
      (now.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );
    const averagePerMonth = data.length / monthsSinceFirst;

    return {
      success: true,
      data: {
        total: data.length,
        byStatus,
        byPriority,
        byAgency,
        averagePerMonth: Math.round(averagePerMonth * 10) / 10,
        upcomingDeadlines,
        overdueDeadlines,
      },
      metadata: {
        generatedAt: now.toISOString(),
      },
    };
  } catch (error) {
    console.error('[AnalyticsService] Unexpected error fetching grant metrics:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get timeline metrics showing grants over time
 */
export async function getTimelineMetrics(
  orgId: string,
  monthsBack: number = 12
): Promise<ServiceResponse<TimelineMetrics>> {
  try {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const { data, error } = await supabase
      .from('org_grants_saved')
      .select('created_at, close_date, status, stage_updated_at')
      .eq('org_id', orgId)
      .gte('created_at', startDate.toISOString());

    if (error) {
      console.error('[AnalyticsService] Error fetching timeline metrics:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    // Initialize month buckets
    const grantsAddedByMonth: Record<string, number> = {};
    const grantsClosedByMonth: Record<string, number> = {};

    data.forEach((grant: any) => {
      // Grants added
      const createdMonth = new Date(grant.created_at).toISOString().slice(0, 7);
      grantsAddedByMonth[createdMonth] = (grantsAddedByMonth[createdMonth] || 0) + 1;

      // Grants closed
      if (grant.close_date) {
        const closeMonth = new Date(grant.close_date).toISOString().slice(0, 7);
        grantsClosedByMonth[closeMonth] = (grantsClosedByMonth[closeMonth] || 0) + 1;
      }
    });

    // Convert to arrays and sort
    const grantsAddedArray = Object.entries(grantsAddedByMonth)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const grantsClosedArray = Object.entries(grantsClosedByMonth)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      success: true,
      data: {
        grantsAddedByMonth: grantsAddedArray,
        grantsClosedByMonth: grantsClosedArray,
        statusChangesOverTime: [], // Could be enhanced with more detailed tracking
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        reportPeriod: `Last ${monthsBack} months`,
      },
    };
  } catch (error) {
    console.error('[AnalyticsService] Unexpected error fetching timeline metrics:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get pipeline health metrics
 */
export async function getPipelineHealth(
  orgId: string
): Promise<ServiceResponse<PipelineHealth>> {
  try {
    const { data, error } = await supabase
      .from('org_grants_saved')
      .select('status, created_at, stage_updated_at')
      .eq('org_id', orgId);

    if (error) {
      console.error('[AnalyticsService] Error fetching pipeline health:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    const total = data.length;
    const byStage: Record<string, { count: number; percentage: number }> = {};
    const stageTimings: Record<string, number[]> = {};

    data.forEach((grant: any) => {
      const status = grant.status || 'unknown';

      // Count by stage
      if (!byStage[status]) {
        byStage[status] = { count: 0, percentage: 0 };
      }
      byStage[status].count++;

      // Calculate time in current stage
      if (grant.stage_updated_at) {
        const stageDate = new Date(grant.stage_updated_at);
        const now = new Date();
        const daysInStage = (now.getTime() - stageDate.getTime()) / (1000 * 60 * 60 * 24);

        if (!stageTimings[status]) {
          stageTimings[status] = [];
        }
        stageTimings[status].push(daysInStage);
      }
    });

    // Calculate percentages
    Object.keys(byStage).forEach((stage) => {
      byStage[stage].percentage = (byStage[stage].count / total) * 100;
    });

    // Calculate average time in each stage
    const averageTimeInStage: Record<string, number> = {};
    Object.entries(stageTimings).forEach(([stage, timings]) => {
      const average = timings.reduce((sum, time) => sum + time, 0) / timings.length;
      averageTimeInStage[stage] = Math.round(average);
    });

    // Simple conversion rate calculation (submitted / total)
    const submitted = byStage['submitted']?.count || 0;
    const conversionRate = total > 0 ? (submitted / total) * 100 : 0;

    return {
      success: true,
      data: {
        totalValue: total,
        byStage,
        conversionRate: Math.round(conversionRate * 10) / 10,
        averageTimeInStage,
      },
      metadata: {
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('[AnalyticsService] Unexpected error fetching pipeline health:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =====================================================
// TEAM PERFORMANCE METRICS
// =====================================================

/**
 * Get team performance metrics
 */
export async function getTeamPerformanceMetrics(
  orgId: string
): Promise<ServiceResponse<TeamPerformanceMetrics>> {
  try {
    // Get all team members
    const { data: members, error: membersError } = await supabase
      .from('org_members')
      .select(`
        user_id,
        profile:user_profiles!org_members_user_id_fkey(
          full_name
        )
      `)
      .eq('org_id', orgId);

    if (membersError) {
      console.error('[AnalyticsService] Error fetching team members:', membersError);
      return {
        success: false,
        error: membersError.message,
      };
    }

    // Get all grants
    const { data: grants, error: grantsError } = await supabase
      .from('org_grants_saved')
      .select('assigned_to, status')
      .eq('org_id', orgId);

    if (grantsError) {
      console.error('[AnalyticsService] Error fetching grants:', grantsError);
      return {
        success: false,
        error: grantsError.message,
      };
    }

    // Calculate grants per member
    const grantsPerMember: Record<string, number> = {};
    const completedPerMember: Record<string, number> = {};
    const completionRates: Record<string, number> = {};

    grants.forEach((grant: any) => {
      if (grant.assigned_to) {
        grantsPerMember[grant.assigned_to] = (grantsPerMember[grant.assigned_to] || 0) + 1;

        if (grant.status === 'submitted' || grant.status === 'awarded') {
          completedPerMember[grant.assigned_to] = (completedPerMember[grant.assigned_to] || 0) + 1;
        }
      }
    });

    // Calculate completion rates
    Object.keys(grantsPerMember).forEach((userId) => {
      const total = grantsPerMember[userId];
      const completed = completedPerMember[userId] || 0;
      completionRates[userId] = total > 0 ? (completed / total) * 100 : 0;
    });

    // Calculate average grants per member
    const totalAssigned = Object.values(grantsPerMember).reduce((sum, count) => sum + count, 0);
    const averageGrantsPerMember = members.length > 0 ? totalAssigned / members.length : 0;

    return {
      success: true,
      data: {
        totalMembers: members.length,
        grantsPerMember,
        completionRates,
        averageGrantsPerMember: Math.round(averageGrantsPerMember * 10) / 10,
      },
      metadata: {
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('[AnalyticsService] Unexpected error fetching team performance:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =====================================================
// DATA EXPORT
// =====================================================

/**
 * Export grants data
 */
export async function exportGrantsData(
  orgId: string,
  exportConfig: ExportFormat
): Promise<ServiceResponse<ExportData>> {
  try {
    let query = supabase
      .from('org_grants_saved')
      .select('*')
      .eq('org_id', orgId);

    // Apply filters
    if (exportConfig.filters?.status) {
      query = query.eq('status', exportConfig.filters.status);
    }
    if (exportConfig.filters?.dateFrom) {
      query = query.gte('created_at', exportConfig.filters.dateFrom);
    }
    if (exportConfig.filters?.dateTo) {
      query = query.lte('created_at', exportConfig.filters.dateTo);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[AnalyticsService] Error fetching export data:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    // Filter fields if specified
    let exportData: any = data;
    if (exportConfig.includeFields && exportConfig.includeFields.length > 0) {
      exportData = (data as any).map((grant: any) => {
        const filtered: any = {};
        exportConfig.includeFields!.forEach((field) => {
          if (field in grant) {
            filtered[field] = (grant as any)[field];
          }
        });
        return filtered;
      });
    }

    // Determine MIME type based on format
    let mimeType = 'application/json';
    let filename = `grants-export-${new Date().toISOString().split('T')[0]}`;

    switch (exportConfig.format) {
      case 'csv':
        mimeType = 'text/csv';
        filename += '.csv';
        break;
      case 'excel':
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        filename += '.xlsx';
        break;
      case 'json':
      default:
        mimeType = 'application/json';
        filename += '.json';
        break;
    }

    return {
      success: true,
      data: {
        data: exportData,
        filename,
        mimeType,
      },
      metadata: {
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('[AnalyticsService] Unexpected error exporting data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Convert data to CSV format
 */
export function convertToCSV(data: any[]): string {
  if (data.length === 0) {
    return '';
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);

  // Create CSV rows
  const csvRows = [
    // Header row
    headers.join(','),
    // Data rows
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          // Escape quotes and wrap in quotes if contains comma or newline
          if (value === null || value === undefined) {
            return '';
          }
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(',')
    ),
  ];

  return csvRows.join('\n');
}

/**
 * Generate analytics report
 */
export async function generateAnalyticsReport(
  orgId: string
): Promise<ServiceResponse<{
  grantMetrics: GrantMetrics;
  pipelineHealth: PipelineHealth;
  teamPerformance: TeamPerformanceMetrics;
  timelineMetrics: TimelineMetrics;
}>> {
  try {
    const [grantMetrics, pipelineHealth, teamPerformance, timelineMetrics] = await Promise.all([
      getGrantMetrics(orgId),
      getPipelineHealth(orgId),
      getTeamPerformanceMetrics(orgId),
      getTimelineMetrics(orgId, 12),
    ]);

    if (!grantMetrics.success) {
      return {
        success: false,
        error: grantMetrics.error || 'Failed to fetch grant metrics',
      };
    }

    if (!pipelineHealth.success) {
      return {
        success: false,
        error: pipelineHealth.error || 'Failed to fetch pipeline health',
      };
    }

    if (!teamPerformance.success) {
      return {
        success: false,
        error: teamPerformance.error || 'Failed to fetch team performance',
      };
    }

    if (!timelineMetrics.success) {
      return {
        success: false,
        error: timelineMetrics.error || 'Failed to fetch timeline metrics',
      };
    }

    return {
      success: true,
      data: {
        grantMetrics: grantMetrics.data!,
        pipelineHealth: pipelineHealth.data!,
        teamPerformance: teamPerformance.data!,
        timelineMetrics: timelineMetrics.data!,
      },
      metadata: {
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('[AnalyticsService] Unexpected error generating analytics report:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get dashboard summary metrics
 */
export async function getDashboardSummary(
  orgId: string,
  userId?: string
): Promise<ServiceResponse<{
  totalGrants: number;
  activeGrants: number;
  upcomingDeadlines: number;
  myGrants?: number;
  recentActivity: number;
}>> {
  try {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // Get basic grant counts
    const { data: allGrants, error: grantsError } = await supabase
      .from('org_grants_saved')
      .select('id, status, close_date, assigned_to')
      .eq('org_id', orgId);

    if (grantsError) {
      console.error('[AnalyticsService] Error fetching grants for dashboard:', grantsError);
      return {
        success: false,
        error: grantsError.message,
      };
    }

    const totalGrants = allGrants.length;
    const activeGrants = (allGrants as any).filter(
      (g: any) => g.status !== 'submitted' && g.status !== 'awarded' && g.status !== 'rejected'
    ).length;

    const upcomingDeadlines = (allGrants as any).filter((g: any) => {
      if (!g.close_date) return false;
      const closeDate = new Date(g.close_date);
      return closeDate >= new Date() && closeDate <= thirtyDaysFromNow;
    }).length;

    const myGrants = userId
      ? (allGrants as any).filter((g: any) => g.assigned_to === userId).length
      : undefined;

    // Get recent activity count (grants added in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: recentActivity } = await supabase
      .from('org_grants_saved')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', sevenDaysAgo.toISOString());

    return {
      success: true,
      data: {
        totalGrants,
        activeGrants,
        upcomingDeadlines,
        myGrants,
        recentActivity: recentActivity || 0,
      },
      metadata: {
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('[AnalyticsService] Unexpected error fetching dashboard summary:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
