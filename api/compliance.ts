import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    // GET - List compliance requirements
    if (req.method === 'GET') {
      const { grant_id, org_id } = req.query;

      if (!grant_id && !org_id) {
        return res.status(400).json({ error: 'grant_id or org_id is required' });
      }

      let query = supabase.from('compliance_requirements').select('*');

      if (grant_id) {
        query = query.eq('grant_id', grant_id);
      }

      if (org_id) {
        // Verify access
        const { data: membership } = await supabase
          .from('org_members')
          .select('id')
          .eq('org_id', org_id as string)
          .eq('user_id', user.id)
          .single();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied' });
        }

        query = query.eq('org_id', org_id);
      }

      const { data: requirements, error } = await query.order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;

      // Also get summary if grant_id is provided
      let summary = null;
      if (grant_id) {
        const { data: summaryData } = await supabase
          .from('grant_compliance_summary')
          .select('*')
          .eq('grant_id', grant_id)
          .single();

        summary = summaryData;
      }

      return res.status(200).json({
        requirements: requirements || [],
        summary,
      });
    }

    // POST - Create compliance requirement
    if (req.method === 'POST') {
      const data = req.body;

      if (!data.grant_id || !data.org_id || !data.requirement_type || !data.title) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Verify access
      const { data: membership } = await supabase
        .from('org_members')
        .select('id')
        .eq('org_id', data.org_id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { data: requirement, error } = await supabase
        .from('compliance_requirements')
        .insert({
          grant_id: data.grant_id,
          org_id: data.org_id,
          requirement_type: data.requirement_type,
          title: data.title,
          description: data.description,
          regulation_reference: data.regulation_reference,
          policy_url: data.policy_url,
          due_date: data.due_date,
          reminder_days_before: data.reminder_days_before || 30,
          documentation_required: data.documentation_required || false,
          is_critical: data.is_critical || false,
          notes: data.notes,
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({ requirement });
    }

    // PATCH - Update compliance requirement
    if (req.method === 'PATCH') {
      const { requirement_id } = req.query;
      const updates = req.body;

      if (!requirement_id || typeof requirement_id !== 'string') {
        return res.status(400).json({ error: 'requirement_id is required' });
      }

      // Verify access
      const { data: requirement } = await supabase
        .from('compliance_requirements')
        .select('org_id, completed')
        .eq('id', requirement_id)
        .single();

      if (!requirement) {
        return res.status(404).json({ error: 'Compliance requirement not found' });
      }

      const { data: membership } = await supabase
        .from('org_members')
        .select('id')
        .eq('org_id', requirement.org_id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // If marking as completed, set completion fields
      if (updates.completed && !requirement.completed) {
        updates.completed_by = user.id;
        updates.completed_at = new Date().toISOString();
        updates.status = 'completed';
      } else if (updates.completed === false && requirement.completed) {
        // Unmarking completion
        updates.completed_by = null;
        updates.completed_at = null;
        updates.status = 'in_progress';
      }

      const { data: updatedRequirement, error } = await supabase
        .from('compliance_requirements')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requirement_id)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ requirement: updatedRequirement });
    }

    // DELETE - Delete compliance requirement
    if (req.method === 'DELETE') {
      const { requirement_id } = req.query;

      if (!requirement_id || typeof requirement_id !== 'string') {
        return res.status(400).json({ error: 'requirement_id is required' });
      }

      // Verify access
      const { data: requirement } = await supabase
        .from('compliance_requirements')
        .select('org_id')
        .eq('id', requirement_id)
        .single();

      if (!requirement) {
        return res.status(404).json({ error: 'Compliance requirement not found' });
      }

      const { data: membership } = await supabase
        .from('org_members')
        .select('id')
        .eq('org_id', requirement.org_id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { error } = await supabase
        .from('compliance_requirements')
        .delete()
        .eq('id', requirement_id);

      if (error) throw error;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in compliance API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
