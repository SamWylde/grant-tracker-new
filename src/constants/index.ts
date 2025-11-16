/**
 * Application Constants
 *
 * Centralized constants for type-safe usage throughout the application.
 * All constants are exported as const objects with proper TypeScript types.
 */

// =====================================================
// GRANT STATUSES
// =====================================================

export const GRANT_STATUSES = {
  RESEARCHING: 'researching',
  GO_NO_GO: 'go-no-go',
  DRAFTING: 'drafting',
  SUBMITTED: 'submitted',
  AWARDED: 'awarded',
  NOT_FUNDED: 'not-funded',
  CLOSED_OUT: 'closed-out',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
  ARCHIVED: 'archived',
} as const;

export type GrantStatus = typeof GRANT_STATUSES[keyof typeof GRANT_STATUSES];

export const GRANT_STATUS_OPTIONS = [
  { value: GRANT_STATUSES.RESEARCHING, label: 'Researching' },
  { value: GRANT_STATUSES.GO_NO_GO, label: 'Go/No-Go' },
  { value: GRANT_STATUSES.DRAFTING, label: 'Drafting' },
  { value: GRANT_STATUSES.SUBMITTED, label: 'Submitted' },
  { value: GRANT_STATUSES.AWARDED, label: 'Awarded' },
  { value: GRANT_STATUSES.NOT_FUNDED, label: 'Not Funded' },
  { value: GRANT_STATUSES.CLOSED_OUT, label: 'Closed Out' },
  { value: GRANT_STATUSES.REJECTED, label: 'Rejected' },
  { value: GRANT_STATUSES.WITHDRAWN, label: 'Withdrawn' },
  { value: GRANT_STATUSES.ARCHIVED, label: 'Archived' },
] as const;

// =====================================================
// GRANT PRIORITIES
// =====================================================

export const GRANT_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export type GrantPriority = typeof GRANT_PRIORITIES[keyof typeof GRANT_PRIORITIES];

export const GRANT_PRIORITY_OPTIONS = [
  { value: GRANT_PRIORITIES.LOW, label: 'Low' },
  { value: GRANT_PRIORITIES.MEDIUM, label: 'Medium' },
  { value: GRANT_PRIORITIES.HIGH, label: 'High' },
  { value: GRANT_PRIORITIES.URGENT, label: 'Urgent' },
] as const;

// =====================================================
// USER ROLES
// =====================================================

export const USER_ROLES = {
  ADMIN: 'admin',
  CONTRIBUTOR: 'contributor',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export const USER_ROLE_OPTIONS = [
  { value: USER_ROLES.ADMIN, label: 'Admin' },
  { value: USER_ROLES.CONTRIBUTOR, label: 'Contributor' },
] as const;

// =====================================================
// TASK STATUSES
// =====================================================

export const TASK_STATUSES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  BLOCKED: 'blocked',
} as const;

export type TaskStatus = typeof TASK_STATUSES[keyof typeof TASK_STATUSES];

export const TASK_STATUS_OPTIONS = [
  { value: TASK_STATUSES.PENDING, label: 'Pending' },
  { value: TASK_STATUSES.IN_PROGRESS, label: 'In Progress' },
  { value: TASK_STATUSES.COMPLETED, label: 'Completed' },
  { value: TASK_STATUSES.BLOCKED, label: 'Blocked' },
] as const;

// =====================================================
// EXPORT REQUEST STATUSES
// =====================================================

export const EXPORT_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  EXPIRED: 'expired',
} as const;

export type ExportStatus = typeof EXPORT_STATUSES[keyof typeof EXPORT_STATUSES];

export const EXPORT_STATUS_OPTIONS = [
  { value: EXPORT_STATUSES.PENDING, label: 'Pending' },
  { value: EXPORT_STATUSES.PROCESSING, label: 'Processing' },
  { value: EXPORT_STATUSES.COMPLETED, label: 'Completed' },
  { value: EXPORT_STATUSES.FAILED, label: 'Failed' },
  { value: EXPORT_STATUSES.EXPIRED, label: 'Expired' },
] as const;

// =====================================================
// APPROVAL REQUEST STATUSES
// =====================================================

export const APPROVAL_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
} as const;

export type ApprovalStatus = typeof APPROVAL_STATUSES[keyof typeof APPROVAL_STATUSES];

export const APPROVAL_STATUS_OPTIONS = [
  { value: APPROVAL_STATUSES.PENDING, label: 'Pending' },
  { value: APPROVAL_STATUSES.APPROVED, label: 'Approved' },
  { value: APPROVAL_STATUSES.REJECTED, label: 'Rejected' },
  { value: APPROVAL_STATUSES.CANCELLED, label: 'Cancelled' },
] as const;

// =====================================================
// SYNC STATUSES
// =====================================================

export const SYNC_STATUSES = {
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type SyncStatus = typeof SYNC_STATUSES[keyof typeof SYNC_STATUSES];

// =====================================================
// PLAN NAMES
// =====================================================

export const PLAN_NAMES = {
  FREE: 'free',
  STARTER: 'starter',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

export type PlanName = typeof PLAN_NAMES[keyof typeof PLAN_NAMES];

// =====================================================
// PLAN STATUSES
// =====================================================

export const PLAN_STATUSES = {
  ACTIVE: 'active',
  TRIAL: 'trial',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const;

export type PlanStatus = typeof PLAN_STATUSES[keyof typeof PLAN_STATUSES];

// =====================================================
// OPPORTUNITY STATUSES (for grants.gov)
// =====================================================

export const OPPORTUNITY_STATUSES = {
  POSTED: 'posted',
  FORECASTED: 'forecasted',
  CLOSED: 'closed',
  ARCHIVED: 'archived',
} as const;

export type OpportunityStatus = typeof OPPORTUNITY_STATUSES[keyof typeof OPPORTUNITY_STATUSES];

// =====================================================
// TASK PRIORITIES
// =====================================================

export const TASK_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

export type TaskPriority = typeof TASK_PRIORITIES[keyof typeof TASK_PRIORITIES];

// =====================================================
// EXTERNAL GRANT SOURCES
// =====================================================

export const GRANT_SOURCES = {
  GRANTS_GOV: 'grants.gov',
  OPEN_GRANTS: 'opengrants',
  CUSTOM: 'custom',
  IMPORTED: 'imported',
} as const;

export type GrantSource = typeof GRANT_SOURCES[keyof typeof GRANT_SOURCES];

// =====================================================
// AWARD STATUSES
// =====================================================

export const AWARD_STATUSES = {
  AWARDED: 'awarded',
  PENDING: 'pending',
  REJECTED: 'rejected',
} as const;

export type AwardStatus = typeof AWARD_STATUSES[keyof typeof AWARD_STATUSES];
