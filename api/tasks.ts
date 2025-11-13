import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { generateTaskAssignmentEmail } from '../lib/emails/task-assignment-template';
import { sendNotifications, getAssignedUserName } from './utils/notifications.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

interface TaskRequest {
  grant_id: string;
  org_id: string;
  title: string;
  description?: string;
  task_type?: string;
  status?: string;
  assigned_to?: string;
  due_date?: string;
  position?: number;
  is_required?: boolean;
  notes?: string;
  created_by: string;
}

/**
 * Sends task assignment email notification
 */
async function sendTaskAssignmentEmail(
  supabase: any,
  taskId: string,
  assigneeId: string,
  assignerId: string,
  isReassignment: boolean = false
) {
  if (!resendApiKey) {
    console.warn('[Task Assignment] RESEND_API_KEY not configured - skipping email notification');
    return;
  }

  try {
    // Get task details with grant information
    const { data: task } = await supabase
      .from('grant_tasks')
      .select(`
        id,
        title,
        description,
        due_date,
        grant_id,
        org_grants_saved!inner(
          id,
          title
        ),
        org_id
      `)
      .eq('id', taskId)
      .single();

    if (!task) {
      console.error('[Task Assignment] Task not found for email notification');
      return;
    }

    // Get assignee details (email from auth.users, name from user_profiles)
    const { data: assignee } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .eq('id', assigneeId)
      .single();

    const { data: assigneeAuth } = await supabase.auth.admin.getUserById(assigneeId);

    if (!assigneeAuth?.user?.email) {
      console.warn(`[Task Assignment] Skipping email - assignee ${assigneeId} has no email`);
      return;
    }

    // Get assigner details
    const { data: assigner } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .eq('id', assignerId)
      .single();

    const { data: assignerAuth } = await supabase.auth.admin.getUserById(assignerId);

    // Get organization name
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', task.org_id)
      .single();

    const resend = new Resend(resendApiKey);

    await resend.emails.send({
      from: 'GrantCue Tasks <tasks@grantcue.com>',
      to: assigneeAuth.user.email,
      subject: `${isReassignment ? 'Task Reassigned' : 'New Task Assigned'}: ${task.title}`,
      html: generateTaskAssignmentEmail({
        assignee_name: assignee?.full_name || assigneeAuth.user.email,
        assigner_name: assigner?.full_name || assignerAuth?.user?.email || 'A team member',
        task_title: task.title,
        task_description: task.description,
        task_due_date: task.due_date,
        grant_title: task.org_grants_saved.title,
        grant_id: task.grant_id,
        task_id: task.id,
        org_name: org?.name || 'Your Organization',
        is_reassignment: isReassignment,
      }),
    });

    console.log(`[Task Assignment] Email sent to ${assigneeAuth.user.email} for task "${task.title}"`);
  } catch (error) {
    console.error('[Task Assignment] Failed to send email notification:', error);
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
        // List tasks for a grant
        const { grant_id, org_id } = req.query;

        if (!grant_id || typeof grant_id !== 'string') {
          return res.status(400).json({ error: 'grant_id is required' });
        }

        // Verify the grant belongs to an organization the user is a member of
        const { data: grant } = await supabase
          .from('org_grants_saved')
          .select('org_id')
          .eq('id', grant_id)
          .single();

        if (!grant) {
          return res.status(404).json({ error: 'Grant not found' });
        }

        const { data: membership } = await supabase
          .from('org_members')
          .select('*')
          .eq('org_id', grant.org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied to this grant' });
        }

        const query = supabase
          .from('grant_tasks')
          .select('*')
          .eq('grant_id', grant_id)
          .order('position', { ascending: true });

        if (org_id && typeof org_id === 'string') {
          query.eq('org_id', org_id);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching tasks:', error);
          return res.status(500).json({ error: 'Failed to fetch tasks' });
        }

        return res.status(200).json({ tasks: data });
      }

      case 'POST': {
        // Create a new task
        const taskData = req.body as TaskRequest;

        if (!taskData.grant_id || !taskData.org_id || !taskData.title || !taskData.created_by) {
          return res.status(400).json({
            error: 'Missing required fields: grant_id, org_id, title, created_by'
          });
        }

        // Verify user is a member of the organization
        const { data: membership } = await supabase
          .from('org_members')
          .select('*')
          .eq('org_id', taskData.org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied to this organization' });
        }

        // Ensure the created_by matches the authenticated user
        if (taskData.created_by !== user.id) {
          return res.status(403).json({ error: 'Cannot create tasks for other users' });
        }

        const { data, error } = await supabase
          .from('grant_tasks')
          .insert({
            grant_id: taskData.grant_id,
            org_id: taskData.org_id,
            title: taskData.title,
            description: taskData.description || null,
            task_type: taskData.task_type || 'custom',
            status: taskData.status || 'pending',
            assigned_to: taskData.assigned_to || null,
            due_date: taskData.due_date || null,
            position: taskData.position || 0,
            is_required: taskData.is_required || false,
            notes: taskData.notes || null,
            created_by: taskData.created_by,
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating task:', error);
          return res.status(500).json({ error: 'Failed to create task' });
        }

        // Send email notification if task is assigned to someone
        if (data.assigned_to) {
          sendTaskAssignmentEmail(
            supabase,
            data.id,
            data.assigned_to,
            user.id,
            false
          ).catch(error => {
            console.error('Error sending task assignment email:', error);
          });

          // Send webhook/Slack/Teams notifications
          (async () => {
            try {
              const { data: grant } = await supabase
                .from('org_grants_saved')
                .select('title, agency, close_date')
                .eq('id', taskData.grant_id)
                .single();

              if (grant) {
                const assignedUserName = await getAssignedUserName(data.assigned_to);
                const origin = req.headers.origin || 'https://grantcue.com';

                await sendNotifications({
                  event: 'grant.task_assigned',
                  org_id: taskData.org_id,
                  grant_id: taskData.grant_id,
                  grant_title: grant.title,
                  grant_agency: grant.agency,
                  grant_deadline: grant.close_date,
                  task_id: data.id,
                  task_title: data.title,
                  assigned_to_id: data.assigned_to,
                  assigned_to_name: assignedUserName || 'Unknown User',
                  action_url: `${origin}/grants/${taskData.grant_id}`,
                });
              }
            } catch (notificationError) {
              console.error('Error sending task assignment notifications:', notificationError);
            }
          })();
        }

        return res.status(201).json({ task: data });
      }

      case 'PATCH': {
        // Update an existing task
        const { id } = req.query;
        const updates = req.body;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'id is required' });
        }

        // Verify the task belongs to an organization the user is a member of
        const { data: task } = await supabase
          .from('grant_tasks')
          .select('org_id, assigned_to, grant_id')
          .eq('id', id)
          .single();

        if (!task) {
          return res.status(404).json({ error: 'Task not found' });
        }

        const { data: membership } = await supabase
          .from('org_members')
          .select('*')
          .eq('org_id', task.org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied to this task' });
        }

        // Track if assignment is changing
        const oldAssignedTo = task.assigned_to;
        const newAssignedTo = updates.assigned_to;
        const isAssignmentChange = newAssignedTo !== undefined && newAssignedTo !== oldAssignedTo;
        const isNewAssignment = isAssignmentChange && !oldAssignedTo && newAssignedTo;
        const isReassignment = isAssignmentChange && oldAssignedTo && newAssignedTo;

        // Build the update object
        const updateData: any = {};
        if (updates.title !== undefined) updateData.title = updates.title;
        if (updates.description !== undefined) updateData.description = updates.description;
        if (updates.task_type !== undefined) updateData.task_type = updates.task_type;
        if (updates.status !== undefined) updateData.status = updates.status;
        if (updates.assigned_to !== undefined) updateData.assigned_to = updates.assigned_to;
        if (updates.due_date !== undefined) updateData.due_date = updates.due_date;
        if (updates.position !== undefined) updateData.position = updates.position;
        if (updates.is_required !== undefined) updateData.is_required = updates.is_required;
        if (updates.notes !== undefined) updateData.notes = updates.notes;

        const { data, error } = await supabase
          .from('grant_tasks')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('Error updating task:', error);
          return res.status(500).json({ error: 'Failed to update task' });
        }

        // Send email notification if task assignment changed
        if ((isNewAssignment || isReassignment) && newAssignedTo) {
          sendTaskAssignmentEmail(
            supabase,
            id,
            newAssignedTo,
            user.id,
            isReassignment
          ).catch(error => {
            console.error('Error sending task assignment email:', error);
          });

          // Send webhook/Slack/Teams notifications
          (async () => {
            try {
              const { data: grant } = await supabase
                .from('org_grants_saved')
                .select('title, agency, close_date')
                .eq('id', task.grant_id)
                .single();

              if (grant) {
                const assignedUserName = await getAssignedUserName(newAssignedTo);
                const origin = req.headers.origin || 'https://grantcue.com';

                await sendNotifications({
                  event: 'grant.task_assigned',
                  org_id: task.org_id,
                  grant_id: task.grant_id,
                  grant_title: grant.title,
                  grant_agency: grant.agency,
                  grant_deadline: grant.close_date,
                  task_id: data.id,
                  task_title: data.title,
                  assigned_to_id: newAssignedTo,
                  assigned_to_name: assignedUserName || 'Unknown User',
                  action_url: `${origin}/grants/${task.grant_id}`,
                });
              }
            } catch (notificationError) {
              console.error('Error sending task assignment notifications:', notificationError);
            }
          })();
        }

        return res.status(200).json({ task: data });
      }

      case 'DELETE': {
        // Delete a task
        const { id } = req.query;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'id is required' });
        }

        // Verify the task belongs to an organization the user is a member of
        const { data: task } = await supabase
          .from('grant_tasks')
          .select('org_id')
          .eq('id', id)
          .single();

        if (!task) {
          return res.status(404).json({ error: 'Task not found' });
        }

        const { data: membership } = await supabase
          .from('org_members')
          .select('*')
          .eq('org_id', task.org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied to this task' });
        }

        const { error } = await supabase
          .from('grant_tasks')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('Error deleting task:', error);
          return res.status(500).json({ error: 'Failed to delete task' });
        }

        return res.status(200).json({ message: 'Task deleted successfully' });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in tasks API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
