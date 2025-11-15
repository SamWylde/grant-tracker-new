import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

/**
 * Generates HTML email for approval request notifications
 */
function generateApprovalRequestEmailHTML(data: {
  requester_name: string;
  grant_title: string;
  from_stage: string;
  to_stage: string;
  request_notes?: string;
  org_name: string;
  approval_url: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Approval Required</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; border-bottom: 1px solid #e5e7eb;">
              <h1 style="margin: 0; font-size: 24px; color: #111827;">⏳ Approval Required</h1>
              <p style="margin: 8px 0 0; font-size: 16px; color: #6b7280;">
                ${data.requester_name} has requested approval for a grant stage transition.
              </p>
            </td>
          </tr>

          <!-- Request Details -->
          <tr>
            <td style="padding: 24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 8px 0;">
                    <strong style="color: #374151;">Grant:</strong>
                    <div style="margin-top: 4px; color: #111827;">${data.grant_title}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <strong style="color: #374151;">Stage Transition:</strong>
                    <div style="margin-top: 4px; color: #111827;">
                      <span style="padding: 4px 8px; background-color: #f3f4f6; border-radius: 4px;">${data.from_stage}</span>
                      →
                      <span style="padding: 4px 8px; background-color: #dcfce7; border-radius: 4px;">${data.to_stage}</span>
                    </div>
                  </td>
                </tr>
                ${data.request_notes ? `
                <tr>
                  <td style="padding: 8px 0;">
                    <strong style="color: #374151;">Request Notes:</strong>
                    <div style="margin-top: 4px; padding: 12px; background-color: #f9fafb; border-radius: 6px; color: #111827;">
                      ${data.request_notes}
                    </div>
                  </td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 24px 32px; text-align: center;">
              <a href="${data.approval_url}" style="display: inline-block; padding: 12px 32px; background-color: #7c3aed; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Review & Approve
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e5e7eb; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 14px; color: #6b7280; text-align: center;">
                You're receiving this email because you're an approver for ${data.org_name}.
                <br>
                <a href="https://grantcue.com/settings" style="color: #7c3aed; text-decoration: none;">Manage your settings</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Sends email notifications to approvers
 */
async function sendApprovalEmails(
  supabase: any,
  requestId: string,
  approverIds: string[]
) {
  if (!resendApiKey) {
    console.warn('[Approval Requests] RESEND_API_KEY not configured - skipping email notifications');
    return;
  }

  // Get request details
  const { data: request } = await supabase
    .from('approval_requests')
    .select(`
      *,
      requester:requested_by(full_name, email),
      grant:grant_id(title),
      organization:org_id(name)
    `)
    .eq('id', requestId)
    .single();

  if (!request) {
    console.error('[Approval Requests] Request not found for email notification');
    return;
  }

  // Get approver details
  const { data: approvers } = await supabase
    .from('user_profiles')
    .select('id, full_name, email')
    .in('id', approverIds);

  if (!approvers || approvers.length === 0) {
    console.warn('[Approval Requests] No approvers found for email notification');
    return;
  }

  const resend = new Resend(resendApiKey);
  const approvalUrl = `https://grantcue.com/pipeline?approval=${requestId}`;

  for (const approver of approvers) {
    if (!approver.email) {
      console.warn(`[Approval Requests] Skipping approver ${approver.id} - no email found`);
      continue;
    }

    try {
      await resend.emails.send({
        from: 'GrantCue Approvals <approvals@grantcue.com>',
        to: approver.email,
        subject: `Approval Required: ${request.grant?.title || 'Grant Application'}`,
        html: generateApprovalRequestEmailHTML({
          requester_name: request.requester?.full_name || 'A team member',
          grant_title: request.grant?.title || 'Grant Application',
          from_stage: request.from_stage,
          to_stage: request.to_stage,
          request_notes: request.request_notes,
          org_name: request.organization?.name || 'Your Organization',
          approval_url: approvalUrl,
        }),
      });

      console.log(`[Approval Requests] Email sent to ${approver.email} for request ${requestId}`);
    } catch (error) {
      console.error(`[Approval Requests] Failed to send email to ${approver.email}:`, error);
    // Import sanitizeError from error-handler
    const { sanitizeError } = await import('./utils/error-handler.js');
    }
  }
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
        // List approval requests
        const { org_id, status, grant_id, pending_for_user } = req.query;

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
          .from('approval_requests')
          .select(`
            *,
            workflow:workflow_id(name, approval_chain),
            grant:grant_id(id, title, status),
            requester:requested_by(id, full_name, avatar_url)
          `)
          .eq('org_id', org_id)
          .order('requested_at', { ascending: false });

        if (status && typeof status === 'string') {
          query = query.eq('status', status);
        }

        if (grant_id && typeof grant_id === 'string') {
          query = query.eq('grant_id', grant_id);
        }

        const { data: requests, error } = await query;

        if (error) {
          console.error('Error fetching approval requests:', error);
          return res.status(500).json({ error: 'Failed to fetch approval requests' });
        }

        // If pending_for_user is requested, filter to requests where user can approve
        if (pending_for_user === 'true' && requests) {
          const { data: userApprovals } = await supabase
            .from('approval_request_approvers')
            .select('request_id')
            .eq('user_id', user.id)
            .eq('has_approved', false);

          const pendingRequestIds = new Set(userApprovals?.map((a: any) => a.request_id) || []);
          const filteredRequests = requests.filter((r: any) =>
            r.status === 'pending' && pendingRequestIds.has(r.id)
          );

          return res.status(200).json({ requests: filteredRequests });
        }

        return res.status(200).json({ requests: requests || [] });
      }

      case 'POST': {
        // Create a new approval request
        const { grant_id, from_stage, to_stage, request_notes } = req.body;

        if (!grant_id || !from_stage || !to_stage) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        // Get the grant and verify access
        const { data: grant } = await supabase
          .from('org_grants_saved')
          .select('org_id, status')
          .eq('id', grant_id)
          .single();

        if (!grant) {
          return res.status(404).json({ error: 'Grant not found' });
        }

        // Verify user is a member of the organization
        const { data: membership } = await supabase
          .from('org_members')
          .select('*')
          .eq('org_id', grant.org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied to this grant' });
        }

        // Verify the grant is currently in the from_stage
        if (grant.status !== from_stage) {
          return res.status(400).json({
            error: `Grant is not in ${from_stage} stage. Current stage: ${grant.status}`
          });
        }

        // Find applicable workflow
        const { data: workflow } = await supabase
          .from('approval_workflows')
          .select('*')
          .eq('org_id', grant.org_id)
          .eq('from_stage', from_stage)
          .eq('to_stage', to_stage)
          .eq('is_active', true)
          .single();

        if (!workflow) {
          return res.status(404).json({
            error: 'No active workflow found for this stage transition',
            suggestion: 'The stage change may not require approval'
          });
        }

        // Check if user is admin and workflow allows auto-approval
        if (workflow.auto_approve_admin && membership.role === 'admin') {
          // Auto-approve: directly update grant status
          const { error: updateError } = await supabase
            .from('org_grants_saved')
            .update({ status: to_stage })
            .eq('id', grant_id);

          if (updateError) {
            console.error('Error auto-approving grant:', updateError);
            return res.status(500).json({ error: 'Failed to update grant status' });
          }

          return res.status(200).json({
            auto_approved: true,
            message: 'Stage transition auto-approved for admin'
          });
        }

        // Check for existing pending request
        const { data: existingRequest } = await supabase
          .from('approval_requests')
          .select('id')
          .eq('grant_id', grant_id)
          .eq('status', 'pending')
          .single();

        if (existingRequest) {
          return res.status(409).json({
            error: 'A pending approval request already exists for this grant',
            request_id: existingRequest.id
          });
        }

        // Create approval request (trigger will create approvers)
        const { data: request, error: createError } = await supabase
          .from('approval_requests')
          .insert({
            org_id: grant.org_id,
            workflow_id: workflow.id,
            grant_id,
            requested_by: user.id,
            from_stage,
            to_stage,
            request_notes,
            current_approval_level: 1,
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating approval request:', createError);
          return res.status(500).json({ error: 'Failed to create approval request' });
        }

        // Get approvers for email notification
        const { data: approvers } = await supabase
          .from('approval_request_approvers')
          .select('user_id')
          .eq('request_id', request.id)
          .eq('approval_level', 1);

        if (approvers && approvers.length > 0) {
          // Send email notifications asynchronously
          sendApprovalEmails(
            supabase,
            request.id,
            approvers.map((a: any) => a.user_id)
          ).catch(error => {
            console.error('Error sending approval emails:', error);
          });
        }

        return res.status(201).json({ request });
      }

      case 'PATCH': {
        // Approve or reject a request
        const { id } = req.query;
        const { decision, comments } = req.body;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'Request id is required' });
        }

        if (!decision || !['approved', 'rejected'].includes(decision)) {
          return res.status(400).json({ error: 'Valid decision (approved/rejected) is required' });
        }

        // Get the request
        const { data: request } = await supabase
          .from('approval_requests')
          .select(`
            *,
            workflow:workflow_id(*)
          `)
          .eq('id', id)
          .single();

        if (!request) {
          return res.status(404).json({ error: 'Approval request not found' });
        }

        // Verify user is a member of the organization
        const { data: membership } = await supabase
          .from('org_members')
          .select('*')
          .eq('org_id', request.org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied' });
        }

        // Check if request is still pending
        if (request.status !== 'pending') {
          return res.status(400).json({
            error: `Request is already ${request.status}`
          });
        }

        // Check if request has expired
        if (request.expires_at && new Date(request.expires_at) < new Date()) {
          // Auto-cancel expired request
          await supabase
            .from('approval_requests')
            .update({
              status: 'cancelled',
              completed_at: new Date().toISOString()
            })
            .eq('id', id);

          return res.status(400).json({ error: 'Request has expired' });
        }

        // Get user's approver record
        const { data: approverRecord } = await supabase
          .from('approval_request_approvers')
          .select('*')
          .eq('request_id', id)
          .eq('user_id', user.id)
          .eq('approval_level', request.current_approval_level)
          .single();

        if (!approverRecord) {
          return res.status(403).json({
            error: 'You are not an approver for this request at the current level'
          });
        }

        if (approverRecord.has_approved) {
          return res.status(400).json({ error: 'You have already provided your decision' });
        }

        // Record the approval/rejection
        await supabase
          .from('approval_request_approvers')
          .update({
            has_approved: true,
            approved_at: new Date().toISOString(),
            decision,
            comments,
          })
          .eq('id', approverRecord.id);

        // Update approvals array in request
        const newApproval = {
          level: request.current_approval_level,
          user_id: user.id,
          decision,
          comments,
          timestamp: new Date().toISOString(),
        };

        const updatedApprovals = [...(request.approvals || []), newApproval];

        if (decision === 'rejected') {
          // Rejection: mark request as rejected
          await supabase
            .from('approval_requests')
            .update({
              status: 'rejected',
              approvals: updatedApprovals,
              rejection_reason: comments,
              completed_at: new Date().toISOString(),
            })
            .eq('id', id);

          return res.status(200).json({
            decision: 'rejected',
            message: 'Approval request rejected'
          });
        }

        // Approval: check if we need more approvals at this level
        const approvalChain = request.workflow.approval_chain;
        const currentLevel = approvalChain.find((l: any) => l.level === request.current_approval_level);

        if (!currentLevel) {
          return res.status(500).json({ error: 'Invalid approval chain configuration' });
        }

        // Count approvals at current level
        const { count: approvalsCount } = await supabase
          .from('approval_request_approvers')
          .select('*', { count: 'exact', head: true })
          .eq('request_id', id)
          .eq('approval_level', request.current_approval_level)
          .eq('has_approved', true)
          .eq('decision', 'approved');

        const requiredApprovals = currentLevel.required_approvers || 1;

        if ((approvalsCount || 0) >= requiredApprovals) {
          // Current level is complete
          const nextLevel = approvalChain.find((l: any) => l.level === request.current_approval_level + 1);

          if (nextLevel && request.workflow.require_all_levels) {
            // Move to next level
            await supabase
              .from('approval_requests')
              .update({
                approvals: updatedApprovals,
                current_approval_level: request.current_approval_level + 1,
              })
              .eq('id', id);

            // Get next level approvers for email
            const { data: nextApprovers } = await supabase
              .from('approval_request_approvers')
              .select('user_id')
              .eq('request_id', id)
              .eq('approval_level', request.current_approval_level + 1);

            if (nextApprovers && nextApprovers.length > 0) {
              sendApprovalEmails(
                supabase,
                id,
                nextApprovers.map((a: any) => a.user_id)
              ).catch(error => {
                console.error('Error sending approval emails:', error);
              });
            }

            return res.status(200).json({
              decision: 'approved',
              message: 'Approval recorded, moved to next level',
              next_level: request.current_approval_level + 1
            });
          } else {
            // All levels complete: approve the request and update grant status
            await supabase
              .from('approval_requests')
              .update({
                status: 'approved',
                approvals: updatedApprovals,
                completed_at: new Date().toISOString(),
              })
              .eq('id', id);

            // Update grant status
            const { error: updateError } = await supabase
              .from('org_grants_saved')
              .update({ status: request.to_stage })
              .eq('id', request.grant_id);

            if (updateError) {
              console.error('Error updating grant status:', updateError);
              return res.status(500).json({
                error: 'Request approved but failed to update grant status',
                details: sanitizeError(updateError)
              });
            }

            return res.status(200).json({
              decision: 'approved',
              message: 'Request fully approved, grant status updated',
              new_stage: request.to_stage
            });
          }
        } else {
          // Still need more approvals at current level
          await supabase
            .from('approval_requests')
            .update({
              approvals: updatedApprovals,
            })
            .eq('id', id);

          return res.status(200).json({
            decision: 'approved',
            message: `Approval recorded (${(approvalsCount || 0)}/${requiredApprovals} required)`,
            approvals_count: approvalsCount,
            required_approvals: requiredApprovals
          });
        }
      }

      case 'DELETE': {
        // Cancel an approval request
        const { id } = req.query;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'Request id is required' });
        }

        // Get the request
        const { data: request } = await supabase
          .from('approval_requests')
          .select('org_id, requested_by, status')
          .eq('id', id)
          .single();

        if (!request) {
          return res.status(404).json({ error: 'Approval request not found' });
        }

        // Verify user is the requester or an admin
        const { data: membership } = await supabase
          .from('org_members')
          .select('*')
          .eq('org_id', request.org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied' });
        }

        if (request.requested_by !== user.id && membership.role !== 'admin') {
          return res.status(403).json({
            error: 'Only the requester or an admin can cancel this request'
          });
        }

        if (request.status !== 'pending') {
          return res.status(400).json({
            error: `Cannot cancel a request that is already ${request.status}`
          });
        }

        // Cancel the request
        const { error } = await supabase
          .from('approval_requests')
          .update({
            status: 'cancelled',
            completed_at: new Date().toISOString()
          })
          .eq('id', id);

        if (error) {
          console.error('Error cancelling request:', error);
          return res.status(500).json({ error: 'Failed to cancel request' });
        }

        return res.status(200).json({ success: true });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Approval requests API error:', error);
    // Import sanitizeError from error-handler
    const { sanitizeError } = await import('./utils/error-handler.js');
    return res.status(500).json({
      error: sanitizeError(error, 'approval-requests'),
    });
  }
}
