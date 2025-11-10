import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

interface SavedGrantRequest {
  org_id: string;
  user_id: string;
  external_id: string;
  title: string;
  agency?: string;
  aln?: string;
  open_date?: string;
  close_date?: string;
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
        // List saved grants for an organization
        const { org_id } = req.query;

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

        const { data, error } = await supabase
          .from('org_grants_saved')
          .select('*')
          .eq('org_id', org_id)
          .order('saved_at', { ascending: false });

        if (error) {
          console.error('Error fetching saved grants:', error);
          return res.status(500).json({ error: 'Failed to fetch saved grants' });
        }

        return res.status(200).json({ grants: data });
      }

      case 'POST': {
        // Save a new grant
        const grantData = req.body as SavedGrantRequest;

        if (!grantData.org_id || !grantData.user_id || !grantData.external_id || !grantData.title) {
          return res.status(400).json({
            error: 'Missing required fields: org_id, user_id, external_id, title'
          });
        }

        // Verify user is a member of the organization
        const { data: membership } = await supabase
          .from('org_members')
          .select('*')
          .eq('org_id', grantData.org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied to this organization' });
        }

        // Ensure the user_id in the request matches the authenticated user
        if (grantData.user_id !== user.id) {
          return res.status(403).json({ error: 'Cannot save grants for other users' });
        }

        // Helper to convert MM/DD/YYYY to ISO format
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
            return dateStr; // Return as-is if format is unexpected
          } catch {
            return dateStr;
          }
        };

        const { data, error } = await supabase
          .from('org_grants_saved')
          .insert({
            org_id: grantData.org_id,
            user_id: grantData.user_id,
            external_source: 'grants.gov',
            external_id: grantData.external_id,
            title: grantData.title,
            agency: grantData.agency || null,
            aln: grantData.aln || null,
            open_date: convertToISO(grantData.open_date),
            close_date: convertToISO(grantData.close_date),
            status: 'researching', // Default to researching stage
          })
          .select()
          .single();

        if (error) {
          // Check for unique constraint violation (already saved)
          if (error.code === '23505') {
            return res.status(409).json({ error: 'Grant already saved' });
          }
          console.error('Error saving grant:', error);
          return res.status(500).json({
            error: 'Failed to save grant',
            details: error.message,
            code: error.code,
            hint: error.hint
          });
        }

        // Create default tasks for the grant
        try {
          const { error: tasksError } = await supabase.rpc('create_default_grant_tasks', {
            p_grant_id: data.id,
            p_org_id: grantData.org_id,
            p_user_id: grantData.user_id,
          });

          if (tasksError) {
            console.error('Error creating default tasks:', tasksError);
            // Don't fail the request if task creation fails, just log it
          }
        } catch (taskErr) {
          console.error('Exception creating default tasks:', taskErr);
          // Continue even if task creation fails
        }

        return res.status(201).json({ grant: data });
      }

      case 'DELETE': {
        // Delete a saved grant by ID
        const { id } = req.query;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'id is required' });
        }

        // Verify the grant belongs to an organization the user is a member of
        const { data: grant } = await supabase
          .from('org_grants_saved')
          .select('org_id')
          .eq('id', id)
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

        const { error } = await supabase
          .from('org_grants_saved')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('Error deleting saved grant:', error);
          return res.status(500).json({ error: 'Failed to delete saved grant' });
        }

        return res.status(200).json({ message: 'Grant removed from pipeline' });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in saved grants API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
