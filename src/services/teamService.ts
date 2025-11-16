/**
 * Team Service
 *
 * Abstracts all team/member management operations from components.
 * Handles team members, roles, permissions, and invitations.
 */

import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import {
  getUserPermissions,
  getUserRoles,
  assignRoleToUser,
  removeRoleFromUser,
  type Permission,
  type Role,
} from '../lib/rbac';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export type OrgMember = Database['public']['Tables']['org_members']['Row'];
export type OrgMemberInsert = Database['public']['Tables']['org_members']['Insert'];
export type OrgMemberUpdate = Database['public']['Tables']['org_members']['Update'];

export type TeamInvitation = Database['public']['Tables']['team_invitations']['Row'];
export type TeamInvitationInsert = Database['public']['Tables']['team_invitations']['Insert'];
export type TeamInvitationUpdate = Database['public']['Tables']['team_invitations']['Update'];

interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    count?: number;
  };
}

export interface TeamMemberWithProfile extends OrgMember {
  profile?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    timezone: string;
  };
  inviter?: {
    id: string;
    full_name: string | null;
  };
}

export interface InvitationWithDetails extends TeamInvitation {
  inviter?: {
    id: string;
    full_name: string | null;
  };
}

export interface TeamMemberWithPermissions extends TeamMemberWithProfile {
  permissions: Permission[];
  roles: Role[];
}

// =====================================================
// TEAM MEMBER MANAGEMENT
// =====================================================

/**
 * Get all team members for an organization
 */
