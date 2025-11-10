import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Use server-side environment variables (not VITE_ prefixed)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get user from auth header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // GET - List integrations
  if (req.method === 'GET') {
    const { org_id } = req.query;

    if (!org_id || typeof org_id !== 'string') {
      return res.status(400).json({ error: 'org_id is required' });
    }

    // Check if user is member of org
    const { data: membership } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', org_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this organization' });
    }

    const { data: integrations, error } = await supabase
      .from('integrations')
      .select('id, org_id, integration_type, channel_name, webhook_url, is_active, connected_at, connected_by')
      .eq('org_id', org_id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ integrations });
  }

  // POST - Create/update integration
  if (req.method === 'POST') {
    const { org_id, integration_type, webhook_url, channel_name, settings } = req.body;

    if (!org_id || !integration_type) {
      return res.status(400).json({ error: 'org_id and integration_type are required' });
    }

    // Check if user is admin
    const { data: membership } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', org_id)
      .eq('user_id', user.id)
      .single();

    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // For Teams, validate webhook URL
    if (integration_type === 'microsoft_teams' && webhook_url) {
      try {
        const url = new URL(webhook_url);
        if (!url.hostname.includes('webhook.office.com')) {
          return res.status(400).json({ error: 'Invalid Teams webhook URL' });
        }
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
      }
    }

    // Upsert integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .upsert({
        org_id,
        integration_type,
        webhook_url: webhook_url || null,
        channel_name: channel_name || null,
        settings: settings || {},
        connected_by: user.id,
        connected_at: new Date().toISOString(),
        is_active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'org_id,integration_type'
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ integration });
  }

  // DELETE - Disconnect integration
  if (req.method === 'DELETE') {
    const { org_id, integration_type } = req.query;

    if (!org_id || !integration_type || typeof org_id !== 'string' || typeof integration_type !== 'string') {
      return res.status(400).json({ error: 'org_id and integration_type are required' });
    }

    // Check if user is admin
    const { data: membership } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', org_id)
      .eq('user_id', user.id)
      .single();

    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { error } = await supabase
      .from('integrations')
      .delete()
      .eq('org_id', org_id)
      .eq('integration_type', integration_type);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
