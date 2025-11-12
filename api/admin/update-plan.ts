import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  // Verify user is authenticated
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // SECURITY: Verify user is an admin in at least one organization
  const { data: adminMembership, error: membershipError } = await supabase
    .from('org_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error('Error checking admin status:', membershipError);
    return res.status(500).json({ error: 'Failed to verify admin status' });
  }

  if (!adminMembership) {
    return res.status(403).json({
      error: 'Admin access required',
      message: 'This endpoint is restricted to admin users only'
    });
  }

  try {
    const { org_id, plan_name, plan_status } = req.body;

    // Validate input
    if (!org_id || !plan_name || !plan_status) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'org_id, plan_name, and plan_status are required'
      });
    }

    // Validate plan_name
    const validPlans = ['free', 'starter', 'professional', 'enterprise'];
    if (!validPlans.includes(plan_name)) {
      return res.status(400).json({
        error: 'Invalid plan_name',
        message: `plan_name must be one of: ${validPlans.join(', ')}`
      });
    }

    // Validate plan_status
    const validStatuses = ['active', 'trialing', 'past_due', 'canceled', 'suspended'];
    if (!validStatuses.includes(plan_status)) {
      return res.status(400).json({
        error: 'Invalid plan_status',
        message: `plan_status must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Update organization settings
    const { data, error } = await supabase
      .from('organization_settings')
      .update({
        plan_name,
        plan_status,
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', org_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating organization settings:', error);
      throw error;
    }

    console.log(`[Admin] User ${user.id} updated plan for org ${org_id}: ${plan_name} (${plan_status})`);

    return res.status(200).json({
      success: true,
      message: 'Organization plan updated successfully',
      data,
    });
  } catch (error) {
    console.error('Error updating organization plan:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