export async function getTeamMembers(
  orgId: string
): Promise<ServiceResponse<TeamMemberWithProfile[]>> {
  try {
    const { data, error } = await supabase
      .from('org_members')
      .select(`
        *,
        profile:user_profiles!org_members_user_id_fkey(
          id,
          full_name,
          avatar_url,
          timezone
        ),
        inviter:user_profiles!org_members_invited_by_fkey(
          id,
          full_name
        )
      `)
      .eq('org_id', orgId)
      .order('joined_at', { ascending: false });

    if (error) {
      console.error('[TeamService] Error fetching team members:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data as TeamMemberWithProfile[],
      metadata: {
        count: data.length,
      },
    };
  } catch (error) {
    console.error('[TeamService] Unexpected error fetching team members:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get a specific team member
 */
export async function getTeamMember(
  orgId: string,
  userId: string
): Promise<ServiceResponse<TeamMemberWithProfile>> {
  try {
    const { data, error } = await supabase
      .from('org_members')
      .select(`
        *,
        profile:user_profiles!org_members_user_id_fkey(
          id,
          full_name,
          avatar_url,
          timezone
        ),
        inviter:user_profiles!org_members_invited_by_fkey(
          id,
          full_name
        )
      `)
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('[TeamService] Error fetching team member:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data as TeamMemberWithProfile,
    };
  } catch (error) {
    console.error('[TeamService] Unexpected error fetching team member:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Add a team member to an organization
 */
export async function addTeamMember(
  member: OrgMemberInsert
): Promise<ServiceResponse<OrgMember>> {
  try {
    const { data, error } = await supabase
      .from('org_members')
      .insert(member as never)
      .select()
      .single();

    if (error) {
      console.error('[TeamService] Error adding team member:', error);
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
    console.error('[TeamService] Unexpected error adding team member:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update a team member's role
 */
export async function updateTeamMemberRole(
  orgId: string,
  userId: string,
  newRole: string
): Promise<ServiceResponse<OrgMember>> {
  try {
    const { data, error } = await supabase
      .from('org_members')
      .update({ role: newRole } as never)
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[TeamService] Error updating team member role:', error);
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
    console.error('[TeamService] Unexpected error updating team member role:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Remove a team member from an organization
 */
export async function removeTeamMember(
  orgId: string,
  userId: string
): Promise<ServiceResponse<void>> {
  try {
    const { error } = await supabase
      .from('org_members')
      .delete()
      .eq('org_id', orgId)
      .eq('user_id', userId);

    if (error) {
      console.error('[TeamService] Error removing team member:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('[TeamService] Unexpected error removing team member:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if user is a member of an organization
 */
export async function isMemberOfOrg(
  orgId: string,
  userId: string
): Promise<ServiceResponse<boolean>> {
  try {
    const { data, error } = await supabase
      .from('org_members')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[TeamService] Error checking membership:', error);
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
    console.error('[TeamService] Unexpected error checking membership:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =====================================================
// ROLE AND PERMISSION OPERATIONS
// =====================================================

/**
 * Get a team member with their roles and permissions
 */
export async function getTeamMemberWithPermissions(
  orgId: string,
  userId: string
): Promise<ServiceResponse<TeamMemberWithPermissions>> {
  try {
    // Get the team member
    const memberResponse = await getTeamMember(orgId, userId);
    if (!memberResponse.success || !memberResponse.data) {
      return {
        success: false,
        error: memberResponse.error || 'Member not found',
      };
    }

    // Get permissions and roles
    const [permissions, roles] = await Promise.all([
      getUserPermissions(userId, orgId),
      getUserRoles(userId, orgId),
    ]);

    return {
      success: true,
      data: {
        ...memberResponse.data,
        permissions,
        roles,
      },
    };
  } catch (error) {
    console.error('[TeamService] Unexpected error fetching member with permissions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Assign a role to a team member
 */
export async function assignRoleToTeamMember(
  orgId: string,
  userId: string,
  roleId: string,
  assignedBy: string
): Promise<ServiceResponse<boolean>> {
  try {
    const success = await assignRoleToUser(userId, roleId, orgId, assignedBy);

    if (!success) {
      return {
        success: false,
        error: 'Failed to assign role',
      };
    }

    return {
      success: true,
      data: true,
    };
  } catch (error) {
    console.error('[TeamService] Unexpected error assigning role:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Remove a role from a team member
 */
export async function removeRoleFromTeamMember(
  orgId: string,
  userId: string,
  roleId: string
): Promise<ServiceResponse<boolean>> {
  try {
    const success = await removeRoleFromUser(userId, roleId, orgId);

    if (!success) {
      return {
        success: false,
        error: 'Failed to remove role',
      };
    }

    return {
      success: true,
      data: true,
    };
  } catch (error) {
    console.error('[TeamService] Unexpected error removing role:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =====================================================
// INVITATION MANAGEMENT
// =====================================================

/**
 * Get all pending invitations for an organization
 */
export async function getPendingInvitations(
  orgId: string
): Promise<ServiceResponse<InvitationWithDetails[]>> {
  try {
    const { data, error } = await supabase
      .from('team_invitations')
      .select(`
        *,
        inviter:user_profiles!team_invitations_invited_by_fkey(
          id,
          full_name
        )
      `)
      .eq('org_id', orgId)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('invited_at', { ascending: false });

    if (error) {
      console.error('[TeamService] Error fetching invitations:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data as InvitationWithDetails[],
      metadata: {
        count: data.length,
      },
    };
  } catch (error) {
    console.error('[TeamService] Unexpected error fetching invitations:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get an invitation by ID
 */
export async function getInvitation(
  invitationId: string
): Promise<ServiceResponse<InvitationWithDetails>> {
  try {
    const { data, error } = await supabase
      .from('team_invitations')
      .select(`
        *,
        inviter:user_profiles!team_invitations_invited_by_fkey(
          id,
          full_name
        )
      `)
      .eq('id', invitationId)
      .single();

    if (error) {
      console.error('[TeamService] Error fetching invitation:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data as InvitationWithDetails,
    };
  } catch (error) {
    console.error('[TeamService] Unexpected error fetching invitation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create a new team invitation
 */
export async function createInvitation(
  invitation: TeamInvitationInsert
): Promise<ServiceResponse<TeamInvitation>> {
  try {
    // Set expiration date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitationData: TeamInvitationInsert = {
      ...invitation,
      expires_at: expiresAt.toISOString(),
    };

    const { data, error } = await supabase
      .from('team_invitations')
      .insert(invitationData as never)
      .select()
      .single();

    if (error) {
      console.error('[TeamService] Error creating invitation:', error);
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
    console.error('[TeamService] Unexpected error creating invitation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Accept an invitation
 */
export async function acceptInvitation(
  invitationId: string,
  userId: string
): Promise<ServiceResponse<OrgMember>> {
  try {
    // Get the invitation
    const invitationResponse = await getInvitation(invitationId);
    if (!invitationResponse.success || !invitationResponse.data) {
      return {
        success: false,
        error: invitationResponse.error || 'Invitation not found',
      };
    }

    const invitation = invitationResponse.data;

    // Check if invitation is still valid
    if (invitation.accepted_at) {
      return {
        success: false,
        error: 'Invitation has already been accepted',
      };
    }

    if (invitation.revoked_at) {
      return {
        success: false,
        error: 'Invitation has been revoked',
      };
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return {
        success: false,
        error: 'Invitation has expired',
      };
    }

    // Add user as org member
    const memberResponse = await addTeamMember({
      org_id: invitation.org_id,
      user_id: userId,
      role: invitation.role,
      invited_by: invitation.invited_by,
    });

    if (!memberResponse.success) {
      return {
        success: false,
        error: memberResponse.error || 'Failed to add team member',
      };
    }

    // Mark invitation as accepted
    const { error } = await supabase
      .from('team_invitations')
      .update({ accepted_at: new Date().toISOString() } as never)
      .eq('id', invitationId);

    if (error) {
      console.error('[TeamService] Error marking invitation as accepted:', error);
      // Note: Member was already added, so we still return success
    }

    return {
      success: true,
      data: memberResponse.data!,
    };
  } catch (error) {
    console.error('[TeamService] Unexpected error accepting invitation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Revoke an invitation
 */
export async function revokeInvitation(
  invitationId: string,
  orgId: string
): Promise<ServiceResponse<void>> {
  try {
    const { error } = await supabase
      .from('team_invitations')
      .update({ revoked_at: new Date().toISOString() } as never)
      .eq('id', invitationId)
      .eq('org_id', orgId);

    if (error) {
      console.error('[TeamService] Error revoking invitation:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('[TeamService] Unexpected error revoking invitation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Resend an invitation (creates a new invitation)
 */
export async function resendInvitation(
  originalInvitationId: string,
  invitedBy: string
): Promise<ServiceResponse<TeamInvitation>> {
  try {
    // Get original invitation
    const originalResponse = await getInvitation(originalInvitationId);
    if (!originalResponse.success || !originalResponse.data) {
      return {
        success: false,
        error: originalResponse.error || 'Original invitation not found',
      };
    }

    const original = originalResponse.data;

    // Revoke original invitation
    await revokeInvitation(originalInvitationId, original.org_id);

    // Create new invitation with same details
    return createInvitation({
      org_id: original.org_id,
      email: original.email,
      role: original.role,
      invited_by: invitedBy,
    });
  } catch (error) {
    console.error('[TeamService] Unexpected error resending invitation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if an email has a pending invitation
 */
export async function checkPendingInvitation(
  orgId: string,
  email: string
): Promise<ServiceResponse<boolean>> {
  try {
    const { data, error } = await supabase
      .from('team_invitations')
      .select('id')
      .eq('org_id', orgId)
      .eq('email', email.toLowerCase())
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error) {
      console.error('[TeamService] Error checking pending invitation:', error);
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
    console.error('[TeamService] Unexpected error checking pending invitation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get team statistics
 */
export async function getTeamStats(
  orgId: string
): Promise<ServiceResponse<{
  total: number;
  byRole: Record<string, number>;
  pendingInvitations: number;
}>> {
  try {
    // Get team members
    const membersResponse = await getTeamMembers(orgId);
    if (!membersResponse.success) {
      return {
        success: false,
        error: membersResponse.error,
      };
    }

    const members = membersResponse.data || [];

    // Get pending invitations count
    const invitationsResponse = await getPendingInvitations(orgId);
    const pendingInvitations = invitationsResponse.data?.length || 0;

    // Count by role
    const byRole: Record<string, number> = {};
    members.forEach((member) => {
      if (member.role) {
        byRole[member.role] = (byRole[member.role] || 0) + 1;
      }
    });

    return {
      success: true,
      data: {
        total: members.length,
        byRole,
        pendingInvitations,
      },
    };
  } catch (error) {
    console.error('[TeamService] Unexpected error fetching team stats:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
