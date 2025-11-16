/**
 * API Type Definitions
 *
 * Type definitions for API requests, responses, and RPC functions
 */

import type { Database } from '../lib/database.types';

// =====================================================
// SUPABASE RPC FUNCTION TYPES
// =====================================================

// Re-export RPC function types from Database
export type SupabaseRPCFunctions = Database['public']['Functions'];

// =====================================================
// DATABASE EXTENDED TYPES
// =====================================================

export interface OrganizationSettings {
  org_id: string;
  deadline_reminders_30d: boolean;
  deadline_reminders_14d: boolean;
  deadline_reminders_7d: boolean;
  deadline_reminders_3d: boolean;
  deadline_reminders_1d: boolean;
  deadline_reminders_0d: boolean;
  daily_task_emails: boolean;
  ics_token: string | null;
  google_calendar_connected: boolean;
  google_calendar_token: string | null;
  plan_name: 'free' | 'starter' | 'pro' | 'enterprise';
  plan_status: 'active' | 'trial' | 'cancelled' | 'expired';
  trial_ends_at: string | null;
  next_renewal_at: string | null;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
  is_platform_admin?: boolean;
  totp_enabled?: boolean;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: 'admin' | 'contributor';
  joined_at: string;
  invited_by: string | null;
  user_profiles?: UserProfile;
}

export interface TeamInvitation {
  id: string;
  org_id: string;
  email: string;
  role: 'admin' | 'contributor';
  invited_by: string;
  invited_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

// =====================================================
// TEAM MEMBER TYPES
// =====================================================

export interface TeamMember {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: 'admin' | 'contributor';
  joined_at: string;
}

export interface TeamMemberOption {
  value: string;
  label: string;
}

// =====================================================
// ROLE & PERMISSION TYPES
// =====================================================

export interface Permission {
  id: string;
  name: string;
  description?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions?: Permission[];
}

export interface RolePermission {
  permissions: Permission;
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// =====================================================
// METRICS & ANALYTICS TYPES
// =====================================================

export interface GrantMetrics {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  totalValue: number;
  averageValue: number;
}

export interface TeamPerformanceMetrics {
  userId: string;
  userName: string;
  grantsManaged: number;
  grantsAwarded: number;
  totalValue: number;
  successRate: number;
}

// =====================================================
// SYNC TYPES
// =====================================================

export interface SyncResult {
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  totalProcessed: number;
  errors?: string[];
}

// =====================================================
// EXPORT TYPES
// =====================================================

export interface ExportRequest {
  id: string;
  user_id: string;
  org_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  format: 'csv' | 'json';
  requested_at: string;
  completed_at?: string;
  expires_at?: string;
  download_url?: string;
  error_message?: string;
}

// =====================================================
// APPROVAL WORKFLOW TYPES (extended from existing)
// =====================================================

export interface ApprovalRequest {
  id: string;
  org_id: string;
  workflow_id: string;
  grant_id: string;
  requested_by: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  created_at: string;
  expires_at: string;
  completed_at?: string;
  completed_by?: string;
  comments?: string;
}

// =====================================================
// NOTIFICATION TYPES
// =====================================================

export interface Notification {
  id: string;
  user_id: string;
  org_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  metadata?: Record<string, unknown>;
}

// =====================================================
// ACTIVITY LOG TYPES
// =====================================================

export interface ActivityLog {
  id: string;
  org_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}
