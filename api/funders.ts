import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

interface FunderRequest {
  org_id: string;
  name: string;
  website?: string;
  description?: string;
  agency_code?: string;
  notes?: string;
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
        // List funders for an organization
        const { org_id, id } = req.query;

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

        if (id && typeof id === 'string') {
          // Get single funder with related data
          const { data: funder, error: funderError } = await supabase
            .from('funders')
            .select(`
              *,
              contacts:contacts(count),
              grants:org_grants_saved(count),
              interactions:funder_interactions(count)
            `)
            .eq('id', id)
            .eq('org_id', org_id)
            .single();

          if (funderError) {
            console.error('Error fetching funder:', funderError);
            return res.status(500).json({ error: 'Failed to fetch funder' });
          }

          if (!funder) {
            return res.status(404).json({ error: 'Funder not found' });
          }

          return res.status(200).json({ funder });
        } else {
          // List all funders
          const { data, error } = await supabase
            .from('funders')
            .select(`
              *,
              contacts:contacts(count),
              grants:org_grants_saved(count),
              interactions:funder_interactions(count)
            `)
            .eq('org_id', org_id)
            .order('name', { ascending: true });

          if (error) {
            console.error('Error fetching funders:', error);
            return res.status(500).json({ error: 'Failed to fetch funders' });
          }

          return res.status(200).json({ funders: data });
        }
      }

      case 'POST': {
        // Create a new funder
        const funderData = req.body as FunderRequest;

        if (!funderData.org_id || !funderData.name) {
          return res.status(400).json({
            error: 'Missing required fields: org_id, name'
          });
        }

        // Verify user is a member of the organization
        const { data: membership } = await supabase
          .from('org_members')
          .select('*')
          .eq('org_id', funderData.org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied to this organization' });
        }

        const { data, error } = await supabase
          .from('funders')
          .insert({
            org_id: funderData.org_id,
            name: funderData.name,
            website: funderData.website || null,
            description: funderData.description || null,
            agency_code: funderData.agency_code || null,
            notes: funderData.notes || null,
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating funder:', error);
          if (error.code === '23505') {
            return res.status(409).json({ error: 'A funder with this name already exists' });
          }
          return res.status(500).json({ error: 'Failed to create funder' });
        }

        return res.status(201).json({ funder: data });
      }

      case 'PATCH': {
        // Update an existing funder
        const { id } = req.query;
        const updates = req.body;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'id is required' });
        }

        // Verify the funder belongs to an organization the user is a member of
        const { data: funder } = await supabase
          .from('funders')
          .select('org_id')
          .eq('id', id)
          .single();

        if (!funder) {
          return res.status(404).json({ error: 'Funder not found' });
        }

        const { data: membership } = await supabase
          .from('org_members')
          .select('*')
          .eq('org_id', funder.org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied to this funder' });
        }

        // Build the update object
        const updateData: any = {};
        if (updates.name !== undefined) updateData.name = updates.name;
        if (updates.website !== undefined) updateData.website = updates.website;
        if (updates.description !== undefined) updateData.description = updates.description;
        if (updates.agency_code !== undefined) updateData.agency_code = updates.agency_code;
        if (updates.notes !== undefined) updateData.notes = updates.notes;

        const { data, error } = await supabase
          .from('funders')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('Error updating funder:', error);
          if (error.code === '23505') {
            return res.status(409).json({ error: 'A funder with this name already exists' });
          }
          return res.status(500).json({ error: 'Failed to update funder' });
        }

        return res.status(200).json({ funder: data });
      }

      case 'DELETE': {
        // Delete a funder
        const { id } = req.query;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'id is required' });
        }

        // Verify the funder belongs to an organization the user is a member of
        const { data: funder } = await supabase
          .from('funders')
          .select('org_id')
          .eq('id', id)
          .single();

        if (!funder) {
          return res.status(404).json({ error: 'Funder not found' });
        }

        const { data: membership } = await supabase
          .from('org_members')
          .select('*')
          .eq('org_id', funder.org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied to this funder' });
        }

        const { error } = await supabase
          .from('funders')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('Error deleting funder:', error);
          return res.status(500).json({ error: 'Failed to delete funder' });
        }

        return res.status(200).json({ message: 'Funder deleted successfully' });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in funders API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
