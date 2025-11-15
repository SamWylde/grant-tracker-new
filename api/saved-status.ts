import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { setCorsHeaders } from './utils/cors.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const VALID_STATUSES = [
  'researching',
  'go-no-go',
  'drafting',
  'submitted',
  'awarded',
  'not-funded',
  'closed-out',
  'rejected',
  'withdrawn',
  'archived'
];

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set secure CORS headers based on whitelisted origins
  setCorsHeaders(res, req.headers.origin);

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

    // Extract grant ID from query parameter
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
      console.error('[status API] Grant fetch error:', grantError, 'grantId:', grantId);
      return res.status(404).json({ error: 'Grant not found' });
    }

    // Check if org_id is valid
    if (!grant.org_id) {
      console.error('[status API] Grant missing org_id:', { grantId, grant });
      return res.status(400).json({
        error: 'Grant is missing organization ID. Please contact support.',
        details: 'This grant has no associated organization and cannot be updated.'
      });
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

    const { status, assigned_to, priority, close_date, loi_deadline, internal_deadline } = req.body;

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
    if (close_date !== undefined) updateData.close_date = close_date;
    if (loi_deadline !== undefined) updateData.loi_deadline = loi_deadline;
    if (internal_deadline !== undefined) updateData.internal_deadline = internal_deadline;

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
