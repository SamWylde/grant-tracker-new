import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Create Supabase client with user's token
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

  try {
    // GET - List all alerts for user's org
    if (req.method === 'GET') {
      const { org_id } = req.query;

      if (!org_id || typeof org_id !== 'string') {
        return res.status(400).json({ error: 'org_id is required' });
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

      const { data: alerts, error } = await supabase
        .from('grant_alerts')
        .select('*')
        .eq('org_id', org_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return res.status(200).json({ alerts });
    }

    // POST - Create new alert
    if (req.method === 'POST') {
      const {
        org_id,
        name,
        description,
        keyword,
        category,
        agency,
        status_posted,
        status_forecasted,
        due_in_days,
        min_amount,
        max_amount,
        frequency,
        notify_email,
        notify_in_app,
        notify_webhook,
        webhook_url,
      } = req.body;

      if (!org_id || !name) {
        return res.status(400).json({ error: 'org_id and name are required' });
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

      const { data: alert, error } = await supabase
        .from('grant_alerts')
        .insert({
          org_id,
          user_id: user.id,
          name,
          description,
          keyword,
          category,
          agency,
          status_posted,
          status_forecasted,
          due_in_days,
          min_amount,
          max_amount,
          frequency: frequency || 'daily',
          notify_email: notify_email !== false,
          notify_in_app: notify_in_app !== false,
          notify_webhook: notify_webhook || false,
          webhook_url,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({ alert });
    }

    // PUT - Update alert
    if (req.method === 'PUT') {
      const { alert_id } = req.query;
      const updates = req.body;

      if (!alert_id || typeof alert_id !== 'string') {
        return res.status(400).json({ error: 'alert_id is required' });
      }

      // Verify user owns this alert and belongs to org
      const { data: existingAlert, error: fetchError } = await supabase
        .from('grant_alerts')
        .select('user_id, org_id')
        .eq('id', alert_id)
        .single();

      if (fetchError) throw fetchError;

      if (existingAlert.user_id !== user.id) {
        return res.status(403).json({ error: 'Forbidden: You do not own this alert' });
      }

      // Verify user belongs to the organization
      const { data: membership, error: membershipError } = await supabase
        .from('org_members')
        .select('id')
        .eq('org_id', existingAlert.org_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (membershipError || !membership) {
        return res.status(403).json({ error: 'Forbidden - User is not a member of this organization' });
      }

      const { data: alert, error } = await supabase
        .from('grant_alerts')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', alert_id)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ alert });
    }

    // DELETE - Delete alert
    if (req.method === 'DELETE') {
      const { alert_id } = req.query;

      if (!alert_id || typeof alert_id !== 'string') {
        return res.status(400).json({ error: 'alert_id is required' });
      }

      // Verify user owns this alert and belongs to org
      const { data: existingAlert, error: fetchError } = await supabase
        .from('grant_alerts')
        .select('user_id, org_id')
        .eq('id', alert_id)
        .single();

      if (fetchError) throw fetchError;

      if (existingAlert.user_id !== user.id) {
        return res.status(403).json({ error: 'Forbidden: You do not own this alert' });
      }

      // Verify user belongs to the organization
      const { data: membership, error: membershipError } = await supabase
        .from('org_members')
        .select('id')
        .eq('org_id', existingAlert.org_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (membershipError || !membership) {
        return res.status(403).json({ error: 'Forbidden - User is not a member of this organization' });
      }

      const { error } = await supabase.from('grant_alerts').delete().eq('id', alert_id);

      if (error) throw error;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in alerts API:', error);
    // Import sanitizeError from error-handler
    const { sanitizeError } = await import('../utils/error-handler.js');
    return res.status(500).json({
      error: sanitizeError(error, 'processing request'),
    });
  }
}
