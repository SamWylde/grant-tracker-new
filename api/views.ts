import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

interface SavedView {
  id?: string;
  org_id: string;
  created_by: string;
  name: string;
  description?: string;
  keyword?: string;
  category?: string;
  agency?: string;
  status_posted?: boolean;
  status_forecasted?: boolean;
  due_in_days?: number;
  sort_by?: string;
  is_shared?: boolean;
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
        // List saved views for an organization
        const { org_id, user_id } = req.query;

        if (!org_id || typeof org_id !== 'string') {
          return res.status(400).json({ error: 'org_id is required' });
        }

        if (!user_id || typeof user_id !== 'string') {
          return res.status(400).json({ error: 'user_id is required' });
        }

        // Get views that are either created by user or shared within org
        const { data, error } = await supabase
          .from('saved_views')
          .select('*')
          .eq('org_id', org_id)
          .or(`created_by.eq.${user_id},and(is_shared.eq.true)`)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching saved views:', error);
          return res.status(500).json({ error: 'Failed to fetch saved views' });
        }

        return res.status(200).json({ views: data });
      }

      case 'POST': {
        // Create a new saved view
        const viewData = req.body as SavedView;

        if (!viewData.org_id || !viewData.created_by || !viewData.name) {
          return res.status(400).json({
            error: 'Missing required fields: org_id, created_by, name'
          });
        }

        const { data, error } = await supabase
          .from('saved_views')
          .insert({
            org_id: viewData.org_id,
            created_by: viewData.created_by,
            name: viewData.name,
            description: viewData.description || null,
            keyword: viewData.keyword || null,
            category: viewData.category || null,
            agency: viewData.agency || null,
            status_posted: viewData.status_posted !== undefined ? viewData.status_posted : true,
            status_forecasted: viewData.status_forecasted !== undefined ? viewData.status_forecasted : true,
            due_in_days: viewData.due_in_days || null,
            sort_by: viewData.sort_by || 'due_soon',
            is_shared: viewData.is_shared || false,
          })
          .select()
          .single();

        if (error) {
          // Check for unique constraint violation (name already exists)
          if (error.code === '23505') {
            return res.status(409).json({ error: 'A view with this name already exists' });
          }
          console.error('Error creating saved view:', error);
          return res.status(500).json({ error: 'Failed to create saved view' });
        }

        return res.status(201).json({ view: data });
      }

      case 'PUT': {
        // Update a saved view
        const { id } = req.query;
        const viewData = req.body as SavedView;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'id is required' });
        }

        const { data, error } = await supabase
          .from('saved_views')
          .update({
            name: viewData.name,
            description: viewData.description,
            keyword: viewData.keyword,
            category: viewData.category,
            agency: viewData.agency,
            status_posted: viewData.status_posted,
            status_forecasted: viewData.status_forecasted,
            due_in_days: viewData.due_in_days,
            sort_by: viewData.sort_by,
            is_shared: viewData.is_shared,
            use_count: viewData.is_shared ? supabase.sql`use_count + 1` : undefined,
            last_used_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('Error updating saved view:', error);
          return res.status(500).json({ error: 'Failed to update saved view' });
        }

        return res.status(200).json({ view: data });
      }

      case 'DELETE': {
        // Delete a saved view
        const { id } = req.query;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'id is required' });
        }

        const { error } = await supabase
          .from('saved_views')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('Error deleting saved view:', error);
          return res.status(500).json({ error: 'Failed to delete saved view' });
        }

        return res.status(200).json({ message: 'Saved view deleted' });
      }

      case 'PATCH': {
        // Increment use_count for a saved view
        const { id } = req.query;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'id is required' });
        }

        const { error } = await supabase.rpc('increment_view_use_count', {
          view_id: id
        });

        // If RPC doesn't exist, fallback to regular update
        if (error) {
          const { error: updateError } = await supabase
            .from('saved_views')
            .update({
              use_count: supabase.sql`use_count + 1`,
              last_used_at: new Date().toISOString(),
            })
            .eq('id', id);

          if (updateError) {
            console.error('Error incrementing view use count:', updateError);
            return res.status(500).json({ error: 'Failed to update view usage' });
          }
        }

        return res.status(200).json({ message: 'View usage tracked' });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in saved views API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
