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
    // GET - List disbursements for a budget
    if (req.method === 'GET') {
      const { budget_id, org_id } = req.query;

      if (!budget_id && !org_id) {
        return res.status(400).json({ error: 'budget_id or org_id is required' });
      }

      let query = supabase
        .from('disbursements')
        .select('*, budget_line_items(description, category)');

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

      const { data: disbursements, error } = await query.order('disbursement_date', { ascending: false });

      if (error) throw error;

      return res.status(200).json({ disbursements: disbursements || [] });
    }

    // POST - Create a new disbursement
    if (req.method === 'POST') {
      const data = req.body;

      if (!data.budget_id || !data.org_id || !data.amount || !data.disbursement_date || !data.disbursement_type) {
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

      const { data: disbursement, error } = await supabase
        .from('disbursements')
        .insert({
          budget_id: data.budget_id,
          org_id: data.org_id,
          disbursement_type: data.disbursement_type,
          amount: data.amount,
          disbursement_date: data.disbursement_date,
          category: data.category,
          line_item_id: data.line_item_id,
          payment_method: data.payment_method,
          reference_number: data.reference_number,
          vendor_payee: data.vendor_payee,
          description: data.description,
          receipt_url: data.receipt_url,
          notes: data.notes,
          approved: data.approved || false,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({ disbursement });
    }

    // PATCH - Update disbursement
    if (req.method === 'PATCH') {
      const { disbursement_id } = req.query;
      const updates = req.body;

      if (!disbursement_id || typeof disbursement_id !== 'string') {
        return res.status(400).json({ error: 'disbursement_id is required' });
      }

      // Verify access
      const { data: disbursement } = await supabase
        .from('disbursements')
        .select('org_id')
        .eq('id', disbursement_id)
        .single();

      if (!disbursement) {
        return res.status(404).json({ error: 'Disbursement not found' });
      }

      const { data: membership } = await supabase
        .from('org_members')
        .select('id')
        .eq('org_id', disbursement.org_id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Handle approval
      if (updates.approved && !disbursement.approved) {
        updates.approved_by = user.id;
        updates.approved_at = new Date().toISOString();
      }

      const { data: updatedDisbursement, error } = await supabase
        .from('disbursements')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', disbursement_id)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ disbursement: updatedDisbursement });
    }

    // DELETE - Delete disbursement
    if (req.method === 'DELETE') {
      const { disbursement_id } = req.query;

      if (!disbursement_id || typeof disbursement_id !== 'string') {
        return res.status(400).json({ error: 'disbursement_id is required' });
      }

      // Verify access
      const { data: disbursement } = await supabase
        .from('disbursements')
        .select('org_id')
        .eq('id', disbursement_id)
        .single();

      if (!disbursement) {
        return res.status(404).json({ error: 'Disbursement not found' });
      }

      const { data: membership } = await supabase
        .from('org_members')
        .select('id')
        .eq('org_id', disbursement.org_id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { error } = await supabase
        .from('disbursements')
        .delete()
        .eq('id', disbursement_id);

      if (error) throw error;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in disbursements API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
