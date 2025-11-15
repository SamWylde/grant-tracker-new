import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

interface ImportGrant {
  org_id: string;
  user_id: string;
  external_id: string;
  external_source?: string;
  title: string;
  agency?: string | null;
  aln?: string | null;
  open_date?: string | null;
  close_date?: string | null;
  status?: string;
  priority?: string;
  assigned_to?: string | null;
  notes?: string | null;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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
    const { grants, org_id, user_id } = req.body as {
      grants: ImportGrant[];
      org_id: string;
      user_id: string;
    };

    if (!grants || !Array.isArray(grants)) {
      return res.status(400).json({ error: 'grants must be an array' });
    }

    if (!org_id || !user_id) {
      return res.status(400).json({ error: 'org_id and user_id are required' });
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

    // Ensure the user_id matches authenticated user
    if (user_id !== user.id) {
      return res.status(403).json({ error: 'Cannot import grants for other users' });
    }

    // Helper to convert date strings to ISO format
    const convertToISO = (dateStr: string | undefined | null): string | null => {
      if (!dateStr) return null;
      try {
        // If already in ISO format, return as-is
        if (dateStr.includes('T') || dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
          return dateStr;
        }
        // Convert MM/DD/YYYY to YYYY-MM-DD
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const [month, day, year] = parts;
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return dateStr;
      } catch {
        return dateStr;
      }
    };

    // Prepare grants for insert
    const grantsToInsert = grants.map(grant => ({
      org_id,
      user_id,
      external_source: grant.external_source || 'import',
      external_id: grant.external_id,
      title: grant.title,
      agency: grant.agency || null,
      aln: grant.aln || null,
      open_date: convertToISO(grant.open_date),
      close_date: convertToISO(grant.close_date),
      status: grant.status || 'researching',
      priority: grant.priority || 'medium',
      assigned_to: grant.assigned_to || null,
      notes: grant.notes || null,
    }));

    // Bulk insert grants
    const { data, error } = await supabase
      .from('org_grants_saved')
      .insert(grantsToInsert)
      .select();

    if (error) {
      console.error('Error importing grants:', error);

      // Handle duplicate grants gracefully
      if (error.code === '23505') {
        return res.status(409).json({
          error: 'Some grants already exist',
          details: sanitizeError(error),
        });
      }

      return res.status(500).json({
        error: 'Failed to import grants',
        details: sanitizeError(error),
        code: error.code,
      });
    }

    // Create default tasks for each grant (optional, in background)
    const taskCreationPromises = (data || []).map(async (grant) => {
      try {
        await supabase.rpc('create_default_grant_tasks', {
          p_grant_id: grant.id,
          p_org_id: org_id,
          p_user_id: user_id,
        });
      } catch (err) {
        console.error(`Failed to create tasks for grant ${grant.id}:`, err);
    // Import sanitizeError from error-handler
    const { sanitizeError } = await import('./utils/error-handler.js');
        // Don't fail the import if task creation fails
      }
    });

    // Don't await task creation - let it happen in background
    Promise.all(taskCreationPromises);

    return res.status(201).json({
      success: true,
      imported: data?.length || 0,
      grants: data,
    });
  } catch (error) {
    console.error('Error in import API:', error);
    // Import sanitizeError from error-handler
    const { sanitizeError } = await import('./utils/error-handler.js');
    return res.status(500).json({
      error: sanitizeError(error, 'import'),
    });
  }
}
