import { supabase } from '../lib/supabase';
import type {
  ApprovalWorkflow,
  ApprovalRequest,
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  CreateApprovalRequestRequest,
  ApproveRejectRequest,
  WorkflowsResponse,
  ApprovalRequestsResponse,
  ApprovalDecisionResponse,
  AutoApprovalResponse,
} from '../types/approvals';

const API_BASE_URL = '/api';

/**
 * Get authorization header with current user's token
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  };
}

/**
 * Handle API response errors
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

// ==================== WORKFLOWS API ====================

/**
 * Fetch all workflows for an organization
 */
export async function fetchWorkflows(
  orgId: string,
  activeOnly: boolean = false
): Promise<ApprovalWorkflow[]> {
  const headers = await getAuthHeaders();
  const queryParams = new URLSearchParams({
    org_id: orgId,
    ...(activeOnly && { active_only: 'true' }),
  });

  const response = await fetch(
    `${API_BASE_URL}/approval-workflows?${queryParams}`,
    { headers }
  );

  const data = await handleResponse<WorkflowsResponse>(response);
  return data.workflows;
}

/**
 * Create a new approval workflow
 */
export async function createWorkflow(
  workflowData: CreateWorkflowRequest
): Promise<ApprovalWorkflow> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/approval-workflows`, {
    method: 'POST',
    headers,
    body: JSON.stringify(workflowData),
  });

  const data = await handleResponse<{ workflow: ApprovalWorkflow }>(response);
  return data.workflow;
}

/**
 * Update an existing workflow
 */
export async function updateWorkflow(
  workflowId: string,
  updates: UpdateWorkflowRequest
): Promise<ApprovalWorkflow> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_BASE_URL}/approval-workflows?id=${workflowId}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    }
  );

  const data = await handleResponse<{ workflow: ApprovalWorkflow }>(response);
  return data.workflow;
}

/**
 * Delete a workflow
 */
export async function deleteWorkflow(workflowId: string): Promise<void> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_BASE_URL}/approval-workflows?id=${workflowId}`,
    {
      method: 'DELETE',
      headers,
    }
  );

  await handleResponse<{ success: boolean }>(response);
}

/**
 * Toggle workflow active status
 */
export async function toggleWorkflowActive(
  workflowId: string,
  isActive: boolean
): Promise<ApprovalWorkflow> {
  return updateWorkflow(workflowId, { is_active: isActive });
}

// ==================== APPROVAL REQUESTS API ====================

/**
 * Fetch approval requests for an organization
 */
export async function fetchApprovalRequests(params: {
  orgId: string;
  status?: string;
  grantId?: string;
  pendingForUser?: boolean;
}): Promise<ApprovalRequest[]> {
  const headers = await getAuthHeaders();
  const queryParams = new URLSearchParams({
    org_id: params.orgId,
    ...(params.status && { status: params.status }),
    ...(params.grantId && { grant_id: params.grantId }),
    ...(params.pendingForUser && { pending_for_user: 'true' }),
  });

  const response = await fetch(
    `${API_BASE_URL}/approval-requests?${queryParams}`,
    { headers }
  );

  const data = await handleResponse<ApprovalRequestsResponse>(response);
  return data.requests;
}

/**
 * Create a new approval request
 */
export async function createApprovalRequest(
  requestData: CreateApprovalRequestRequest
): Promise<ApprovalRequest | AutoApprovalResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/approval-requests`, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestData),
  });

  const data = await handleResponse<
    { request: ApprovalRequest } | AutoApprovalResponse
  >(response);

  // Check if it's an auto-approval response
  if ('auto_approved' in data) {
    return data;
  }

  return data.request;
}

/**
 * Approve or reject an approval request
 */
export async function approveOrRejectRequest(
  requestId: string,
  decision: ApproveRejectRequest
): Promise<ApprovalDecisionResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_BASE_URL}/approval-requests?id=${requestId}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify(decision),
    }
  );

  return handleResponse<ApprovalDecisionResponse>(response);
}

/**
 * Cancel an approval request
 */
export async function cancelApprovalRequest(requestId: string): Promise<void> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_BASE_URL}/approval-requests?id=${requestId}`,
    {
      method: 'DELETE',
      headers,
    }
  );

  await handleResponse<{ success: boolean }>(response);
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Check if a stage transition requires approval
 */
export async function checkTransitionRequiresApproval(
  orgId: string,
  fromStage: string,
  toStage: string
): Promise<{ requiresApproval: boolean; workflowId?: string }> {
  try {
    const workflows = await fetchWorkflows(orgId, true);
    const workflow = workflows.find(
      w => w.from_stage === fromStage && w.to_stage === toStage
    );

    return {
      requiresApproval: !!workflow,
      workflowId: workflow?.id,
    };
  } catch (error) {
    console.error('Error checking approval requirement:', error);
    return { requiresApproval: false };
  }
}

/**
 * Get pending approvals count for a user
 */
export async function getPendingApprovalsCount(orgId: string): Promise<number> {
  try {
    const requests = await fetchApprovalRequests({
      orgId,
      pendingForUser: true,
    });
    return requests.length;
  } catch (error) {
    console.error('Error fetching pending approvals count:', error);
    return 0;
  }
}
