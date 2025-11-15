import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { setCorsHeaders } from './utils/cors.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set secure CORS headers based on whitelisted origins
  setCorsHeaders(res, req.headers.origin);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
    // GET - Get budget for a grant
    if (req.method === 'GET') {
      const { grant_id, org_id, budget_id } = req.query;

      if (budget_id && typeof budget_id === 'string') {
        // Get specific budget with line items
        const { data: budget, error: budgetError } = await supabase
          .from('grant_budgets')
          .select(`
            *,
            budget_line_items (*),
            disbursements (*)
          `)
          .eq('id', budget_id)
          .single();

        if (budgetError) throw budgetError;

        if (!budget) {
          return res.status(404).json({ error: 'Budget not found' });
        }

        // Verify access
        const { data: membership } = await supabase
          .from('org_members')
          .select('id')
          .eq('org_id', budget.org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied' });
        }

        // Get budget summary separately (it's a view, not a table)
        const { data: summary } = await supabase
          .from('grant_budget_summary')
          .select('*')
          .eq('budget_id', budget_id)
          .single();

        return res.status(200).json({ budget: { ...budget, summary } });
      }

      if (grant_id && typeof grant_id === 'string') {
        // Get budget for a specific grant
        const { data: budget, error: budgetError } = await supabase
          .from('grant_budgets')
          .select(`
            *,
            budget_line_items (*)
          `)
          .eq('grant_id', grant_id)
          .maybeSingle();

        if (budgetError) throw budgetError;

        if (budget) {
          // Verify access
          const { data: membership } = await supabase
            .from('org_members')
            .select('id')
            .eq('org_id', budget.org_id)
            .eq('user_id', user.id)
            .single();

          if (!membership) {
            return res.status(403).json({ error: 'Access denied' });
          }

          // Get budget summary separately (it's a view, not a table)
          const { data: summary } = await supabase
            .from('grant_budget_summary')
            .select('*')
            .eq('budget_id', budget.id)
            .single();

          return res.status(200).json({ budget: { ...budget, summary } });
        }

        return res.status(200).json({ budget: null });
      }

      if (org_id && typeof org_id === 'string') {
        // List all budgets for org
        const { data: membership } = await supabase
          .from('org_members')
          .select('id')
          .eq('org_id', org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied' });
        }

        const { data: budgets, error } = await supabase
          .from('grant_budgets')
          .select(`
            *,
            org_grants_saved!inner (title, external_id)
          `)
          .eq('org_id', org_id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Get summaries for all budgets
        if (budgets && budgets.length > 0) {
          const budgetIds = budgets.map(b => b.id);
          const { data: summaries } = await supabase
            .from('grant_budget_summary')
            .select('*')
            .in('budget_id', budgetIds);

          // Merge summaries into budgets
          const budgetsWithSummaries = budgets.map(budget => {
            const summary = summaries?.find(s => s.budget_id === budget.id);
            return { ...budget, summary };
          });

          return res.status(200).json({ budgets: budgetsWithSummaries });
        }

        return res.status(200).json({ budgets: budgets || [] });
      }

      return res.status(400).json({ error: 'grant_id, org_id, or budget_id is required' });
    }

    // POST - Create a new budget
    if (req.method === 'POST') {
      const budgetData = req.body;

      if (!budgetData.grant_id || !budgetData.org_id) {
        return res.status(400).json({ error: 'grant_id and org_id are required' });
      }

      // Verify access
      const { data: membership } = await supabase
        .from('org_members')
        .select('id')
        .eq('org_id', budgetData.org_id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { data: budget, error } = await supabase
        .from('grant_budgets')
        .insert({
          grant_id: budgetData.grant_id,
          org_id: budgetData.org_id,
          proposed_amount: budgetData.proposed_amount || 0,
          awarded_amount: budgetData.awarded_amount || 0,
          match_required: budgetData.match_required || false,
          match_amount: budgetData.match_amount || 0,
          budget_period_start: budgetData.budget_period_start,
          budget_period_end: budgetData.budget_period_end,
          status: budgetData.status || 'draft',
          notes: budgetData.notes,
        })
        .select()
        .single();

      if (error) throw error;

      // Create line items if provided
      if (budgetData.line_items && Array.isArray(budgetData.line_items)) {
        const lineItems = budgetData.line_items.map((item: any) => ({
          budget_id: budget.id,
          org_id: budgetData.org_id,
          category: item.category,
          description: item.description,
          line_number: item.line_number,
          proposed_amount: item.proposed_amount || 0,
          awarded_amount: item.awarded_amount || 0,
        }));

        await supabase.from('budget_line_items').insert(lineItems);
      }

      return res.status(201).json({ budget });
    }

    // PATCH - Update a budget
    if (req.method === 'PATCH') {
      const { budget_id } = req.query;
      const updates = req.body;

      if (!budget_id || typeof budget_id !== 'string') {
        return res.status(400).json({ error: 'budget_id is required' });
      }

      // Verify access
      const { data: budget } = await supabase
        .from('grant_budgets')
        .select('org_id')
        .eq('id', budget_id)
        .single();

      if (!budget) {
        return res.status(404).json({ error: 'Budget not found' });
      }

      const { data: membership } = await supabase
        .from('org_members')
        .select('id')
        .eq('org_id', budget.org_id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { data: updatedBudget, error } = await supabase
        .from('grant_budgets')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', budget_id)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ budget: updatedBudget });
    }

    // DELETE - Delete a budget
    if (req.method === 'DELETE') {
      const { budget_id } = req.query;

      if (!budget_id || typeof budget_id !== 'string') {
        return res.status(400).json({ error: 'budget_id is required' });
      }

      // Verify access
      const { data: budget } = await supabase
        .from('grant_budgets')
        .select('org_id')
        .eq('id', budget_id)
        .single();

      if (!budget) {
        return res.status(404).json({ error: 'Budget not found' });
      }

      const { data: membership } = await supabase
        .from('org_members')
        .select('id')
        .eq('org_id', budget.org_id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { error } = await supabase
        .from('grant_budgets')
        .delete()
        .eq('id', budget_id);

      if (error) throw error;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in budgets API:', error);
    // Import sanitizeError from error-handler
    const { sanitizeError } = await import('../utils/error-handler.js');
    return res.status(500).json({
      error: sanitizeError(error, 'processing request'),
    });
  }
}
