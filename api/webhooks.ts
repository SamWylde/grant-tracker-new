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

  // GET - List webhooks
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

    const { data: webhooks, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('org_id', org_id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ webhooks });
  }

  // POST - Create webhook
  if (req.method === 'POST') {
    const { org_id, name, url, secret, events } = req.body;

    if (!org_id || !name || !url) {
      return res.status(400).json({ error: 'org_id, name, and url are required' });
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

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const { data: webhook, error } = await supabase
      .from('webhooks')
      .insert({
        org_id,
        name,
        url,
        secret: secret || null,
        events: events || ['grant.saved', 'grant.deadline_approaching'],
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ webhook });
  }

  // PATCH - Update webhook
  if (req.method === 'PATCH') {
    const { id } = req.query;
    const { name, url, secret, events, is_active } = req.body;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'webhook id is required' });
    }

    // Get webhook to check org_id
    const { data: webhook } = await supabase
      .from('webhooks')
      .select('org_id')
      .eq('id', id)
      .single();

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Check if user is admin
    const { data: membership } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', webhook.org_id)
      .eq('user_id', user.id)
      .single();

    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const updates: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (url !== undefined) {
      try {
        new URL(url);
        updates.url = url;
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
      }
    }
    if (secret !== undefined) updates.secret = secret;
    if (events !== undefined) updates.events = events;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data: updated, error } = await supabase
      .from('webhooks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ webhook: updated });
  }

  // DELETE - Delete webhook
  if (req.method === 'DELETE') {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'webhook id is required' });
    }

    // Get webhook to check org_id
    const { data: webhook } = await supabase
      .from('webhooks')
      .select('org_id')
      .eq('id', id)
      .single();

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Check if user is admin
    const { data: membership } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', webhook.org_id)
      .eq('user_id', user.id)
      .single();

    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { error } = await supabase
      .from('webhooks')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
