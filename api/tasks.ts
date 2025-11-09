import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
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

  try {
    switch (req.method) {
      case 'GET': {
        // List tasks for a grant
        const { grant_id, org_id } = req.query;

        if (!grant_id || typeof grant_id !== 'string') {
          return res.status(400).json({ error: 'grant_id is required' });
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
