import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

interface RecentSearch {
  org_id: string;
  user_id: string;
  keyword?: string;
  category?: string;
  agency?: string;
  status_posted?: boolean;
  status_forecasted?: boolean;
  due_in_days?: number;
  sort_by?: string;
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
    return res.status(401).json({ error: 'Unauthorized - Missing or invalid authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');

  // Verify the JWT token and get user
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }

  try {
    switch (req.method) {
      case 'GET': {
        // List recent searches for a user
        const { org_id, user_id, limit = '10' } = req.query;

        if (!org_id || typeof org_id !== 'string') {
          return res.status(400).json({ error: 'org_id is required' });
        }

        if (!user_id || typeof user_id !== 'string') {
          return res.status(400).json({ error: 'user_id is required' });
        }

        // Verify user belongs to the organization
        const { data: membership, error: membershipError } = await supabase
          .from('org_members')
          .select('id')
          .eq('org_id', org_id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (membershipError || !membership) {
          return res.status(403).json({ error: 'Forbidden - User is not a member of this organization' });
        }

        // Verify user is accessing their own data or is admin
        if (user_id !== user.id) {
          return res.status(403).json({ error: 'Forbidden - Cannot access another user\'s data' });
        }

        const limitNum = parseInt(limit as string, 10);

        const { data, error } = await supabase
          .from('recent_searches')
          .select('*')
          .eq('org_id', org_id)
          .eq('user_id', user_id)
          .order('last_used_at', { ascending: false })
          .limit(limitNum);

        if (error) {
          console.error('Error fetching recent searches:', error);
          return res.status(500).json({ error: 'Failed to fetch recent searches' });
        }

        return res.status(200).json({ searches: data });
      }

      case 'POST': {
        // Add or update a recent search
        const searchData = req.body as RecentSearch;

        if (!searchData.org_id || !searchData.user_id) {
          return res.status(400).json({
            error: 'Missing required fields: org_id, user_id'
          });
        }

        // Verify user belongs to the organization
        const { data: membership, error: membershipError } = await supabase
          .from('org_members')
          .select('id')
          .eq('org_id', searchData.org_id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (membershipError || !membership) {
          return res.status(403).json({ error: 'Forbidden - User is not a member of this organization' });
        }

        // Verify user is saving their own data
        if (searchData.user_id !== user.id) {
          return res.status(403).json({ error: 'Forbidden - Cannot save data for another user' });
        }

        // Try to find existing search with same parameters
        const { data: existing, error: findError } = await supabase
          .from('recent_searches')
          .select('*')
          .eq('org_id', searchData.org_id)
          .eq('user_id', searchData.user_id)
          .eq('keyword', searchData.keyword || '')
          .eq('category', searchData.category || '')
          .eq('agency', searchData.agency || '')
          .eq('status_posted', searchData.status_posted !== undefined ? searchData.status_posted : true)
          .eq('status_forecasted', searchData.status_forecasted !== undefined ? searchData.status_forecasted : true)
          .eq('due_in_days', searchData.due_in_days || 0)
          .eq('sort_by', searchData.sort_by || 'due_soon')
          .maybeSingle();

        if (findError && findError.code !== 'PGRST116') {
          console.error('Error finding existing search:', findError);
          return res.status(500).json({ error: 'Failed to check existing searches' });
        }

        if (existing) {
          // Update existing search
          const { data, error } = await supabase
            .from('recent_searches')
            .update({
              search_count: existing.search_count + 1,
              last_used_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
            .select()
            .single();

          if (error) {
            console.error('Error updating recent search:', error);
            return res.status(500).json({ error: 'Failed to update recent search' });
          }

          return res.status(200).json({ search: data });
        } else {
          // Create new search
          const { data, error } = await supabase
            .from('recent_searches')
            .insert({
              org_id: searchData.org_id,
              user_id: searchData.user_id,
              keyword: searchData.keyword || null,
              category: searchData.category || null,
              agency: searchData.agency || null,
              status_posted: searchData.status_posted !== undefined ? searchData.status_posted : true,
              status_forecasted: searchData.status_forecasted !== undefined ? searchData.status_forecasted : true,
              due_in_days: searchData.due_in_days || null,
              sort_by: searchData.sort_by || 'due_soon',
            })
            .select()
            .single();

          if (error) {
            console.error('Error creating recent search:', error);
            return res.status(500).json({ error: 'Failed to save recent search' });
          }

          return res.status(201).json({ search: data });
        }
      }

      case 'DELETE': {
        // Delete a recent search or clear all for user
        const { id, org_id, user_id, clear_all } = req.query;

        if (clear_all === 'true') {
          if (!org_id || typeof org_id !== 'string' || !user_id || typeof user_id !== 'string') {
            return res.status(400).json({ error: 'org_id and user_id are required' });
          }

          // Verify user belongs to the organization
          const { data: membership, error: membershipError } = await supabase
            .from('org_members')
            .select('id')
            .eq('org_id', org_id)
            .eq('user_id', user.id)
            .maybeSingle();

          if (membershipError || !membership) {
            return res.status(403).json({ error: 'Forbidden - User is not a member of this organization' });
          }

          // Verify user is deleting their own data
          if (user_id !== user.id) {
            return res.status(403).json({ error: 'Forbidden - Cannot delete another user\'s data' });
          }

          const { error } = await supabase
            .from('recent_searches')
            .delete()
            .eq('org_id', org_id)
            .eq('user_id', user_id);

          if (error) {
            console.error('Error clearing recent searches:', error);
            return res.status(500).json({ error: 'Failed to clear recent searches' });
          }

          return res.status(200).json({ message: 'Recent searches cleared' });
        } else {
          if (!id || typeof id !== 'string') {
            return res.status(400).json({ error: 'id is required' });
          }

          const { error } = await supabase
            .from('recent_searches')
            .delete()
            .eq('id', id);

          if (error) {
            console.error('Error deleting recent search:', error);
            return res.status(500).json({ error: 'Failed to delete recent search' });
          }

          return res.status(200).json({ message: 'Recent search deleted' });
        }
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in recent searches API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
