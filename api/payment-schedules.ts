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
    // GET - List payment schedules
    if (req.method === 'GET') {
      const { budget_id, org_id, upcoming } = req.query;

      if (!budget_id && !org_id) {
        return res.status(400).json({ error: 'budget_id or org_id is required' });
      }

      let query = supabase.from('payment_schedules').select('*');

      if (budget_id) {
        query = query.eq('budget_id', budget_id);
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

      // Filter for upcoming payments
      if (upcoming === 'true') {
        query = query
          .eq('received', false)
          .gte('expected_date', new Date().toISOString().split('T')[0])
          .lte('expected_date', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      }

      const { data: schedules, error } = await query.order('expected_date', { ascending: true });

      if (error) throw error;

      return res.status(200).json({ payment_schedules: schedules || [] });
    }

    // POST - Create payment schedule
    if (req.method === 'POST') {
      const data = req.body;

      if (!data.budget_id || !data.org_id || !data.payment_name || !data.expected_amount || !data.expected_date) {
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

      const { data: schedule, error } = await supabase
        .from('payment_schedules')
        .insert({
          budget_id: data.budget_id,
          org_id: data.org_id,
          payment_name: data.payment_name,
          payment_type: data.payment_type || 'reimbursement',
          expected_amount: data.expected_amount,
          expected_date: data.expected_date,
          deliverable_required: data.deliverable_required,
          report_required: data.report_required,
          report_due_date: data.report_due_date,
          notes: data.notes,
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({ payment_schedule: schedule });
    }

    // PATCH - Update payment schedule
    if (req.method === 'PATCH') {
      const { schedule_id } = req.query;
      const updates = req.body;

      if (!schedule_id || typeof schedule_id !== 'string') {
        return res.status(400).json({ error: 'schedule_id is required' });
      }

      // Verify access
      const { data: schedule } = await supabase
        .from('payment_schedules')
        .select('org_id, received')
        .eq('id', schedule_id)
        .single();

      if (!schedule) {
        return res.status(404).json({ error: 'Payment schedule not found' });
      }

      const { data: membership } = await supabase
        .from('org_members')
        .select('id')
        .eq('org_id', schedule.org_id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // If marking as received, set status
      if (updates.received && !schedule.received) {
        updates.status = 'received';
        if (!updates.actual_date) {
          updates.actual_date = new Date().toISOString().split('T')[0];
        }
      }

      const { data: updatedSchedule, error } = await supabase
        .from('payment_schedules')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', schedule_id)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ payment_schedule: updatedSchedule });
    }

    // DELETE - Delete payment schedule
    if (req.method === 'DELETE') {
      const { schedule_id } = req.query;

      if (!schedule_id || typeof schedule_id !== 'string') {
        return res.status(400).json({ error: 'schedule_id is required' });
      }

      // Verify access
      const { data: schedule } = await supabase
        .from('payment_schedules')
        .select('org_id')
        .eq('id', schedule_id)
        .single();

      if (!schedule) {
        return res.status(404).json({ error: 'Payment schedule not found' });
      }

      const { data: membership } = await supabase
        .from('org_members')
        .select('id')
        .eq('org_id', schedule.org_id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { error } = await supabase
        .from('payment_schedules')
        .delete()
        .eq('id', schedule_id);

      if (error) throw error;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in payment schedules API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
