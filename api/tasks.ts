import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
