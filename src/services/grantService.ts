/**
 * Grant Service
 *
 * Abstracts all grant-related database operations from components.
 * Handles CRUD operations, search, filtering, and enrichment for grants.
 */

import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export type Grant = Database['public']['Tables']['org_grants_saved']['Row'];
export type GrantInsert = Database['public']['Tables']['org_grants_saved']['Insert'];
export type GrantUpdate = Database['public']['Tables']['org_grants_saved']['Update'];

export interface GrantFilters {
  status?: string;
  priority?: string;
  assigned_to?: string;
  search?: string;
  agency?: string;
  close_date_from?: string;
  close_date_to?: string;
}

export interface GrantListOptions {
  filters?: GrantFilters;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    count?: number;
    page?: number;
    totalPages?: number;
  };
}

export interface GrantWithAssignee extends Grant {
  assignee?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface GrantEnrichmentData {
  ai_summary?: string;
  tags?: string[];
  success_score?: number;
  recommended_priority?: string;
}

// =====================================================
// GRANT CRUD OPERATIONS
// =====================================================

/**
 * Get a single grant by ID
 */
export async function getGrantById(
  grantId: string,
  orgId: string
): Promise<ServiceResponse<GrantWithAssignee>> {
  try {
    const { data, error } = await supabase
      .from('org_grants_saved')
      .select(`
        *,
        assignee:user_profiles!org_grants_saved_assigned_to_fkey(
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('id', grantId)
      .eq('org_id', orgId)
      .single();

    if (error) {
      console.error('[GrantService] Error fetching grant:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data as GrantWithAssignee,
    };
  } catch (error) {
    console.error('[GrantService] Unexpected error fetching grant:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * List grants with optional filtering and pagination
 */
export async function listGrants(
  orgId: string,
  options: GrantListOptions = {}
): Promise<ServiceResponse<GrantWithAssignee[]>> {
  try {
    const {
      filters = {},
      sortBy = 'created_at',
      sortOrder = 'desc',
      limit = 50,
      offset = 0,
    } = options;

    let query = supabase
      .from('org_grants_saved')
      .select(`
        *,
        assignee:user_profiles!org_grants_saved_assigned_to_fkey(
          id,
          full_name,
          avatar_url
        )
      `, { count: 'exact' })
      .eq('org_id', orgId);

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }
    if (filters.assigned_to) {
      query = query.eq('assigned_to', filters.assigned_to);
    }
    if (filters.agency) {
      query = query.ilike('agency', `%${filters.agency}%`);
    }
    if (filters.search) {
      query = query.or(
        `title.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`
      );
    }
    if (filters.close_date_from) {
      query = query.gte('close_date', filters.close_date_from);
    }
    if (filters.close_date_to) {
      query = query.lte('close_date', filters.close_date_to);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[GrantService] Error listing grants:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data as GrantWithAssignee[],
      metadata: {
        count: count || 0,
        page: Math.floor(offset / limit) + 1,
        totalPages: count ? Math.ceil(count / limit) : 0,
      },
    };
  } catch (error) {
    console.error('[GrantService] Unexpected error listing grants:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create a new grant
 */
export async function createGrant(
  grant: GrantInsert
): Promise<ServiceResponse<Grant>> {
  try {
    const { data, error} = await supabase
      .from('org_grants_saved')
      .insert(grant as never)
      .select()
      .single();

    if (error) {
      console.error('[GrantService] Error creating grant:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('[GrantService] Unexpected error creating grant:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update an existing grant
 */
export async function updateGrant(
  grantId: string,
  orgId: string,
  updates: GrantUpdate
): Promise<ServiceResponse<Grant>> {
  try {
    const { data, error } = await supabase
      .from('org_grants_saved')
      .update(updates as never)
      .eq('id', grantId)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error) {
      console.error('[GrantService] Error updating grant:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('[GrantService] Unexpected error updating grant:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete a grant
 */
export async function deleteGrant(
  grantId: string,
  orgId: string
): Promise<ServiceResponse<void>> {
  try {
    const { error } = await supabase
      .from('org_grants_saved')
      .delete()
      .eq('id', grantId)
      .eq('org_id', orgId);

    if (error) {
      console.error('[GrantService] Error deleting grant:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('[GrantService] Unexpected error deleting grant:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Bulk delete grants
 */
export async function bulkDeleteGrants(
  grantIds: string[],
  orgId: string
): Promise<ServiceResponse<void>> {
  try {
    const { error } = await supabase
      .from('org_grants_saved')
      .delete()
      .in('id', grantIds)
      .eq('org_id', orgId);

    if (error) {
      console.error('[GrantService] Error bulk deleting grants:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('[GrantService] Unexpected error bulk deleting grants:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =====================================================
// GRANT SEARCH AND FILTERING
// =====================================================

/**
 * Search grants by keyword across multiple fields
 */
export async function searchGrants(
  orgId: string,
  searchTerm: string,
  limit: number = 20
): Promise<ServiceResponse<Grant[]>> {
  try {
    const { data, error } = await supabase
      .from('org_grants_saved')
      .select('*')
      .eq('org_id', orgId)
      .or(
        `title.ilike.%${searchTerm}%,agency.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`
      )
      .order('saved_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[GrantService] Error searching grants:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('[GrantService] Unexpected error searching grants:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get grants by status
 */
export async function getGrantsByStatus(
  orgId: string,
  status: string
): Promise<ServiceResponse<Grant[]>> {
  try {
    const { data, error } = await supabase
      .from('org_grants_saved')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', status)
      .order('close_date', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('[GrantService] Error fetching grants by status:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('[GrantService] Unexpected error fetching grants by status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get grants assigned to a specific user
 */
export async function getGrantsByAssignee(
  orgId: string,
  userId: string
): Promise<ServiceResponse<Grant[]>> {
  try {
    const { data, error } = await supabase
      .from('org_grants_saved')
      .select('*')
      .eq('org_id', orgId)
      .eq('assigned_to', userId)
      .order('close_date', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('[GrantService] Error fetching grants by assignee:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('[GrantService] Unexpected error fetching grants by assignee:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get grants with upcoming deadlines
 */
export async function getUpcomingDeadlines(
  orgId: string,
  daysAhead: number = 30
): Promise<ServiceResponse<Grant[]>> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('org_grants_saved')
      .select('*')
      .eq('org_id', orgId)
      .gte('close_date', today)
      .lte('close_date', futureDateStr)
      .order('close_date', { ascending: true });

    if (error) {
      console.error('[GrantService] Error fetching upcoming deadlines:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('[GrantService] Unexpected error fetching upcoming deadlines:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =====================================================
// GRANT ENRICHMENT OPERATIONS
// =====================================================

/**
 * Update grant with AI-generated enrichment data
 */
export async function enrichGrant(
  grantId: string,
  orgId: string,
  enrichmentData: GrantEnrichmentData
): Promise<ServiceResponse<Grant>> {
  try {
    // Note: This assumes enrichment fields exist in the database schema
    // You may need to add these fields or store them in a separate table
    const updates: any = {};

    if (enrichmentData.ai_summary !== undefined) {
      updates.notes = enrichmentData.ai_summary;
    }
    if (enrichmentData.recommended_priority !== undefined) {
      updates.priority = enrichmentData.recommended_priority;
    }

    const { data, error } = await supabase
      .from('org_grants_saved')
      .update(updates as never)
      .eq('id', grantId)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error) {
      console.error('[GrantService] Error enriching grant:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('[GrantService] Unexpected error enriching grant:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if a grant already exists (by external_id)
 */
export async function checkGrantExists(
  orgId: string,
  externalId: string,
  externalSource: string = 'grants.gov'
): Promise<ServiceResponse<boolean>> {
  try {
    const { data, error } = await supabase
      .from('org_grants_saved')
      .select('id')
      .eq('org_id', orgId)
      .eq('external_id', externalId)
      .eq('external_source', externalSource)
      .maybeSingle();

    if (error) {
      console.error('[GrantService] Error checking grant existence:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: !!data,
    };
  } catch (error) {
    console.error('[GrantService] Unexpected error checking grant existence:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Bulk update grant status
 */
export async function bulkUpdateStatus(
  grantIds: string[],
  orgId: string,
  newStatus: string
): Promise<ServiceResponse<void>> {
  try {
    const { error } = await supabase
      .from('org_grants_saved')
      .update({
        status: newStatus,
        stage_updated_at: new Date().toISOString()
      } as never)
      .in('id', grantIds)
      .eq('org_id', orgId);

    if (error) {
      console.error('[GrantService] Error bulk updating status:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('[GrantService] Unexpected error bulk updating status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Bulk assign grants to a user
 */
export async function bulkAssignGrants(
  grantIds: string[],
  orgId: string,
  userId: string
): Promise<ServiceResponse<void>> {
  try {
    const { error } = await supabase
      .from('org_grants_saved')
      .update({ assigned_to: userId } as never)
      .in('id', grantIds)
      .eq('org_id', orgId);

    if (error) {
      console.error('[GrantService] Error bulk assigning grants:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('[GrantService] Unexpected error bulk assigning grants:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get grant statistics for an organization
 */
export async function getGrantStats(
  orgId: string
): Promise<ServiceResponse<{
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}>> {
  try {
    const { data, error } = await supabase
      .from('org_grants_saved')
      .select('status, priority')
      .eq('org_id', orgId);

    if (error) {
      console.error('[GrantService] Error fetching grant stats:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    const stats = {
      total: data.length,
      byStatus: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
    };

    data.forEach((grant: any) => {
      // Count by status
      if (grant.status) {
        stats.byStatus[grant.status] = (stats.byStatus[grant.status] || 0) + 1;
      }

      // Count by priority
      if (grant.priority) {
        stats.byPriority[grant.priority] = (stats.byPriority[grant.priority] || 0) + 1;
      }
    });

    return {
      success: true,
      data: stats,
    };
  } catch (error) {
    console.error('[GrantService] Unexpected error fetching grant stats:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
