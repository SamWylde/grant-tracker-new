import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const VALID_STATUSES = ['researching', 'drafting', 'submitted', 'awarded', 'rejected', 'withdrawn'];

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
    if (req.method !== 'PATCH') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Extract grant ID from URL path
    const grantId = req.query.id as string;

    if (!grantId) {
      return res.status(400).json({ error: 'Grant ID is required' });
    }

    // Verify the grant belongs to an organization the user is a member of
    const { data: grant, error: grantError } = await supabase
      .from('org_grants_saved')
      .select('org_id')
      .eq('id', grantId)
      .single();

    if (grantError || !grant) {
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
