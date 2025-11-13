import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

interface ApprovalLevel {
  level: number;
  role?: 'admin' | 'contributor';
  required_approvers: number;
  specific_users?: string[];
}

interface WorkflowRequest {
  org_id: string;
  name: string;
  description?: string;
  from_stage: string;
  to_stage: string;
  approval_chain: ApprovalLevel[];
  is_active?: boolean;
  require_all_levels?: boolean;
  allow_self_approval?: boolean;
  auto_approve_admin?: boolean;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Initialize Supabase client
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    switch (req.method) {
      case 'GET': {
        // List workflows for an organization
        const { org_id, active_only } = req.query;

        if (!org_id || typeof org_id !== 'string') {
          return res.status(400).json({ error: 'org_id is required' });
        }

        // Verify user is a member of the organization
        const { data: membership } = await supabase
          .from('org_members')
          .select('*')
          .eq('org_id', org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied to this organization' });
        }

        let query = supabase
          .from('approval_workflows')
          .select(`
            *,
            creator:created_by(id, full_name, avatar_url)
          `)
          .eq('org_id', org_id)
          .order('created_at', { ascending: false });

        if (active_only === 'true') {
          query = query.eq('is_active', true);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching workflows:', error);
          return res.status(500).json({ error: 'Failed to fetch workflows' });
        }

        return res.status(200).json({ workflows: data || [] });
      }

      case 'POST': {
        // Create a new workflow
        const workflowData: WorkflowRequest = req.body;

        if (!workflowData.org_id || !workflowData.name || !workflowData.from_stage || !workflowData.to_stage) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        // Verify user is an admin of the organization
        const { data: membership } = await supabase
          .from('org_members')
          .select('*')
          .eq('org_id', workflowData.org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership || membership.role !== 'admin') {
          return res.status(403).json({ error: 'Only admins can create workflows' });
        }

        // Validate approval chain
        if (!workflowData.approval_chain || workflowData.approval_chain.length === 0) {
          return res.status(400).json({ error: 'approval_chain must have at least one level' });
        }

        // Check if an active workflow already exists for this transition
        const { data: existingWorkflow } = await supabase
          .from('approval_workflows')
          .select('id')
          .eq('org_id', workflowData.org_id)
          .eq('from_stage', workflowData.from_stage)
          .eq('to_stage', workflowData.to_stage)
          .eq('is_active', true)
          .single();

        if (existingWorkflow) {
          return res.status(409).json({
            error: 'An active workflow already exists for this stage transition',
            existing_workflow_id: existingWorkflow.id
          });
        }

        const { data: workflow, error } = await supabase
          .from('approval_workflows')
          .insert({
            org_id: workflowData.org_id,
            name: workflowData.name,
            description: workflowData.description,
            from_stage: workflowData.from_stage,
            to_stage: workflowData.to_stage,
            approval_chain: workflowData.approval_chain,
            is_active: workflowData.is_active ?? true,
            require_all_levels: workflowData.require_all_levels ?? true,
            allow_self_approval: workflowData.allow_self_approval ?? false,
            auto_approve_admin: workflowData.auto_approve_admin ?? false,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating workflow:', error);
          return res.status(500).json({ error: 'Failed to create workflow', details: error.message });
        }

        return res.status(201).json({ workflow });
      }

      case 'PATCH': {
        // Update a workflow
        const { id } = req.query;
        const updates = req.body;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'Workflow id is required' });
        }

        // Get the workflow to verify permissions
        const { data: workflow } = await supabase
          .from('approval_workflows')
          .select('org_id')
          .eq('id', id)
          .single();

        if (!workflow) {
          return res.status(404).json({ error: 'Workflow not found' });
        }

        // Verify user is an admin of the organization
        const { data: membership } = await supabase
          .from('org_members')
          .select('*')
          .eq('org_id', workflow.org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership || membership.role !== 'admin') {
          return res.status(403).json({ error: 'Only admins can update workflows' });
        }

        // If updating to active and changing stage transition, check for conflicts
        if (updates.is_active && (updates.from_stage || updates.to_stage)) {
          const { data: currentWorkflow } = await supabase
            .from('approval_workflows')
            .select('from_stage, to_stage')
            .eq('id', id)
            .single();

          if (currentWorkflow) {
            const fromStage = updates.from_stage || currentWorkflow.from_stage;
            const toStage = updates.to_stage || currentWorkflow.to_stage;

            const { data: conflictingWorkflow } = await supabase
              .from('approval_workflows')
              .select('id')
              .eq('org_id', workflow.org_id)
              .eq('from_stage', fromStage)
              .eq('to_stage', toStage)
              .eq('is_active', true)
              .neq('id', id)
              .single();

            if (conflictingWorkflow) {
              return res.status(409).json({
                error: 'An active workflow already exists for this stage transition'
              });
            }
          }
        }

        const { data: updatedWorkflow, error } = await supabase
          .from('approval_workflows')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('Error updating workflow:', error);
          return res.status(500).json({ error: 'Failed to update workflow' });
        }

        return res.status(200).json({ workflow: updatedWorkflow });
      }

      case 'DELETE': {
        // Delete a workflow
        const { id } = req.query;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'Workflow id is required' });
        }

        // Get the workflow to verify permissions
        const { data: workflow } = await supabase
          .from('approval_workflows')
          .select('org_id')
          .eq('id', id)
          .single();

        if (!workflow) {
          return res.status(404).json({ error: 'Workflow not found' });
        }

        // Verify user is an admin of the organization
        const { data: membership } = await supabase
          .from('org_members')
          .select('*')
          .eq('org_id', workflow.org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership || membership.role !== 'admin') {
          return res.status(403).json({ error: 'Only admins can delete workflows' });
        }

        // Check for pending approval requests
        const { data: pendingRequests, error: checkError } = await supabase
          .from('approval_requests')
          .select('id')
          .eq('workflow_id', id)
          .eq('status', 'pending')
          .limit(1);

        if (checkError) {
          console.error('Error checking pending requests:', checkError);
          return res.status(500).json({ error: 'Failed to check pending requests' });
        }

        if (pendingRequests && pendingRequests.length > 0) {
          return res.status(409).json({
            error: 'Cannot delete workflow with pending approval requests',
            suggestion: 'Deactivate the workflow instead'
          });
        }

        const { error } = await supabase
          .from('approval_workflows')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('Error deleting workflow:', error);
          return res.status(500).json({ error: 'Failed to delete workflow' });
        }

        return res.status(200).json({ success: true });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Approval workflows API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
