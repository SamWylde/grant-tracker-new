import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const VALID_STATUSES = ['researching', 'drafting', 'submitted', 'awarded', 'rejected', 'withdrawn'];

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
    if (req.method !== 'PATCH') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Extract grant ID from URL path
    const grantId = req.query.id as string;

    if (!grantId) {
      return res.status(400).json({ error: 'Grant ID is required' });
    }

    const { status, assigned_to, priority } = req.body;

    // Validate status if provided
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        validStatuses: VALID_STATUSES,
      });
    }

    // Build update object
    const updateData: any = {};
    if (status) updateData.status = status;
    if (assigned_to !== undefined) updateData.assigned_to = assigned_to;
    if (priority) updateData.priority = priority;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Update grant
    const { data, error } = await supabase
      .from('org_grants_saved')
      .update(updateData)
      .eq('id', grantId)
      .select()
      .single();

    if (error) {
      console.error('Error updating grant:', error);
      return res.status(500).json({ error: 'Failed to update grant' });
    }

    return res.status(200).json({ grant: data });
  } catch (error) {
    console.error('Error in grant status update API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
