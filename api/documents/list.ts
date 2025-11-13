import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Document List API
 *
 * Lists documents for an organization, grant, or task
 * Supports filtering and pagination
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // Get auth token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const {
      org_id,
      grant_id,
      task_id,
      document_category,
      latest_only,
      limit = 50,
      offset = 0,
    } = req.query;

    if (!org_id) {
      return res.status(400).json({ error: 'org_id is required' });
    }

    // Verify user belongs to organization
    const { data: membership, error: membershipError } = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', org_id)
      .single();

    if (membershipError || !membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Build query
    let query = supabase
      .from('grant_documents')
      .select(`
        *,
        uploaded_by_user:uploaded_by (
          id,
          email
        )
      `)
      .eq('org_id', org_id)
      .is('deleted_at', null);

    // Apply filters
    if (grant_id) {
      query = query.eq('grant_id', grant_id);
    }

    if (task_id) {
      query = query.eq('task_id', task_id);
    }

    if (document_category) {
      query = query.eq('document_category', document_category);
    }

    if (latest_only === 'true') {
      query = query.eq('is_latest_version', true);
    }

    // Apply pagination and sorting
    query = query
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    const { data: documents, error: queryError, count } = await query;

    if (queryError) {
      console.error('Error fetching documents:', queryError);
      return res.status(500).json({
        error: 'Failed to fetch documents',
        details: queryError.message
      });
    }

    // Get total count
    const { count: totalCount, error: countError } = await supabase
      .from('grant_documents')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org_id)
      .is('deleted_at', null);

    return res.status(200).json({
      documents: documents || [],
      total: totalCount || 0,
      limit: Number(limit),
      offset: Number(offset),
    });

  } catch (error) {
    console.error('Document list error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
