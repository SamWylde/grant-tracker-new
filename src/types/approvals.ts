// Approval workflow types

export type GrantStage = 'researching' | 'drafting' | 'submitted' | 'awarded' | 'rejected' | 'withdrawn';
export type ApprovalRole = 'admin' | 'contributor';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ApprovalDecision = 'approved' | 'rejected';

// Approval level configuration
export interface ApprovalLevel {
  level: number;
  role?: ApprovalRole;
  required_approvers: number;
  specific_users?: string[];
}

// Approval workflow definition
export interface ApprovalWorkflow {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  from_stage: GrantStage;
  to_stage: GrantStage;
  approval_chain: ApprovalLevel[];
  is_active: boolean;
  require_all_levels: boolean;
  allow_self_approval: boolean;
  auto_approve_admin: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  creator?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

// Individual approval record within a request
export interface ApprovalRecord {
  level: number;
  user_id: string;
  decision: ApprovalDecision;
  comments?: string;
  timestamp: string;
}

// Approval request
export interface ApprovalRequest {
  id: string;
  org_id: string;
  workflow_id: string;
  grant_id: string;
  requested_by: string;
  from_stage: GrantStage;
  to_stage: GrantStage;
  status: ApprovalStatus;
  current_approval_level: number;
  approvals: ApprovalRecord[];
  request_notes?: string;
  rejection_reason?: string;
  requested_at: string;
  completed_at?: string;
  expires_at: string;
  created_at: string;
  updated_at: string;

  // Joined data
  workflow?: {
    name: string;
    approval_chain: ApprovalLevel[];
  };
  grant?: {
    id: string;
    title: string;
    status: GrantStage;
  };
  requester?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

// Approver record (who can approve)
export interface ApprovalRequestApprover {
  id: string;
  request_id: string;
  user_id: string;
  approval_level: number;
  has_approved: boolean;
  approved_at?: string;
  decision?: ApprovalDecision;
  comments?: string;
  notified_at?: string;
  notification_sent: boolean;
  created_at: string;
}

// API request types
export interface CreateWorkflowRequest {
  org_id: string;
  name: string;
  description?: string;
  from_stage: GrantStage;
  to_stage: GrantStage;
  approval_chain: ApprovalLevel[];
  is_active?: boolean;
  require_all_levels?: boolean;
  allow_self_approval?: boolean;
  auto_approve_admin?: boolean;
}

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  from_stage?: GrantStage;
  to_stage?: GrantStage;
  approval_chain?: ApprovalLevel[];
  is_active?: boolean;
  require_all_levels?: boolean;
  allow_self_approval?: boolean;
  auto_approve_admin?: boolean;
}

export interface CreateApprovalRequestRequest {
  grant_id: string;
  from_stage: GrantStage;
  to_stage: GrantStage;
  request_notes?: string;
}

export interface ApproveRejectRequest {
  decision: ApprovalDecision;
  comments?: string;
}

// API response types
export interface WorkflowsResponse {
  workflows: ApprovalWorkflow[];
}

export interface ApprovalRequestsResponse {
  requests: ApprovalRequest[];
}

export interface ApprovalRequestResponse {
  request: ApprovalRequest;
}

export interface ApprovalDecisionResponse {
  decision: ApprovalDecision;
  message: string;
  next_level?: number;
  new_stage?: GrantStage;
  approvals_count?: number;
  required_approvals?: number;
}

export interface AutoApprovalResponse {
  auto_approved: boolean;
  message: string;
}

// UI helper types
export interface StageTransition {
  from: GrantStage;
  to: GrantStage;
  label: string;
  requiresApproval?: boolean;
  workflowId?: string;
}

// Constants
export const GRANT_STAGES: { value: GrantStage; label: string; color: string }[] = [
  { value: 'researching', label: 'Researching', color: 'blue' },
  { value: 'drafting', label: 'Drafting', color: 'yellow' },
  { value: 'submitted', label: 'Submitted', color: 'cyan' },
  { value: 'awarded', label: 'Awarded', color: 'green' },
  { value: 'rejected', label: 'Rejected', color: 'red' },
  { value: 'withdrawn', label: 'Withdrawn', color: 'gray' },
];

export const COMMON_STAGE_TRANSITIONS: Omit<StageTransition, 'requiresApproval' | 'workflowId'>[] = [
  { from: 'researching', to: 'drafting', label: 'Start Drafting' },
  { from: 'drafting', to: 'submitted', label: 'Submit Application' },
  { from: 'submitted', to: 'awarded', label: 'Mark as Awarded' },
  { from: 'submitted', to: 'rejected', label: 'Mark as Rejected' },
  { from: 'researching', to: 'withdrawn', label: 'Withdraw' },
  { from: 'drafting', to: 'withdrawn', label: 'Withdraw' },
];

// Helper functions
export function getStageLabel(stage: GrantStage): string {
  return GRANT_STAGES.find(s => s.value === stage)?.label || stage;
}

export function getStageColor(stage: GrantStage): string {
  return GRANT_STAGES.find(s => s.value === stage)?.color || 'gray';
}

export function formatTransitionLabel(from: GrantStage, to: GrantStage): string {
  return `${getStageLabel(from)} → ${getStageLabel(to)}`;
}

export function isRequestPending(request: ApprovalRequest): boolean {
  return request.status === 'pending' && new Date(request.expires_at) > new Date();
}

export function isRequestExpired(request: ApprovalRequest): boolean {
  return request.status === 'pending' && new Date(request.expires_at) <= new Date();
}

export function canUserApprove(
  request: ApprovalRequest,
  userId: string,
  approvers: ApprovalRequestApprover[]
): boolean {
  if (request.status !== 'pending' || isRequestExpired(request)) {
    return false;
  }

  const userApprover = approvers.find(
    a => a.user_id === userId &&
         a.approval_level === request.current_approval_level &&
         !a.has_approved
  );

  return !!userApprover;
}

export function getApprovalProgress(request: ApprovalRequest): {
  currentLevel: number;
  totalLevels: number;
  currentLevelApprovals: number;
  currentLevelRequired: number;
} {
  const totalLevels = request.workflow?.approval_chain.length || 1;
  const currentLevel = request.current_approval_level;

  const currentLevelConfig = request.workflow?.approval_chain.find(
    l => l.level === currentLevel
  );
  const currentLevelRequired = currentLevelConfig?.required_approvers || 1;

  const currentLevelApprovals = request.approvals.filter(
    a => a.level === currentLevel && a.decision === 'approved'
  ).length;

  return {
    currentLevel,
    totalLevels,
    currentLevelApprovals,
    currentLevelRequired,
  };
}
